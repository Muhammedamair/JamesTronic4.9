-- Migration: C17 Workforce Scoring RPCs
-- Creates RPCs for score calculation and incident management.

-- ============================================================================
-- 1. RPC: Calculate Daily Behaviour Score
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_calculate_workforce_daily_score(
    p_user_id uuid,
    p_score_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reliability_score integer := 100;
    v_punctuality_score integer := 100;
    v_quality_score integer := 100;
    v_incident_factor integer := 0;
    v_jobs_completed integer := 0;
    v_jobs_failed integer := 0;
    v_incidents_count integer := 0;
    v_late_minutes integer := 0;
    v_customer_rating numeric := 0;
    v_sla_compliance numeric := 100;
    v_result jsonb;
BEGIN
    -- 1. Get performance metrics for the day
    SELECT 
        COALESCE(jobs_completed, 0),
        COALESCE(jobs_failed, 0),
        COALESCE(customer_rating_avg, 5.0),
        COALESCE(sla_compliance_rate, 100)
    INTO v_jobs_completed, v_jobs_failed, v_customer_rating, v_sla_compliance
    FROM public.workforce_performance_daily
    WHERE user_id = p_user_id AND performance_date = p_score_date;

    -- 2. Get attendance metrics
    SELECT COALESCE(SUM(late_minutes), 0)
    INTO v_late_minutes
    FROM public.workforce_attendance
    WHERE user_id = p_user_id AND DATE(check_in_at) = p_score_date;

    -- 3. Get incident count
    SELECT COUNT(*)
    INTO v_incidents_count
    FROM public.workforce_incidents
    WHERE user_id = p_user_id 
      AND DATE(created_at) = p_score_date
      AND resolved_at IS NULL;

    -- 4. Calculate component scores
    
    -- Reliability: Based on job completion rate
    IF (v_jobs_completed + v_jobs_failed) > 0 THEN
        v_reliability_score := LEAST(100, GREATEST(0, 
            (v_jobs_completed::numeric / (v_jobs_completed + v_jobs_failed) * 100)::integer
        ));
    END IF;

    -- Punctuality: Deduct points for late minutes (max 50 point deduction)
    v_punctuality_score := GREATEST(50, 100 - LEAST(50, v_late_minutes));

    -- Quality: Based on customer rating (1-5 scale mapped to 0-100)
    v_quality_score := LEAST(100, GREATEST(0, (v_customer_rating * 20)::integer));

    -- Incident Factor: Each unresolved incident adds to the factor
    v_incident_factor := LEAST(100, v_incidents_count * 15);

    -- 5. Upsert the score
    INSERT INTO public.workforce_behaviour_scores (
        user_id, score_date, reliability_score, punctuality_score, 
        quality_score, incident_factor, jobs_counted, incidents_counted
    )
    VALUES (
        p_user_id, p_score_date, v_reliability_score, v_punctuality_score,
        v_quality_score, v_incident_factor, v_jobs_completed + v_jobs_failed, v_incidents_count
    )
    ON CONFLICT (user_id, score_date) DO UPDATE SET
        reliability_score = EXCLUDED.reliability_score,
        punctuality_score = EXCLUDED.punctuality_score,
        quality_score = EXCLUDED.quality_score,
        incident_factor = EXCLUDED.incident_factor,
        jobs_counted = EXCLUDED.jobs_counted,
        incidents_counted = EXCLUDED.incidents_counted,
        updated_at = now();

    -- 6. Return the calculated scores
    SELECT jsonb_build_object(
        'user_id', p_user_id,
        'score_date', p_score_date,
        'reliability_score', v_reliability_score,
        'punctuality_score', v_punctuality_score,
        'quality_score', v_quality_score,
        'incident_factor', v_incident_factor,
        'composite_score', (v_reliability_score * 35 + v_punctuality_score * 25 + v_quality_score * 25 + (100 - v_incident_factor) * 15) / 100
    ) INTO v_result;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.rpc_calculate_workforce_daily_score IS 'Calculates and stores daily behaviour score for a workforce member.';

-- ============================================================================
-- 2. RPC: Log Workforce Incident
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_log_workforce_incident(
    p_user_id uuid,
    p_incident_type incident_type,
    p_severity incident_severity,
    p_description text,
    p_ticket_id uuid DEFAULT NULL,
    p_transport_job_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_incident_id uuid;
    v_reporter_id uuid;
BEGIN
    -- Get the current user as reporter
    v_reporter_id := auth.uid();

    -- Insert the incident
    INSERT INTO public.workforce_incidents (
        user_id, incident_type, severity, description,
        ticket_id, transport_job_id, reported_by
    )
    VALUES (
        p_user_id, p_incident_type, p_severity, p_description,
        p_ticket_id, p_transport_job_id, v_reporter_id
    )
    RETURNING id INTO v_incident_id;

    -- Trigger score recalculation
    PERFORM public.rpc_calculate_workforce_daily_score(p_user_id, CURRENT_DATE);

    RETURN v_incident_id;
END;
$$;

COMMENT ON FUNCTION public.rpc_log_workforce_incident IS 'Logs a workforce incident and triggers score recalculation.';

-- ============================================================================
-- 3. RPC: Resolve Workforce Incident
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_resolve_workforce_incident(
    p_incident_id uuid,
    p_resolution_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    -- Get the user_id and resolve the incident
    UPDATE public.workforce_incidents
    SET resolved_at = now(),
        resolution_notes = p_resolution_notes
    WHERE id = p_incident_id AND resolved_at IS NULL
    RETURNING user_id INTO v_user_id;

    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Trigger score recalculation
    PERFORM public.rpc_calculate_workforce_daily_score(v_user_id, CURRENT_DATE);

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.rpc_resolve_workforce_incident IS 'Resolves a workforce incident and recalculates scores.';

-- ============================================================================
-- 4. RPC: Worker Check-In
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_workforce_check_in(
    p_lat numeric DEFAULT NULL,
    p_lng numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_shift_id uuid;
    v_expected_start time;
    v_late_minutes integer := 0;
    v_attendance_id uuid;
BEGIN
    v_user_id := auth.uid();

    -- Find today's shift
    SELECT id, expected_start
    INTO v_shift_id, v_expected_start
    FROM public.workforce_shifts
    WHERE user_id = v_user_id AND shift_date = CURRENT_DATE;

    -- Calculate late minutes if shift exists
    IF v_expected_start IS NOT NULL AND CURRENT_TIME > v_expected_start THEN
        v_late_minutes := EXTRACT(EPOCH FROM (CURRENT_TIME - v_expected_start)) / 60;
    END IF;

    -- Create attendance record
    INSERT INTO public.workforce_attendance (
        user_id, shift_id, check_in_at, check_in_lat, check_in_lng, late_minutes
    )
    VALUES (
        v_user_id, v_shift_id, now(), p_lat, p_lng, v_late_minutes
    )
    RETURNING id INTO v_attendance_id;

    -- Log late arrival incident if significant
    IF v_late_minutes > 15 THEN
        INSERT INTO public.workforce_incidents (
            user_id, incident_type, severity, description, reported_by
        )
        VALUES (
            v_user_id, 'late_arrival', 
            CASE WHEN v_late_minutes > 60 THEN 'high' WHEN v_late_minutes > 30 THEN 'medium' ELSE 'low' END,
            'Late arrival by ' || v_late_minutes || ' minutes.',
            v_user_id
        );
    END IF;

    RETURN v_attendance_id;
END;
$$;

COMMENT ON FUNCTION public.rpc_workforce_check_in IS 'Records worker check-in with location and calculates lateness.';

-- ============================================================================
-- 5. RPC: Worker Check-Out
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_workforce_check_out(
    p_lat numeric DEFAULT NULL,
    p_lng numeric DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_attendance_id uuid;
    v_shift_id uuid;
    v_expected_end time;
    v_early_minutes integer := 0;
BEGIN
    v_user_id := auth.uid();

    -- Find today's open attendance record
    SELECT a.id, a.shift_id
    INTO v_attendance_id, v_shift_id
    FROM public.workforce_attendance a
    WHERE a.user_id = v_user_id 
      AND DATE(a.check_in_at) = CURRENT_DATE 
      AND a.check_out_at IS NULL
    ORDER BY a.check_in_at DESC
    LIMIT 1;

    IF v_attendance_id IS NULL THEN
        RAISE EXCEPTION 'No active check-in found for today.';
    END IF;

    -- Get expected end time from shift
    IF v_shift_id IS NOT NULL THEN
        SELECT expected_end INTO v_expected_end
        FROM public.workforce_shifts
        WHERE id = v_shift_id;

        IF v_expected_end IS NOT NULL AND CURRENT_TIME < v_expected_end THEN
            v_early_minutes := EXTRACT(EPOCH FROM (v_expected_end - CURRENT_TIME)) / 60;
        END IF;
    END IF;

    -- Update attendance record
    UPDATE public.workforce_attendance
    SET check_out_at = now(),
        check_out_lat = p_lat,
        check_out_lng = p_lng,
        early_departure_minutes = v_early_minutes
    WHERE id = v_attendance_id;

    -- Log early departure incident if significant
    IF v_early_minutes > 30 THEN
        INSERT INTO public.workforce_incidents (
            user_id, incident_type, severity, description, reported_by
        )
        VALUES (
            v_user_id, 'early_departure', 
            CASE WHEN v_early_minutes > 120 THEN 'high' WHEN v_early_minutes > 60 THEN 'medium' ELSE 'low' END,
            'Early departure by ' || v_early_minutes || ' minutes.',
            v_user_id
        );
    END IF;

    -- Recalculate daily score
    PERFORM public.rpc_calculate_workforce_daily_score(v_user_id, CURRENT_DATE);

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.rpc_workforce_check_out IS 'Records worker check-out and calculates early departure.';

-- ============================================================================
-- 6. GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.rpc_calculate_workforce_daily_score TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_log_workforce_incident TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_resolve_workforce_incident TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_workforce_check_in TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_workforce_check_out TO authenticated;
