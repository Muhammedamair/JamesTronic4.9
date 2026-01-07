-- Migration: Fix RLS policies attempting to access auth.users directly
-- Accessing auth.users in RLS policies triggers '42501: permission denied for table users' 
-- for non-superuser roles (like 'authenticated').
-- We replace these with joins to public.customers which has the user_id link.

-- 1. Fix customer_timeline policies
DROP POLICY IF EXISTS "customer_timeline_read_customer_own" ON public.customer_timeline;
CREATE POLICY "customer_timeline_read_customer_own" ON public.customer_timeline
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = customer_timeline.ticket_id
    AND t.customer_id IN (
      SELECT c.id FROM public.customers c
      WHERE c.user_id = auth.uid()
    )
  )
);

-- 2. Fix customer_sla_snapshot policies
DROP POLICY IF EXISTS "customer_sla_snapshot_read_customer_own" ON public.customer_sla_snapshot;
CREATE POLICY "customer_sla_snapshot_read_customer_own" ON public.customer_sla_snapshot
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = customer_sla_snapshot.ticket_id
    AND t.customer_id IN (
      SELECT c.id FROM public.customers c
      WHERE c.user_id = auth.uid()
    )
  )
);

-- 3. Fix customer_feedback policies
DROP POLICY IF EXISTS "customer_feedback_all_customer_own" ON public.customer_feedback;
CREATE POLICY "customer_feedback_all_customer_own" ON public.customer_feedback
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = customer_feedback.ticket_id
    AND t.customer_id IN (
      SELECT c.id FROM public.customers c
      WHERE c.user_id = auth.uid()
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = customer_feedback.ticket_id
    AND t.customer_id IN (
      SELECT c.id FROM public.customers c
      WHERE c.user_id = auth.uid()
    )
  )
);

-- 4. Audit Note: We used c.user_id instead of c.phone_e164 join with auth.users.
-- This is faster, more secure, and bypasses the 403 Forbidden error.
COMMENT ON TABLE public.customer_timeline IS 'RLS fixed to avoid auth.users direct access.';
COMMENT ON TABLE public.customer_sla_snapshot IS 'RLS fixed to avoid auth.users direct access.';
COMMENT ON TABLE public.customer_feedback IS 'RLS fixed to avoid auth.users direct access.';
