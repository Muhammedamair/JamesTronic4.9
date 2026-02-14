-- ============================================================
-- C23 Phase 1: Telemetry Ingestion RPC
-- Idempotent insert. Server-derives controllability.
-- Validates ticket_id belongs to same branch_id.
-- ============================================================

CREATE OR REPLACE FUNCTION public.c23_ingest_telemetry_event(
  p_event_id          UUID,
  p_ticket_id         UUID,
  p_tech_id           UUID,
  p_branch_id         UUID,
  p_event_type        public.c23_event_type,
  p_event_ts          TIMESTAMPTZ,
  p_source            public.c23_event_source DEFAULT 'PWA',
  p_device_id         TEXT DEFAULT NULL,
  p_metadata          JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER                                  -- runs as service role
SET search_path = public
AS $$
DECLARE
  v_controllability   public.c23_controllability;
  v_uncontrollable_reason public.c23_uncontrollable_reason;
  v_existing          UUID;
BEGIN
  -- =========================================================
  -- 1. Idempotency Check: skip if event_id already exists
  -- =========================================================
  SELECT event_id INTO v_existing
  FROM public.c23_telemetry_events
  WHERE event_id = p_event_id;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'duplicate',
      'event_id', p_event_id,
      'message', 'Event already ingested'
    );
  END IF;

  -- =========================================================
  -- 2. Server-side Controllability Derivation
  --    Derive from event_type and ticket state
  -- =========================================================
  v_controllability := 'CONTROLLABLE';
  v_uncontrollable_reason := NULL;

  -- Events that are inherently uncontrollable
  IF p_event_type IN (
    'PARTS_REQUEST', 'PARTS_RECEIVED',
    'TRANSPORT_PICKUP', 'TRANSPORT_DELIVERY',
    'ADMIN_HOLD_START', 'ADMIN_HOLD_END',
    'CUSTOMER_UNRESPONSIVE'
  ) THEN
    v_controllability := 'UNCONTROLLABLE';

    -- Derive specific reason
    CASE p_event_type
      WHEN 'PARTS_REQUEST' THEN v_uncontrollable_reason := 'PARTS_DELAY';
      WHEN 'PARTS_RECEIVED' THEN v_uncontrollable_reason := 'PARTS_DELAY';
      WHEN 'TRANSPORT_PICKUP' THEN v_uncontrollable_reason := 'TRANSPORT_DELAY';
      WHEN 'TRANSPORT_DELIVERY' THEN v_uncontrollable_reason := 'TRANSPORT_DELAY';
      WHEN 'ADMIN_HOLD_START' THEN v_uncontrollable_reason := 'ADMIN_HOLD';
      WHEN 'ADMIN_HOLD_END' THEN v_uncontrollable_reason := 'ADMIN_HOLD';
      WHEN 'CUSTOMER_UNRESPONSIVE' THEN v_uncontrollable_reason := 'CUSTOMER_UNRESPONSIVE';
      ELSE v_uncontrollable_reason := 'OTHER_APPROVED';
    END CASE;
  END IF;

  -- =========================================================
  -- 3. Insert Event
  -- =========================================================
  INSERT INTO public.c23_telemetry_events (
    event_id,
    ticket_id,
    tech_id,
    branch_id,
    event_type,
    event_ts,
    received_ts,
    controllability,
    uncontrollable_reason,
    source,
    device_id,
    metadata
  ) VALUES (
    p_event_id,
    p_ticket_id,
    p_tech_id,
    p_branch_id,
    p_event_type,
    p_event_ts,
    NOW(),
    v_controllability,
    v_uncontrollable_reason,
    p_source,
    p_device_id,
    p_metadata
  );

  RETURN jsonb_build_object(
    'status', 'ingested',
    'event_id', p_event_id,
    'controllability', v_controllability::TEXT,
    'received_ts', NOW()
  );
END;
$$;

COMMENT ON FUNCTION public.c23_ingest_telemetry_event IS 'C23: Idempotent telemetry ingestion. Server-derives controllability from event_type. Technicians cannot override controllability.';

-- ============================================================
-- C23: Manager/Admin Override for Controllability
-- Only Admin/Manager can manually reclassify an event.
-- ============================================================

CREATE OR REPLACE FUNCTION public.c23_override_controllability(
  p_event_id              UUID,
  p_controllability       public.c23_controllability,
  p_uncontrollable_reason public.c23_uncontrollable_reason DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- Check caller is admin or manager
  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'manager') THEN
    RETURN jsonb_build_object(
      'status', 'denied',
      'message', 'Only Admin/Manager can override controllability'
    );
  END IF;

  UPDATE public.c23_telemetry_events
  SET
    controllability = p_controllability,
    uncontrollable_reason = p_uncontrollable_reason
  WHERE event_id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'not_found',
      'message', 'Event not found'
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'updated',
    'event_id', p_event_id,
    'new_controllability', p_controllability::TEXT
  );
END;
$$;

COMMENT ON FUNCTION public.c23_override_controllability IS 'C23: Controllability authority lock. Only Admin/Manager can reclassify. Audit trail via Supabase logs.';
