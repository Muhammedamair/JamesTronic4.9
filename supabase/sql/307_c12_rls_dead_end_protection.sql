-- C12.5: RLS Dead End Protection - Minimal Working Version
-- Clean SQL (NO CREATE OR REPLACE POLICY—100% Supabase-safe)

------------------------------------------------------------
-- Helper Functions
------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_my_role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_my_profile_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

------------------------------------------------------------
-- Ownership Verification Function
------------------------------------------------------------

CREATE OR REPLACE FUNCTION verify_ownership_and_role(entity_type TEXT, entity_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    has_access BOOLEAN := FALSE;
    user_role TEXT;
    entity_owner_id UUID;
BEGIN
    SELECT role INTO user_role FROM public.profiles WHERE user_id = p_user_id LIMIT 1;

    IF entity_type = 'ticket' THEN
        SELECT customer_id INTO entity_owner_id FROM public.tickets WHERE id = entity_id;

        IF user_role = 'customer' AND entity_owner_id IS NOT DISTINCT FROM (SELECT id FROM public.customers WHERE user_id = p_user_id LIMIT 1) THEN
            has_access := TRUE;
        ELSIF user_role IN ('admin', 'staff') THEN
            has_access := TRUE;
        ELSIF user_role = 'technician' AND EXISTS (
            SELECT 1 FROM public.tickets t
            WHERE t.id = entity_id
            AND t.assigned_technician_id = get_my_profile_id()
        ) THEN
            has_access := TRUE;
        END IF;

    ELSIF entity_type = 'ticket_event' THEN
        SELECT t.customer_id INTO entity_owner_id
        FROM public.ticket_events te
        JOIN public.tickets t ON t.id = te.ticket_id
        WHERE te.id = entity_id;

        IF user_role = 'customer' AND entity_owner_id IS NOT DISTINCT FROM (SELECT id FROM public.customers WHERE user_id = p_user_id LIMIT 1) THEN
            has_access := TRUE;
        ELSIF user_role IN ('admin', 'staff') THEN
            has_access := TRUE;
        ELSIF user_role = 'technician' AND EXISTS (
            SELECT 1 FROM public.ticket_events te
            JOIN public.tickets t ON t.id = te.ticket_id
            WHERE te.id = entity_id
            AND t.assigned_technician_id = get_my_profile_id()
        ) THEN
            has_access := TRUE;
        END IF;
    END IF;

    RETURN has_access;
END;
$$ LANGUAGE plpgsql;

------------------------------------------------------------
-- Security Violation Logging
------------------------------------------------------------

CREATE OR REPLACE FUNCTION log_security_violation(
    p_user_id UUID,
    p_operation TEXT,
    p_table_name TEXT,
    p_record_id UUID,
    p_details TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.audit_log_entries (
        actor_user_id,
        event_type,
        entity_type,
        entity_id,
        metadata,
        created_at
    )
    VALUES (
        p_user_id,
        'ACCESS_VIOLATION',
        p_table_name,
        p_record_id,
        jsonb_build_object(
            'operation', p_operation,
            'details', p_details,
            'attempted_at', NOW()
        ),
        NOW()
    );
EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END;
$$ LANGUAGE plpgsql;

------------------------------------------------------------
-- Access Checker
------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_access_and_log(
    p_user_id UUID,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_operation TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    has_access BOOLEAN;
BEGIN
    has_access := verify_ownership_and_role(p_entity_type, p_entity_id, p_user_id);

    IF NOT has_access THEN
        PERFORM log_security_violation(
            p_user_id,
            p_operation,
            p_entity_type,
            p_entity_id,
            'Access denied'
        );
    END IF;

    RETURN has_access;
END;
$$ LANGUAGE plpgsql;

------------------------------------------------------------
-- Prevent Batch Bypass Trigger
------------------------------------------------------------

CREATE OR REPLACE FUNCTION prevent_batch_bypass()
RETURNS TRIGGER AS $$
DECLARE
    user_role TEXT;
    current_user_id UUID;
    normalized_table_name TEXT;
BEGIN
    current_user_id := auth.uid();
    SELECT role INTO user_role FROM public.profiles WHERE user_id = current_user_id LIMIT 1;

    IF user_role = 'customer' AND TG_OP IN ('UPDATE', 'DELETE') THEN

        IF TG_TABLE_NAME = 'ticket_events' THEN
            normalized_table_name := 'ticket_event';
        ELSIF TG_TABLE_NAME = 'ticket_sla' THEN
            normalized_table_name := 'ticket_sla';
        ELSIF TG_TABLE_NAME = 'ticket_quotations' THEN
            normalized_table_name := 'ticket_quotation';
        ELSE
            normalized_table_name := TG_TABLE_NAME;
        END IF;

        IF NOT verify_ownership_and_role(normalized_table_name, OLD.id, current_user_id) THEN
            RAISE EXCEPTION 'Access denied: unauthorized % operation', TG_OP;
        END IF;

    END IF;

    RETURN CASE WHEN TG_OP = 'INSERT' THEN NEW ELSE OLD END;
END;
$$ LANGUAGE plpgsql;

------------------------------------------------------------
-- RLS Policies (FIXED: No OR REPLACE)
------------------------------------------------------------

-- ticket_events
DROP POLICY IF EXISTS "Customers can view ticket events with verification" ON public.ticket_events;
CREATE POLICY "Customers can view ticket events with verification"
ON public.ticket_events
FOR SELECT USING (
    (get_my_role() = 'customer' AND
        EXISTS (
            SELECT 1 FROM public.tickets t
            JOIN public.customers c ON c.id = t.customer_id
            WHERE t.id = ticket_events.ticket_id
            AND c.user_id = auth.uid()
        )
    ) OR
    (get_my_role() = 'technician' AND
        EXISTS (
            SELECT 1 FROM public.tickets t
            WHERE t.id = ticket_events.ticket_id
            AND t.assigned_technician_id = get_my_profile_id()
        )
    ) OR
    (get_my_role() IN ('admin','staff'))
);

DROP POLICY IF EXISTS "Technicians view assigned events" ON public.ticket_events;
CREATE POLICY "Technicians view assigned events"
ON public.ticket_events
FOR SELECT USING (
    get_my_role() = 'technician' AND
    EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_events.ticket_id
        AND t.assigned_technician_id = get_my_profile_id()
    )
);

-- ticket_sla
DROP POLICY IF EXISTS "Customers can view ticket SLA" ON public.ticket_sla;
CREATE POLICY "Customers can view ticket SLA"
ON public.ticket_sla
FOR SELECT USING (
    (get_my_role() = 'customer' AND
        EXISTS (
            SELECT 1 FROM public.tickets t
            JOIN public.customers c ON c.id = t.customer_id
            WHERE t.id = ticket_sla.ticket_id
            AND c.user_id = auth.uid()
        )
    ) OR
    (get_my_role() = 'technician' AND
        EXISTS (
            SELECT 1 FROM public.tickets t
            WHERE t.id = ticket_sla.ticket_id
            AND t.assigned_technician_id = get_my_profile_id()
        )
    ) OR
    (get_my_role() IN ('admin','staff'))
);

-- ticket_quotations
DROP POLICY IF EXISTS "Customers view ticket quotations" ON public.ticket_quotations;
CREATE POLICY "Customers view ticket quotations"
ON public.ticket_quotations
FOR SELECT USING (
    (get_my_role() = 'customer' AND
        EXISTS (
            SELECT 1 FROM public.tickets t
            JOIN public.customers c ON c.id = t.customer_id
            WHERE t.id = ticket_quotations.ticket_id
            AND c.user_id = auth.uid()
        )
    ) OR
    (get_my_role() = 'technician' AND
        EXISTS (
            SELECT 1 FROM public.tickets t
            WHERE t.id = ticket_quotations.ticket_id
            AND t.assigned_technician_id = get_my_profile_id()
        )
    ) OR
    (get_my_role() IN ('admin','staff'))
);

------------------------------------------------------------
-- Security Triggers
------------------------------------------------------------

CREATE TRIGGER ticket_events_security_check_trigger
    BEFORE UPDATE OR DELETE ON public.ticket_events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_batch_bypass();

CREATE TRIGGER ticket_sla_security_check_trigger
    BEFORE UPDATE OR DELETE ON public.ticket_sla
    FOR EACH ROW
    EXECUTE FUNCTION prevent_batch_bypass();

CREATE TRIGGER ticket_quotations_security_check_trigger
    BEFORE UPDATE OR DELETE ON public.ticket_quotations
    FOR EACH ROW
    EXECUTE FUNCTION prevent_batch_bypass();

------------------------------------------------------------
-- Safe View
------------------------------------------------------------

CREATE OR REPLACE VIEW customer_safe_ticket_events AS
SELECT
    te.id,
    te.ticket_id,
    te.event_type,
    te.title,
    te.description,
    te.details,
    te.created_at,
    CASE WHEN get_my_role() = 'customer' THEN NULL ELSE te.created_by END AS created_by
FROM public.ticket_events te
JOIN public.tickets t ON t.id = te.ticket_id
JOIN public.customers c ON c.id = t.customer_id
WHERE
    (get_my_role() = 'customer' AND c.user_id = auth.uid())
    OR get_my_role() IN ('admin','staff')
    OR (get_my_role() = 'technician' AND t.assigned_technician_id = get_my_profile_id());

GRANT SELECT ON customer_safe_ticket_events TO authenticated;

------------------------------------------------------------
-- Security: Restrict helper functions
------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION get_my_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_my_profile_id() FROM PUBLIC;
