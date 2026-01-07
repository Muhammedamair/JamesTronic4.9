-- ============================================================================
-- C27 AI Repair Outcome Predictor: Foundation Migration
-- JamesTronic Platform
-- ============================================================================
-- Purpose: Predict repair success, warranty risk, and comeback probability
-- to enable proactive interventions.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.prediction_type AS ENUM (
    'success_probability',
    'comeback_risk',
    'warranty_claim_risk',
    'repair_complexity'
);

CREATE TYPE public.risk_level AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);

CREATE TYPE public.prediction_status AS ENUM (
    'pending',
    'calculated',
    'validated', -- Outcome matched prediction
    'incorrect'  -- Outcome differed
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Prediction Models: Registry of active AI models
CREATE TABLE IF NOT EXISTS public.prediction_models (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name text NOT NULL, -- e.g. "v1.0-logreg-success"
    model_type public.prediction_type NOT NULL,
    version text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Repair Outcome Features: Feature store for tickets
CREATE TABLE IF NOT EXISTS public.repair_outcome_features (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES public.tickets(id),
    
    -- Features
    device_age_years numeric(4, 1),
    brand_reputation_score integer, -- 0-100
    symptom_complexity_score integer, -- 0-100
    technician_skill_match_score integer, -- 0-100 (from C23)
    part_availability_status text, -- 'available', 'backorder', 'obsolete'
    
    extracted_at timestamptz DEFAULT now() NOT NULL
);

-- Repair Prediction Logs: The actual predictions
CREATE TABLE IF NOT EXISTS public.repair_prediction_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES public.tickets(id),
    model_id uuid REFERENCES public.prediction_models(id),
    
    -- Output
    prediction_type public.prediction_type NOT NULL,
    predicted_value numeric(5, 2), -- Probability 0-1.0 or Score
    risk_level public.risk_level DEFAULT 'low',
    
    confidence_score numeric(3, 2), -- 0.0-1.0
    explanation_text text, -- AI explanation
    
    -- Validation
    actual_outcome_value numeric(5, 2),
    status public.prediction_status DEFAULT 'calculated',
    
    created_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_features_ticket ON public.repair_outcome_features(ticket_id);
CREATE INDEX idx_predictions_ticket ON public.repair_prediction_logs(ticket_id);
CREATE INDEX idx_predictions_type ON public.repair_prediction_logs(prediction_type);
CREATE INDEX idx_predictions_risk ON public.repair_prediction_logs(risk_level);

-- ============================================================================
-- SEED DATA (Models)
-- ============================================================================

INSERT INTO public.prediction_models (model_name, model_type, version)
VALUES 
    ('v1.0-basic-success', 'success_probability', '1.0.0'),
    ('v1.0-comeback-risk', 'comeback_risk', '1.0.0')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.prediction_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_outcome_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_prediction_logs ENABLE ROW LEVEL SECURITY;

-- Admins manage all
CREATE POLICY "Admin view all models"
ON public.prediction_models FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner', 'staff'));

CREATE POLICY "Admin view all features"
ON public.repair_outcome_features FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner', 'staff'));

CREATE POLICY "Admin view all predictions"
ON public.repair_prediction_logs FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner', 'staff'));

-- ============================================================================
-- FUNCTIONS / RPCs
-- ============================================================================

-- RPC: Predict Repair Outcome (Simulation Logic)
CREATE OR REPLACE FUNCTION public.rpc_predict_repair_outcome(
    p_ticket_id uuid,
    p_device_age numeric DEFAULT NULL,
    p_brand text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_success_prob numeric;
    v_risk_level public.risk_level;
    v_explanation text;
    v_comeback_prob numeric;
    v_result jsonb;
BEGIN
    -- Simulation Logic based on inputs (or dummy logic if inputs null)
    -- In real system, this would query features or call external ML service
    
    -- Default values
    v_success_prob := 0.85;
    v_comeback_prob := 0.05;
    
    -- Adjust based on age (Risk increases with age)
    IF p_device_age IS NOT NULL THEN
        IF p_device_age > 10 THEN
            v_success_prob := v_success_prob - 0.20;
            v_comeback_prob := v_comeback_prob + 0.15;
            v_explanation := 'High risk due to device age (>10 years). Parts may be scarce.';
        ELSIF p_device_age > 5 THEN
            v_success_prob := v_success_prob - 0.10;
            v_comeback_prob := v_comeback_prob + 0.05;
            v_explanation := 'Moderate risk due to device age (5-10 years).';
        ELSE
            v_explanation := 'Low risk. Device is relatively new.';
        END IF;
    END IF;

    -- Determine Risk Level
    IF v_success_prob < 0.6 THEN
        v_risk_level := 'high';
    ELSIF v_success_prob < 0.8 THEN
        v_risk_level := 'medium';
    ELSE
        v_risk_level := 'low';
    END IF;

    -- Store Feature Snapshot
    INSERT INTO public.repair_outcome_features (ticket_id, device_age_years)
    VALUES (p_ticket_id, p_device_age);

    -- Log Prediction (Success Prob)
    INSERT INTO public.repair_prediction_logs (
        ticket_id, prediction_type, predicted_value, risk_level, explanation_text, confidence_score
    )
    VALUES (
        p_ticket_id, 'success_probability', v_success_prob, v_risk_level, v_explanation, 0.90
    );

    v_result := jsonb_build_object(
        'success_probability', v_success_prob,
        'risk_level', v_risk_level,
        'explanation', v_explanation,
        'comeback_probability', v_comeback_prob
    );
    
    RETURN v_result;
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prediction_models TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repair_outcome_features TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repair_prediction_logs TO authenticated;

GRANT ALL ON public.prediction_models TO service_role;
GRANT ALL ON public.repair_outcome_features TO service_role;
GRANT ALL ON public.repair_prediction_logs TO service_role;

GRANT EXECUTE ON FUNCTION public.rpc_predict_repair_outcome TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_predict_repair_outcome TO service_role;
