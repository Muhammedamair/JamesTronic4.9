-- C12: Customer Command Center - Extend Existing Tables
-- Add columns to existing tables to support Customer Command Center features

-- Add transporter tracking fields to tickets table
-- This enables tracking of pickup/drop status as requested in C12
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS transporter_job_id TEXT,
ADD COLUMN IF NOT EXISTS pickup_scheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pickup_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS drop_scheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS drop_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS transporter_tracking_url TEXT,
ADD COLUMN IF NOT EXISTS transporter_contact_name TEXT,
ADD COLUMN IF NOT EXISTS transporter_contact_phone TEXT;

-- Add quotation reference to tickets table
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS current_quotation_id UUID REFERENCES public.ticket_quotations(id);

-- Add SLA reference to tickets table
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS sla_id UUID REFERENCES public.ticket_sla(id);

-- Add customer notification preferences to customers table
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"sms": true, "whatsapp": true, "push": true}'::JSONB,
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'hi', 'te')); -- English, Hindi, Telugu

-- Indexes for the new columns in tickets table
CREATE INDEX IF NOT EXISTS idx_tickets_transporter_job_id ON public.tickets(transporter_job_id);
CREATE INDEX IF NOT EXISTS idx_tickets_pickup_scheduled_at ON public.tickets(pickup_scheduled_at);
CREATE INDEX IF NOT EXISTS idx_tickets_drop_scheduled_at ON public.tickets(drop_scheduled_at);
CREATE INDEX IF NOT EXISTS idx_tickets_current_quotation_id ON public.tickets(current_quotation_id);