-- C12.2: Add predictive SLA warnings and risk triggers
-- Creates functions and triggers for SLA risk detection

-- Function to calculate remaining SLA time
CREATE OR REPLACE FUNCTION calculate_remaining_sla_time(ticket_sla_record public.ticket_sla)
RETURNS INTERVAL AS $$
BEGIN
  -- If the SLA is already fulfilled or breached, return 0
  IF ticket_sla_record.status IN ('fulfilled', 'breached') THEN
    RETURN INTERVAL '0 hours';
  END IF;

  -- Calculate remaining time based on promised hours and start time
  -- This assumes that SLA is calculated from start_time + promised_hours
  IF ticket_sla_record.promised_hours IS NOT NULL THEN
    RETURN (ticket_sla_record.start_time + (ticket_sla_record.promised_hours || ' hours')::INTERVAL) - NOW();
  ELSE
    -- If no promised hours, return a large value indicating no SLA
    RETURN INTERVAL '999999 hours';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check if SLA is at risk (remaining time < 2 hours)
CREATE OR REPLACE FUNCTION is_sla_at_risk(ticket_sla_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  remaining_time INTERVAL;
  sla_record public.ticket_sla;
BEGIN
  SELECT * INTO sla_record FROM public.ticket_sla WHERE id = ticket_sla_id;
  
  IF sla_record IS NULL THEN
    RETURN FALSE;
  END IF;

  remaining_time := calculate_remaining_sla_time(sla_record);
  
  -- If remaining time is less than 2 hours and status is active, it's at risk
  RETURN remaining_time < INTERVAL '2 hours' AND sla_record.status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Function to create SLA risk events
CREATE OR REPLACE FUNCTION create_sla_risk_event(ticket_id UUID, remaining_hours NUMERIC)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.ticket_events (
    ticket_id,
    event_type,
    title,
    description,
    details,
    created_at
  ) VALUES (
    ticket_id,
    'sla_at_risk',
    'SLA at Risk',
    'Ticket SLA is approaching breach with ' || remaining_hours || ' hours remaining',
    jsonb_build_object(
      'remaining_hours', remaining_hours,
      'sla_status', 'at_risk'
    ),
    NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger function to check SLA status on ticket_sla updates
CREATE OR REPLACE FUNCTION check_sla_status_trigger()
RETURNS TRIGGER AS $$
DECLARE
  remaining_time INTERVAL;
  remaining_hours NUMERIC;
  existing_risk_event RECORD;
BEGIN
  -- Only handle updates to active SLAs
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Calculate remaining time
  remaining_time := calculate_remaining_sla_time(NEW);
  remaining_hours := EXTRACT(EPOCH FROM remaining_time) / 3600;

  -- Check if SLA is at risk (less than 2 hours remaining)
  IF remaining_hours < 2 AND remaining_hours > 0 THEN
    -- Check if we already created a risk event for this SLA
    SELECT * INTO existing_risk_event 
    FROM ticket_events 
    WHERE ticket_id = NEW.ticket_id 
    AND event_type = 'sla_at_risk'
    AND created_at > NOW() - INTERVAL '1 hour'; -- Only check for events in the last hour to avoid spam
    
    -- If no existing risk event in last hour, create one
    IF existing_risk_event IS NULL THEN
      PERFORM create_sla_risk_event(NEW.ticket_id, ROUND(remaining_hours, 2));
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on ticket_sla table
CREATE TRIGGER ticket_sla_status_check_trigger
  AFTER UPDATE ON public.ticket_sla
  FOR EACH ROW
  EXECUTE FUNCTION check_sla_status_trigger();

-- Create index to optimize SLA checks
CREATE INDEX idx_ticket_sla_calculation ON public.ticket_sla (status, start_time, promised_hours) 
WHERE status = 'active';