-- ============================================================
-- C23 Phase 3: Security Hardening + Review/Coaching Workflows
-- GOVERNANCE: Close Phase 2 security loop. Add review RPCs.
--             Add audit log. Feature flags default OFF.
-- ============================================================

-- ===================== SECURITY REVOCATION ==================
-- Hard-lock: c23_generate_packets() NOT callable by clients.
-- Only pg_cron / service_role can invoke.
REVOKE EXECUTE ON FUNCTION public.c23_generate_packets(TIMESTAMPTZ) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.c23_generate_packets(TIMESTAMPTZ) FROM anon;
REVOKE EXECUTE ON FUNCTION public.c23_generate_packets(TIMESTAMPTZ) FROM authenticated;

-- ===================== ADDITIONAL REVIEW FIELDS =============
-- Add review metadata columns to packets table
DO $$ BEGIN
  ALTER TABLE public.c23_technician_performance_packets
    ADD COLUMN review_reason TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.c23_technician_performance_packets
    ADD COLUMN review_evidence_refs UUID[] DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- HR review columns
DO $$ BEGIN
  CREATE TYPE public.c23_hr_review_state AS ENUM (
    'NOT_REQUIRED',
    'PENDING',
    'ACKNOWLEDGED',
    'ACTION_REQUESTED',
    'CLOSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.c23_technician_performance_packets
    ADD COLUMN hr_review_state public.c23_hr_review_state DEFAULT 'NOT_REQUIRED';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.c23_technician_performance_packets
    ADD COLUMN hr_reviewed_by UUID;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.c23_technician_performance_packets
    ADD COLUMN hr_reviewed_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.c23_technician_performance_packets
    ADD COLUMN hr_reason TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ===================== AUDIT LOG TABLE ======================
CREATE TABLE IF NOT EXISTS public.c23_review_audit_log (
  log_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id       UUID NOT NULL,
  actor_id        UUID NOT NULL,       -- auth.uid() of reviewer
  actor_role      TEXT NOT NULL,        -- 'manager' | 'admin' | 'hr'
  action          TEXT NOT NULL,        -- 'APPROVE' | 'FLAG_HR' | 'NEEDS_MORE_DATA' | 'ACKNOWLEDGE' etc.
  reason          TEXT,
  evidence_refs   UUID[] DEFAULT '{}',
  previous_state  TEXT,                 -- state before transition
  new_state       TEXT,                 -- state after transition
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.c23_review_audit_log IS 'C23: Immutable audit trail of all review state transitions. Every action logged with actor, reason, and evidence.';

CREATE INDEX IF NOT EXISTS idx_c23_audit_packet_id ON public.c23_review_audit_log(packet_id);
CREATE INDEX IF NOT EXISTS idx_c23_audit_actor_id ON public.c23_review_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_c23_audit_created ON public.c23_review_audit_log(created_at);

-- RLS on audit log
ALTER TABLE public.c23_review_audit_log ENABLE ROW LEVEL SECURITY;

-- Only manager/admin/hr can read audit logs
CREATE POLICY c23_audit_select_manager
  ON public.c23_review_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager', 'hr')
    )
  );

-- No tech access to audit log
-- No INSERT by client (written by RPCs via SECURITY DEFINER)

-- ===================== FEATURE FLAGS ========================
CREATE TABLE IF NOT EXISTS public.c23_feature_flags (
  flag_key     TEXT PRIMARY KEY,
  enabled      BOOLEAN NOT NULL DEFAULT false,
  description  TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   TEXT NOT NULL DEFAULT 'system'
);

COMMENT ON TABLE public.c23_feature_flags IS 'C23: Feature flags for phased rollout. Default OFF in production.';

ALTER TABLE public.c23_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY c23_flags_read_all
  ON public.c23_feature_flags
  FOR SELECT
  USING (true);  -- readable by all (needed for UI gating)

CREATE POLICY c23_flags_write_admin
  ON public.c23_feature_flags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Seed flags (default OFF)
INSERT INTO public.c23_feature_flags (flag_key, enabled, description)
VALUES
  ('c23_manager_dashboard_enabled', false, 'Enable C23 Manager Performance Dashboard'),
  ('c23_hr_dashboard_enabled', false, 'Enable C23 HR Performance Dashboard'),
  ('c23_coaching_enabled', false, 'Enable C23 Coaching Task Workflows')
ON CONFLICT (flag_key) DO NOTHING;

-- ===================== REVIEW RPCs ==========================

-- Manager Review Packet
CREATE OR REPLACE FUNCTION public.c23_manager_review_packet(
  p_packet_id     UUID,
  p_action        TEXT,         -- 'APPROVE' | 'FLAG_HR' | 'NEEDS_MORE_DATA'
  p_reason        TEXT,
  p_evidence_refs UUID[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   TEXT;
  v_caller_branch UUID;
  v_packet        RECORD;
  v_prev_state    TEXT;
  v_new_state     public.c23_review_state;
BEGIN
  -- Validate caller role
  SELECT role, branch_id INTO v_caller_role, v_caller_branch
  FROM public.profiles WHERE id = auth.uid();

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'manager') THEN
    RETURN jsonb_build_object('status', 'denied', 'message', 'Only Manager/Admin can review packets');
  END IF;

  -- Validate action
  IF p_action NOT IN ('APPROVE', 'FLAG_HR', 'NEEDS_MORE_DATA') THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Invalid action: ' || p_action);
  END IF;

  -- Validate reason required
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Reason is required for all review actions');
  END IF;

  -- Get packet (branch-scoped for managers)
  SELECT * INTO v_packet
  FROM public.c23_technician_performance_packets
  WHERE packet_id = p_packet_id
  AND (v_caller_role = 'admin' OR branch_id = v_caller_branch);

  IF v_packet IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found', 'message', 'Packet not found or out of scope');
  END IF;

  v_prev_state := v_packet.review_state::TEXT;

  -- Determine new state
  CASE p_action
    WHEN 'APPROVE' THEN v_new_state := 'APPROVED';
    WHEN 'FLAG_HR' THEN v_new_state := 'FLAGGED';
    WHEN 'NEEDS_MORE_DATA' THEN v_new_state := 'PENDING';
  END CASE;

  -- Update packet
  UPDATE public.c23_technician_performance_packets SET
    review_state = v_new_state,
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    review_reason = p_reason,
    review_evidence_refs = p_evidence_refs,
    -- If flagged for HR, set HR review pending
    hr_review_state = CASE
      WHEN p_action = 'FLAG_HR' THEN 'PENDING'::public.c23_hr_review_state
      ELSE hr_review_state
    END
  WHERE packet_id = p_packet_id;

  -- Audit log
  INSERT INTO public.c23_review_audit_log
    (packet_id, actor_id, actor_role, action, reason, evidence_refs, previous_state, new_state)
  VALUES
    (p_packet_id, auth.uid(), v_caller_role, p_action, p_reason, p_evidence_refs, v_prev_state, v_new_state::TEXT);

  RETURN jsonb_build_object(
    'status', 'ok',
    'packet_id', p_packet_id,
    'action', p_action,
    'new_state', v_new_state::TEXT
  );
END;
$$;

COMMENT ON FUNCTION public.c23_manager_review_packet IS 'C23: Manager reviews a packet. Requires reason. Logs to audit trail.';

-- HR Review Packet
CREATE OR REPLACE FUNCTION public.c23_hr_review_packet(
  p_packet_id UUID,
  p_action    TEXT,     -- 'ACKNOWLEDGE' | 'REQUEST_MANAGER_ACTION' | 'CLOSE'
  p_reason    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_packet      RECORD;
  v_prev_state  TEXT;
  v_new_state   public.c23_hr_review_state;
BEGIN
  SELECT role INTO v_caller_role
  FROM public.profiles WHERE id = auth.uid();

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'hr') THEN
    RETURN jsonb_build_object('status', 'denied', 'message', 'Only Admin/HR can perform HR review');
  END IF;

  IF p_action NOT IN ('ACKNOWLEDGE', 'REQUEST_MANAGER_ACTION', 'CLOSE') THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Invalid HR action: ' || p_action);
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Reason is required');
  END IF;

  SELECT * INTO v_packet
  FROM public.c23_technician_performance_packets
  WHERE packet_id = p_packet_id;

  IF v_packet IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  v_prev_state := COALESCE(v_packet.hr_review_state::TEXT, 'NOT_REQUIRED');

  CASE p_action
    WHEN 'ACKNOWLEDGE' THEN v_new_state := 'ACKNOWLEDGED';
    WHEN 'REQUEST_MANAGER_ACTION' THEN v_new_state := 'ACTION_REQUESTED';
    WHEN 'CLOSE' THEN v_new_state := 'CLOSED';
  END CASE;

  UPDATE public.c23_technician_performance_packets SET
    hr_review_state = v_new_state,
    hr_reviewed_by = auth.uid(),
    hr_reviewed_at = NOW(),
    hr_reason = p_reason
  WHERE packet_id = p_packet_id;

  INSERT INTO public.c23_review_audit_log
    (packet_id, actor_id, actor_role, action, reason, previous_state, new_state)
  VALUES
    (p_packet_id, auth.uid(), v_caller_role, 'HR_' || p_action, p_reason, v_prev_state, v_new_state::TEXT);

  RETURN jsonb_build_object(
    'status', 'ok',
    'packet_id', p_packet_id,
    'hr_action', p_action,
    'new_state', v_new_state::TEXT
  );
END;
$$;

COMMENT ON FUNCTION public.c23_hr_review_packet IS 'C23: HR reviews a flagged packet. Requires reason. Logs to audit trail.';

-- ===================== COACHING RPCs ========================

-- Create coaching task (Manager only)
CREATE OR REPLACE FUNCTION public.c23_create_coaching_task(
  p_tech_id         UUID,
  p_packet_id       UUID DEFAULT NULL,
  p_task_text       TEXT DEFAULT '',
  p_due_date        DATE DEFAULT NULL,
  p_evidence_refs   UUID[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   TEXT;
  v_caller_branch UUID;
  v_tech_branch   UUID;
  v_task_id       UUID;
BEGIN
  SELECT role, branch_id INTO v_caller_role, v_caller_branch
  FROM public.profiles WHERE id = auth.uid();

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'manager') THEN
    RETURN jsonb_build_object('status', 'denied', 'message', 'Only Manager/Admin can create coaching tasks');
  END IF;

  IF p_task_text IS NULL OR trim(p_task_text) = '' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Task text is required');
  END IF;

  -- Verify tech is in caller's branch (managers) or any branch (admin)
  SELECT branch_id INTO v_tech_branch
  FROM public.profiles WHERE id = p_tech_id;

  IF v_tech_branch IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Technician not found');
  END IF;

  IF v_caller_role = 'manager' AND v_tech_branch != v_caller_branch THEN
    RETURN jsonb_build_object('status', 'denied', 'message', 'Cannot create tasks for techs outside your branch');
  END IF;

  INSERT INTO public.c23_coaching_tasks (
    tech_id, created_by_manager_id, branch_id,
    packet_id, ticket_evidence_id,
    task_text, due_date
  ) VALUES (
    p_tech_id, auth.uid(), v_tech_branch,
    p_packet_id,
    CASE WHEN array_length(p_evidence_refs, 1) > 0 THEN p_evidence_refs[1] ELSE NULL END,
    p_task_text, p_due_date
  ) RETURNING task_id INTO v_task_id;

  -- Audit log (if linked to packet)
  IF p_packet_id IS NOT NULL THEN
    INSERT INTO public.c23_review_audit_log
      (packet_id, actor_id, actor_role, action, reason, evidence_refs)
    VALUES
      (p_packet_id, auth.uid(), v_caller_role, 'CREATE_COACHING_TASK', p_task_text, p_evidence_refs);
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'task_id', v_task_id,
    'tech_id', p_tech_id
  );
END;
$$;

COMMENT ON FUNCTION public.c23_create_coaching_task IS 'C23: Manager creates a coaching task linked to packet/evidence. Branch-scoped.';

-- Complete coaching task (Tech completes own)
CREATE OR REPLACE FUNCTION public.c23_complete_coaching_task(
  p_task_id        UUID,
  p_completion_note TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
BEGIN
  SELECT * INTO v_task
  FROM public.c23_coaching_tasks
  WHERE task_id = p_task_id AND tech_id = auth.uid();

  IF v_task IS NULL THEN
    RETURN jsonb_build_object('status', 'denied', 'message', 'Task not found or not assigned to you');
  END IF;

  IF v_task.status IN ('COMPLETED', 'CANCELLED') THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Task already ' || v_task.status::TEXT);
  END IF;

  UPDATE public.c23_coaching_tasks SET
    status = 'COMPLETED',
    completed_at = NOW(),
    updated_at = NOW()
  WHERE task_id = p_task_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'task_id', p_task_id,
    'completed_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION public.c23_complete_coaching_task IS 'C23: Technician completes their own coaching task. RPC-validated ownership.';
