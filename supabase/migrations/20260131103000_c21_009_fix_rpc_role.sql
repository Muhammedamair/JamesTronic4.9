-- Migration: C21.9 Fix Ruleset Activation RPC Auth Check
-- Purpose: Correct the JWT extraction path for app_role (it sits in app_metadata).

BEGIN;

CREATE OR REPLACE FUNCTION public.activate_pricing_ruleset(
  p_ruleset_id uuid,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  -- FIX: app_role is inside app_metadata, not at top level
  v_role text := coalesce((auth.jwt() -> 'app_metadata' ->> 'app_role'), '');
  v_before_version text := null;
  v_after_version text := null;
BEGIN
  -- A. Auth Checks
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- B. Input Validation
  IF p_reason IS NULL OR length(trim(p_reason)) < 6 THEN
    RAISE EXCEPTION 'reason_too_short';
  END IF;

  -- C. Locking & State Capture
  -- Lock current active row (if any) to serialize activations
  SELECT version INTO v_before_version
  FROM public.pricing_rulesets
  WHERE is_active = true
  LIMIT 1
  FOR UPDATE;

  -- Lock target row
  SELECT version INTO v_after_version
  FROM public.pricing_rulesets
  WHERE id = p_ruleset_id
  FOR UPDATE;

  IF v_after_version IS NULL THEN
    RAISE EXCEPTION 'ruleset_not_found';
  END IF;

  -- Idempotency check
  IF v_after_version = v_before_version THEN
    RAISE EXCEPTION 'already_active';
  END IF;

  -- D. Atomic Switch
  -- Deactivate all
  UPDATE public.pricing_rulesets SET is_active = false WHERE is_active = true;

  -- Activate target
  UPDATE public.pricing_rulesets
  SET is_active = true,
      activated_at = now(),
      activated_by = v_actor_id
  WHERE id = p_ruleset_id;

  -- E. Audit Log (Global Scope)
  INSERT INTO public.pricing_audit_log (
    event_type, scope, city_id, actor_id, actor_role, payload, explanation
  ) VALUES (
    'RULESET_ACTIVATED',
    'global',
    NULL,
    v_actor_id,
    v_role,
    jsonb_build_object('before', v_before_version, 'after', v_after_version, 'reason', p_reason),
    format('Activated ruleset %s: %s', v_after_version, p_reason)
  );

  RETURN jsonb_build_object('success', true, 'before', v_before_version, 'after', v_after_version);
END;
$$;

COMMIT;
