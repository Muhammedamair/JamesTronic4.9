-- C14: Backfill default values for new ticket columns

-- Set default values for existing tickets for the new columns
UPDATE public.tickets 
SET 
    parts_status = COALESCE(parts_status, 'not_required'),
    priority = COALESCE(priority, 'normal')
WHERE 
    parts_status IS NULL OR priority IS NULL;

-- Update any tickets with statuses that affect SLA calculations to appropriate defaults
-- This is a safety measure to ensure existing tickets have proper state for SLA calculations