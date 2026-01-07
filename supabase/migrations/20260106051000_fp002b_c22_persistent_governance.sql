-- FP-002b: Persistent Governance Lock for C22
-- Purpose:
-- 1) Ensure suspension audit log exists + RLS + correct policies
-- 2) Ensure strict governance RPC exists
-- 3) Ensure legacy rpc_suspend_actor is NOT executable by clients (anon/authenticated/PUBLIC)

-- 1) Audit log table (idempotent)
CREATE TABLE IF NOT EXISTS public.suspension_audit_log (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_type text NOT NULL,
  actor_id uuid NOT NULL,
  requested_by uuid,
  requested_by_role text,
  is_automatic boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_by_role text,
  investigation_case_id uuid,
  reason text,
  decision text NOT NULL,        -- 'ALLOWED' | 'BLOCKED'
  decision_reason text
);

ALTER TABLE public.suspension_audit_log ENABLE ROW LEVEL SECURITY;

-- 2) RLS policies (only valid enum roles: admin, staff, customer, technician, transporter)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='suspension_audit_log'
      AND policyname='C22: Admin/Staff can read suspension_audit_log'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "C22: Admin/Staff can read suspension_audit_log"
      ON public.suspension_audit_log
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin'::app_role, 'staff'::app_role)
        )
      )
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='suspension_audit_log'
      AND policyname='C22: Admin can insert suspension_audit_log'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "C22: Admin can insert suspension_audit_log"
      ON public.suspension_audit_log
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin'::app_role)
        )
      )
    $pol$;
  END IF;
END $$;

-- 3) Strict governance gate (idempotent)
CREATE OR REPLACE FUNCTION public.rpc_suspend_actor_strict(
  actor_type text,
  actor_id uuid,
  investigation_case_id uuid,
  reason text,
  is_automatic boolean DEFAULT false,
  approved_by_admin boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_role app_role;
  caller_id uuid;
  allowed boolean := false;
  decision_reason text := '';
BEGIN
  caller_id := auth.uid();

  SELECT p.role INTO caller_role
  FROM public.profiles p
  WHERE p.id = caller_id;

  IF caller_role IS NULL THEN
    decision_reason := 'BLOCKED: caller has no role/profile';
    INSERT INTO public.suspension_audit_log(
      actor_type, actor_id, requested_by, requested_by_role,
      is_automatic, approved_by, approved_by_role,
      investigation_case_id, reason, decision, decision_reason
    ) VALUES (
      actor_type, actor_id, caller_id, NULL,
      is_automatic, NULL, NULL,
      investigation_case_id, reason, 'BLOCKED', decision_reason
    );
    RETURN json_build_object('ok', false, 'error', decision_reason);
  END IF;

  -- HARD GOVERNANCE: Only admin can suspend
  IF caller_role <> 'admin'::app_role THEN
    decision_reason := 'BLOCKED: only admin can suspend actors';
    INSERT INTO public.suspension_audit_log(
      actor_type, actor_id, requested_by, requested_by_role,
      is_automatic, approved_by, approved_by_role,
      investigation_case_id, reason, decision, decision_reason
    ) VALUES (
      actor_type, actor_id, caller_id, caller_role::text,
      is_automatic, NULL, NULL,
      investigation_case_id, reason, 'BLOCKED', decision_reason
    );
    RETURN json_build_object('ok', false, 'error', decision_reason);
  END IF;

  -- Auto-suspend path: requires explicit approval + case id
  IF is_automatic = true THEN
    IF approved_by_admin = true AND investigation_case_id IS NOT NULL THEN
      allowed := true;
    ELSE
      allowed := false;
      decision_reason := 'BLOCKED: auto-suspend requires approved_by_admin=true + investigation_case_id';
    END IF;
  ELSE
    -- Manual: requires case id + reason
    IF investigation_case_id IS NOT NULL
       AND reason IS NOT NULL
       AND length(trim(reason)) > 5 THEN
      allowed := true;
    ELSE
      allowed := false;
      decision_reason := 'BLOCKED: manual suspend requires investigation_case_id + reason';
    END IF;
  END IF;

  INSERT INTO public.suspension_audit_log(
    actor_type, actor_id, requested_by, requested_by_role,
    is_automatic, approved_by, approved_by_role,
    investigation_case_id, reason, decision, decision_reason
  ) VALUES (
    actor_type, actor_id, caller_id, caller_role::text,
    is_automatic,
    CASE WHEN approved_by_admin THEN caller_id ELSE NULL END,
    CASE WHEN approved_by_admin THEN caller_role::text ELSE NULL END,
    investigation_case_id, reason,
    CASE WHEN allowed THEN 'ALLOWED' ELSE 'BLOCKED' END,
    CASE WHEN allowed THEN 'OK' ELSE decision_reason END
  );

  IF allowed = false THEN
    RETURN json_build_object('ok', false, 'error', decision_reason);
  END IF;

  -- NOTE: This function is a GOVERNANCE GATE + AUDIT.
  -- Wire actual suspension mutation later through an approved workflow.
  RETURN json_build_object('ok', true, 'message', 'Suspension approved by governance gate');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_suspend_actor_strict(text, uuid, uuid, text, boolean, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_suspend_actor_strict(text, uuid, uuid, text, boolean, boolean) TO authenticated;

-- 4) Permanently disable client execution on legacy RPC (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public'
      AND p.proname='rpc_suspend_actor'
      AND pg_get_function_identity_arguments(p.oid) = 'p_actor_id uuid, p_actor_type text, p_reason text, p_reason_details text, p_is_automatic boolean'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rpc_suspend_actor(uuid, text, text, text, boolean) FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rpc_suspend_actor(uuid, text, text, text, boolean) FROM authenticated';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rpc_suspend_actor(uuid, text, text, text, boolean) FROM PUBLIC';
  END IF;
END $$;
