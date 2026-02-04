-- ============================================================================
-- C20 ExpansionOS - Phase 3.0: Security Micro-Patch
-- JamesTronic Platform
-- ============================================================================
-- Purpose:
-- 1. Revoke execution of _c20_reload_pgrst_schema from anon/authenticated.
-- 2. Ensure only service_role/admin can trigger schema reloads.
-- ============================================================================
-- Job ID: C20_PHASE3_0_SEC_PATCH
-- Priority: P0
-- Date: 2026-01-27
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public._c20_reload_pgrst_schema() FROM anon;
REVOKE EXECUTE ON FUNCTION public._c20_reload_pgrst_schema() FROM authenticated;
GRANT EXECUTE ON FUNCTION public._c20_reload_pgrst_schema() TO service_role;

-- Re-assert search_path just in case
ALTER FUNCTION public._c20_reload_pgrst_schema() SET search_path = pg_catalog;
