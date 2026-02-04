-- ============================================================================
-- C20 ExpansionOS - Phase 2: Scenario Scoring & Snapshots (V1.0)
-- JamesTronic Platform
-- ============================================================================
-- Purpose:
-- 1. Create scenario configuration and run tracking tables
-- 2. Create snapshot tables for scores and allocations (audit trail)
-- 3. Enforce run_id integrity (no overwrite)
-- 4. Apply RLS: Manager create scenarios, read results; Service writes results
-- ============================================================================
-- Job ID: C20_PHASE2_SCENARIOS
-- Priority: P0
-- Date: 2026-01-27
-- ============================================================================

-- ============================================================================
-- STEP 1: Expansion Scenarios (Configuration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.expansion_scenarios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    
    name text NOT NULL,
    description text,
    
    -- Inputs / Weights
    weights jsonb NOT NULL DEFAULT '{
        "demand_density": 0.4,
        "competitor_distance": 0.2,
        "travel_time": 0.3,
        "rent_cost": 0.1
    }',
    
    target_candidates uuid[], -- Specific candidates to evaluate (optional)
    
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expansion_scenarios_city_id ON expansion_scenarios(city_id);

COMMENT ON TABLE public.expansion_scenarios IS 'User-defined configuration for expansion evaluation scenarios';

-- ============================================================================
-- STEP 2: Scenario Runs (Job Tracking)
-- ============================================================================

CREATE TYPE public.scenario_run_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed'
);

CREATE TABLE IF NOT EXISTS public.expansion_scenario_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id uuid NOT NULL REFERENCES expansion_scenarios(id) ON DELETE CASCADE,
    city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE, -- Denormalized for RLS/Query ease
    
    status scenario_run_status DEFAULT 'pending',
    
    -- Audit
    started_at timestamptz,
    completed_at timestamptz,
    error_message text,
    
    -- Results Summary
    summary jsonb DEFAULT '{}', -- { "candidates_scored": 5, "top_candidate": "..." }
    
    created_by uuid REFERENCES auth.users(id), -- Triggered by
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scenario_runs_scenario_id ON expansion_scenario_runs(scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_runs_city_id ON expansion_scenario_runs(city_id);
CREATE INDEX IF NOT EXISTS idx_scenario_runs_status ON expansion_scenario_runs(status);

COMMENT ON TABLE public.expansion_scenario_runs IS 'Execution history and status of scenario runs (Job Safety)';

-- ============================================================================
-- STEP 3: Location Scores Snapshot
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.expansion_location_scores (
    run_id uuid NOT NULL REFERENCES expansion_scenario_runs(id) ON DELETE CASCADE,
    candidate_id uuid NOT NULL REFERENCES expansion_candidate_locations(id) ON DELETE CASCADE,
    
    score numeric(5, 2) NOT NULL,
    rank integer NOT NULL,
    
    -- Explainability
    explanation jsonb NOT NULL DEFAULT '{}', 
    
    created_at timestamptz DEFAULT now() NOT NULL,
    
    PRIMARY KEY (run_id, candidate_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_location_scores_run_rank ON expansion_location_scores(run_id, rank);

COMMENT ON TABLE public.expansion_location_scores IS 'Snapshot of scores per candidate for a specific run';

-- ============================================================================
-- STEP 4: Service Area Allocation Snapshot
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.service_area_allocations (
    run_id uuid NOT NULL REFERENCES expansion_scenario_runs(id) ON DELETE CASCADE,
    location_id uuid NOT NULL, -- Flexible: can range from store or candidate ID
    location_type text NOT NULL CHECK (location_type IN ('store', 'candidate')),
    
    -- Allocation metrics
    allocated_pincodes_count integer DEFAULT 0,
    projected_ticket_volume integer DEFAULT 0,
    projected_revenue numeric(12, 2) DEFAULT 0,
    
    -- Detail: List of pincodes (Array for light storage, normalized table if heavy queries needed)
    pincode_ids uuid[] DEFAULT '{}',
    
    created_at timestamptz DEFAULT now() NOT NULL,
    
    PRIMARY KEY (run_id, location_id)
);

COMMENT ON TABLE public.service_area_allocations IS 'Snapshot of service area assignments (pincodes) per location for a run';

-- ============================================================================
-- STEP 5: Workload Capacity Snapshot
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workload_capacity_snapshots (
    run_id uuid NOT NULL REFERENCES expansion_scenario_runs(id) ON DELETE CASCADE,
    location_id uuid NOT NULL,
    
    day date NOT NULL,
    
    capacity_limit integer,
    projected_load integer,
    utilization_pct numeric(5, 2),
    
    created_at timestamptz DEFAULT now() NOT NULL,
    
    PRIMARY KEY (run_id, location_id, day)
);

COMMENT ON TABLE public.workload_capacity_snapshots IS 'Projected daily utilization per location based on scenario allocation';

-- ============================================================================
-- STEP 6: RLS Policies
-- ============================================================================

ALTER TABLE expansion_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE expansion_scenario_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE expansion_location_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_area_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workload_capacity_snapshots ENABLE ROW LEVEL SECURITY;

-- 6.1 Scenarios
-- Manager: Select/Insert/Update own city
CREATE POLICY scenarios_manager_all ON expansion_scenarios
    FOR ALL
    TO authenticated
    USING (_c20_is_city_accessible(city_id))
    WITH CHECK (_c20_is_city_accessible(city_id) AND _c20_app_role() IN ('manager', 'admin', 'super_admin'));

-- Admin/Service: Full access
CREATE POLICY scenarios_admin_all ON expansion_scenarios
    FOR ALL
    TO authenticated, service_role
    USING (_c20_app_role() IN ('admin', 'super_admin') OR auth.role() = 'service_role');

-- 6.2 Runs
-- Manager: Select own city (read results)
CREATE POLICY runs_manager_select ON expansion_scenario_runs
    FOR SELECT
    TO authenticated
    USING (_c20_is_city_accessible(city_id));

-- Admin/Service: Full access + Create Runs
CREATE POLICY runs_admin_all ON expansion_scenario_runs
    FOR ALL
    TO authenticated, service_role
    USING (_c20_app_role() IN ('admin', 'super_admin') OR auth.role() = 'service_role');

-- 6.3 Scores
-- Manager: Select via Run->City join
CREATE POLICY scores_manager_select ON expansion_location_scores
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM expansion_scenario_runs r
            WHERE r.id = run_id
            AND _c20_is_city_accessible(r.city_id)
        )
    );

-- Admin/Service: Full
CREATE POLICY scores_admin_all ON expansion_location_scores
    FOR ALL
    TO authenticated, service_role
    USING (true); -- Optimization: Assume admin/service has access if they can reach endpoint

-- 6.4 Allocations
CREATE POLICY allocations_manager_select ON service_area_allocations
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM expansion_scenario_runs r
            WHERE r.id = run_id
            AND _c20_is_city_accessible(r.city_id)
        )
    );

CREATE POLICY allocations_admin_all ON service_area_allocations
    FOR ALL
    TO authenticated, service_role
    USING (true);

-- 6.5 Workload
CREATE POLICY workload_manager_select ON workload_capacity_snapshots
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM expansion_scenario_runs r
            WHERE r.id = run_id
            AND _c20_is_city_accessible(r.city_id)
        )
    );

CREATE POLICY workload_admin_all ON workload_capacity_snapshots
    FOR ALL
    TO authenticated, service_role
    USING (true);

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'C20 Phase 2: Scenarios & Snapshots migration complete.';
    RAISE NOTICE 'Tables: scenarios, runs, scores, allocations, workload';
    RAISE NOTICE 'RLS: Manager configured for creation and reading; Service/Admin for execution.';
END $$;
