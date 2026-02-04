-- C16: Transporter Engine V0 - Link tickets to transport jobs
-- Adds transporter_job_id reference to tickets table for proper linkage

-- Add transporter_job_id column to tickets table to link to transport_jobs
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS transporter_job_id UUID REFERENCES public.transport_jobs(id);

-- Create index for fast lookups of tickets by their transport job
CREATE INDEX IF NOT EXISTS idx_tickets_transporter_job_id ON public.tickets(transporter_job_id);

-- Update the foreign key constraint on transport_jobs to reference tickets
-- This is already handled in the transport_jobs creation, but let's ensure it's correct
-- ALTER TABLE public.transport_jobs ALTER COLUMN ticket_id SET NOT NULL;
-- ALTER TABLE public.transport_jobs ADD CONSTRAINT fk_transport_jobs_ticket 
--     FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;