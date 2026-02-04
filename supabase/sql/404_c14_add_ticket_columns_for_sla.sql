-- C14: Add necessary columns to tickets table for SLA tracking

-- Add parts_status column to track part requirements
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS parts_status TEXT DEFAULT 'not_required' CHECK (parts_status IN ('not_required', 'pending', 'ordered', 'arrived', 'installed'));

-- Add priority column for SLA priority levels
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical'));

-- Add status values that may be needed for SLA tracking
-- Note: We can't add values to an existing text column CHECK constraint easily in Postgres,
-- so we'll just document the expected values and handle them in the application layer

-- Update the status column to include SLA-related statuses (documentation only)
-- Expected statuses: pending, assigned, in_progress, part_required, part_arrived, ready_for_pickup, completed, awaiting_approval