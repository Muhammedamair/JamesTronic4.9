-- ============================================================================
-- C40 AI Governance & Compliance Engine: Database Infrastructure
-- JamesTronic Platform
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.compliance_severity AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);

CREATE TYPE public.violation_status AS ENUM (
    'open',
    'investigating',
    'resolved',
    'dismissed'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. Compliance Policies: Active Governance Rules
CREATE TABLE IF NOT EXISTS public.compliance_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    description text,
    category text NOT NULL, -- e.g., 'Finance', 'HR', 'Logistics', 'AI Ethics'
    severity public.compliance_severity DEFAULT 'medium',
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- 2. Compliance Violations: Detected Anomalies
CREATE TABLE IF NOT EXISTS public.compliance_violations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id uuid REFERENCES public.compliance_policies(id),
    detected_at timestamptz DEFAULT now(),
    severity public.compliance_severity NOT NULL,
    status public.violation_status DEFAULT 'open',
    
    description text NOT NULL,
    reference_id text, -- ID of the related ticket, transaction, or user
    evidence_meta jsonb DEFAULT '{}',
    
    resolved_at timestamptz,
    resolved_by uuid REFERENCES auth.users(id),
    resolution_notes text,
    
    created_at timestamptz DEFAULT now()
);

-- 3. AI Audit Logs: Decision Transparency Layer
CREATE TABLE IF NOT EXISTS public.ai_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_module text NOT NULL, -- e.g., 'Fraud Detector', 'Scheduling', 'Repair Predictor'
    action_taken text NOT NULL,
    data_points jsonb DEFAULT '{}', -- The inputs used for decision
    result_meta jsonb DEFAULT '{}', -- The output and reasoning
    
    confidence_score numeric(4, 3), -- 0.000 to 1.000
    ethical_check_passed boolean DEFAULT true,
    fairness_score numeric(4, 3),
    
    user_id uuid REFERENCES auth.users(id), -- If decision for specific user
    created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- RPCs
-- ============================================================================

-- RPC: Get Compliance Overview
CREATE OR REPLACE FUNCTION public.rpc_get_compliance_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_open_critical integer;
    v_total_violations integer;
    v_policy_health numeric;
    v_result jsonb;
BEGIN
    SELECT COUNT(*) INTO v_open_critical 
    FROM public.compliance_violations 
    WHERE severity = 'critical' AND status IN ('open', 'investigating');

    SELECT COUNT(*) INTO v_total_violations 
    FROM public.compliance_violations 
    WHERE status IN ('open', 'investigating');

    SELECT (COUNT(CASE WHEN is_active THEN 1 END)::numeric / COUNT(*)::numeric) * 100 INTO v_policy_health
    FROM public.compliance_policies;

    v_result := jsonb_build_object(
        'critical_violations', v_open_critical,
        'active_violations', v_total_violations,
        'policy_adherence_rate', COALESCE(v_policy_health, 100.0),
        'last_audit_date', now()
    );

    RETURN v_result;
END;
$$;

-- RPC: Trigger Auto Audit (Simulated)
CREATE OR REPLACE FUNCTION public.rpc_trigger_auto_audit()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Simulate finding an anomaly if none exist today
    IF NOT EXISTS (SELECT 1 FROM public.compliance_violations WHERE detected_at::date = now()::date) THEN
        INSERT INTO public.compliance_violations (policy_id, severity, description, reference_id)
        SELECT id, severity, 'Automated audit detected irregular frequency in warehouse dispatches.', 'WH-909'
        FROM public.compliance_policies
        WHERE name = 'Logistics Efficiency Threshold'
        LIMIT 1;
    END IF;
END;
$$;

-- ============================================================================
-- SEED DATA
-- ============================================================================

INSERT INTO public.compliance_policies (name, description, category, severity)
VALUES 
('GST Compliance Check', 'Verifies all invoices have valid tax records before payout.', 'Finance', 'high'),
('Workforce Punctuality Audit', 'Monitors repetitive late logins or missing check-ins.', 'HR', 'medium'),
('Logistics Efficiency Threshold', 'Detects unusual gaps in dispatch times.', 'Logistics', 'medium'),
('AI Fraud Neutrality', 'Ensures fraud detection isn''t biased against specific regions.', 'AI Ethics', 'high'),
('SLA Penalty Verification', 'Confirms SLA penalties are correctly applied to transporters.', 'Logistics', 'medium'),
('Data Privacy Guard', 'Monitors for unauthorized sensitive data access.', 'Security', 'critical');

-- Seed sample violations
INSERT INTO public.compliance_violations (policy_id, severity, description, status)
SELECT id, severity, 'Invoice missing valid GSTIN for vendor V-202.', 'investigating'
FROM public.compliance_policies WHERE name = 'GST Compliance Check'
LIMIT 1;

INSERT INTO public.compliance_violations (policy_id, severity, description, status)
SELECT id, severity, 'Suspicious login pattern detected outside operating hours.', 'open'
FROM public.compliance_policies WHERE name = 'Data Privacy Guard'
LIMIT 1;

-- Seed Sample AI Logs
INSERT INTO public.ai_audit_logs (ai_module, action_taken, confidence_score, ethical_check_passed, fairness_score)
VALUES 
('Fraud Detector', 'Flagged Transaction TX-450: High probability of duplicate claim.', 0.945, true, 0.980),
('Scheduling Engine', 'Assigned Ticket T-101 to Tech B based on efficiency score.', 0.880, true, 0.950),
('Outcome Predictor', 'Predicted Display Failure for Batch B-12.', 0.760, true, 0.920);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.compliance_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.compliance_violations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ai_audit_logs TO authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_get_compliance_overview TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_trigger_auto_audit TO authenticated;
