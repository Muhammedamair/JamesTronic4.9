-- Restore legacy tables required by subsequent fix migrations
-- Inferred schema based on typical usage and fix dependencies

-- 1. Tenants / Branches (Organization structure)
CREATE TABLE IF NOT EXISTS public.branches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    address text,
    city text,
    manager_id uuid REFERENCES auth.users(id),
    active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- 2. Tickets (Core Support System)
CREATE TABLE IF NOT EXISTS public.tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    title text,
    description text,
    status text DEFAULT 'open', -- open, in_progress, resolved, closed
    priority text DEFAULT 'normal', -- low, normal, high, urgent
    assigned_to uuid REFERENCES auth.users(id),
    
    -- Added fields for C17/SLA compatibility
    device_category text,
    pickup_scheduled_at timestamptz,
    transporter_job_id text,
    
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- 3. Action Logs (Audit Trail)
CREATE TABLE IF NOT EXISTS public.action_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id),
    ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
    action text NOT NULL,
    entity_type text,
    entity_id uuid,
    details jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

-- 4. Customer Timeline (Legacy table)
CREATE TABLE IF NOT EXISTS public.customer_timeline (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
    event_type text,
    description text,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.customer_timeline ENABLE ROW LEVEL SECURITY;

-- 5. Customer SLA Snapshot (Legacy table)
CREATE TABLE IF NOT EXISTS public.customer_sla_snapshot (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
    sla_status text,
    promised_hours integer,
    elapsed_hours numeric,
    status text,
    last_updated timestamptz,
    due_at timestamptz,
    created_at timestamptz DEFAULT now(),
    UNIQUE(ticket_id)
);
ALTER TABLE public.customer_sla_snapshot ENABLE ROW LEVEL SECURITY;

-- 6. Customer Feedback (Legacy table)
CREATE TABLE IF NOT EXISTS public.customer_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
    rating integer,
    comment text,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;

-- 7. Ticket Events (Event Sourcing / Audit)
CREATE TABLE IF NOT EXISTS public.ticket_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    title text,
    description text,
    details jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ticket_events ENABLE ROW LEVEL SECURITY;

-- 8. Ticket SLA State
CREATE TABLE IF NOT EXISTS public.ticket_sla_state (
    ticket_id uuid PRIMARY KEY REFERENCES public.tickets(id) ON DELETE CASCADE,
    last_recalc_at timestamptz,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ticket_sla_state ENABLE ROW LEVEL SECURITY;

-- 9. Dark Stores
-- Updated with columns required by fix_seed_stores
CREATE TABLE IF NOT EXISTS public.dark_stores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE,
    name text NOT NULL,
    location text, 
    city text,
    status text DEFAULT 'active',
    max_daily_capacity integer DEFAULT 100,
    manager_id uuid REFERENCES auth.users(id),
    active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.dark_stores ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.dark_stores TO authenticated;


-- Basic RLS for these tables to prevent lockout if no policies exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branches' AND policyname = 'Enable read access for all users') THEN
        CREATE POLICY "Enable read access for all users" ON public.branches FOR SELECT USING (true);
    END IF;
END $$;
