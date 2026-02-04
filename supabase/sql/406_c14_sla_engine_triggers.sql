-- C14: Triggers for SLA engine

-- Trigger function to call compute_ticket_sla when ticket changes
CREATE OR REPLACE FUNCTION public.handle_ticket_sla_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Call the SLA computation function
    PERFORM public.compute_ticket_sla(NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on tickets table to call compute_ticket_sla
-- This will fire on INSERT and UPDATE when relevant columns change
-- Using only columns that exist in the tickets table
CREATE TRIGGER ticket_sla_update_trigger
    AFTER INSERT OR UPDATE OF status, assigned_technician_id, branch_id, updated_at, parts_status, priority
    ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_ticket_sla_update();

-- Create trigger for manual SLA updates if needed
CREATE OR REPLACE FUNCTION public.handle_manual_sla_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the last_recalc_at field to show when manual changes were made
    UPDATE public.ticket_sla_state
    SET last_recalc_at = NOW()
    WHERE ticket_id = NEW.ticket_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for manual updates to ticket_sla_state
CREATE TRIGGER manual_sla_update_trigger
    AFTER UPDATE OF eta_at, confidence, risk_score, risk_level
    ON public.ticket_sla_state
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_manual_sla_update();