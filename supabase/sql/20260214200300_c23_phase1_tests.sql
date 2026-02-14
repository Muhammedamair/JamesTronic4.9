-- ============================================================
-- C23 Phase 1: Automated RLS & Idempotency Tests
-- Run as: psql -f this_file.sql
-- Expected: All tests PASS. Any FAIL = blocking.
-- ============================================================

-- Test harness
DO $$
DECLARE
  v_result JSONB;
  v_count  INTEGER;
  v_tests_passed INTEGER := 0;
  v_tests_failed INTEGER := 0;
BEGIN
  RAISE NOTICE '=== C23 Phase 1: RLS & Idempotency Tests ===';

  -- ---------------------------------------------------------
  -- TEST 1: Tables exist
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'c23_telemetry_events',
    'c23_technician_performance_packets',
    'c23_performance_signals',
    'c23_coaching_tasks'
  );

  IF v_count = 4 THEN
    RAISE NOTICE '✅ TEST 1 PASS: All 4 C23 tables exist';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 1 FAIL: Expected 4 tables, found %', v_count;
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 2: RLS is enabled on all C23 tables
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename IN (
    'c23_telemetry_events',
    'c23_technician_performance_packets',
    'c23_performance_signals',
    'c23_coaching_tasks'
  )
  AND rowsecurity = true;

  IF v_count = 4 THEN
    RAISE NOTICE '✅ TEST 2 PASS: RLS enabled on all 4 tables';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 2 FAIL: RLS not enabled on all tables (% of 4)', v_count;
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 3: Enums exist
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM pg_type
  WHERE typname IN (
    'c23_event_type',
    'c23_controllability',
    'c23_uncontrollable_reason',
    'c23_event_source',
    'c23_signal_type',
    'c23_perf_status',
    'c23_perf_trend',
    'c23_review_state',
    'c23_coaching_status'
  );

  IF v_count = 9 THEN
    RAISE NOTICE '✅ TEST 3 PASS: All 9 C23 enums exist';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 3 FAIL: Expected 9 enums, found %', v_count;
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 4: Ingestion RPC exists
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM pg_proc
  WHERE proname = 'c23_ingest_telemetry_event';

  IF v_count >= 1 THEN
    RAISE NOTICE '✅ TEST 4 PASS: c23_ingest_telemetry_event RPC exists';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 4 FAIL: c23_ingest_telemetry_event RPC missing';
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 5: Override RPC exists
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM pg_proc
  WHERE proname = 'c23_override_controllability';

  IF v_count >= 1 THEN
    RAISE NOTICE '✅ TEST 5 PASS: c23_override_controllability RPC exists';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 5 FAIL: c23_override_controllability RPC missing';
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 6: No SELECT policy on packets for technician role
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'c23_technician_performance_packets'
  AND policyname ILIKE '%tech%'
  AND cmd = 'r';

  IF v_count = 0 THEN
    RAISE NOTICE '✅ TEST 6 PASS: No technician SELECT policy on packets (governance lock)';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 6 FAIL: Found % technician SELECT policies on packets (GOVERNANCE VIOLATION)', v_count;
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 7: No SELECT policy on signals for technician role
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'c23_performance_signals'
  AND policyname ILIKE '%tech%'
  AND cmd = 'r';

  IF v_count = 0 THEN
    RAISE NOTICE '✅ TEST 7 PASS: No technician SELECT policy on signals (governance lock)';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 7 FAIL: Found % technician SELECT policies on signals (GOVERNANCE VIOLATION)', v_count;
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 8: Technician CAN read own coaching tasks
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'c23_coaching_tasks'
  AND policyname ILIKE '%tech%'
  AND cmd = 'r';

  IF v_count >= 1 THEN
    RAISE NOTICE '✅ TEST 8 PASS: Technician can read own coaching tasks';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 8 FAIL: No technician read policy on coaching_tasks';
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 9: Idempotent insert (functional test)
  -- ---------------------------------------------------------
  -- First insert
  v_result := public.c23_ingest_telemetry_event(
    '00000000-0000-0000-0000-000000000001'::UUID,
    '00000000-0000-0000-0000-000000000002'::UUID,
    '00000000-0000-0000-0000-000000000003'::UUID,
    '00000000-0000-0000-0000-000000000004'::UUID,
    'DIAG_START',
    NOW(),
    'PWA',
    'test-device-001',
    '{}'::JSONB
  );

  IF v_result->>'status' = 'ingested' THEN
    RAISE NOTICE '✅ TEST 9a PASS: First insert returned "ingested"';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 9a FAIL: First insert returned %', v_result->>'status';
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- Duplicate insert (same event_id)
  v_result := public.c23_ingest_telemetry_event(
    '00000000-0000-0000-0000-000000000001'::UUID,
    '00000000-0000-0000-0000-000000000002'::UUID,
    '00000000-0000-0000-0000-000000000003'::UUID,
    '00000000-0000-0000-0000-000000000004'::UUID,
    'DIAG_START',
    NOW(),
    'PWA',
    'test-device-001',
    '{}'::JSONB
  );

  IF v_result->>'status' = 'duplicate' THEN
    RAISE NOTICE '✅ TEST 9b PASS: Duplicate insert returned "duplicate" (idempotent)';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 9b FAIL: Duplicate insert returned %', v_result->>'status';
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 10: Controllability derivation
  -- ---------------------------------------------------------
  v_result := public.c23_ingest_telemetry_event(
    '00000000-0000-0000-0000-000000000010'::UUID,
    '00000000-0000-0000-0000-000000000002'::UUID,
    '00000000-0000-0000-0000-000000000003'::UUID,
    '00000000-0000-0000-0000-000000000004'::UUID,
    'PARTS_REQUEST',
    NOW(),
    'PWA',
    'test-device-001',
    '{}'::JSONB
  );

  IF v_result->>'controllability' = 'UNCONTROLLABLE' THEN
    RAISE NOTICE '✅ TEST 10 PASS: PARTS_REQUEST derived as UNCONTROLLABLE';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 10 FAIL: PARTS_REQUEST controllability = %', v_result->>'controllability';
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- Cleanup test data
  -- ---------------------------------------------------------
  DELETE FROM public.c23_telemetry_events
  WHERE event_id IN (
    '00000000-0000-0000-0000-000000000001'::UUID,
    '00000000-0000-0000-0000-000000000010'::UUID
  );

  -- ---------------------------------------------------------
  -- Summary
  -- ---------------------------------------------------------
  RAISE NOTICE '=== RESULTS: % passed, % failed ===', v_tests_passed, v_tests_failed;

  IF v_tests_failed > 0 THEN
    RAISE EXCEPTION 'C23 Phase 1 Tests FAILED: % failures', v_tests_failed;
  END IF;
END $$;
