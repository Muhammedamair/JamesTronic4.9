-- C16: Transporter Engine V0 - Custody Ledger Table
-- Creates the immutable chain-of-custody events for audits

-- Create custody_ledger table (append-only, immutable events)
CREATE TABLE IF NOT EXISTS public.custody_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transport_job_id UUID NOT NULL REFERENCES public.transport_jobs(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'PICKUP_CONFIRMED', 'IN_TRANSIT', 'DROP_CONFIRMED', 'REFUSAL', 'DAMAGE_REPORTED', etc.
  event_meta JSONB, -- Additional structured data about the event
  actor_id UUID, -- Who performed the action (profiles.id)
  actor_role TEXT, -- Role of the actor ('transporter', 'admin', 'staff', etc.)
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signature TEXT, -- Optional signature for verification
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_custody_ledger_transport_job_id ON public.custody_ledger(transport_job_id);
CREATE INDEX idx_custody_ledger_ticket_id ON public.custody_ledger(ticket_id);
CREATE INDEX idx_custody_ledger_occurred_at ON public.custody_ledger(occurred_at DESC);
CREATE INDEX idx_custody_ledger_event_type ON public.custody_ledger(event_type);
-- Composite index for common audit queries
CREATE INDEX idx_custody_ledger_job_event_time ON public.custody_ledger(transport_job_id, event_type, occurred_at DESC);

-- Enable Row Level Security
ALTER TABLE public.custody_ledger ENABLE ROW LEVEL SECURITY;

-- RLS policies for custody_ledger
-- Admins and staff have full access
CREATE POLICY "custody_ledger_admin_all" ON public.custody_ledger
  FOR ALL USING (
    get_my_role() IN ('admin', 'staff', 'manager')
  );

-- Transporters can only see events related to their assigned transport jobs
CREATE POLICY "custody_ledger_transporter_view_assigned" ON public.custody_ledger
  FOR SELECT USING (
    get_my_role() = 'transporter' 
    AND EXISTS (
      SELECT 1 FROM public.transport_jobs tj
      WHERE tj.id = custody_ledger.transport_job_id
      AND tj.assigned_transporter_id = get_my_profile_id()
    )
  );

-- Transporters can insert events for their assigned jobs
CREATE POLICY "custody_ledger_transporter_insert_assigned" ON public.custody_ledger
  FOR INSERT WITH CHECK (
    get_my_role() = 'transporter' 
    AND EXISTS (
      SELECT 1 FROM public.transport_jobs tj
      WHERE tj.id = custody_ledger.transport_job_id
      AND tj.assigned_transporter_id = get_my_profile_id()
    )
  );

-- Customers can only see events related to their tickets
CREATE POLICY "custody_ledger_customer_view_own" ON public.custody_ledger
  FOR SELECT USING (
    get_my_role() = 'customer'
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = custody_ledger.ticket_id
      AND t.customer_id IN (
        SELECT id FROM public.customers 
        WHERE user_id = auth.uid()
      )
    )
  );