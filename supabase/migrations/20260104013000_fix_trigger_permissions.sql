-- Migration: Fix trigger permissions by adding SECURITY DEFINER
-- This ensures triggers can perform system operations (like updating snapshots or logging events) 
-- even when triggered by users with restricted RLS permissions (like 'customer').

-- 1. Fix public.update_sla_on_ticket_change (Resolves 403 Forbidden on customer_sla_snapshot)
CREATE OR REPLACE FUNCTION public.update_sla_on_ticket_change()
RETURNS TRIGGER AS $$
DECLARE
    promised_hours_val INT;
    elapsed_hours_val NUMERIC;
    status_val TEXT;
BEGIN
    -- Calculate promised hours based on device category (default to 24h)
    CASE
        WHEN NEW.device_category = 'television' THEN
            promised_hours_val := 72;
        WHEN NEW.device_category = 'mobile' THEN
            promised_hours_val := 24;
        WHEN NEW.device_category = 'laptop' THEN
            promised_hours_val := 48;
        WHEN NEW.device_category = 'appliances' THEN
            promised_hours_val := 72;
        ELSE
            promised_hours_val := 48; -- default
    END CASE;

    -- Calculate elapsed hours
    elapsed_hours_val := EXTRACT(EPOCH FROM (NOW() - NEW.created_at)) / 3600;

    -- Determine SLA status
    IF elapsed_hours_val > promised_hours_val THEN
        status_val := 'breached';
    ELSIF elapsed_hours_val > (promised_hours_val * 0.8) THEN  -- 80% of promised time
        status_val := 'at_risk';
    ELSE
        status_val := 'active';
    END IF;

    -- Update SLA snapshot (using ON CONFLICT for robustness)
    INSERT INTO public.customer_sla_snapshot (
        ticket_id,
        promised_hours,
        elapsed_hours,
        status
    ) VALUES (
        NEW.id,
        promised_hours_val,
        elapsed_hours_val,
        status_val
    )
    ON CONFLICT (ticket_id)
    DO UPDATE SET
        promised_hours = EXCLUDED.promised_hours,
        elapsed_hours = EXCLUDED.elapsed_hours,
        status = EXCLUDED.status,
        last_updated = NOW()
    WHERE 
        customer_sla_snapshot.promised_hours != EXCLUDED.promised_hours
        OR ABS(customer_sla_snapshot.elapsed_hours - EXCLUDED.elapsed_hours) > 0.1
        OR customer_sla_snapshot.status != EXCLUDED.status;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix public.handle_ticket_sla_update
CREATE OR REPLACE FUNCTION public.handle_ticket_sla_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Call the SLA computation function (which is already SECURITY DEFINER)
    PERFORM public.compute_ticket_sla(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix public.handle_manual_sla_update
CREATE OR REPLACE FUNCTION public.handle_manual_sla_update()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.ticket_sla_state
    SET last_recalc_at = NOW()
    WHERE ticket_id = NEW.ticket_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Fix/Create public.detect_transporter_stall (Helper function)
CREATE OR REPLACE FUNCTION public.detect_transporter_stall(
    p_transporter_job_id TEXT,
    p_last_location_update TIMESTAMPTZ,
    p_current_location TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    last_update TIMESTAMPTZ;
    time_diff INTERVAL;
BEGIN
    SELECT MAX(created_at) INTO last_update
    FROM public.ticket_events
    WHERE event_type = 'transporter_location_update'
    AND details->>'transporter_job_id' = p_transporter_job_id;

    IF last_update IS NULL THEN
        RETURN FALSE;
    END IF;

    time_diff := NOW() - last_update;
    RETURN time_diff > INTERVAL '15 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fix/Create public.create_pickup_risk_event (Re-defining with SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.create_pickup_risk_event(
    p_ticket_id UUID,
    p_risk_type TEXT,
    p_risk_description TEXT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.ticket_events (
        ticket_id,
        event_type,
        title,
        description,
        details,
        created_at
    ) VALUES (
        p_ticket_id,
        'pickup_risk',
        'Pickup Risk',
        p_risk_description,
        jsonb_build_object(
            'risk_type', p_risk_type,
            'risk_level', 'medium',
            'detected_at', NOW()
        ),
        NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Fix/Create public.flag_transporter_delay (Re-defining with SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.flag_transporter_delay(
    p_ticket_id UUID,
    p_delay_type TEXT,
    p_delay_reason TEXT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.ticket_events (
        ticket_id,
        event_type,
        title,
        description,
        details,
        created_at
    ) VALUES (
        p_ticket_id,
        'transporter_delay',
        'Transporter Delay',
        p_delay_reason,
        jsonb_build_object(
            'delay_type', p_delay_type,
            'detected_at', NOW()
        ),
        NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Fix public.monitor_pickup_schedule
CREATE OR REPLACE FUNCTION public.monitor_pickup_schedule()
RETURNS TRIGGER AS $$
DECLARE
    pickup_scheduled TIMESTAMPTZ;
    current_time TIMESTAMPTZ := NOW();
BEGIN
    IF (NEW.pickup_scheduled_at IS NOT NULL AND (OLD.pickup_scheduled_at IS NULL OR OLD.pickup_scheduled_at IS DISTINCT FROM NEW.pickup_scheduled_at)) THEN
        pickup_scheduled := NEW.pickup_scheduled_at;
        
        IF pickup_scheduled < current_time THEN
            PERFORM public.create_pickup_risk_event(
                NEW.id,
                'late_scheduling',
                'Pickup was scheduled for ' || pickup_scheduled::TEXT || ' but is now overdue'
            );
        ELSIF pickup_scheduled BETWEEN current_time AND current_time + INTERVAL '30 minutes' THEN
            IF NEW.transporter_job_id IS NULL THEN
                PERFORM public.create_pickup_risk_event(
                    NEW.id,
                    'unassigned_transporter',
                    'Pickup is scheduled soon but no transporter is assigned'
                );
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Fix public.handle_transporter_location_update
CREATE OR REPLACE FUNCTION public.handle_transporter_location_update()
RETURNS TRIGGER AS $$
DECLARE
    stall_detected BOOLEAN;
    ticket_id UUID;
BEGIN
    IF NEW.event_type != 'transporter_location_update' THEN
        RETURN NEW;
    END IF;

    ticket_id := NEW.ticket_id;

    stall_detected := public.detect_transporter_stall(
        NEW.details->>'transporter_job_id',
        NEW.created_at,
        NEW.details->>'location'
    );

    IF stall_detected THEN
        PERFORM public.flag_transporter_delay(
            ticket_id,
            'stall',
            'Transporter has not moved for more than 15 minutes'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Final Permission Check
GRANT SELECT ON public.customer_sla_snapshot TO authenticated;
GRANT SELECT ON public.ticket_events TO authenticated;
