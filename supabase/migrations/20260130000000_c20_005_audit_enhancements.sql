-- ============================================================================
-- C20 ExpansionOS - Phase 3: Audit Enhancements & Compute Safety (V1.0)
-- JamesTronic Platform
-- ============================================================================
-- Purpose:
-- 1. Add city_id column to expansion_audit_log for RLS-safe filtering
-- 2. Add Manager SELECT policy (city-scoped via city_id column)
-- 3. Create expansion_compute_runs table for demand/travel job ledger
-- 4. Add advisory lock wrappers to all compute RPCs
-- 5. Add structured event emission: COMPUTE_START / COMPUTE_END / COMPUTE_FAIL
-- ============================================================================
-- Job ID: C20_PHASE3_AUDIT_ENHANCEMENTS
-- Priority: P0 (Core Engine)
-- Date: 2026-01-30
-- ============================================================================

-- ============================================================================
-- STEP 1: Add city_id column to expansion_audit_log for RLS
-- ============================================================================

-- Add city_id as first-class column (not relying on JSONB payload for RLS)
ALTER TABLE public.expansion_audit_log
ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES cities(id) ON DELETE SET NULL;

-- Index for city-scoped queries
CREATE INDEX IF NOT EXISTS idx_expansion_audit_city_id 
ON expansion_audit_log(city_id) WHERE city_id IS NOT NULL;

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_expansion_audit_city_event_time 
ON expansion_audit_log(city_id, event_type, created_at DESC);

-- ============================================================================
-- STEP 2: Add Manager RLS policy for audit log (city-scoped)
-- ============================================================================

-- Manager can read audit logs only for their accessible city
CREATE POLICY audit_manager_select_city ON expansion_audit_log
    FOR SELECT
    TO authenticated
    USING (
        public._c20_app_role() = 'manager'
        AND city_id IS NOT NULL
        AND public._c20_is_city_accessible(city_id)
    );

-- ============================================================================
-- STEP 3: Create expansion_compute_runs table (Run Ledger for demand/travel)
-- ============================================================================

CREATE TYPE public.compute_job_type AS ENUM (
    'build_demand_points',
    'build_travel_matrix'
);

CREATE TYPE public.compute_run_status AS ENUM (
    'queued',
    'running',
    'succeeded',
    'failed'
);

CREATE TABLE IF NOT EXISTS public.expansion_compute_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type compute_job_type NOT NULL,
    city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    
    -- Run tracking
    status compute_run_status NOT NULL DEFAULT 'queued',
    started_at timestamptz,
    completed_at timestamptz,
    
    -- Inputs for determinism check
    inputs_hash text, -- SHA256 of input params for idempotency detection
    
    -- Results summary
    rows_affected integer DEFAULT 0,
    warnings jsonb DEFAULT '[]',
    error_message text,
    
    -- Audit
    triggered_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now() NOT NULL,
    
    -- Generated column for idempotency (immutable)
    run_date date GENERATED ALWAYS AS ((created_at AT TIME ZONE 'UTC')::date) STORED
);

-- Unique index for idempotency: prevent duplicate runs for same city+day+job
CREATE UNIQUE INDEX IF NOT EXISTS uq_compute_run_city_job_day 
ON expansion_compute_runs(city_id, job_type, run_date);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_compute_runs_city ON expansion_compute_runs(city_id);
CREATE INDEX IF NOT EXISTS idx_compute_runs_status ON expansion_compute_runs(status);
CREATE INDEX IF NOT EXISTS idx_compute_runs_created ON expansion_compute_runs(created_at DESC);

COMMENT ON TABLE public.expansion_compute_runs IS 'Run ledger for demand/travel compute jobs with status tracking';

-- ============================================================================
-- STEP 4: RLS for expansion_compute_runs
-- ============================================================================

ALTER TABLE expansion_compute_runs ENABLE ROW LEVEL SECURITY;

-- Manager: Read own city only
CREATE POLICY compute_runs_manager_select ON expansion_compute_runs
    FOR SELECT
    TO authenticated
    USING (
        public._c20_is_city_accessible(city_id)
    );

-- Service/Admin: Full access
CREATE POLICY compute_runs_service_all ON expansion_compute_runs
    FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY compute_runs_admin_all ON expansion_compute_runs
    FOR ALL
    TO authenticated
    USING (public._c20_app_role() IN ('admin', 'super_admin'));

-- ============================================================================
-- STEP 5: Structured Audit Event Emitter
-- ============================================================================

CREATE OR REPLACE FUNCTION public._c20_emit_compute_event(
    p_event_type text,           -- 'COMPUTE_START', 'COMPUTE_END', 'COMPUTE_FAIL'
    p_job_type text,             -- 'build_demand_points', 'run_scenario', etc.
    p_city_id uuid,
    p_run_id uuid DEFAULT NULL,
    p_details jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    INSERT INTO expansion_audit_log (
        ai_module,
        event_type,
        city_id,
        payload,
        user_id,
        role,
        details,
        created_at
    ) VALUES (
        'expansion_os',
        p_event_type,
        p_city_id,
        jsonb_build_object(
            'job_type', p_job_type,
            'run_id', p_run_id,
            'timestamp', now()
        ),
        auth.uid(),
        public._c20_app_role(),
        p_details,
        now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public._c20_emit_compute_event(text, text, uuid, uuid, jsonb) TO service_role;

-- ============================================================================
-- STEP 6: Enhanced rpc_c20_build_demand_points with advisory lock
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_c20_build_demand_points(
    p_day date,
    p_city_id uuid DEFAULT NULL,
    p_run_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_run_id uuid;
    v_lock_key bigint;
    v_rows_inserted int;
    v_start_time timestamptz;
    v_warnings jsonb := '[]'::jsonb;
BEGIN
    -- 1. Security Guard
    IF auth.role() != 'service_role' AND public._c20_app_role() NOT IN ('admin', 'super_admin', 'manager') THEN
        RAISE EXCEPTION 'Access Denied: Compute jobs reserved for service_role, admin, or manager';
    END IF;

    -- 2. Generate run_id if not provided (for idempotency)
    v_run_id := COALESCE(p_run_id, gen_random_uuid());
    v_start_time := clock_timestamp();

    -- 3. Advisory lock on city_id to prevent parallel runs
    v_lock_key := COALESCE(('x' || substr(p_city_id::text, 1, 8))::bit(32)::int, 0);
    PERFORM pg_advisory_xact_lock(20001, v_lock_key);

    -- 4. Emit COMPUTE_START
    PERFORM public._c20_emit_compute_event(
        'COMPUTE_START',
        'build_demand_points',
        p_city_id,
        v_run_id,
        jsonb_build_object('day', p_day)
    );

    -- 5. Create run ledger entry
    INSERT INTO expansion_compute_runs (id, job_type, city_id, status, started_at, triggered_by)
    VALUES (v_run_id, 'build_demand_points', p_city_id, 'running', now(), auth.uid())
    ON CONFLICT (city_id, job_type, (created_at::date)) 
    DO UPDATE SET status = 'running', started_at = now();

    -- 6. Processing
    INSERT INTO demand_points_daily (day, city_id, pincode_id, device_category, ticket_count, gross_revenue_inr)
    SELECT 
        p_day,
        gp.city_id,
        gp.id,
        unnest(ARRAY['smartphone', 'laptop', 'tablet']),
        floor(random() * 50)::int,
        floor(random() * 50000)::numeric
    FROM geo_pincodes gp
    WHERE (p_city_id IS NULL OR gp.city_id = p_city_id)
    ON CONFLICT (day, city_id, pincode_id, device_category)
    DO UPDATE SET 
        ticket_count = EXCLUDED.ticket_count,
        gross_revenue_inr = EXCLUDED.gross_revenue_inr,
        updated_at = now();
        
    GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

    -- 7. Check for warnings (e.g., no pincodes found)
    IF v_rows_inserted = 0 THEN
        v_warnings := v_warnings || jsonb_build_array('No pincodes found for city');
    END IF;

    -- 8. Mark run complete
    UPDATE expansion_compute_runs 
    SET status = 'succeeded', 
        completed_at = now(), 
        rows_affected = v_rows_inserted,
        warnings = v_warnings
    WHERE id = v_run_id OR (city_id = p_city_id AND job_type = 'build_demand_points' AND created_at::date = now()::date);

    -- 9. Emit COMPUTE_END
    PERFORM public._c20_emit_compute_event(
        'COMPUTE_END',
        'build_demand_points',
        p_city_id,
        v_run_id,
        jsonb_build_object(
            'day', p_day,
            'rows_processed', v_rows_inserted,
            'duration_ms', extract(epoch from (clock_timestamp() - v_start_time)) * 1000,
            'warnings', v_warnings
        )
    );

    RETURN jsonb_build_object(
        'success', true, 
        'run_id', v_run_id,
        'rows', v_rows_inserted,
        'warnings', v_warnings
    );

EXCEPTION WHEN OTHERS THEN
    -- Mark run failed
    UPDATE expansion_compute_runs 
    SET status = 'failed', 
        completed_at = now(), 
        error_message = SQLERRM
    WHERE id = v_run_id OR (city_id = p_city_id AND job_type = 'build_demand_points' AND created_at::date = now()::date);

    -- Emit COMPUTE_FAIL (sanitized error)
    PERFORM public._c20_emit_compute_event(
        'COMPUTE_FAIL',
        'build_demand_points',
        p_city_id,
        v_run_id,
        jsonb_build_object(
            'day', p_day,
            'error', substring(SQLERRM from 1 for 200) -- Sanitized
        )
    );

    RAISE;
END;
$$;

-- ============================================================================
-- STEP 7: Enhanced rpc_c20_build_travel_matrix with advisory lock
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_c20_build_travel_matrix(
    p_city_id uuid,
    p_only_active boolean DEFAULT true,
    p_run_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_run_id uuid;
    v_lock_key bigint;
    v_rows_upserted int;
    v_start_time timestamptz;
    v_warnings jsonb := '[]'::jsonb;
BEGIN
    -- 1. Security Guard
    IF auth.role() != 'service_role' AND public._c20_app_role() NOT IN ('admin', 'super_admin', 'manager') THEN
        RAISE EXCEPTION 'Access Denied: Compute jobs reserved for service_role, admin, or manager';
    END IF;

    v_run_id := COALESCE(p_run_id, gen_random_uuid());
    v_start_time := clock_timestamp();

    -- 2. Advisory lock on city_id
    v_lock_key := COALESCE(('x' || substr(p_city_id::text, 1, 8))::bit(32)::int, 0);
    PERFORM pg_advisory_xact_lock(20002, v_lock_key);

    -- 3. Emit COMPUTE_START
    PERFORM public._c20_emit_compute_event(
        'COMPUTE_START',
        'build_travel_matrix',
        p_city_id,
        v_run_id,
        jsonb_build_object('only_active', p_only_active)
    );

    -- 4. Create run ledger entry
    INSERT INTO expansion_compute_runs (id, job_type, city_id, status, started_at, triggered_by)
    VALUES (v_run_id, 'build_travel_matrix', p_city_id, 'running', now(), auth.uid())
    ON CONFLICT (city_id, job_type, (created_at::date)) 
    DO UPDATE SET status = 'running', started_at = now();

    -- 5. Processing (Store -> Pincode using candidate locations)
    INSERT INTO travel_time_matrix_cache (
        city_id, from_candidate_id, to_pincode_id, hour_bucket,
        eta_median_minutes, eta_p90_minutes, distance_km
    )
    SELECT
        c.city_id,
        c.id,
        p.id,
        h.hour,
        (ST_Distance(c.location::geography, p.centroid) / 1000.0) * 3 * (1 + (CASE WHEN h.hour IN (9,10,17,18,19) THEN 0.5 ELSE 0 END)),
        (ST_Distance(c.location::geography, p.centroid) / 1000.0) * 4,
        (ST_Distance(c.location::geography, p.centroid) / 1000.0)
    FROM 
        expansion_candidate_locations c,
        geo_pincodes p,
        generate_series(0, 23) as h(hour)
    WHERE c.city_id = p_city_id AND p.city_id = p_city_id
    ON CONFLICT (city_id, from_store_id, from_candidate_id, to_pincode_id, hour_bucket)
    DO UPDATE SET 
        eta_median_minutes = EXCLUDED.eta_median_minutes,
        eta_p90_minutes = EXCLUDED.eta_p90_minutes,
        distance_km = EXCLUDED.distance_km,
        updated_at = now();
        
    GET DIAGNOSTICS v_rows_upserted = ROW_COUNT;

    -- 6. Warning if no rows
    IF v_rows_upserted = 0 THEN
        v_warnings := v_warnings || jsonb_build_array('No candidate locations or pincodes found');
    END IF;

    -- 7. Mark run complete
    UPDATE expansion_compute_runs 
    SET status = 'succeeded', 
        completed_at = now(), 
        rows_affected = v_rows_upserted,
        warnings = v_warnings
    WHERE id = v_run_id OR (city_id = p_city_id AND job_type = 'build_travel_matrix' AND created_at::date = now()::date);

    -- 8. Emit COMPUTE_END
    PERFORM public._c20_emit_compute_event(
        'COMPUTE_END',
        'build_travel_matrix',
        p_city_id,
        v_run_id,
        jsonb_build_object(
            'rows', v_rows_upserted,
            'duration_ms', extract(epoch from (clock_timestamp() - v_start_time)) * 1000,
            'warnings', v_warnings
        )
    );

    RETURN jsonb_build_object(
        'success', true, 
        'run_id', v_run_id,
        'rows', v_rows_upserted,
        'warnings', v_warnings
    );

EXCEPTION WHEN OTHERS THEN
    UPDATE expansion_compute_runs 
    SET status = 'failed', 
        completed_at = now(), 
        error_message = SQLERRM
    WHERE id = v_run_id OR (city_id = p_city_id AND job_type = 'build_travel_matrix' AND created_at::date = now()::date);

    PERFORM public._c20_emit_compute_event(
        'COMPUTE_FAIL',
        'build_travel_matrix',
        p_city_id,
        v_run_id,
        jsonb_build_object('error', substring(SQLERRM from 1 for 200))
    );

    RAISE;
END;
$$;

-- ============================================================================
-- STEP 8: Enhanced rpc_c20_run_scenario with advisory lock
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_c20_run_scenario(
    p_run_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_scenario_id uuid;
    v_city_id uuid;
    v_weights jsonb;
    v_candidates record;
    v_score numeric;
    v_rank int;
    v_candidate_count int := 0;
    v_lock_key bigint;
    v_start_time timestamptz;
    v_warnings jsonb := '[]'::jsonb;
BEGIN
    -- 1. Security Guard
    IF auth.role() != 'service_role' AND public._c20_app_role() NOT IN ('admin', 'super_admin', 'manager') THEN
        RAISE EXCEPTION 'Access Denied: Scenario execution reserved for service_role, admin, or manager';
    END IF;

    v_start_time := clock_timestamp();

    -- 2. Load Scenario Context
    SELECT s.id, s.city_id, s.weights 
    INTO v_scenario_id, v_city_id, v_weights
    FROM expansion_scenario_runs r
    JOIN expansion_scenarios s ON r.scenario_id = s.id
    WHERE r.id = p_run_id AND r.status = 'pending'
    FOR UPDATE OF r;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Run not found or not pending');
    END IF;

    -- 3. Advisory lock on scenario_id
    v_lock_key := COALESCE(('x' || substr(v_scenario_id::text, 1, 8))::bit(32)::int, 0);
    PERFORM pg_advisory_xact_lock(20003, v_lock_key);

    -- 4. Emit COMPUTE_START
    PERFORM public._c20_emit_compute_event(
        'COMPUTE_START',
        'run_scenario',
        v_city_id,
        p_run_id,
        jsonb_build_object('scenario_id', v_scenario_id, 'weights', v_weights)
    );

    -- 5. Update status to processing
    UPDATE expansion_scenario_runs 
    SET status = 'processing', started_at = now() 
    WHERE id = p_run_id;

    -- 6. Scoring Loop
    FOR v_candidates IN 
        SELECT id, name FROM expansion_candidate_locations 
        WHERE city_id = v_city_id
    LOOP
        v_score := (random() * 100)::numeric(5,2);
        v_candidate_count := v_candidate_count + 1;
        
        INSERT INTO expansion_location_scores (run_id, candidate_id, score, rank, explanation)
        VALUES (
            p_run_id, 
            v_candidates.id, 
            v_score, 
            0,
            jsonb_build_object('base', v_score, 'weights', v_weights)
        )
        ON CONFLICT (run_id, candidate_id) DO UPDATE SET
            score = EXCLUDED.score,
            explanation = EXCLUDED.explanation;
        
        INSERT INTO service_area_allocations (run_id, location_id, location_type, allocated_pincodes_count)
        VALUES (p_run_id, v_candidates.id, 'candidate', floor(random() * 10))
        ON CONFLICT (run_id, location_id) DO UPDATE SET
            allocated_pincodes_count = EXCLUDED.allocated_pincodes_count;
    END LOOP;

    -- 7. Warning if no candidates
    IF v_candidate_count = 0 THEN
        v_warnings := v_warnings || jsonb_build_array('No candidate locations found for city');
    END IF;

    -- 8. Update Ranks
    WITH ranked AS (
        SELECT candidate_id, rank() OVER (ORDER BY score DESC) as new_rank
        FROM expansion_location_scores
        WHERE run_id = p_run_id
    )
    UPDATE expansion_location_scores s
    SET rank = r.new_rank
    FROM ranked r
    WHERE s.run_id = p_run_id AND s.candidate_id = r.candidate_id;

    -- 9. Finish
    UPDATE expansion_scenario_runs 
    SET status = 'completed', completed_at = now(),
        summary = jsonb_build_object(
            'candidates_scored', v_candidate_count,
            'duration_ms', extract(epoch from (clock_timestamp() - v_start_time)) * 1000
        )
    WHERE id = p_run_id;

    -- 10. Emit COMPUTE_END
    PERFORM public._c20_emit_compute_event(
        'COMPUTE_END',
        'run_scenario',
        v_city_id,
        p_run_id,
        jsonb_build_object(
            'scenario_id', v_scenario_id,
            'candidates_scored', v_candidate_count,
            'duration_ms', extract(epoch from (clock_timestamp() - v_start_time)) * 1000,
            'warnings', v_warnings
        )
    );

    RETURN jsonb_build_object(
        'success', true, 
        'run_id', p_run_id, 
        'candidates_scored', v_candidate_count,
        'warnings', v_warnings
    );

EXCEPTION WHEN OTHERS THEN
    UPDATE expansion_scenario_runs 
    SET status = 'failed', error_message = SQLERRM, completed_at = now()
    WHERE id = p_run_id;

    PERFORM public._c20_emit_compute_event(
        'COMPUTE_FAIL',
        'run_scenario',
        v_city_id,
        p_run_id,
        jsonb_build_object(
            'scenario_id', v_scenario_id,
            'error', substring(SQLERRM from 1 for 200)
        )
    );
    
    RAISE;
END;
$$;

-- ============================================================================
-- STEP 9: Update grants
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.rpc_c20_build_demand_points(date, uuid, uuid) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_c20_build_travel_matrix(uuid, boolean, uuid) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_c20_run_scenario(uuid) TO service_role, authenticated;

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'C20 Phase 3: Audit Enhancements migration complete.';
    RAISE NOTICE 'Added: city_id column to audit log, Manager RLS, compute run ledger';
    RAISE NOTICE 'Enhanced: All compute RPCs with advisory locks + structured events';
END $$;
