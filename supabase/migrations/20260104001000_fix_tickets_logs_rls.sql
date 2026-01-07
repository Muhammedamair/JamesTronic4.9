-- C15.5: Fix Tickets and Action Logs RLS for Customer Ticket Creation

-- 1. Allow customers to create tickets
-- The check ensures they can only create tickets for themselves
CREATE POLICY "Customers can create own tickets" ON public.tickets
  FOR INSERT WITH CHECK (
    get_my_role() = 'customer' AND
    customer_id = (
      SELECT id FROM public.customers WHERE user_id = auth.uid()
    )
  );

-- 2. Allow customers and staff to insert action logs
-- For customers, we ensure the ticket belongs to them
-- For staff/admin, we allow all inserts for now (consistent with their access)
CREATE POLICY "Users can insert action logs for authorized tickets" ON public.action_logs
  FOR INSERT WITH CHECK (
    (get_my_role() = 'admin' OR get_my_role() = 'staff') OR
    (
      get_my_role() = 'customer' AND
      EXISTS (
        SELECT 1 FROM public.tickets t, public.customers c
        WHERE t.id = ticket_id
        AND t.customer_id = c.id
        AND c.user_id = auth.uid()
      )
    )
  );
