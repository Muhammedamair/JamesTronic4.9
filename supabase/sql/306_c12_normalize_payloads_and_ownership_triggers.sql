-- C12.4: Normalize event payloads using JSONB and ownership update triggers
-- Optimizes event storage and adds triggers to track ownership changes

-- Function to standardize event payload structure
CREATE OR REPLACE FUNCTION normalize_event_payload(event_type TEXT, payload JSONB)
RETURNS JSONB AS $$
DECLARE
    normalized_payload JSONB;
BEGIN
    -- Create a standardized payload structure based on event type
    CASE event_type
        WHEN 'status_change' THEN
            normalized_payload := jsonb_build_object(
                'status', payload->>'status',
                'previous_status', payload->>'previous_status',
                'note', payload->>'note',
                'changed_by', payload->>'changed_by'
            );
        WHEN 'transporter_assigned' THEN
            normalized_payload := jsonb_build_object(
                'transporter_id', payload->>'transporter_id',
                'transporter_name', payload->>'transporter_name',
                'job_id', payload->>'job_id',
                'estimated_pickup', payload->>'estimated_pickup',
                'estimated_drop', payload->>'estimated_drop'
            );
        WHEN 'technician_assigned' THEN
            normalized_payload := jsonb_build_object(
                'technician_id', payload->>'technician_id',
                'technician_name', payload->>'technician_name',
                'specialization', payload->>'specialization'
            );
        WHEN 'part_required' THEN
            normalized_payload := jsonb_build_object(
                'part_name', payload->>'part_name',
                'part_number', payload->>'part_number',
                'estimated_cost', payload->>'estimated_cost',
                'required_quantity', payload->>'required_quantity',
                'priority', payload->>'priority'
            );
        WHEN 'quotation_created' THEN
            normalized_payload := jsonb_build_object(
                'quoted_price', payload->>'quoted_price',
                'parts_cost', payload->>'parts_cost',
                'labor_cost', payload->>'labor_cost',
                'notes', payload->>'notes',
                'valid_until', payload->>'valid_until'
            );
        WHEN 'sla_updated' THEN
            normalized_payload := jsonb_build_object(
                'promised_hours', payload->>'promised_hours',
                'start_time', payload->>'start_time',
                'previous_promised_hours', payload->>'previous_promised_hours',
                'updated_by', payload->>'updated_by'
            );
        WHEN 'transporter_location_update' THEN
            normalized_payload := jsonb_build_object(
                'location', payload->>'location',
                'latitude', payload->>'latitude',
                'longitude', payload->>'longitude',
                'transporter_job_id', payload->>'transporter_job_id',
                'speed', payload->>'speed',
                'heading', payload->>'heading'
            );
        WHEN 'customer_communication' THEN
            normalized_payload := jsonb_build_object(
                'communication_channel', payload->>'communication_channel',
                'message_type', payload->>'message_type',
                'message_content', payload->>'message_content',
                'sent_by', payload->>'sent_by'
            );
        ELSE
            -- For unknown event types, return the original payload
            normalized_payload := payload;
    END CASE;

    RETURN normalized_payload;
END;
$$ LANGUAGE plpgsql;

-- Function to validate and normalize event details
CREATE OR REPLACE FUNCTION validate_and_normalize_event_details(
    p_event_type TEXT,
    p_details JSONB
) RETURNS JSONB AS $$
BEGIN
    -- Ensure details is a valid JSON object
    IF p_details IS NULL OR jsonb_typeof(p_details) != 'object' THEN
        RETURN '{}';
    END IF;

    -- Normalize the payload based on event type
    RETURN normalize_event_payload(p_event_type, p_details);
END;
$$ LANGUAGE plpgsql;

-- Trigger function for normalizing event details on insert
CREATE OR REPLACE FUNCTION normalize_event_details_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Normalize the details field before inserting
    NEW.details := validate_and_normalize_event_details(NEW.event_type, NEW.details);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for normalizing event details
CREATE TRIGGER normalize_event_details_trigger
    BEFORE INSERT ON public.ticket_events
    FOR EACH ROW
    EXECUTE FUNCTION normalize_event_details_trigger();

-- Function to handle ownership changes in tickets
CREATE OR REPLACE FUNCTION handle_ticket_ownership_change()
RETURNS TRIGGER AS $$
DECLARE
    event_title TEXT;
    event_description TEXT;
    event_details JSONB;
BEGIN
    -- Check if the customer_id changed (ownership transfer)
    IF OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
        event_title := 'Ticket Ownership Changed';
        event_description := 'Ticket ownership transferred from customer ' || COALESCE(OLD.customer_id, 'NULL') || ' to ' || COALESCE(NEW.customer_id, 'NULL');
        
        event_details := jsonb_build_object(
            'previous_customer_id', OLD.customer_id,
            'new_customer_id', NEW.customer_id,
            'changed_by', CURRENT_USER,
            'change_reason', 'system_transfer'
        );

        -- Insert an event to track this ownership change
        INSERT INTO public.ticket_events (
            ticket_id,
            event_type,
            title,
            description,
            details,
            created_by,
            created_at
        ) VALUES (
            NEW.id,
            'ownership_change',
            event_title,
            event_description,
            event_details,
            NULL, -- No specific user for system events
            NOW()
        );
    END IF;

    -- Check if technician assignment changed
    IF OLD.assigned_technician_id IS DISTINCT FROM NEW.assigned_technician_id THEN
        event_title := 'Technician Assignment Changed';
        
        IF NEW.assigned_technician_id IS NOT NULL AND OLD.assigned_technician_id IS NULL THEN
            event_description := 'Ticket assigned to technician';
        ELSIF NEW.assigned_technician_id IS NULL AND OLD.assigned_technician_id IS NOT NULL THEN
            event_description := 'Technician assignment removed';
        ELSE
            event_description := 'Ticket reassigned to different technician';
        END IF;
        
        event_details := jsonb_build_object(
            'previous_technician_id', OLD.assigned_technician_id,
            'new_technician_id', NEW.assigned_technician_id,
            'changed_by', CURRENT_USER
        );

        INSERT INTO public.ticket_events (
            ticket_id,
            event_type,
            title,
            description,
            details,
            created_by,
            created_at
        ) VALUES (
            NEW.id,
            'technician_assignment_change',
            event_title,
            event_description,
            event_details,
            NULL,
            NOW()
        );
    END IF;

    -- Check if transporter assignment changed
    IF OLD.transporter_job_id IS DISTINCT FROM NEW.transporter_job_id THEN
        event_title := 'Transporter Assignment Changed';
        
        IF NEW.transporter_job_id IS NOT NULL AND OLD.transporter_job_id IS NULL THEN
            event_description := 'Transporter job assigned';
        ELSIF NEW.transporter_job_id IS NULL AND OLD.transporter_job_id IS NOT NULL THEN
            event_description := 'Transporter job unassigned';
        ELSE
            event_description := 'Transporter job reassigned';
        END IF;
        
        event_details := jsonb_build_object(
            'previous_transporter_job_id', OLD.transporter_job_id,
            'new_transporter_job_id', NEW.transporter_job_id,
            'changed_by', CURRENT_USER
        );

        INSERT INTO public.ticket_events (
            ticket_id,
            event_type,
            title,
            description,
            details,
            created_by,
            created_at
        ) VALUES (
            NEW.id,
            'transporter_assignment_change',
            event_title,
            event_description,
            event_details,
            NULL,
            NOW()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for handling ticket ownership changes
CREATE TRIGGER ticket_ownership_change_trigger
    AFTER UPDATE ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION handle_ticket_ownership_change();

-- Create trigger for handling customer updates that might affect ticket access
CREATE OR REPLACE FUNCTION handle_customer_update()
RETURNS TRIGGER AS $$
DECLARE
    event_title TEXT;
    event_description TEXT;
    event_details JSONB;
BEGIN
    -- Check if important customer information changed that might affect communications
    IF (OLD.notification_preferences IS DISTINCT FROM NEW.notification_preferences) OR
       (OLD.preferred_language IS DISTINCT FROM NEW.preferred_language) OR
       (OLD.phone_e164 IS DISTINCT FROM NEW.phone_e164) THEN
       
        event_title := 'Customer Profile Updated';
        event_description := 'Customer profile information updated';
        
        event_details := jsonb_build_object(
            'updated_fields', jsonb_build_array(),
            'changed_at', NOW(),
            'customer_id', NEW.id
        );

        -- Add specific changed fields to the details
        IF OLD.notification_preferences IS DISTINCT FROM NEW.notification_preferences THEN
            event_details := event_details || jsonb_build_object('notification_preferences_changed', true);
        END IF;
        
        IF OLD.preferred_language IS DISTINCT FROM NEW.preferred_language THEN
            event_details := event_details || jsonb_build_object('preferred_language_changed', NEW.preferred_language);
        END IF;
        
        IF OLD.phone_e164 IS DISTINCT FROM NEW.phone_e164 THEN
            event_details := event_details || jsonb_build_object('phone_changed', NEW.phone_e164);
        END IF;

        -- Insert events for all tickets belonging to this customer
        INSERT INTO public.ticket_events (
            ticket_id,
            event_type,
            title,
            description,
            details,
            created_by,
            created_at
        )
        SELECT 
            t.id,
            'customer_profile_update',
            event_title,
            event_description,
            event_details,
            NULL,
            NOW()
        FROM public.tickets t
        WHERE t.customer_id = NEW.id;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for handling customer updates
CREATE TRIGGER customer_update_trigger
    AFTER UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION handle_customer_update();

-- Optimize indexes for normalized event queries
-- Create specific indexes for common query patterns on normalized JSON data
CREATE INDEX IF NOT EXISTS idx_ticket_events_details_gin ON public.ticket_events USING GIN (details);
CREATE INDEX IF NOT EXISTS idx_ticket_events_type_details_gin ON public.ticket_events (event_type) WHERE details ? 'transporter_job_id';
CREATE INDEX IF NOT EXISTS idx_ticket_events_sla_risk ON public.ticket_events (event_type, ticket_id) WHERE event_type IN ('sla_at_risk', 'sla_breached', 'sla_fulfilled');