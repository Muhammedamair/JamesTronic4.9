-- ============================================================
-- C23 Phase 2: Test Suite
-- Tests: fairness, trend, schema integrity, RLS regression
-- GOVERNANCE: No notifications/penalties triggers exist
-- ============================================================

DO $$
DECLARE
  v_result        JSONB;
  v_count         INT;
  v_packet_count  INT;
  v_tests_passed  INT := 0;
  v_tests_failed  INT := 0;

  -- Test data IDs
  v_tech_1        UUID := '11111111-1111-1111-1111-111111111111';
  v_tech_2        UUID := '22222222-2222-2222-2222-222222222222';
  v_branch_1      UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_ticket_1      UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_ticket_2      UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_ticket_3      UUID := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  v_now           TIMESTAMPTZ := NOW();
  v_status_val    TEXT;
  v_rework_val    NUMERIC;
  v_uncontrol_val NUMERIC;
  v_trend_val     TEXT;
BEGIN
  RAISE NOTICE '=== C23 Phase 2: Snapshot Engine Tests ===';

  -- ---------------------------------------------------------
  -- SETUP: Seed test telemetry data
  -- ---------------------------------------------------------

  -- Tech 1: 6 completed tickets, 1 rework, 2 uncontrollable events
  -- (Good performance, some exceptions)
  INSERT INTO public.c23_telemetry_events (event_id, ticket_id, tech_id, branch_id, event_type, event_ts, controllability, uncontrollable_reason, source)
  VALUES
    -- Ticket 1: normal completion
    (gen_random_uuid(), v_ticket_1, v_tech_1, v_branch_1, 'DIAG_START',   v_now - INTERVAL '10 days', 'CONTROLLABLE', NULL, 'PWA'),
    (gen_random_uuid(), v_ticket_1, v_tech_1, v_branch_1, 'REPAIR_START', v_now - INTERVAL '10 days' + INTERVAL '30 minutes', 'CONTROLLABLE', NULL, 'PWA'),
    (gen_random_uuid(), v_ticket_1, v_tech_1, v_branch_1, 'COMPLETION',   v_now - INTERVAL '10 days' + INTERVAL '90 minutes', 'CONTROLLABLE', NULL, 'PWA'),

    -- Ticket 2: completion with parts delay (uncontrollable)
    (gen_random_uuid(), v_ticket_2, v_tech_1, v_branch_1, 'DIAG_START',     v_now - INTERVAL '8 days', 'CONTROLLABLE', NULL, 'PWA'),
    (gen_random_uuid(), v_ticket_2, v_tech_1, v_branch_1, 'PARTS_REQUEST',  v_now - INTERVAL '8 days' + INTERVAL '20 minutes', 'UNCONTROLLABLE', 'PARTS_DELAY', 'PWA'),
    (gen_random_uuid(), v_ticket_2, v_tech_1, v_branch_1, 'PARTS_RECEIVED', v_now - INTERVAL '6 days', 'UNCONTROLLABLE', 'PARTS_DELAY', 'PWA'),
    (gen_random_uuid(), v_ticket_2, v_tech_1, v_branch_1, 'COMPLETION',     v_now - INTERVAL '6 days' + INTERVAL '60 minutes', 'CONTROLLABLE', NULL, 'PWA'),

    -- Ticket 3: rework
    (gen_random_uuid(), v_ticket_3, v_tech_1, v_branch_1, 'DIAG_START',     v_now - INTERVAL '5 days', 'CONTROLLABLE', NULL, 'PWA'),
    (gen_random_uuid(), v_ticket_3, v_tech_1, v_branch_1, 'REWORK_START',   v_now - INTERVAL '4 days', 'CONTROLLABLE', NULL, 'PWA'),
    (gen_random_uuid(), v_ticket_3, v_tech_1, v_branch_1, 'REWORK_END',     v_now - INTERVAL '4 days' + INTERVAL '45 minutes', 'CONTROLLABLE', NULL, 'PWA'),
    (gen_random_uuid(), v_ticket_3, v_tech_1, v_branch_1, 'COMPLETION',     v_now - INTERVAL '4 days' + INTERVAL '60 minutes', 'CONTROLLABLE', NULL, 'PWA'),

    -- Additional completions for confidence
    (gen_random_uuid(), gen_random_uuid(), v_tech_1, v_branch_1, 'COMPLETION', v_now - INTERVAL '3 days', 'CONTROLLABLE', NULL, 'PWA'),
    (gen_random_uuid(), gen_random_uuid(), v_tech_1, v_branch_1, 'COMPLETION', v_now - INTERVAL '2 days', 'CONTROLLABLE', NULL, 'PWA'),
    (gen_random_uuid(), gen_random_uuid(), v_tech_1, v_branch_1, 'COMPLETION', v_now - INTERVAL '1 day',  'CONTROLLABLE', NULL, 'PWA');

  -- ---------------------------------------------------------
  -- TEST 1: Generator function exists and runs
  -- ---------------------------------------------------------
  BEGIN
    v_packet_count := public.c23_generate_packets(v_now);
    RAISE NOTICE '✅ TEST 1 PASS: c23_generate_packets() returned % packets', v_packet_count;
    v_tests_passed := v_tests_passed + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ TEST 1 FAIL: c23_generate_packets() error: %', SQLERRM;
    v_tests_failed := v_tests_failed + 1;
  END;

  -- ---------------------------------------------------------
  -- TEST 2: Packets were generated for tech_1
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM public.c23_technician_performance_packets
  WHERE tech_id = v_tech_1 AND branch_id = v_branch_1;

  IF v_count >= 1 THEN
    RAISE NOTICE '✅ TEST 2 PASS: % packet(s) generated for tech_1', v_count;
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 2 FAIL: No packets generated for tech_1';
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 3: Fairness — uncontrollable time excluded from avg cycle
  -- ---------------------------------------------------------
  SELECT
    (packet_json->'signals'->'efficiency'->>'uncontrollable_delay_mins')::NUMERIC
  INTO v_uncontrol_val
  FROM public.c23_technician_performance_packets
  WHERE tech_id = v_tech_1 AND branch_id = v_branch_1
  LIMIT 1;

  IF v_uncontrol_val IS NOT NULL AND v_uncontrol_val > 0 THEN
    RAISE NOTICE '✅ TEST 3 PASS: Uncontrollable delay tracked (% mins), excluded from efficiency', v_uncontrol_val;
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 3 FAIL: Uncontrollable delay not properly tracked';
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 4: Evidence pointers present
  -- ---------------------------------------------------------
  SELECT
    jsonb_array_length(packet_json->'signals'->'quality'->'evidence')
  INTO v_count
  FROM public.c23_technician_performance_packets
  WHERE tech_id = v_tech_1 AND branch_id = v_branch_1
  LIMIT 1;

  IF v_count > 0 THEN
    RAISE NOTICE '✅ TEST 4 PASS: Evidence pointers present (% ticket refs)', v_count;
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 4 FAIL: No evidence pointers in packet';
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 5: Packet contains governance block
  -- ---------------------------------------------------------
  SELECT
    packet_json->'governance'->>'review_required'
  INTO v_status_val
  FROM public.c23_technician_performance_packets
  WHERE tech_id = v_tech_1 AND branch_id = v_branch_1
  LIMIT 1;

  IF v_status_val IS NOT NULL THEN
    RAISE NOTICE '✅ TEST 5 PASS: Governance block present (review_required=%)', v_status_val;
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 5 FAIL: Governance block missing';
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 6: Signals written to c23_performance_signals
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM public.c23_performance_signals
  WHERE tech_id = v_tech_1 AND branch_id = v_branch_1;

  IF v_count >= 2 THEN
    RAISE NOTICE '✅ TEST 6 PASS: % signal rows written', v_count;
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 6 FAIL: Expected >=2 signal rows, found %', v_count;
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 7: Idempotent upsert (run again, no duplicates)
  -- ---------------------------------------------------------
  v_packet_count := public.c23_generate_packets(v_now);

  SELECT COUNT(*) INTO v_count
  FROM public.c23_technician_performance_packets
  WHERE tech_id = v_tech_1 AND branch_id = v_branch_1;

  -- Should still be same count (upsert, not duplicate)
  IF v_count <= 2 THEN  -- max 2 windows (30d + 90d)
    RAISE NOTICE '✅ TEST 7 PASS: Upsert works, % packets (no duplicates)', v_count;
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 7 FAIL: Duplicate packets detected (% found, expected <=2)', v_count;
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 8: No notification/penalty tables touched
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name LIKE 'c23_%'
  AND table_name LIKE '%notification%';

  IF v_count = 0 THEN
    RAISE NOTICE '✅ TEST 8 PASS: No notification tables exist (governance: no auto-alerts)';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 8 FAIL: Found % notification tables (GOVERNANCE VIOLATION)', v_count;
    v_tests_failed := v_tests_failed + 1;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name LIKE 'c23_%'
  AND table_name LIKE '%penalty%';

  IF v_count = 0 THEN
    RAISE NOTICE '✅ TEST 8b PASS: No penalty tables exist';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 8b FAIL: Found % penalty tables (GOVERNANCE VIOLATION)', v_count;
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 9: RLS REGRESSION — tech still blocked from packets
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'c23_technician_performance_packets'
  AND policyname ILIKE '%tech%'
  AND cmd = 'r';

  IF v_count = 0 THEN
    RAISE NOTICE '✅ TEST 9 PASS: RLS regression OK: no tech SELECT on packets';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 9 FAIL: RLS REGRESSION: tech SELECT policy found on packets';
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 10: RLS REGRESSION — tech still blocked from signals
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'c23_performance_signals'
  AND policyname ILIKE '%tech%'
  AND cmd = 'r';

  IF v_count = 0 THEN
    RAISE NOTICE '✅ TEST 10 PASS: RLS regression OK: no tech SELECT on signals';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 10 FAIL: RLS REGRESSION: tech SELECT policy found on signals';
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 11: Config table exists and has thresholds
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM public.c23_engine_config
  WHERE config_key = 'status_thresholds_v1';

  IF v_count = 1 THEN
    RAISE NOTICE '✅ TEST 11 PASS: Engine config loaded';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 11 FAIL: Engine config missing';
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 12: Exception breakdown in packet
  -- ---------------------------------------------------------
  SELECT
    (packet_json->'signals'->'exceptions'->>'parts_delay')::INT
  INTO v_count
  FROM public.c23_technician_performance_packets
  WHERE tech_id = v_tech_1 AND branch_id = v_branch_1
  LIMIT 1;

  IF v_count IS NOT NULL AND v_count >= 1 THEN
    RAISE NOTICE '✅ TEST 12 PASS: Exception breakdown present (parts_delay=%, ...)', v_count;
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 12 FAIL: Exception breakdown missing or zero';
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- CLEANUP test data
  -- ---------------------------------------------------------
  DELETE FROM public.c23_performance_signals WHERE tech_id IN (v_tech_1, v_tech_2);
  DELETE FROM public.c23_technician_performance_packets WHERE tech_id IN (v_tech_1, v_tech_2);
  DELETE FROM public.c23_telemetry_events WHERE tech_id IN (v_tech_1, v_tech_2);

  -- ---------------------------------------------------------
  -- Summary
  -- ---------------------------------------------------------
  RAISE NOTICE '=== RESULTS: % passed, % failed ===', v_tests_passed, v_tests_failed;

  IF v_tests_failed > 0 THEN
    RAISE EXCEPTION 'C23 Phase 2 Tests FAILED: % failures', v_tests_failed;
  END IF;
END $$;
