-- C14: Indexes for SLA Engine performance

-- Indexes for ticket_sla_state table
CREATE INDEX IF NOT EXISTS idx_ticket_sla_state_branch_risk ON public.ticket_sla_state(branch_id, risk_level, risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_sla_state_tech_risk ON public.ticket_sla_state(technician_id, risk_level, risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_sla_state_eta ON public.ticket_sla_state(eta_at);
CREATE INDEX IF NOT EXISTS idx_ticket_sla_state_updated_at ON public.ticket_sla_state(updated_at);

-- Indexes for ticket_sla_ledger table
CREATE INDEX IF NOT EXISTS idx_ticket_sla_ledger_ticket_time ON public.ticket_sla_ledger(ticket_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_sla_ledger_changed_at ON public.ticket_sla_ledger(changed_at);

-- Indexes for risk_snapshots table
CREATE INDEX IF NOT EXISTS idx_risk_snapshots_branch_time ON public.risk_snapshots(branch_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_snapshots_ticket_time ON public.risk_snapshots(ticket_id, captured_at DESC);

-- Indexes for sla_alerts table
CREATE INDEX IF NOT EXISTS idx_sla_alerts_branch_time ON public.sla_alerts(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sla_alerts_ticket ON public.sla_alerts(ticket_id);
CREATE INDEX IF NOT EXISTS idx_sla_alerts_risk_level ON public.sla_alerts(risk_level);
CREATE INDEX IF NOT EXISTS idx_sla_alerts_acknowledged ON public.sla_alerts(acknowledged_at);