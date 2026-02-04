-- C12: Customer Command Center - Base Tables
-- Creates the foundational tables for the Customer Command Center

-- Create ticket_events table to track all events in the ticket lifecycle
CREATE TABLE IF NOT EXISTS public.ticket_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'status_change', 'technician_assigned', 'part_required', 'estimated_completion', 'transporter_assigned', etc.
    title TEXT NOT NULL,
    description TEXT,
    details JSONB, -- Additional structured data about the event
    created_by UUID REFERENCES public.profiles(id), -- Who created this event (admin/staff/technician)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::JSONB
);

-- Index for ticket-based queries
CREATE INDEX idx_ticket_events_ticket_id ON public.ticket_events(ticket_id);
-- Index for chronological queries
CREATE INDEX idx_ticket_events_created_at ON public.ticket_events(created_at DESC);

-- Create ticket_sla table to manage SLA commitments
CREATE TABLE IF NOT EXISTS public.ticket_sla (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    promised_hours INT, -- Hours promised to customer
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When SLA started (usually when assigned to technician)
    end_time TIMESTAMPTZ, -- When SLA was completed
    breach_time TIMESTAMPTZ, -- When SLA was breached (if applicable)
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'breached', 'fulfilled', 'at_risk')), -- Current SLA status
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')), -- SLA priority
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for ticket-based queries
CREATE INDEX idx_ticket_sla_ticket_id ON public.ticket_sla(ticket_id);
-- Index for status-based queries
CREATE INDEX idx_ticket_sla_status ON public.ticket_sla(status);
-- Index for breach time queries
CREATE INDEX idx_ticket_sla_breach_time ON public.ticket_sla(breach_time);

-- Create ticket_quotations table to handle pricing suggestions and customer approvals
CREATE TABLE IF NOT EXISTS public.ticket_quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    quoted_price DECIMAL(10, 2) NOT NULL, -- Quoted price
    quoted_parts_cost DECIMAL(10, 2), -- Cost of parts if applicable
    quoted_labor_cost DECIMAL(10, 2), -- Labor cost if applicable
    quote_notes TEXT, -- Additional notes about the quote
    created_by UUID NOT NULL REFERENCES public.profiles(id), -- Who created this quote
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ, -- When customer approved
    rejected_at TIMESTAMPTZ, -- When customer rejected
    approved_by_customer BOOLEAN DEFAULT NULL, -- Whether customer approved (true/false/null)
    expires_at TIMESTAMPTZ, -- When the quote expires
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'fulfilled')) -- Status of the quote
);

-- Index for ticket-based queries
CREATE INDEX idx_ticket_quotations_ticket_id ON public.ticket_quotations(ticket_id);
-- Index for status-based queries
CREATE INDEX idx_ticket_quotations_status ON public.ticket_quotations(status);
-- Index for creation time
CREATE INDEX idx_ticket_quotations_created_at ON public.ticket_quotations(created_at);

-- Create updated_at trigger for ticket_sla table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ticket_sla_updated_at
    BEFORE UPDATE ON public.ticket_sla
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_sla TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_quotations TO authenticated;

-- Create RLS policies for new tables
ALTER TABLE public.ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_sla ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_quotations ENABLE ROW LEVEL SECURITY;