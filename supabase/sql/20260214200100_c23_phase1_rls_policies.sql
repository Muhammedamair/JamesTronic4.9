-- ============================================================
-- C23 Phase 1: RLS Policies (Deny-by-Default)
-- GOVERNANCE: Technician CANNOT see packets or signals.
--             Manager/Admin scoped to branch/city.
--             System writes via service_role only.
-- ============================================================

-- Enable RLS on all C23 tables
ALTER TABLE public.c23_telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.c23_technician_performance_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.c23_performance_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.c23_coaching_tasks ENABLE ROW LEVEL SECURITY;

-- ===================== TELEMETRY EVENTS =====================

-- Technicians can INSERT their own telemetry events (via RPC, not direct)
-- but this policy exists as a safety net if direct insert is attempted.
CREATE POLICY c23_telemetry_insert_own
  ON public.c23_telemetry_events
  FOR INSERT
  WITH CHECK (tech_id = auth.uid());

-- Technicians CANNOT read telemetry events (no SELECT policy for tech role)
-- Managers/Admins can read telemetry for their branch
CREATE POLICY c23_telemetry_select_manager
  ON public.c23_telemetry_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager', 'hr')
      AND (p.branch_id = c23_telemetry_events.branch_id OR p.role = 'admin')
    )
  );

-- ===================== PERFORMANCE PACKETS ==================

-- ❌ NO SELECT for technicians (hard governance lock)
-- ✅ Managers/Admins can read packets for their branch scope
CREATE POLICY c23_packets_select_manager
  ON public.c23_technician_performance_packets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager', 'hr')
      AND (p.branch_id = c23_technician_performance_packets.branch_id OR p.role = 'admin')
    )
  );

-- ❌ NO INSERT/UPDATE/DELETE for any authenticated user
-- Packets are written ONLY via service_role (batch job)
-- No policy = deny by default with RLS enabled

-- ===================== PERFORMANCE SIGNALS ==================

-- ❌ NO SELECT for technicians (hard governance lock)
-- ✅ Managers/Admins can read signals for their branch scope
CREATE POLICY c23_signals_select_manager
  ON public.c23_performance_signals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager', 'hr')
      AND (p.branch_id = c23_performance_signals.branch_id OR p.role = 'admin')
    )
  );

-- ❌ NO INSERT/UPDATE/DELETE for any authenticated user
-- Signals are written ONLY via service_role (batch job)

-- ===================== COACHING TASKS =======================

-- ✅ Technicians CAN read their own coaching tasks (task_text + status only)
CREATE POLICY c23_coaching_select_own_tech
  ON public.c23_coaching_tasks
  FOR SELECT
  USING (tech_id = auth.uid());

-- ✅ Managers can read coaching tasks for their branch
CREATE POLICY c23_coaching_select_manager
  ON public.c23_coaching_tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager', 'hr')
      AND (p.branch_id = c23_coaching_tasks.branch_id OR p.role = 'admin')
    )
  );

-- ✅ Managers can INSERT coaching tasks for their branch
CREATE POLICY c23_coaching_insert_manager
  ON public.c23_coaching_tasks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager')
      AND (p.branch_id = c23_coaching_tasks.branch_id OR p.role = 'admin')
    )
  );

-- ✅ Managers can UPDATE coaching tasks for their branch
CREATE POLICY c23_coaching_update_manager
  ON public.c23_coaching_tasks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager')
      AND (p.branch_id = c23_coaching_tasks.branch_id OR p.role = 'admin')
    )
  );

-- ✅ Technicians can update status of their own coaching tasks (mark complete)
CREATE POLICY c23_coaching_update_own_tech
  ON public.c23_coaching_tasks
  FOR UPDATE
  USING (tech_id = auth.uid())
  WITH CHECK (tech_id = auth.uid());
