-- C12: Customer Command Center - RLS Policies
-- Implements security policies for new Customer Command Center tables

-- Policy for ticket_events table
-- Customers can view events for their own tickets
-- Technicians can view events for assigned tickets
-- Admins and staff can view all events
CREATE POLICY "Customers can view ticket events for own tickets" ON public.ticket_events
    FOR SELECT USING (
        get_my_role() = 'customer' AND
        EXISTS (
            SELECT 1 FROM tickets t, customers c
            WHERE t.id = ticket_events.ticket_id
            AND t.customer_id = c.id
            AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Technicians can view events for assigned tickets" ON public.ticket_events
    FOR SELECT USING (
        get_my_role() = 'technician' AND
        EXISTS (
            SELECT 1 FROM tickets t
            WHERE t.id = ticket_events.ticket_id
            AND t.assigned_technician_id = get_my_profile_id()
        )
    );

CREATE POLICY "Admins and staff can view all ticket events" ON public.ticket_events
    FOR SELECT USING (
        get_my_role() = 'admin' OR get_my_role() = 'staff'
    );

CREATE POLICY "Admins and staff can manage ticket events" ON public.ticket_events
    FOR ALL USING (
        get_my_role() = 'admin' OR get_my_role() = 'staff'
    );

-- Policy for ticket_sla table
-- Customers can view SLA for their own tickets
-- Technicians can view SLA for assigned tickets
-- Admins and staff can view all SLA
CREATE POLICY "Customers can view SLA for own tickets" ON public.ticket_sla
    FOR SELECT USING (
        get_my_role() = 'customer' AND
        EXISTS (
            SELECT 1 FROM tickets t, customers c
            WHERE t.id = ticket_sla.ticket_id
            AND t.customer_id = c.id
            AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Technicians can view SLA for assigned tickets" ON public.ticket_sla
    FOR SELECT USING (
        get_my_role() = 'technician' AND
        EXISTS (
            SELECT 1 FROM tickets t
            WHERE t.id = ticket_sla.ticket_id
            AND t.assigned_technician_id = get_my_profile_id()
        )
    );

CREATE POLICY "Admins and staff can view all SLA" ON public.ticket_sla
    FOR SELECT USING (
        get_my_role() = 'admin' OR get_my_role() = 'staff'
    );

CREATE POLICY "Admins and staff can manage SLA" ON public.ticket_sla
    FOR ALL USING (
        get_my_role() = 'admin' OR get_my_role() = 'staff'
    );

-- Policy for ticket_quotations table
-- Customers can view and approve/reject quotes for their own tickets
-- Technicians can view quotes for assigned tickets
-- Admins and staff can manage all quotes
CREATE POLICY "Customers can view quotations for own tickets" ON public.ticket_quotations
    FOR SELECT USING (
        get_my_role() = 'customer' AND
        EXISTS (
            SELECT 1 FROM tickets t, customers c
            WHERE t.id = ticket_quotations.ticket_id
            AND t.customer_id = c.id
            AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Customers can approve/reject own quotations" ON public.ticket_quotations
    FOR UPDATE USING (
        get_my_role() = 'customer' AND
        EXISTS (
            SELECT 1 FROM tickets t, customers c
            WHERE t.id = ticket_quotations.ticket_id
            AND t.customer_id = c.id
            AND c.user_id = auth.uid()
        )
    ) WITH CHECK (
        get_my_role() = 'customer' AND
        EXISTS (
            SELECT 1 FROM tickets t, customers c
            WHERE t.id = ticket_quotations.ticket_id
            AND t.customer_id = c.id
            AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Technicians can view quotations for assigned tickets" ON public.ticket_quotations
    FOR SELECT USING (
        get_my_role() = 'technician' AND
        EXISTS (
            SELECT 1 FROM tickets t
            WHERE t.id = ticket_quotations.ticket_id
            AND t.assigned_technician_id = get_my_profile_id()
        )
    );

CREATE POLICY "Admins and staff can view all quotations" ON public.ticket_quotations
    FOR SELECT USING (
        get_my_role() = 'admin' OR get_my_role() = 'staff'
    );

CREATE POLICY "Admins and staff can manage all quotations" ON public.ticket_quotations
    FOR ALL USING (
        get_my_role() = 'admin' OR get_my_role() = 'staff'
    );