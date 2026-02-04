-- C16: Transporter Engine V0 - Transport Jobs Table
-- Creates the master transport manifest linked to ticket_id with proper branch linkage

-- Create transport_jobs table
CREATE TABLE IF NOT EXISTS public.transport_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id), -- Required branch linkage from C14
  job_type TEXT NOT NULL CHECK (job_type IN ('PICKUP', 'DROP', 'INTER_BRANCH', 'PARTS_RUN')), -- Type of transport job
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'assigned', 'en_route_pickup', 'picked_up', 'en_route_drop', 'delivered', 'cancelled', 'failed')), -- Current status
  assigned_transporter_id UUID REFERENCES public.profiles(id), -- Assigned transporter
  pickup_notes TEXT, -- Notes for pickup
  drop_notes TEXT, -- Notes for drop
  pickup_address_text TEXT, -- Pickup address as text
  drop_address_text TEXT, -- Drop address as text
  pickup_lat DOUBLE PRECISION, -- Latitude for pickup location (for geolock)
  pickup_lng DOUBLE PRECISION, -- Longitude for pickup location (for geolock)
  drop_lat DOUBLE PRECISION, -- Latitude for drop location (for geolock)
  drop_lng DOUBLE PRECISION, -- Longitude for drop location (for geolock)
  scheduled_at TIMESTAMPTZ, -- When the job is scheduled
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create updated_at trigger for transport_jobs (reuse existing set_updated_at function if it exists)
CREATE OR REPLACE FUNCTION public.update_transport_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_transport_jobs_updated_at_trigger ON public.transport_jobs;
CREATE TRIGGER update_transport_jobs_updated_at_trigger
  BEFORE UPDATE ON public.transport_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_transport_jobs_updated_at();

-- Create indexes for performance
CREATE INDEX idx_transport_jobs_ticket_id ON public.transport_jobs(ticket_id);
CREATE INDEX idx_transport_jobs_branch_id_status ON public.transport_jobs(branch_id, status);
CREATE INDEX idx_transport_jobs_assigned_transporter_id_status ON public.transport_jobs(assigned_transporter_id, status);
CREATE INDEX idx_transport_jobs_created_at ON public.transport_jobs(created_at);

-- Enable Row Level Security
ALTER TABLE public.transport_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for transport_jobs
-- Admins and staff have full access
CREATE POLICY "transport_jobs_admin_all" ON public.transport_jobs
  FOR ALL USING (
    get_my_role() IN ('admin', 'staff', 'manager')
  );

-- Transporters can only see their assigned jobs
CREATE POLICY "transport_jobs_transporter_view_assigned" ON public.transport_jobs
  FOR SELECT USING (
    get_my_role() = 'transporter' 
    AND assigned_transporter_id = get_my_profile_id()
  );

-- Transporters can update their assigned jobs
CREATE POLICY "transport_jobs_transporter_update_assigned" ON public.transport_jobs
  FOR UPDATE USING (
    get_my_role() = 'transporter' 
    AND assigned_transporter_id = get_my_profile_id()
  );

-- Customers can only see jobs related to their tickets
CREATE POLICY "transport_jobs_customer_view_own" ON public.transport_jobs
  FOR SELECT USING (
    get_my_role() = 'customer'
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = transport_jobs.ticket_id
      AND t.customer_id IN (
        SELECT id FROM public.customers 
        WHERE user_id = auth.uid()
      )
    )
  );