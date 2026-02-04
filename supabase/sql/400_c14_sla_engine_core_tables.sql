-- C14: Dynamic Assurance Engine & Temporal Trust Brain
-- Core SLA tables and RLS policies

-- 1) SLA policies table
CREATE TABLE IF NOT EXISTS public.sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('global','branch','category','service')),
  branch_id uuid NULL,
  device_category text NULL,
  service_type text NULL,
  base_minutes int NOT NULL,
  logic jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Current SLA state per ticket (mutable)
CREATE TABLE IF NOT EXISTS public.ticket_sla_state (
  ticket_id uuid PRIMARY KEY,
  branch_id uuid NOT NULL,
  technician_id uuid NULL,
  customer_id uuid NULL,
  eta_at timestamptz NOT NULL,
  eta_window_minutes int NOT NULL DEFAULT 120,
  confidence int NOT NULL DEFAULT 80 CHECK (confidence >= 0 AND confidence <= 100),
  allocated_minutes int NOT NULL,
  elapsed_minutes int NOT NULL DEFAULT 0,
  progress_pct int NOT NULL DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  risk_score numeric NOT NULL DEFAULT 0,
  risk_level int NOT NULL DEFAULT 0 CHECK (risk_level IN (0,1,2,3)),
  burn_rate numeric NOT NULL DEFAULT 0,
  blocker_code text NULL,
  clock_paused boolean NOT NULL DEFAULT false,
  clock_pause_reason text NULL,
  clock_pause_until timestamptz NULL,
  last_recalc_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Immutable SLA ledger (append-only)
CREATE TABLE IF NOT EXISTS public.ticket_sla_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  old_eta_at timestamptz NULL,
  new_eta_at timestamptz NOT NULL,
  old_confidence int NULL,
  new_confidence int NOT NULL,
  old_risk_score numeric NULL,
  new_risk_score numeric NOT NULL,
  reason_code text NOT NULL,
  reason_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid NULL,
  actor_role text NULL,
  source text NOT NULL CHECK (source IN ('system','manual')),
  signature text NULL
);

-- 4) Risk snapshots (periodic, append-only)
CREATE TABLE IF NOT EXISTS public.risk_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  technician_id uuid NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  risk_score numeric NOT NULL,
  risk_level int NOT NULL,
  burn_rate numeric NOT NULL,
  progress_pct int NOT NULL,
  blocker_code text NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- 5) Alerts (append-only; drives notifications)
CREATE TABLE IF NOT EXISTS public.sla_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  risk_level int NOT NULL CHECK (risk_level IN (1,2,3)),
  alert_code text NOT NULL,
  message text NOT NULL,
  targets jsonb NOT NULL DEFAULT '[]'::jsonb,
  acknowledged_at timestamptz NULL,
  acknowledged_by uuid NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Enable Row Level Security on all new tables
ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_sla_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_sla_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for sla_policies
CREATE POLICY "sla_policies_admin_all" ON public.sla_policies
  FOR ALL USING (
    (auth.jwt() ->> 'role') = 'admin'
  );

CREATE POLICY "sla_policies_staff_read" ON public.sla_policies
  FOR SELECT USING (
    (auth.jwt() ->> 'role') IN ('admin', 'staff')
  );

-- RLS policies for ticket_sla_state
CREATE POLICY "ticket_sla_state_admin_all" ON public.ticket_sla_state
  FOR ALL USING (
    (auth.jwt() ->> 'role') = 'admin'
  );

CREATE POLICY "ticket_sla_state_staff_read" ON public.ticket_sla_state
  FOR SELECT USING (
    (auth.jwt() ->> 'role') IN ('admin', 'staff', 'manager')
  );

CREATE POLICY "ticket_sla_state_technician_read_own" ON public.ticket_sla_state
  FOR SELECT USING (
    (auth.jwt() ->> 'role') = 'technician' 
    AND technician_id = (auth.jwt() ->> 'user_id')::uuid
  );

CREATE POLICY "ticket_sla_state_customer_read_own" ON public.ticket_sla_state
  FOR SELECT USING (
    (auth.jwt() ->> 'role') = 'customer'
    AND customer_id = (auth.jwt() ->> 'user_id')::uuid
  );

-- RLS policies for ticket_sla_ledger
CREATE POLICY "ticket_sla_ledger_read" ON public.ticket_sla_ledger
  FOR SELECT USING (
    (auth.jwt() ->> 'role') IN ('admin', 'staff', 'manager')
  );

CREATE POLICY "ticket_sla_ledger_admin_insert" ON public.ticket_sla_ledger
  FOR INSERT WITH CHECK (
    (auth.jwt() ->> 'role') = 'service_role'
  );

-- RLS policies for risk_snapshots
CREATE POLICY "risk_snapshots_read" ON public.risk_snapshots
  FOR SELECT USING (
    (auth.jwt() ->> 'role') IN ('admin', 'staff', 'manager')
  );

CREATE POLICY "risk_snapshots_admin_insert" ON public.risk_snapshots
  FOR INSERT WITH CHECK (
    (auth.jwt() ->> 'role') = 'service_role'
  );

-- RLS policies for sla_alerts
CREATE POLICY "sla_alerts_admin_all" ON public.sla_alerts
  FOR ALL USING (
    (auth.jwt() ->> 'role') = 'admin'
  );

CREATE POLICY "sla_alerts_staff_read" ON public.sla_alerts
  FOR SELECT USING (
    (auth.jwt() ->> 'role') IN ('admin', 'staff', 'manager')
  );

CREATE POLICY "sla_alerts_technician_read_assigned" ON public.sla_alerts
  FOR SELECT USING (
    (auth.jwt() ->> 'role') = 'technician'
    AND ticket_id IN (
      SELECT id FROM public.tickets 
      WHERE assigned_technician_id = (auth.jwt() ->> 'user_id')::uuid
    )
  );