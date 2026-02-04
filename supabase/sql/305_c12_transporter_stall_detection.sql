-- C12.3: Transporter stall detection and delay flagging
-- Creates functions and triggers for detecting when transporters are stalled

-- Function to detect transporter stall (no movement for more than 15 minutes)
CREATE OR REPLACE FUNCTION detect_transporter_stall(
    p_transporter_job_id TEXT,
    p_last_location_update TIMESTAMPTZ,
    p_current_location TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    last_update TIMESTAMPTZ;
    time_diff INTERVAL;
BEGIN
    -- Get the last location update time for this transporter job
    SELECT MAX(created_at) INTO last_update
    FROM ticket_events
    WHERE event_type = 'transporter_location_update'
    AND details->>'transporter_job_id' = p_transporter_job_id;

    -- If no previous updates found, no stall detected
    IF last_update IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Calculate time difference
    time_diff := NOW() - last_update;

    -- If no movement for more than 15 minutes, consider it a stall
    RETURN time_diff > INTERVAL '15 minutes';
END;
$$ LANGUAGE plpgsql;

-- Function to flag transporter delays
CREATE OR REPLACE FUNCTION flag_transporter_delay(
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
$$ LANGUAGE plpgsql;

-- Function to create pickup risk events
CREATE OR REPLACE FUNCTION create_pickup_risk_event(
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
$$ LANGUAGE plpgsql;

-- Function to track transporter location updates
CREATE OR REPLACE FUNCTION handle_transporter_location_update()
RETURNS TRIGGER AS $$
DECLARE
    stall_detected BOOLEAN;
    ticket_id UUID;
BEGIN
    -- Only handle transporter location update events
    IF NEW.event_type != 'transporter_location_update' THEN
        RETURN NEW;
    END IF;

    -- Extract ticket ID from the details or from the ticket_events reference
    ticket_id := NEW.ticket_id;

    -- Check if this is a stall situation
    stall_detected := detect_transporter_stall(
        NEW.details->>'transporter_job_id',
        NEW.created_at,
        NEW.details->>'location'
    );

    -- If stall is detected, create a delay flag event
    IF stall_detected THEN
        PERFORM flag_transporter_delay(
            ticket_id,
            'stall',
            'Transporter has not moved for more than 15 minutes'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for transporter location updates
CREATE TRIGGER transporter_location_update_trigger
    AFTER INSERT ON public.ticket_events
    FOR EACH ROW
    WHEN (NEW.event_type = 'transporter_location_update')
    EXECUTE FUNCTION handle_transporter_location_update();

-- Function to monitor pickup scheduling and detect risks
CREATE OR REPLACE FUNCTION monitor_pickup_schedule()
RETURNS TRIGGER AS $$
DECLARE
    pickup_scheduled TIMESTAMPTZ;
    current_time TIMESTAMPTZ := NOW();
BEGIN
    -- If pickup was scheduled, check if there are risks
    IF (NEW.pickup_scheduled_at IS NOT NULL AND OLD.pickup_scheduled_at IS DISTINCT FROM NEW.pickup_scheduled_at) THEN
        pickup_scheduled := NEW.pickup_scheduled_at;
        
        -- If pickup is scheduled in the past, create a risk event
        IF pickup_scheduled < current_time THEN
            PERFORM create_pickup_risk_event(
                NEW.id,
                'late_scheduling',
                'Pickup was scheduled for ' || pickup_scheduled::TEXT || ' but is now overdue'
            );
        -- If pickup is scheduled within the next 30 minutes, create an alert
        ELSIF pickup_scheduled BETWEEN current_time AND current_time + INTERVAL '30 minutes' THEN
            -- Check if transporter is assigned
            IF NEW.transporter_job_id IS NULL THEN
                PERFORM create_pickup_risk_event(
                    NEW.id,
                    'unassigned_transporter',
                    'Pickup is scheduled soon but no transporter is assigned'
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on tickets table to monitor pickup scheduling
CREATE TRIGGER pickup_schedule_monitor_trigger
    AFTER UPDATE ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION monitor_pickup_schedule();

-- Add columns for transporter tracking to tickets table (if not already present)
-- Note: These were added in the previous migration, but adding here for completeness
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS last_transporter_location_update TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS transporter_current_location TEXT,
ADD COLUMN IF NOT EXISTS transporter_stall_flag BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS transporter_delay_reason TEXT;

-- Index for efficient transporter stall detection
CREATE INDEX IF NOT EXISTS idx_tickets_transporter_stall_check 
ON public.tickets (transporter_job_id, last_transporter_location_update) 
WHERE transporter_job_id IS NOT NULL;

-- Index for pickup risk monitoring
CREATE INDEX IF NOT EXISTS idx_tickets_pickup_monitoring 
ON public.tickets (pickup_scheduled_at, transporter_job_id)
WHERE pickup_scheduled_at IS NOT NULL;