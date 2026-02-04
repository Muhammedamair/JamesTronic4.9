-- C16 V1: RLS Hardening for Transport Tables
-- Tighten RLS policies for enhanced security

-- Drop existing transport_jobs update policy and recreate without NEW references
DROP POLICY IF EXISTS "transport_jobs_transporter_update_assigned" ON public.transport_jobs;

CREATE POLICY "transport_jobs_transporter_update_assigned" ON public.transport_jobs
  FOR UPDATE
  USING (
    get_my_role() = 'transporter'
    AND assigned_transporter_id = get_my_profile_id()
  )
  WITH CHECK (
    get_my_role() = 'transporter'
    AND assigned_transporter_id = get_my_profile_id()
  );

-- Customer select policy (unchanged, safe)
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

-- Custody ledger policies (unchanged logic, kept without NEW/OLD)
DROP POLICY IF EXISTS "custody_ledger_transporter_insert_assigned" ON public.custody_ledger;
DROP POLICY IF EXISTS "custody_ledger_transporter_view_assigned" ON public.custody_ledger;

CREATE POLICY "custody_ledger_transporter_insert_assigned" ON public.custody_ledger
  FOR INSERT WITH CHECK (
    get_my_role() = 'transporter'
    AND EXISTS (
      SELECT 1 FROM public.transport_jobs tj
      WHERE tj.id = custody_ledger.transport_job_id
      AND tj.assigned_transporter_id = get_my_profile_id()
    )
  );

CREATE POLICY "custody_ledger_transporter_view_assigned" ON public.custody_ledger
  FOR SELECT USING (
    get_my_role() = 'transporter'
    AND EXISTS (
      SELECT 1 FROM public.transport_jobs tj
      WHERE tj.id = custody_ledger.transport_job_id
      AND tj.assigned_transporter_id = get_my_profile_id()
    )
  );

-- Immutability protections for custody_ledger (restrict UPDATE/DELETE to service_role)
CREATE POLICY "custody_ledger_no_delete_except_service" ON public.custody_ledger
  FOR DELETE USING (
    (auth.jwt() ->> 'role') = 'service_role'
  );

CREATE POLICY "custody_ledger_no_update_except_service" ON public.custody_ledger
  FOR UPDATE USING (
    (auth.jwt() ->> 'role') = 'service_role'
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'service_role'
  );

-- Safe transporter location view (unchanged)
CREATE OR REPLACE VIEW safe_transporter_locations AS
SELECT
  id,
  transporter_id,
  lat,
  lng,
  accuracy_meters,
  recorded_at,
  created_at,
  CASE
    WHEN get_my_role() IN ('admin', 'staff', 'manager') THEN recorded_at
    ELSE NULL
  END AS full_history_access
FROM public.transporter_location_pings
WHERE
  (get_my_role() = 'transporter' AND transporter_id = get_my_profile_id())
  OR
  get_my_role() IN ('admin', 'staff', 'manager');

-- Customer-safe transport status view (unchanged)
CREATE OR REPLACE VIEW customer_safe_transport_status AS
SELECT
  tj.id,
  tj.ticket_id,
  tj.job_type,
  tj.status,
  tj.scheduled_at,
  CASE
    WHEN tj.status IN ('delivered', 'cancelled') THEN TRUE
    ELSE FALSE
  END AS can_see_eta,
  CASE
    WHEN tj.status = 'delivered' THEN 'Delivered'
    WHEN tj.status = 'picked_up' THEN 'On the way to destination'
    WHEN tj.status = 'en_route_drop' THEN 'On the way to you'
    WHEN tj.status = 'en_route_pickup' THEN 'On the way to pickup'
    WHEN tj.status = 'arrived_pickup' THEN 'Arrived at pickup location'
    WHEN tj.status = 'arrived_drop' THEN 'Arrived at drop location'
    ELSE 'Status update pending'
  END AS customer_friendly_status,
  tj.created_at,
  tj.updated_at
FROM public.transport_jobs tj
WHERE EXISTS (
  SELECT 1 FROM public.tickets t
  WHERE t.id = tj.ticket_id
  AND t.customer_id IN (
    SELECT id FROM public.customers
    WHERE user_id = auth.uid()
  )
);

GRANT SELECT ON customer_safe_transport_status TO authenticated;

-- Trigger to enforce column-level immutability for transporter updates
CREATE OR REPLACE FUNCTION public.transport_jobs_prevent_illegal_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only enforce for transporter role; other roles (e.g., admin/service) can bypass if RLS allows
  IF get_my_role() = 'transporter' THEN
    -- Ensure transporter is assigned to this job
    IF OLD.assigned_transporter_id IS DISTINCT FROM get_my_profile_id() THEN
      RAISE EXCEPTION 'Not authorised to update this job';
    END IF;

    -- Prevent changing immutable fields
    IF (OLD.id IS DISTINCT FROM NEW.id)
       OR (OLD.ticket_id IS DISTINCT FROM NEW.ticket_id)
       OR (OLD.branch_id IS DISTINCT FROM NEW.branch_id)
       OR (OLD.assigned_transporter_id IS DISTINCT FROM NEW.assigned_transporter_id) THEN
      RAISE EXCEPTION 'Transporter not allowed to change immutable fields';
    END IF;

    -- Allow only status (and optional updated_at) to change for transporter
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      -- Optionally validate allowed transitions here. Example placeholder:
      -- IF NOT (OLD.status = 'created' AND NEW.status = 'assigned') THEN
      --   RAISE EXCEPTION 'Invalid status transition';
      -- END IF;
      NULL; -- OK: status changed
    END IF;

    -- If any other column changed besides status and updated_at, block
    IF ( (OLD.pickup_notes IS DISTINCT FROM NEW.pickup_notes)
      OR (OLD.drop_notes IS DISTINCT FROM NEW.drop_notes)
      OR (OLD.pickup_address_text IS DISTINCT FROM NEW.pickup_address_text)
      OR (OLD.drop_address_text IS DISTINCT FROM NEW.drop_address_text)
      OR (OLD.pickup_lat IS DISTINCT FROM NEW.pickup_lat)
      OR (OLD.pickup_lng IS DISTINCT FROM NEW.pickup_lng)
      OR (OLD.drop_lat IS DISTINCT FROM NEW.drop_lat)
      OR (OLD.drop_lng IS DISTINCT FROM NEW.drop_lng)
      OR (OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at)
      ) THEN
      -- Block changes to location/notes/schedule by transporter; allow only status changes
      IF (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
        RAISE EXCEPTION 'Transporter may only update status';
      ELSE
        RAISE EXCEPTION 'Transporter not allowed to change location/notes/schedule fields';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transport_jobs_prevent_illegal_updates_trig ON public.transport_jobs;

CREATE TRIGGER transport_jobs_prevent_illegal_updates_trig
  BEFORE UPDATE ON public.transport_jobs
  FOR EACH ROW
  WHEN (get_my_role() = 'transporter')
  EXECUTE FUNCTION public.transport_jobs_prevent_illegal_updates();