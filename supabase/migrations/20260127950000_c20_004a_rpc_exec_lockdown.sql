-- ============================================================================
-- C20 ExpansionOS - Phase 4.0: RPC Execution Lockdown (Pre-Gate 1)
-- JamesTronic Platform
-- ============================================================================
-- Purpose:
-- Strictly limit compute job execution to service_role (Worker).
-- Revoke execution from 'authenticated' users (even Admins/Managers via Client).
-- ============================================================================
-- Job ID: C20_PHASE4_PREGATE_LOCKDOWN
-- Priority: P0 (Security)
-- Date: 2026-01-27
-- ============================================================================

-- 1. Build Demand Points
REVOKE EXECUTE ON FUNCTION public.rpc_c20_build_demand_points(date, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_c20_build_demand_points(date, uuid) TO service_role;

-- 2. Build Travel Matrix
REVOKE EXECUTE ON FUNCTION public.rpc_c20_build_travel_matrix(uuid, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_c20_build_travel_matrix(uuid, boolean) TO service_role;

-- 3. Run Scenario
REVOKE EXECUTE ON FUNCTION public.rpc_c20_run_scenario(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_c20_run_scenario(uuid) TO service_role;

-- 4. Reload Schema Helper (Double check)
-- Handled in 003b, but good to ensure consistency if reused
REVOKE EXECUTE ON FUNCTION public._c20_reload_pgrst_schema() FROM authenticated;
GRANT EXECUTE ON FUNCTION public._c20_reload_pgrst_schema() TO service_role;
