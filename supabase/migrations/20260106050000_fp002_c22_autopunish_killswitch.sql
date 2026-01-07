-- FP-002: C22 Auto-Punish Kill Switch + Audit Trail
-- Governance: "Flag, rank, explain — never auto-punish." :contentReference[oaicite:6]{index=6}
-- Governance: "Never penalize without human review." :contentReference[oaicite:7]{index=7}

-- 1) Audit log for suspension attempts (ALLOWED + BLOCKED)
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

-- 2) Policies (idempotent creation using pg_policies check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='suspension_audit_log'
      AND policyname='C22: Admin/Security/HR can read suspension_audit_log'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "C22: Admin/Security/HR can read suspension_audit_log"
      ON public.suspension_audit_log
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin','security','hr')
        )
      )
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='suspension_audit_log'
      AND policyname='C22: Admin/Security can write suspension_audit_log'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "C22: Admin/Security can write suspension_audit_log"
      ON public.suspension_audit_log
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin','security')
        )
      )
    $pol$;
  END IF;
END $$;

-- 3) Strict suspension gate (new function; do NOT assume old function signature)
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
AS $$
DECLARE
  caller_role text;
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
      actor_type, actor_id, caller_id, caller_role,
      is_automatic, NULL, NULL,
      investigation_case_id, reason, 'BLOCKED', decision_reason
    );
    RETURN json_build_object('ok', false, 'error', decision_reason);
  END IF;

  -- HARD RULE: automatic suspension blocked unless admin/security + explicit approval + case_id
  IF is_automatic = true THEN
    IF caller_role IN ('admin','security')
       AND approved_by_admin = true
       AND investigation_case_id IS NOT NULL THEN
      allowed := true;
    ELSE
      allowed := false;
      decision_reason := 'BLOCKED: auto-suspend requires admin/security + approved_by_admin + investigation_case_id';
    END IF;
  ELSE
    -- Manual suspend allowed only for admin/security and must have case_id + reason
    IF caller_role IN ('admin','security')
       AND investigation_case_id IS NOT NULL
       AND reason IS NOT NULL
       AND length(trim(reason)) > 5 THEN
      allowed := true;
    ELSE
      allowed := false;
      decision_reason := 'BLOCKED: manual suspend requires admin/security + investigation_case_id + reason';
    END IF;
  END IF;

  -- Always audit
  INSERT INTO public.suspension_audit_log(
    actor_type, actor_id, requested_by, requested_by_role,
    is_automatic, approved_by, approved_by_role,
    investigation_case_id, reason, decision, decision_reason
  ) VALUES (
    actor_type, actor_id, caller_id, caller_role,
    is_automatic,
    CASE WHEN approved_by_admin THEN caller_id ELSE NULL END,
    CASE WHEN approved_by_admin THEN caller_role ELSE NULL END,
    investigation_case_id, reason,
    CASE WHEN allowed THEN 'ALLOWED' ELSE 'BLOCKED' END,
    CASE WHEN allowed THEN 'OK' ELSE decision_reason END
  );

  IF allowed = false THEN
    RETURN json_build_object('ok', false, 'error', decision_reason);
  END IF;

  -- IMPORTANT: do not mutate any actor status here until you wire it to your real suspension mechanism.
  -- This function is the GOVERNANCE GATE + AUDIT TRAIL. Next step will connect it safely.

  RETURN json_build_object('ok', true, 'message', 'Suspension approved by governance gate');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_suspend_actor_strict(text, uuid, uuid, text, boolean, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_suspend_actor_strict(text, uuid, uuid, text, boolean, boolean) TO authenticated;
