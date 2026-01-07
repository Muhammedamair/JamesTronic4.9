-- ============================================================================
-- C22 Fraud Detection AI: Foundation Migration
-- JamesTronic Platform
-- ============================================================================
-- Purpose: AI-powered fraud detection across technicians, transporters,
-- dealers, and customers with risk scoring and automated alerts.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.actor_type AS ENUM (
    'technician',
    'transporter',
    'dealer',
    'customer',
    'staff',
    'system'
);

CREATE TYPE public.fraud_alert_severity AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);

CREATE TYPE public.fraud_alert_type AS ENUM (
    'behavioral_anomaly',
    'financial_irregularity',
    'parts_authenticity',
    'time_manipulation',
    'gps_manipulation',
    'quality_concern',
    'comeback_rate',
    'suspicious_pattern',
    'identity_fraud',
    'collusion_suspected'
);

CREATE TYPE public.investigation_status AS ENUM (
    'pending',
    'in_progress',
    'evidence_gathered',
    'awaiting_review',
    'resolved_fraud_confirmed',
    'resolved_false_positive',
    'escalated',
    'closed'
);

CREATE TYPE public.suspension_reason AS ENUM (
    'fraud_investigation',
    'quality_issues',
    'compliance_violation',
    'customer_complaints',
    'performance_concerns',
    'manual_review',
    'other'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Fraud Alerts: Automated detection alerts
CREATE TABLE IF NOT EXISTS public.fraud_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Actor Information
    actor_id uuid NOT NULL,
    actor_type public.actor_type NOT NULL,
    actor_name text,
    
    -- Alert Details
    alert_type public.fraud_alert_type NOT NULL,
    severity public.fraud_alert_severity NOT NULL DEFAULT 'medium',
    
    -- Context
    title text NOT NULL,
    description text,
    evidence jsonb DEFAULT '{}', -- Structured evidence data
    related_ticket_id uuid REFERENCES public.tickets(id),
    related_entities jsonb DEFAULT '[]', -- Other related IDs
    
    -- Risk Assessment
    risk_score integer DEFAULT 50 CHECK (risk_score BETWEEN 0 AND 100),
    confidence_score integer DEFAULT 70 CHECK (confidence_score BETWEEN 0 AND 100),
    
    -- Status
    is_acknowledged boolean DEFAULT false,
    acknowledged_by uuid REFERENCES public.profiles(user_id),
    acknowledged_at timestamptz,
    
    is_resolved boolean DEFAULT false,
    resolution_notes text,
    resolved_by uuid REFERENCES public.profiles(user_id),
    resolved_at timestamptz,
    
    -- Metadata
    detected_at timestamptz DEFAULT now() NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Actor Risk Scores: Composite risk for all actors
CREATE TABLE IF NOT EXISTS public.actor_risk_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid NOT NULL,
    actor_type public.actor_type NOT NULL,
    actor_name text,
    
    -- Component Scores (0-100)
    behavioral_anomaly_score integer DEFAULT 20,
    pattern_inconsistency_score integer DEFAULT 20,
    historical_risk_score integer DEFAULT 20,
    network_anomaly_score integer DEFAULT 20,
    external_risk_score integer DEFAULT 20,
    
    -- Composite Risk Score (weighted average)
    composite_risk_score integer DEFAULT 20,
    risk_tier text DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
    
    -- Trend
    previous_score integer,
    score_change integer DEFAULT 0,
    trend text DEFAULT 'stable', -- 'improving', 'stable', 'deteriorating'
    
    -- Stats
    total_alerts integer DEFAULT 0,
    unresolved_alerts integer DEFAULT 0,
    fraud_confirmed_count integer DEFAULT 0,
    
    last_calculated_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    
    CONSTRAINT unique_actor_risk UNIQUE (actor_id, actor_type)
);

-- Investigation Cases: Fraud case management
CREATE TABLE IF NOT EXISTS public.investigation_cases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number text UNIQUE, -- CASE-2026-0001
    
    -- Subject
    actor_id uuid NOT NULL,
    actor_type public.actor_type NOT NULL,
    actor_name text,
    
    -- Case Details
    title text NOT NULL,
    description text,
    status public.investigation_status DEFAULT 'pending',
    priority public.fraud_alert_severity DEFAULT 'medium',
    
    -- Related Alerts
    related_alert_ids uuid[] DEFAULT '{}',
    
    -- Evidence
    evidence_summary text,
    evidence_documents jsonb DEFAULT '[]', -- File paths or URLs
    
    -- Investigation
    assigned_to uuid REFERENCES public.profiles(user_id),
    assigned_at timestamptz,
    
    -- Financial Impact
    estimated_loss numeric(12, 2) DEFAULT 0,
    recovered_amount numeric(12, 2) DEFAULT 0,
    
    -- Resolution
    resolution_type text, -- 'fraud_confirmed', 'false_positive', 'inconclusive'
    resolution_notes text,
    resolved_by uuid REFERENCES public.profiles(user_id),
    resolved_at timestamptz,
    
    -- Actions Taken
    actions_taken jsonb DEFAULT '[]',
    
    opened_at timestamptz DEFAULT now() NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Suspension Records: Actor suspensions
CREATE TABLE IF NOT EXISTS public.suspension_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Actor
    actor_id uuid NOT NULL,
    actor_type public.actor_type NOT NULL,
    actor_name text,
    
    -- Suspension Details
    reason public.suspension_reason NOT NULL,
    reason_details text,
    related_case_id uuid REFERENCES public.investigation_cases(id),
    
    -- Duration
    is_automatic boolean DEFAULT false,
    suspended_at timestamptz DEFAULT now() NOT NULL,
    suspended_until timestamptz, -- NULL = indefinite
    
    -- Reinstatement
    is_reinstated boolean DEFAULT false,
    reinstated_at timestamptz,
    reinstated_by uuid REFERENCES public.profiles(user_id),
    reinstatement_notes text,
    
    -- Approval
    approved_by uuid REFERENCES public.profiles(user_id),
    approved_at timestamptz,
    
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Parts Authenticity Logs: Track parts verification
CREATE TABLE IF NOT EXISTS public.parts_authenticity_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Part Details
    part_category text NOT NULL,
    brand text,
    serial_number text,
    dealer_id uuid,
    
    -- Verification
    is_authentic boolean,
    verification_method text, -- 'manual', 'ai', 'supplier_confirmed'
    verification_notes text,
    
    -- If marked as scrap
    is_scrap boolean DEFAULT false,
    scrap_reason text,
    should_be_scrap boolean, -- AI assessment
    scrap_discrepancy boolean DEFAULT false, -- Mismatch between is_scrap and should_be_scrap
    
    -- Related
    ticket_id uuid REFERENCES public.tickets(id),
    technician_id uuid,
    
    -- Financial
    claimed_value numeric(10, 2),
    actual_value numeric(10, 2),
    
    verified_by uuid REFERENCES public.profiles(user_id),
    verified_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_fraud_alerts_actor ON public.fraud_alerts(actor_id, actor_type);
CREATE INDEX idx_fraud_alerts_severity ON public.fraud_alerts(severity);
CREATE INDEX idx_fraud_alerts_unresolved ON public.fraud_alerts(is_resolved) WHERE is_resolved = false;
CREATE INDEX idx_fraud_alerts_type ON public.fraud_alerts(alert_type);
CREATE INDEX idx_risk_scores_actor ON public.actor_risk_scores(actor_id, actor_type);
CREATE INDEX idx_risk_scores_tier ON public.actor_risk_scores(risk_tier);
CREATE INDEX idx_investigation_status ON public.investigation_cases(status);
CREATE INDEX idx_investigation_assigned ON public.investigation_cases(assigned_to);
CREATE INDEX idx_suspension_actor ON public.suspension_records(actor_id, actor_type);
CREATE INDEX idx_suspension_active ON public.suspension_records(is_reinstated) WHERE is_reinstated = false;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER set_risk_scores_updated_at
BEFORE UPDATE ON public.actor_risk_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER set_investigation_updated_at
BEFORE UPDATE ON public.investigation_cases
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actor_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suspension_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts_authenticity_logs ENABLE ROW LEVEL SECURITY;

-- Only Admin/Security can manage fraud data
CREATE POLICY "Admin can manage fraud_alerts"
ON public.fraud_alerts FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

CREATE POLICY "Admin can manage risk_scores"
ON public.actor_risk_scores FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

CREATE POLICY "Admin can manage investigations"
ON public.investigation_cases FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

CREATE POLICY "Admin can manage suspensions"
ON public.suspension_records FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

CREATE POLICY "Admin can manage authenticity_logs"
ON public.parts_authenticity_logs FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

-- ============================================================================
-- FUNCTIONS / RPCs
-- ============================================================================

-- RPC: Calculate Actor Risk Score
CREATE OR REPLACE FUNCTION public.rpc_calculate_actor_risk(
    p_actor_id uuid,
    p_actor_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_behavioral integer := 20;
    v_pattern integer := 20;
    v_historical integer := 20;
    v_network integer := 20;
    v_external integer := 20;
    v_composite integer;
    v_tier text;
    v_alert_count integer;
    v_result jsonb;
BEGIN
    -- Count unresolved alerts
    SELECT COUNT(*) INTO v_alert_count
    FROM public.fraud_alerts
    WHERE actor_id = p_actor_id
      AND actor_type = p_actor_type::public.actor_type
      AND is_resolved = false;
    
    -- Behavioral score based on alerts
    v_behavioral := LEAST(100, 20 + (v_alert_count * 15));
    
    -- Historical score based on confirmed fraud
    SELECT LEAST(100, 20 + (COUNT(*) * 25)) INTO v_historical
    FROM public.investigation_cases
    WHERE actor_id = p_actor_id
      AND actor_type = p_actor_type::public.actor_type
      AND resolution_type = 'fraud_confirmed';
    
    -- Calculate composite (weighted)
    v_composite := (v_behavioral * 30 + v_pattern * 25 + v_historical * 20 + v_network * 15 + v_external * 10) / 100;
    
    -- Determine tier
    v_tier := CASE
        WHEN v_composite >= 75 THEN 'critical'
        WHEN v_composite >= 50 THEN 'high'
        WHEN v_composite >= 30 THEN 'medium'
        ELSE 'low'
    END;
    
    -- Upsert risk score
    INSERT INTO public.actor_risk_scores (
        actor_id, actor_type,
        behavioral_anomaly_score, pattern_inconsistency_score,
        historical_risk_score, network_anomaly_score, external_risk_score,
        composite_risk_score, risk_tier, total_alerts, unresolved_alerts,
        last_calculated_at
    )
    VALUES (
        p_actor_id, p_actor_type::public.actor_type,
        v_behavioral, v_pattern, v_historical, v_network, v_external,
        v_composite, v_tier, v_alert_count, v_alert_count,
        now()
    )
    ON CONFLICT (actor_id, actor_type)
    DO UPDATE SET
        behavioral_anomaly_score = EXCLUDED.behavioral_anomaly_score,
        pattern_inconsistency_score = EXCLUDED.pattern_inconsistency_score,
        historical_risk_score = EXCLUDED.historical_risk_score,
        composite_risk_score = EXCLUDED.composite_risk_score,
        risk_tier = EXCLUDED.risk_tier,
        total_alerts = EXCLUDED.total_alerts,
        unresolved_alerts = EXCLUDED.unresolved_alerts,
        previous_score = actor_risk_scores.composite_risk_score,
        score_change = EXCLUDED.composite_risk_score - actor_risk_scores.composite_risk_score,
        last_calculated_at = now(),
        updated_at = now();
    
    v_result := jsonb_build_object(
        'actor_id', p_actor_id,
        'actor_type', p_actor_type,
        'behavioral_score', v_behavioral,
        'historical_score', v_historical,
        'composite_score', v_composite,
        'risk_tier', v_tier,
        'unresolved_alerts', v_alert_count
    );
    
    RETURN v_result;
END;
$$;

-- RPC: Create Fraud Alert
CREATE OR REPLACE FUNCTION public.rpc_create_fraud_alert(
    p_actor_id uuid,
    p_actor_type text,
    p_alert_type text,
    p_severity text,
    p_title text,
    p_description text DEFAULT NULL,
    p_evidence jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_alert_id uuid;
    v_risk_score integer := 50;
BEGIN
    -- Calculate initial risk score based on severity
    v_risk_score := CASE p_severity
        WHEN 'critical' THEN 90
        WHEN 'high' THEN 70
        WHEN 'medium' THEN 50
        ELSE 30
    END;
    
    INSERT INTO public.fraud_alerts (
        actor_id, actor_type, alert_type, severity,
        title, description, evidence, risk_score
    )
    VALUES (
        p_actor_id,
        p_actor_type::public.actor_type,
        p_alert_type::public.fraud_alert_type,
        p_severity::public.fraud_alert_severity,
        p_title, p_description, p_evidence, v_risk_score
    )
    RETURNING id INTO v_alert_id;
    
    -- Recalculate actor risk
    PERFORM public.rpc_calculate_actor_risk(p_actor_id, p_actor_type);
    
    RETURN v_alert_id;
END;
$$;

-- RPC: Suspend Actor
CREATE OR REPLACE FUNCTION public.rpc_suspend_actor(
    p_actor_id uuid,
    p_actor_type text,
    p_reason text,
    p_reason_details text DEFAULT NULL,
    p_is_automatic boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_suspension_id uuid;
BEGIN
    INSERT INTO public.suspension_records (
        actor_id, actor_type, reason, reason_details, is_automatic
    )
    VALUES (
        p_actor_id,
        p_actor_type::public.actor_type,
        p_reason::public.suspension_reason,
        p_reason_details,
        p_is_automatic
    )
    RETURNING id INTO v_suspension_id;
    
    RETURN v_suspension_id;
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fraud_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.actor_risk_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investigation_cases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suspension_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parts_authenticity_logs TO authenticated;

GRANT ALL ON public.fraud_alerts TO service_role;
GRANT ALL ON public.actor_risk_scores TO service_role;
GRANT ALL ON public.investigation_cases TO service_role;
GRANT ALL ON public.suspension_records TO service_role;
GRANT ALL ON public.parts_authenticity_logs TO service_role;

GRANT EXECUTE ON FUNCTION public.rpc_calculate_actor_risk TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_create_fraud_alert TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_suspend_actor TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_calculate_actor_risk TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_create_fraud_alert TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_suspend_actor TO service_role;
