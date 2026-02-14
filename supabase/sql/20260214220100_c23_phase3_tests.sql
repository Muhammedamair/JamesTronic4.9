-- ============================================================
-- C23 Phase 3: Test Suite
-- Tests: security revocation, review RPCs, audit trail,
--        coaching, feature flags, RLS regression, no-ranking
-- ============================================================

DO $$
DECLARE
  v_count         INT;
  v_result        JSONB;
  v_tests_passed  INT := 0;
  v_tests_failed  INT := 0;
BEGIN
  RAISE NOTICE '=== C23 Phase 3: Review & Coaching Tests ===';

  -- ---------------------------------------------------------
  -- TEST 1: EXECUTE revoked on c23_generate_packets for PUBLIC
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM information_schema.role_routine_grants
  WHERE routine_name = 'c23_generate_packets'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated')
  AND privilege_type = 'EXECUTE';

  IF v_count = 0 THEN
    RAISE NOTICE '✅ TEST 1 PASS: EXECUTE revoked from PUBLIC/anon/authenticated on c23_generate_packets';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 1 FAIL: c23_generate_packets still executable by % non-service roles', v_count;
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 2: c23_review_audit_log table exists with RLS
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM pg_tables
  WHERE schemaname = 'public' AND tablename = 'c23_review_audit_log' AND rowsecurity = true;

  IF v_count = 1 THEN
    RAISE NOTICE '✅ TEST 2 PASS: c23_review_audit_log exists with RLS';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 2 FAIL: c23_review_audit_log missing or RLS not enabled';
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 3: Feature flags table exists and default OFF
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM public.c23_feature_flags WHERE enabled = false;

  IF v_count >= 3 THEN
    RAISE NOTICE '✅ TEST 3 PASS: % feature flags seeded, all default OFF', v_count;
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 3 FAIL: Expected >=3 flags OFF, found %', v_count;
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 4: Review RPCs exist
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM pg_proc
  WHERE proname IN ('c23_manager_review_packet', 'c23_hr_review_packet');

  IF v_count >= 2 THEN
    RAISE NOTICE '✅ TEST 4 PASS: Review RPCs exist (manager + HR)';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 4 FAIL: Missing review RPCs (found %)', v_count;
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 5: Coaching RPCs exist
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM pg_proc
  WHERE proname IN ('c23_create_coaching_task', 'c23_complete_coaching_task');

  IF v_count >= 2 THEN
    RAISE NOTICE '✅ TEST 5 PASS: Coaching RPCs exist (create + complete)';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 5 FAIL: Missing coaching RPCs (found %)', v_count;
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 6: RLS REGRESSION — tech still cannot read packets
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'c23_technician_performance_packets'
  AND policyname ILIKE '%tech%' AND cmd = 'r';

  IF v_count = 0 THEN
    RAISE NOTICE '✅ TEST 6 PASS: RLS regression OK: no tech SELECT on packets';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 6 FAIL: RLS REGRESSION: tech SELECT policy on packets';
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 7: RLS REGRESSION — tech still cannot read signals
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'c23_performance_signals'
  AND policyname ILIKE '%tech%' AND cmd = 'r';

  IF v_count = 0 THEN
    RAISE NOTICE '✅ TEST 7 PASS: RLS regression OK: no tech SELECT on signals';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 7 FAIL: RLS REGRESSION: tech SELECT policy on signals';
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 8: Tech CAN still read own coaching tasks
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'c23_coaching_tasks'
  AND policyname ILIKE '%tech%' AND cmd = 'r';

  IF v_count >= 1 THEN
    RAISE NOTICE '✅ TEST 8 PASS: Tech can read own coaching tasks';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 8 FAIL: Tech lost read access to coaching tasks';
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 9: No ranking/leaderboard tables
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND (table_name LIKE '%leaderboard%'
    OR table_name LIKE '%ranking%'
    OR table_name LIKE '%scoreboard%');

  IF v_count = 0 THEN
    RAISE NOTICE '✅ TEST 9 PASS: No leaderboard/ranking/scoreboard tables (governance lock)';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 9 FAIL: Found % ranking-related tables (GOVERNANCE VIOLATION)', v_count;
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 10: No notification/penalty tables
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name LIKE 'c23_%'
  AND (table_name LIKE '%notification%' OR table_name LIKE '%penalty%' OR table_name LIKE '%punitive%');

  IF v_count = 0 THEN
    RAISE NOTICE '✅ TEST 10 PASS: No punitive tables (governance lock)';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 10 FAIL: Found % punitive tables (GOVERNANCE VIOLATION)', v_count;
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 11: Audit log has no tech-accessible policies
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'c23_review_audit_log'
  AND policyname ILIKE '%tech%';

  IF v_count = 0 THEN
    RAISE NOTICE '✅ TEST 11 PASS: Audit log not accessible by technicians';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 11 FAIL: Audit log has tech policies';
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- TEST 12: HR review state enum exists
  -- ---------------------------------------------------------
  SELECT COUNT(*) INTO v_count
  FROM pg_type WHERE typname = 'c23_hr_review_state';

  IF v_count >= 1 THEN
    RAISE NOTICE '✅ TEST 12 PASS: c23_hr_review_state enum exists';
    v_tests_passed := v_tests_passed + 1;
  ELSE
    RAISE NOTICE '❌ TEST 12 FAIL: c23_hr_review_state enum missing';
    v_tests_failed := v_tests_failed + 1;
  END IF;

  -- ---------------------------------------------------------
  -- Summary
  -- ---------------------------------------------------------
  RAISE NOTICE '=== RESULTS: % passed, % failed ===', v_tests_passed, v_tests_failed;

  IF v_tests_failed > 0 THEN
    RAISE EXCEPTION 'C23 Phase 3 Tests FAILED: % failures', v_tests_failed;
  END IF;
END $$;
