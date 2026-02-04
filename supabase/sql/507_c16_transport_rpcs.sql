-- C16 V1: Transport RPC Functions
-- SECURITY DEFINER functions for secure transport operations

-- Function to issue transport OTPs
CREATE OR REPLACE FUNCTION rpc_transport_request_handover_otp(
  p_transport_job_id UUID,
  p_purpose TEXT
)
RETURNS TEXT -- Returns OTP code (this would be sent via notification, not returned in real implementation)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_otp_code TEXT;
  v_otp_hash TEXT;
  v_existing_otp_id UUID;
BEGIN
  -- Verify the function is called by service role or with proper authorization
  -- In a real implementation, this would be called from an edge function with proper auth

  -- Validate purpose
  IF p_purpose NOT IN ('PICKUP_HANDOVER', 'DROP_HANDOVER') THEN
    RAISE EXCEPTION 'Invalid OTP purpose: %', p_purpose;
  END IF;

  -- Check if transport job exists and is assigned
  IF NOT EXISTS (
    SELECT 1 FROM public.transport_jobs
    WHERE id = p_transport_job_id
    AND status IN ('assigned', 'en_route_pickup', 'picked_up', 'en_route_drop')
  ) THEN
    RAISE EXCEPTION 'Transport job not found or not in valid state for OTP generation';
  END IF;

  -- Generate OTP (6-digit numeric code)
  v_otp_code := (floor(random() * 900000) + 100000)::TEXT;

  -- For this implementation, we'll use MD5 hash with salt for OTP storage
  -- In production, use a proper cryptographic library
  v_otp_hash := encode(digest(v_otp_code || gen_random_uuid()::TEXT, 'sha256'), 'hex');

  -- Check if an active OTP already exists for this job and purpose
  SELECT id INTO v_existing_otp_id
  FROM public.transport_job_otps
  WHERE transport_job_id = p_transport_job_id
    AND purpose = p_purpose
    AND consumed_at IS NULL
    AND expires_at > CURRENT_TIMESTAMP;

  -- If an active OTP exists, update it (renew expiry)
  IF v_existing_otp_id IS NOT NULL THEN
    UPDATE public.transport_job_otps
    SET
      otp_hash = v_otp_hash,
      expires_at = CURRENT_TIMESTAMP + INTERVAL '30 minutes',
      attempts_used = 0,
      consumed_at = NULL
    WHERE id = v_existing_otp_id;

    RETURN v_otp_code; -- In real implementation, this would trigger a notification instead of returning
  END IF;

  -- Insert new OTP record
  INSERT INTO public.transport_job_otps (
    transport_job_id,
    purpose,
    otp_hash,
    expires_at
  ) VALUES (
    p_transport_job_id,
    p_purpose,
    v_otp_hash,
    CURRENT_TIMESTAMP + INTERVAL '30 minutes'
  );

  -- In a real implementation, you would trigger an SMS/Notification here instead of returning the OTP
  -- PERFORM send_transport_otp_notification(p_transport_job_id, v_otp_code, p_purpose);

  RETURN v_otp_code;
END;
$$;

-- Function to verify transport OTP and handle custody events
CREATE OR REPLACE FUNCTION rpc_transport_verify_handover(
  p_transport_job_id UUID,
  p_purpose TEXT,
  p_otp_code TEXT,
  p_lat NUMERIC,
  p_lng NUMERIC
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  new_status TEXT,
  custody_event_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_otp_record RECORD;
  v_job_record RECORD;
  v_distance_meters NUMERIC;
  v_within_geofence BOOLEAN := FALSE;
  v_new_status TEXT;
  v_event_type TEXT;
  v_hashed_otp TEXT;
  v_custody_event_id UUID;
  otp_salt_value TEXT; -- Declare this at the main level
BEGIN
  -- Validate purpose
  IF p_purpose NOT IN ('PICKUP_HANDOVER', 'DROP_HANDOVER') THEN
    RAISE EXCEPTION 'Invalid OTP purpose: %', p_purpose;
  END IF;

  -- Find the active OTP record
  SELECT * INTO v_otp_record
  FROM public.transport_job_otps
  WHERE transport_job_id = p_transport_job_id
    AND purpose = p_purpose
    AND consumed_at IS NULL
    AND expires_at > CURRENT_TIMESTAMP
  ORDER BY created_at DESC
  LIMIT 1;

  -- Check if OTP exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'No active OTP found for this job and purpose', NULL::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Check if OTP has been attempted too many times
  IF v_otp_record.attempts_used >= v_otp_record.max_attempts THEN
    RETURN QUERY SELECT FALSE, 'OTP attempts exceeded maximum limit', NULL::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Get the salt for this OTP record
  SELECT COALESCE(otp_salt, gen_random_uuid()::TEXT) INTO otp_salt_value
  FROM public.transport_job_otps
  WHERE id = v_otp_record.id;

  -- Hash the provided OTP code with the stored salt to compare with stored hash
  v_hashed_otp := encode(digest(p_otp_code || otp_salt_value, 'sha256'), 'hex');

  -- Compare the hashes
  IF v_hashed_otp != v_otp_record.otp_hash THEN
    -- Increment attempts counter
    UPDATE public.transport_job_otps
    SET attempts_used = attempts_used + 1
    WHERE id = v_otp_record.id;

    RETURN QUERY SELECT FALSE, 'Invalid OTP code', NULL::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Get the transport job details
  SELECT * INTO v_job_record
  FROM public.transport_jobs
  WHERE id = p_transport_job_id;

  -- Verify geolock - calculate distance from expected location
  IF p_purpose = 'PICKUP_HANDOVER' THEN
    -- Calculate distance from provided coordinates to expected pickup location
    IF v_job_record.pickup_lat IS NOT NULL AND v_job_record.pickup_lng IS NOT NULL THEN
      v_distance_meters := 6371000 * acos(
        least(
          greatest(
            cos(radians(p_lat)) * cos(radians(v_job_record.pickup_lat)) *
            cos(radians(v_job_record.pickup_lng) - radians(p_lng)) +
            sin(radians(p_lat)) * sin(radians(v_job_record.pickup_lat)),
            -1
          ),
          1
        )
      );

      -- Check if within 50m geofence (configurable)
      v_within_geofence := v_distance_meters <= 50;
    ELSE
      -- If no expected location, we can't verify geofence
      v_within_geofence := TRUE;
    END IF;
  ELSIF p_purpose = 'DROP_HANDOVER' THEN
    -- Calculate distance from provided coordinates to expected drop location
    IF v_job_record.drop_lat IS NOT NULL AND v_job_record.drop_lng IS NOT NULL THEN
      v_distance_meters := 6371000 * acos(
        least(
          greatest(
            cos(radians(p_lat)) * cos(radians(v_job_record.drop_lat)) *
            cos(radians(v_job_record.drop_lng) - radians(p_lng)) +
            sin(radians(p_lat)) * sin(radians(v_job_record.drop_lat)),
            -1
          ),
          1
        )
      );

      -- Check if within 50m geofence (configurable)
      v_within_geofence := v_distance_meters <= 50;
    ELSE
      -- If no expected location, we can't verify geofence
      v_within_geofence := TRUE;
    END IF;
  END IF;

  -- If not within geofence, deny the action
  IF NOT v_within_geofence THEN
    -- Increment attempts counter for security
    UPDATE public.transport_job_otps
    SET attempts_used = attempts_used + 1
    WHERE id = v_otp_record.id;

    RETURN QUERY SELECT FALSE, 'Geofence violation: You are not at the expected location (' || ROUND(v_distance_meters, 2) || 'm away)', NULL::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- If OTP matches and geofence passes, mark as consumed
  UPDATE public.transport_job_otps
  SET consumed_at = CURRENT_TIMESTAMP
  WHERE id = v_otp_record.id;

  -- Determine new status and event type based on purpose
  IF p_purpose = 'PICKUP_HANDOVER' THEN
    v_new_status := 'picked_up';
    v_event_type := 'PICKUP_CONFIRMED';
  ELSIF p_purpose = 'DROP_HANDOVER' THEN
    v_new_status := 'delivered';
    v_event_type := 'DROP_CONFIRMED';
  END IF;

  -- Insert custody ledger event
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
    tj.ticket_id,
    v_event_type,
    jsonb_build_object(
      'lat', p_lat,
      'lng', p_lng,
      'geofence_distance', v_distance_meters,
      'otp_verified', TRUE
    ),
    get_my_profile_id(), -- Current user's profile ID
    get_my_role(), -- Current user's role
    CURRENT_TIMESTAMP
  FROM public.transport_jobs tj
  WHERE tj.id = p_transport_job_id
  RETURNING id INTO v_custody_event_id;

  -- Update transport job status
  UPDATE public.transport_jobs
  SET
    status = v_new_status,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_transport_job_id;

  -- Return success
  RETURN QUERY SELECT TRUE, 'Handover confirmed successfully', v_new_status, v_custody_event_id;
END;
$$;

-- Function to ingest location pings
CREATE OR REPLACE FUNCTION rpc_transport_ping_ingest(
  p_transporter_id UUID,
  p_lat NUMERIC,
  p_lng NUMERIC,
  p_accuracy_m NUMERIC DEFAULT NULL
)
RETURNS UUID -- Returns the ID of the created ping record
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ping_id UUID;
BEGIN
  -- Verify that the caller is the transporter or an admin
  -- This would be enforced by the calling edge function with proper auth

  -- Insert the location ping
  INSERT INTO public.transporter_location_pings (
    transporter_id,
    lat,
    lng,
    accuracy_meters
  )
  VALUES (
    p_transporter_id,
    p_lat,
    p_lng,
    p_accuracy_m
  )
  RETURNING id INTO v_ping_id;

  -- Optionally update the last ping time on the transport job for quick lookups
  -- This would be done if the transporter is currently assigned to a job
  -- UPDATE transport_jobs SET last_ping_at = CURRENT_TIMESTAMP WHERE assigned_transporter_id = p_transporter_id;

  RETURN v_ping_id;
END;
$$;

-- Function to check geolock without verifying OTP (for pre-verification)
CREATE OR REPLACE FUNCTION rpc_transport_geolock_check(
  p_transport_job_id UUID,
  p_purpose TEXT,
  p_lat NUMERIC,
  p_lng NUMERIC
)
RETURNS TABLE(
  within_geofence BOOLEAN,
  distance_meters NUMERIC,
  radius_meters INTEGER,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_job_record RECORD;
  v_distance_meters NUMERIC;
  v_within_geofence BOOLEAN;
  v_radius INTEGER := 50; -- Default radius
BEGIN
  -- Get the transport job details
  SELECT * INTO v_job_record
  FROM public.transport_jobs
  WHERE id = p_transport_job_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::NUMERIC, v_radius, 'Transport job not found';
    RETURN;
  END IF;

  -- Calculate distance based on purpose
  IF p_purpose = 'PICKUP_HANDOVER' THEN
    IF v_job_record.pickup_lat IS NOT NULL AND v_job_record.pickup_lng IS NOT NULL THEN
      v_distance_meters := 6371000 * acos(
        least(
          greatest(
            cos(radians(p_lat)) * cos(radians(v_job_record.pickup_lat)) *
            cos(radians(v_job_record.pickup_lng) - radians(p_lng)) +
            sin(radians(p_lat)) * sin(radians(v_job_record.pickup_lat)),
            -1
          ),
          1
        )
      );

      v_within_geofence := v_distance_meters <= v_radius;
      RETURN QUERY SELECT v_within_geofence, v_distance_meters, v_radius,
                   CASE WHEN v_within_geofence THEN 'Within geofence' ELSE 'Outside geofence (' || ROUND(v_distance_meters, 2) || 'm away)' END;
    ELSE
      RETURN QUERY SELECT FALSE, NULL::NUMERIC, v_radius, 'No pickup location coordinates available';
    END IF;
  ELSIF p_purpose = 'DROP_HANDOVER' THEN
    IF v_job_record.drop_lat IS NOT NULL AND v_job_record.drop_lng IS NOT NULL THEN
      v_distance_meters := 6371000 * acos(
        least(
          greatest(
            cos(radians(p_lat)) * cos(radians(v_job_record.drop_lat)) *
            cos(radians(v_job_record.drop_lng) - radians(p_lng)) +
            sin(radians(p_lat)) * sin(radians(v_job_record.drop_lat)),
            -1
          ),
          1
        )
      );

      v_within_geofence := v_distance_meters <= v_radius;
      RETURN QUERY SELECT v_within_geofence, v_distance_meters, v_radius,
                   CASE WHEN v_within_geofence THEN 'Within geofence' ELSE 'Outside geofence (' || ROUND(v_distance_meters, 2) || 'm away)' END;
    ELSE
      RETURN QUERY SELECT FALSE, NULL::NUMERIC, v_radius, 'No drop location coordinates available';
    END IF;
  ELSE
    RETURN QUERY SELECT FALSE, NULL::NUMERIC, v_radius, 'Invalid purpose';
  END IF;
END;
$$;