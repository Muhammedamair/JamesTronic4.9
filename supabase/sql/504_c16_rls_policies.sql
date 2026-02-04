-- C16: Transporter Engine V0 - RLS Policies
-- Consolidated RLS policies for all transport-related tables

-- POLICIES FOR transport_jobs (if not already created in 500_c16_transport_jobs.sql)
-- Admins and staff have full access
DROP POLICY IF EXISTS "transport_jobs_admin_all" ON public.transport_jobs;
CREATE POLICY "transport_jobs_admin_all" ON public.transport_jobs
  FOR ALL USING (
    get_my_role() IN ('admin', 'staff', 'manager')
  );

-- Transporters can only see their assigned jobs
DROP POLICY IF EXISTS "transport_jobs_transporter_view_assigned" ON public.transport_jobs;
CREATE POLICY "transport_jobs_transporter_view_assigned" ON public.transport_jobs
  FOR SELECT USING (
    get_my_role() = 'transporter' 
    AND assigned_transporter_id = get_my_profile_id()
  );

-- Transporters can update their assigned jobs
DROP POLICY IF EXISTS "transport_jobs_transporter_update_assigned" ON public.transport_jobs;
CREATE POLICY "transport_jobs_transporter_update_assigned" ON public.transport_jobs
  FOR UPDATE USING (
    get_my_role() = 'transporter' 
    AND assigned_transporter_id = get_my_profile_id()
  );

-- Customers can only see jobs related to their tickets
DROP POLICY IF EXISTS "transport_jobs_customer_view_own" ON public.transport_jobs;
CREATE POLICY "transport_jobs_customer_view_own" ON public.transport_jobs
  FOR SELECT USING (
    get_my_role() = 'customer'
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = transport_jobs.ticket_id
      AND t.customer_id IN (
        SELECT id FROM public.customers 
        WHERE user_id = auth.uid()
      )
    )
  );

-- POLICIES FOR custody_ledger (if not already created in 501_c16_custody_ledger.sql)
-- Admins and staff have full access
DROP POLICY IF EXISTS "custody_ledger_admin_all" ON public.custody_ledger;
CREATE POLICY "custody_ledger_admin_all" ON public.custody_ledger
  FOR ALL USING (
    get_my_role() IN ('admin', 'staff', 'manager')
  );

-- Transporters can only see events related to their assigned transport jobs
DROP POLICY IF EXISTS "custody_ledger_transporter_view_assigned" ON public.custody_ledger;
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
DROP POLICY IF EXISTS "custody_ledger_transporter_insert_assigned" ON public.custody_ledger;
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
DROP POLICY IF EXISTS "custody_ledger_customer_view_own" ON public.custody_ledger;
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

-- POLICIES FOR transporter_location_pings (if not already created in 502_c16_transporter_location_pings.sql)
-- Admins and staff have read access to last ping only
DROP POLICY IF EXISTS "transporter_location_pings_admin_read" ON public.transporter_location_pings;
CREATE POLICY "transporter_location_pings_admin_read" ON public.transporter_location_pings
  FOR SELECT USING (
    get_my_role() IN ('admin', 'staff', 'manager')
  );

-- Transporters can only see and insert their own pings
DROP POLICY IF EXISTS "transporter_location_pings_transporter_own" ON public.transporter_location_pings;
CREATE POLICY "transporter_location_pings_transporter_own" ON public.transporter_location_pings
  FOR ALL USING (
    get_my_role() = 'transporter' 
    AND transporter_id = get_my_profile_id()
  );

-- Customers cannot access location pings (privacy protection)