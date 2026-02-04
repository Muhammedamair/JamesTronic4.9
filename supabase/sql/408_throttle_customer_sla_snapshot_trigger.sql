-- 408_throttle_customer_sla_snapshot_trigger.sql
-- Throttle the legacy customer_sla_snapshot trigger to reduce DB load after C14 implementation

-- Drop the existing trigger that fires on every ticket update
DROP TRIGGER IF EXISTS trigger_update_sla_on_ticket_change ON public.tickets;

-- Create the throttled trigger that only fires on meaningful changes
CREATE TRIGGER trigger_update_sla_on_ticket_change
    AFTER INSERT OR UPDATE OF status, device_category
    ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_sla_on_ticket_change();

-- Update the function to add write-guard inside ON CONFLICT DO UPDATE
CREATE OR REPLACE FUNCTION update_sla_on_ticket_change()
RETURNS TRIGGER AS $$
DECLARE
    promised_hours_val INT;
    elapsed_hours_val NUMERIC;
    status_val TEXT;
BEGIN
    -- Calculate promised hours based on device category (default to 24h)
    CASE
        WHEN NEW.device_category = 'Mobile' THEN
            promised_hours_val := 24;
        WHEN NEW.device_category = 'Laptop' THEN
            promised_hours_val := 48;
        WHEN NEW.device_category = 'TV' THEN
            promised_hours_val := 72;
        WHEN NEW.device_category = 'Appliances' THEN
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

    -- Update SLA snapshot (only update if values have changed significantly to avoid unnecessary writes)
    INSERT INTO customer_sla_snapshot (
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
        OR ABS(customer_sla_snapshot.elapsed_hours - EXCLUDED.elapsed_hours) > 0.1  -- Only update if elapsed time changed by more than 6 minutes
        OR customer_sla_snapshot.status != EXCLUDED.status;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;