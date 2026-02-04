-- Migration: C21.8 Global Audit + Ruleset Activation RPC
-- Purpose: 
-- 1. Allow 'global' scope in pricing_audit_log (city_id nullable).
-- 2. Add RPC for atomic ruleset activation.

BEGIN;

-- 1. Modify pricing_audit_log for global events
ALTER TABLE public.pricing_audit_log
  ALTER COLUMN city_id DROP NOT NULL;

-- Add scope column with check constraint
ALTER TABLE public.pricing_audit_log
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'city';

ALTER TABLE public.pricing_audit_log
  DROP CONSTRAINT IF EXISTS pricing_audit_log_scope_chk;

ALTER TABLE public.pricing_audit_log
  ADD CONSTRAINT pricing_audit_log_scope_chk
  CHECK (scope IN ('city', 'global'));

CREATE INDEX IF NOT EXISTS idx_pricing_audit_log_scope
  ON public.pricing_audit_log(scope);

-- 2. Create Transactional RPC for Ruleset Activation
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
  v_role text := coalesce(auth.jwt() ->> 'app_role', '');
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
  -- Deactivate all (safe because index ensures only one was true)
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

-- 3. Permissions
REVOKE ALL ON FUNCTION public.activate_pricing_ruleset(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.activate_pricing_ruleset(uuid, text) TO authenticated;

COMMIT;
