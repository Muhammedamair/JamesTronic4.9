-- C16 V1: Transport State Machine
-- Enforce allowed state transitions and custody event logging

-- Create a function to validate state transitions
CREATE OR REPLACE FUNCTION validate_transport_job_transition(
  p_current_status TEXT,
  p_new_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Define allowed state transitions
  CASE p_current_status
    WHEN 'created' THEN
      RETURN p_new_status = 'assigned';
    WHEN 'assigned' THEN
      RETURN p_new_status IN ('en_route_pickup', 'cancelled');
    WHEN 'en_route_pickup' THEN
      RETURN p_new_status IN ('arrived_pickup', 'cancelled');
    WHEN 'arrived_pickup' THEN
      RETURN p_new_status IN ('picked_up', 'failed');
    WHEN 'picked_up' THEN
      RETURN p_new_status IN ('en_route_drop', 'cancelled');
    WHEN 'en_route_drop' THEN
      RETURN p_new_status IN ('arrived_drop', 'cancelled');
    WHEN 'arrived_drop' THEN
      RETURN p_new_status IN ('delivered', 'failed');
    WHEN 'delivered' THEN
      RETURN FALSE; -- Delivered is final state
    WHEN 'cancelled' THEN
      RETURN FALSE; -- Cancelled is final state
    WHEN 'failed' THEN
      RETURN p_new_status = 'assigned'; -- Can reassign failed job
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$;

-- Create a trigger function to enforce state transitions
CREATE OR REPLACE FUNCTION enforce_transport_job_state_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_status TEXT;
  v_valid_transition BOOLEAN;
BEGIN
  -- For new records, allow the initial status
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- For updates, check if status is changing
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Get the current status from the old record
  v_current_status := OLD.status;

  -- Validate the transition
  v_valid_transition := validate_transport_job_transition(v_current_status, NEW.status);

  -- If transition is invalid, raise an exception
  IF NOT v_valid_transition THEN
    RAISE EXCEPTION 'Invalid state transition: % -> %', v_current_status, NEW.status;
  END IF;

  -- Log the state change as a custody event if needed
  -- Only log if this is a legitimate state change (not just other field updates)
  IF OLD.status != NEW.status THEN
    INSERT INTO public.custody_ledger (
      transport_job_id,
      ticket_id,
      event_type,
      event_meta,
      actor_id,
      actor_role,
      occurred_at
    )
    VALUES (
      NEW.id,
      NEW.ticket_id,
      'STATUS_CHANGED',
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'reason', 'Automatic state transition'
      ),
      get_my_profile_id(), -- This will be NULL if called from a non-authenticated context
      get_my_role(), -- This will be NULL if called from a non-authenticated context
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Apply the trigger to the transport_jobs table
DROP TRIGGER IF EXISTS enforce_transport_job_state_transition_trigger ON public.transport_jobs;
CREATE TRIGGER enforce_transport_job_state_transition_trigger
  BEFORE UPDATE ON public.transport_jobs
  FOR EACH ROW
  EXECUTE FUNCTION enforce_transport_job_state_transition();

-- Create a function to update transport job status via RPC (recommended approach)
CREATE OR REPLACE FUNCTION rpc_transport_update_job_status(
  p_transport_job_id UUID,
  p_new_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_valid_transition BOOLEAN;
  v_actor_id UUID;
  v_actor_role TEXT;
BEGIN
  -- Get current status
  SELECT status INTO v_current_status
  FROM public.transport_jobs
  WHERE id = p_transport_job_id;

  -- Check if job exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transport job not found: %', p_transport_job_id;
  END IF;

  -- Validate the transition
  v_valid_transition := validate_transport_job_transition(v_current_status, p_new_status);

  -- If transition is invalid, raise an exception
  IF NOT v_valid_transition THEN
    RAISE EXCEPTION 'Invalid state transition: % -> %', v_current_status, p_new_status;
  END IF;

  -- Get actor info
  v_actor_id := get_my_profile_id();
  v_actor_role := get_my_role();

  -- Update the status
  UPDATE public.transport_jobs
  SET
    status = p_new_status,
    updated_at = NOW()
  WHERE id = p_transport_job_id;

  -- Log the state change as a custody event
  INSERT INTO public.custody_ledger (
    transport_job_id,
    ticket_id,
    event_type,
    event_meta,
    actor_id,
    actor_role,
    occurred_at
  )
  SELECT
    p_transport_job_id,
    ticket_id,
    'STATUS_CHANGED_MANUAL',
    jsonb_build_object(
      'old_status', v_current_status,
      'new_status', p_new_status,
      'reason', COALESCE(p_reason, 'Manual status update'),
      'updated_by_role', v_actor_role
    ),
    v_actor_id,
    v_actor_role,
    NOW()
  FROM public.transport_jobs
  WHERE id = p_transport_job_id;

  RETURN TRUE;
END;
$$;