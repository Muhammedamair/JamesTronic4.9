-- Migration: WS-3 PR-1 Foundation
-- Purpose: Add boolean role helpers, make audit city_id nullable, and add atomic ruleset activation RPC.

BEGIN;

-- 1. Helper Functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public._c20_app_role() IN ('admin', 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public._c20_app_role() = 'manager';
$$;

-- 2. Audit Table Hardening (Allow Global Events)
ALTER TABLE public.pricing_audit_log ALTER COLUMN city_id DROP NOT NULL;

-- 3. Ruleset Activation RPC
CREATE OR REPLACE FUNCTION public.activate_pricing_ruleset(
    p_ruleset_id uuid,
    p_confirm text,
    p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_actor_id uuid;
    v_before_id uuid;
BEGIN
    -- Authorization check
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'unauthorized: admin role required for ruleset activation';
    END IF;

    -- Safety confirmation
    IF p_confirm IS NULL OR trim(p_confirm) != 'ACTIVATE' THEN
        RAISE EXCEPTION 'missing_confirmation: must provide exact string "ACTIVATE"';
    END IF;

    -- Reason requirement
    IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'invalid_reason: must provide a detailed reason (min 5 chars)';
    END IF;

    v_actor_id := auth.uid();
    
    -- Get current active ruleset (if any)
    SELECT id INTO v_before_id FROM public.pricing_rulesets WHERE is_active = true LIMIT 1;

    -- Atomic swap
    UPDATE public.pricing_rulesets SET is_active = false WHERE is_active = true;
    
    UPDATE public.pricing_rulesets
    SET 
        is_active = true,
        activated_at = now(),
        activated_by = v_actor_id
    WHERE id = p_ruleset_id;

    -- Audit Log (Global event: city_id is null)
    INSERT INTO public.pricing_audit_log (
        event_type,
        actor_id,
        actor_role,
        payload,
        explanation,
        created_at
    ) VALUES (
        'RULESET_ACTIVATED',
        v_actor_id,
        public._c20_app_role(),
        jsonb_build_object(
            'before_id', v_before_id,
            'after_id', p_ruleset_id,
            'reason', p_reason
        ),
        p_reason,
        now()
    );

END;
$$;

-- 4. Grants
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_manager() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.activate_pricing_ruleset(uuid, text, text) TO authenticated, service_role;

-- 5. RLS Refinement (Manager visibility)
-- Ensure managers can see all rulesets (as defined in plan)
DROP POLICY IF EXISTS "rulesets_admin_read" ON public.pricing_rulesets;
CREATE POLICY "rulesets_manager_admin_read" ON public.pricing_rulesets
  FOR SELECT USING (
    public.is_admin() OR public.is_manager() OR is_active = true
  );

COMMIT;
