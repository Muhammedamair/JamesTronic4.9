-- ============================================================================
-- C20 ExpansionOS - Phase 2.1: RLS Lockdown Patch (P0)
-- JamesTronic Platform
-- ============================================================================
-- Purpose:
-- 1. Fix CRITICAL RLS vulnerability: Remove `USING (true)` for authenticated users.
-- 2. Lockdown policies: Restrict Admin/Service write access strictly.
-- 3. Add deterministic schema cache reload helper.
-- ============================================================================
-- Job ID: C20_PHASE2_1_RLS_LOCKDOWN
-- Priority: P0 (Security Critical)
-- Date: 2026-01-27
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: DROP Dangerous Policies
-- ============================================================================

DROP POLICY IF EXISTS scores_admin_all ON public.expansion_location_scores;
DROP POLICY IF EXISTS allocations_admin_all ON public.service_area_allocations;
DROP POLICY IF EXISTS workload_admin_all ON public.workload_capacity_snapshots;

-- ============================================================================
-- STEP 2: Recreate Strict Policies
-- ============================================================================

-- 2.1 Scores
-- Service Role: Full Access
CREATE POLICY scores_service_all ON public.expansion_location_scores
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Admin: Full Access (Strict Role Check)
CREATE POLICY scores_admin_all ON public.expansion_location_scores
  FOR ALL TO authenticated
  USING (public._c20_app_role() IN ('admin','super_admin'))
  WITH CHECK (public._c20_app_role() IN ('admin','super_admin'));

-- 2.2 Allocations
-- Service Role: Full Access
CREATE POLICY allocations_service_all ON public.service_area_allocations
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Admin: Full Access (Strict Role Check)
CREATE POLICY allocations_admin_all ON public.service_area_allocations
  FOR ALL TO authenticated
  USING (public._c20_app_role() IN ('admin','super_admin'))
  WITH CHECK (public._c20_app_role() IN ('admin','super_admin'));

-- 2.3 Workload
-- Service Role: Full Access
CREATE POLICY workload_service_all ON public.workload_capacity_snapshots
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Admin: Full Access (Strict Role Check)
CREATE POLICY workload_admin_all ON public.workload_capacity_snapshots
  FOR ALL TO authenticated
  USING (public._c20_app_role() IN ('admin','super_admin'))
  WITH CHECK (public._c20_app_role() IN ('admin','super_admin'));

-- ============================================================================
-- STEP 3: Schema Cache Reload Helper (Deterministic)
-- ============================================================================

CREATE OR REPLACE FUNCTION public._c20_reload_pgrst_schema()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT pg_notify('pgrst', 'reload schema');
$$;

GRANT EXECUTE ON FUNCTION public._c20_reload_pgrst_schema() TO service_role, authenticated, anon;

COMMIT;

-- Note: Schema refresh notification happens via the function call in tests, 
-- but we also notify here for good measure.
NOTIFY pgrst, 'reload schema';
