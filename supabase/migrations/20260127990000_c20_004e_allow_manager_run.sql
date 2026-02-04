-- ============================================================================
-- C20 ExpansionOS - Phase 4.x: Allow Managers to Trigger Runs
-- JamesTronic Platform
-- ============================================================================
-- Purpose:
-- Add RLS policy to allow Managers to INSERT into expansion_scenario_runs.
-- Required for "Request Run" button in UI.
-- ============================================================================
-- Job ID: C20_PHASE4_ALLOW_RUN
-- Priority: P1 (Feature Blocker)
-- ============================================================================

-- Manager: Can create runs for own city
CREATE POLICY runs_manager_insert ON public.expansion_scenario_runs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        _c20_is_city_accessible(city_id)
        AND COALESCE(auth.jwt() ->> 'app_role', auth.jwt() ->> 'role', 'anon') 
            IN ('manager', 'admin', 'super_admin')
    );
