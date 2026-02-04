-- C14: Compute ticket SLA function

-- Drop function if exists to handle re-runs safely
DROP FUNCTION IF EXISTS public.compute_ticket_sla(uuid);

-- Function to compute SLA state for a ticket
CREATE OR REPLACE FUNCTION public.compute_ticket_sla(p_ticket_id uuid)
RETURNS void AS $$
DECLARE
    ticket_record RECORD;
    sla_policy RECORD;
    base_minutes_int INT;
    allocated_minutes_int INT;
    elapsed_minutes_int INT;
    burn_rate_numeric NUMERIC;
    risk_score_numeric NUMERIC;
    risk_level_int INT;
    new_eta_at TIMESTAMPTZ;
    new_confidence_int INT;
    current_sla_state RECORD;
    progress_pct_int INT;
    blocker_code_text TEXT;
BEGIN
    -- Get the ticket details
    SELECT * INTO ticket_record
    FROM public.tickets t
    WHERE t.id = p_ticket_id;

    -- If ticket doesn't exist, exit
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Get the most specific SLA policy for this ticket
    -- Note: service_type column doesn't exist in tickets table, so we'll use device_category as service type
    SELECT * INTO sla_policy
    FROM public.sla_policies sp
    WHERE sp.active = true
      AND (
        (sp.scope = 'global') OR
        (sp.scope = 'branch' AND sp.branch_id = ticket_record.branch_id) OR
        (sp.scope = 'category' AND sp.device_category = ticket_record.device_category) OR
        (sp.scope = 'service' AND sp.service_type = ticket_record.device_category)  -- Using device_category as service_type
      )
    ORDER BY
      CASE sp.scope
        WHEN 'service' THEN 1
        WHEN 'category' THEN 2
        WHEN 'branch' THEN 3
        WHEN 'global' THEN 4
      END
    LIMIT 1;

    -- Use default if no policy found
    IF sla_policy IS NULL THEN
        base_minutes_int := 1440; -- 24 hours default
    ELSE
        base_minutes_int := sla_policy.base_minutes;
    END IF;

    -- Calculate elapsed minutes (from ticket creation, minus paused time if applicable)
    elapsed_minutes_int := EXTRACT(EPOCH FROM (NOW() - ticket_record.created_at)) / 60;

    -- Calculate burn rate (how fast we're consuming allocated time)
    IF base_minutes_int > 0 THEN
        burn_rate_numeric := elapsed_minutes_int::NUMERIC / base_minutes_int::NUMERIC;
    ELSE
        burn_rate_numeric := 0;
    END IF;

    -- Calculate progress percentage based on status
    progress_pct_int := CASE
        WHEN ticket_record.status = 'pending' THEN 0
        WHEN ticket_record.status = 'assigned' THEN 10
        WHEN ticket_record.status = 'in_progress' THEN 30
        WHEN ticket_record.status = 'part_required' THEN 50
        WHEN ticket_record.status = 'part_arrived' THEN 70
        WHEN ticket_record.status = 'ready_for_pickup' THEN 90
        WHEN ticket_record.status = 'completed' THEN 100
        ELSE 0
    END;

    -- Determine blocker code if any
    blocker_code_text := NULL;
    IF ticket_record.status = 'part_required' THEN
        blocker_code_text := 'parts_pending';
    ELSIF ticket_record.status = 'awaiting_approval' THEN
        blocker_code_text := 'customer_approval';
    END IF;

    -- Calculate risk score (v1) - based on burn rate, blocker, and progress
    risk_score_numeric := burn_rate_numeric * 10;

    -- Add risk for blockers
    IF blocker_code_text IS NOT NULL THEN
        risk_score_numeric := risk_score_numeric + 5;
    END IF;

    -- Add risk if progress is slow relative to time elapsed
    IF burn_rate_numeric > 1.0 AND progress_pct_int < 50 THEN
        risk_score_numeric := risk_score_numeric + 3;
    END IF;

    -- Calculate risk level based on risk score
    risk_level_int := CASE
        WHEN risk_score_numeric >= 8 THEN 3  -- High risk
        WHEN risk_score_numeric >= 5 THEN 2  -- Medium risk
        WHEN risk_score_numeric >= 2 THEN 1  -- Low risk
        ELSE 0  -- No risk
    END;

    -- Calculate new ETA based on base time and current progress
    -- If progress is slow, extend the ETA
    IF progress_pct_int > 0 THEN
        -- Calculate projected total time based on current burn rate
        allocated_minutes_int := base_minutes_int;
        -- Projected ETA: creation time + (base_minutes * burn_rate)
        new_eta_at := ticket_record.created_at + (allocated_minutes_int * burn_rate_numeric * '1 minute'::INTERVAL);
    ELSE
        -- If no progress yet, use base time
        allocated_minutes_int := base_minutes_int;
        new_eta_at := ticket_record.created_at + (allocated_minutes_int * '1 minute'::INTERVAL);
    END IF;

    -- Set confidence based on risk level (lower for higher risk)
    new_confidence_int := CASE
        WHEN risk_level_int = 3 THEN 30
        WHEN risk_level_int = 2 THEN 50
        WHEN risk_level_int = 1 THEN 70
        ELSE 85
    END;

    -- Get current SLA state to check for changes
    SELECT * INTO current_sla_state
    FROM public.ticket_sla_state s
    WHERE s.ticket_id = p_ticket_id;

    -- Insert into ledger if there are meaningful changes
    IF current_sla_state IS NULL OR
       ABS(EXTRACT(EPOCH FROM (new_eta_at - COALESCE(current_sla_state.eta_at, new_eta_at))) / 60) > 15 OR  -- ETA changed by more than 15 mins
       ABS(COALESCE(new_confidence_int, 0) - COALESCE(current_sla_state.confidence, 0)) > 5 OR  -- Confidence changed by more than 5
       ABS(COALESCE(risk_score_numeric, 0) - COALESCE(current_sla_state.risk_score, 0)) > 0.5 THEN  -- Risk changed by more than 0.5

        -- Insert into ledger
        INSERT INTO public.ticket_sla_ledger (
            ticket_id,
            old_eta_at,
            new_eta_at,
            old_confidence,
            new_confidence,
            old_risk_score,
            new_risk_score,
            reason_code,
            reason_meta,
            actor_id,
            actor_role,
            source
        ) VALUES (
            p_ticket_id,
            current_sla_state.eta_at,
            new_eta_at,
            current_sla_state.confidence,
            new_confidence_int,
            current_sla_state.risk_score,
            risk_score_numeric,
            'automatic_calculation',
            jsonb_build_object(
                'status', ticket_record.status,
                'progress_pct', progress_pct_int,
                'burn_rate', burn_rate_numeric,
                'blocker', blocker_code_text
            ),
            NULL,  -- actor_id - this is a system calculation
            'system',
            'system'
        );
    END IF;

    -- Upsert the ticket SLA state
    INSERT INTO public.ticket_sla_state (
        ticket_id,
        branch_id,
        technician_id,
        customer_id,
        eta_at,
        eta_window_minutes,
        confidence,
        allocated_minutes,
        elapsed_minutes,
        progress_pct,
        risk_score,
        risk_level,
        burn_rate,
        blocker_code,
        last_recalc_at
    ) VALUES (
        p_ticket_id,
        ticket_record.branch_id,
        ticket_record.assigned_technician_id,
        ticket_record.customer_id,
        new_eta_at,
        120,  -- Default 2-hour window
        new_confidence_int,
        allocated_minutes_int,
        elapsed_minutes_int,
        progress_pct_int,
        risk_score_numeric,
        risk_level_int,
        burn_rate_numeric,
        blocker_code_text,
        NOW()
    )
    ON CONFLICT (ticket_id)
    DO UPDATE SET
        eta_at = EXCLUDED.eta_at,
        eta_window_minutes = EXCLUDED.eta_window_minutes,
        confidence = EXCLUDED.confidence,
        allocated_minutes = EXCLUDED.allocated_minutes,
        elapsed_minutes = EXCLUDED.elapsed_minutes,
        progress_pct = EXCLUDED.progress_pct,
        risk_score = EXCLUDED.risk_score,
        risk_level = EXCLUDED.risk_level,
        burn_rate = EXCLUDED.burn_rate,
        blocker_code = EXCLUDED.blocker_code,
        last_recalc_at = EXCLUDED.last_recalc_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.compute_ticket_sla(uuid) TO service_role;