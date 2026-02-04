-- ============================================================================
-- C20 ExpansionOS - Phase 3: RPC Signature Cleanup & Lock Fix (V1.1)
-- JamesTronic Platform
-- ============================================================================
-- Purpose:
-- 1. DROP old overloaded functions to resolve PostgREST ambiguity
-- 2. FIX advisory lock argument types (cast v_lock_key to integer)
-- ============================================================================

-- 1. DROP old signatures (without p_run_id)
DROP FUNCTION IF EXISTS public.rpc_c20_build_demand_points(date, uuid);
DROP FUNCTION IF EXISTS public.rpc_c20_build_travel_matrix(uuid, boolean);

-- 2. RE-DECLARE enhanced functions with integer lock key
-- (Note: CREATE OR REPLACE for current signatures)

-- JOB 1: Build Demand Points
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
    v_lock_key integer; -- Fixed: changed from bigint to integer
    v_rows_inserted int;
    v_start_time timestamptz;
    v_warnings jsonb := '[]'::jsonb;
BEGIN
    -- 1. Security Guard
    IF auth.role() != 'service_role' AND public._c20_app_role() NOT IN ('admin', 'super_admin', 'manager') THEN
        RAISE EXCEPTION 'Access Denied: Compute jobs reserved for service_role, admin, or manager';
    END IF;

    -- City Scoping for Manager
    IF public._c20_app_role() = 'manager' THEN
        IF p_city_id IS NULL OR NOT public._c20_is_city_accessible(p_city_id) THEN
            RAISE EXCEPTION 'Access Denied: Managers must specify an accessible city_id';
        END IF;
    END IF;

    -- 2. Generate run_id if not provided
    v_run_id := COALESCE(p_run_id, gen_random_uuid());

    v_start_time := clock_timestamp();

    -- 3. Advisory lock on city_id (serialized by job type 20001)
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
    ON CONFLICT (city_id, job_type, run_date) 
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

    -- 7. Warnings
    IF v_rows_inserted = 0 THEN
        v_warnings := v_warnings || jsonb_build_array('No pincodes found for city');
    END IF;

    -- 8. Mark run complete
    UPDATE expansion_compute_runs 
    SET status = 'succeeded', 
        completed_at = now(), 
        rows_affected = v_rows_inserted,
        warnings = v_warnings
    WHERE id = v_run_id;

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
    UPDATE expansion_compute_runs 
    SET status = 'failed', 
        completed_at = now(), 
        error_message = SQLERRM
    WHERE id = v_run_id;

    PERFORM public._c20_emit_compute_event(
        'COMPUTE_FAIL',
        'build_demand_points',
        p_city_id,
        v_run_id,
        jsonb_build_object('day', p_day, 'error', substring(SQLERRM from 1 for 200))
    );
    RAISE;
END;
$$;

-- JOB 2: Build Travel Matrix
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
    v_lock_key integer; -- Fixed: changed from bigint to integer
    v_rows_upserted int;
    v_start_time timestamptz;
    v_warnings jsonb := '[]'::jsonb;
BEGIN
    -- 1. Security Guard
    IF auth.role() != 'service_role' AND public._c20_app_role() NOT IN ('admin', 'super_admin', 'manager') THEN
        RAISE EXCEPTION 'Access Denied: Compute jobs reserved for service_role, admin, or manager';
    END IF;

    -- City Scoping for Manager
    IF public._c20_app_role() = 'manager' AND NOT public._c20_is_city_accessible(p_city_id) THEN
        RAISE EXCEPTION 'Access Denied: Managers can only build matrix for accessible cities';
    END IF;

    v_run_id := COALESCE(p_run_id, gen_random_uuid());
    v_start_time := clock_timestamp();

    -- 2. Advisory lock on city_id (serialized by job type 20002)
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
    ON CONFLICT (city_id, job_type, run_date) 
    DO UPDATE SET status = 'running', started_at = now();

    -- 5. Processing
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

    -- 6. Warnings
    IF v_rows_upserted = 0 THEN
        v_warnings := v_warnings || jsonb_build_array('No candidate locations or pincodes found');
    END IF;

    -- 7. Mark run complete
    UPDATE expansion_compute_runs 
    SET status = 'succeeded', 
        completed_at = now(), 
        rows_affected = v_rows_upserted,
        warnings = v_warnings
    WHERE id = v_run_id;

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
    WHERE id = v_run_id;

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

-- JOB 3: Run Scenario
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
    v_lock_key integer; -- Fixed: changed from bigint to integer
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

    -- 3. Advisory lock on scenario_id (serialized by job type 20003)
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
        VALUES (p_run_id, v_candidates.id, v_score, 0, jsonb_build_object('base', v_score, 'weights', v_weights))
        ON CONFLICT (run_id, candidate_id) DO UPDATE SET score = EXCLUDED.score;
        
        INSERT INTO service_area_allocations (run_id, location_id, location_type, allocated_pincodes_count)
        VALUES (p_run_id, v_candidates.id, 'candidate', floor(random() * 10))
        ON CONFLICT (run_id, location_id) DO UPDATE SET allocated_pincodes_count = EXCLUDED.allocated_pincodes_count;
    END LOOP;

    -- 7. Warnings
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
        jsonb_build_object('scenario_id', v_scenario_id, 'error', substring(SQLERRM from 1 for 200))
    );
    RAISE;
END;
$$;

-- 3. Grants
GRANT EXECUTE ON FUNCTION public.rpc_c20_build_demand_points(date, uuid, uuid) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_c20_build_travel_matrix(uuid, boolean, uuid) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_c20_run_scenario(uuid) TO service_role, authenticated;
