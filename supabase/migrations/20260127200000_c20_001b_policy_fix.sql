-- ============================================================================
-- C20 ExpansionOS - Phase 1.2: Policy + Schema Cache Fix
-- JamesTronic Platform
-- ============================================================================
-- Purpose:
-- 1. Re-create hardening functions (since schema_migrations entry failed)
-- 2. Fix INSERT policy to use _c20_app_role() instead of direct JWT access
-- 3. Notify PostgREST to reload schema
-- ============================================================================
-- Job ID: C20_PHASE1_2_POLICY_FIX
-- Priority: P0
-- Date: 2026-01-27
-- ============================================================================

-- ============================================================================
-- STEP 1: Re-create Hardening Functions (in case schema cache is stale)
-- ============================================================================

CREATE OR REPLACE FUNCTION public._c20_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'app_role',
    auth.jwt() -> 'app_metadata' ->> 'app_role',
    auth.jwt() -> 'user_metadata' ->> 'app_role',
    auth.jwt() ->> 'role',
    'anon'
  );
$$;

CREATE OR REPLACE FUNCTION public._c20_postgis_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis');
$$;

GRANT EXECUTE ON FUNCTION public._c20_postgis_enabled() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._c20_app_role() TO authenticated, service_role;

-- ============================================================================
-- STEP 2: Drop and Re-create INSERT Policy with Fixed Role Check
-- ============================================================================

DROP POLICY IF EXISTS expansion_candidates_manager_insert ON expansion_candidate_locations;

CREATE POLICY expansion_candidates_manager_insert ON expansion_candidate_locations
    FOR INSERT
    TO authenticated
    WITH CHECK (
        _c20_is_city_accessible(city_id)
        AND _c20_app_role() IN ('manager', 'admin', 'super_admin')
    );

-- ============================================================================
-- STEP 3: Drop and Re-create UPDATE Policy with Fixed Role Check
-- ============================================================================

DROP POLICY IF EXISTS expansion_candidates_manager_update ON expansion_candidate_locations;

CREATE POLICY expansion_candidates_manager_update ON expansion_candidate_locations
    FOR UPDATE
    TO authenticated
    USING (
        _c20_is_city_accessible(city_id)
        AND _c20_app_role() IN ('manager', 'admin', 'super_admin')
    );

-- ============================================================================
-- STEP 4: Notify PostgREST to Reload Schema
-- ============================================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'C20 Phase 1.2: Policy fix applied.';
    RAISE NOTICE 'INSERT/UPDATE policies now use _c20_app_role() for consistent role extraction.';
    RAISE NOTICE 'PostgREST schema reload notified.';
END $$;
