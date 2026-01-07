-- ============================================================================
-- C18 Dealer Analytics: Reliability Score Engine
-- JamesTronic Platform
-- ============================================================================
-- Purpose: Implements the dealer scoring system to track reliability,
-- availability, quality, and pricing compliance.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.dealer_alert_type AS ENUM (
    'quality_issue',
    'delayed_delivery',
    'pricing_variance',
    'fraud_suspected',
    'low_score',
    'warranty_claim',
    'compliance_issue'
);

CREATE TYPE public.alert_severity AS ENUM (
    'info',
    'warning',
    'critical'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Dealer Reliability Scores: Daily snapshots
CREATE TABLE IF NOT EXISTS public.dealer_reliability_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
    score_date date NOT NULL DEFAULT CURRENT_DATE,
    
    -- Component Scores (0-100)
    availability_score integer DEFAULT 70 CHECK (availability_score BETWEEN 0 AND 100),
    delivery_speed_score integer DEFAULT 70 CHECK (delivery_speed_score BETWEEN 0 AND 100),
    quality_score integer DEFAULT 70 CHECK (quality_score BETWEEN 0 AND 100),
    pricing_compliance_score integer DEFAULT 70 CHECK (pricing_compliance_score BETWEEN 0 AND 100),
    fraud_risk_score integer DEFAULT 100 CHECK (fraud_risk_score BETWEEN 0 AND 100), -- Higher is better (less risk)
    
    -- Composite Score: Weighted average
    -- (Availability * 0.25) + (Delivery * 0.20) + (Quality * 0.25) + (Pricing * 0.15) + (FraudRisk * 0.15)
    composite_score integer GENERATED ALWAYS AS (
        (availability_score * 25 + 
         delivery_speed_score * 20 + 
         quality_score * 25 + 
         pricing_compliance_score * 15 + 
         fraud_risk_score * 15) / 100
    ) STORED,
    
    -- Metrics used for calculation
    orders_fulfilled integer DEFAULT 0,
    orders_total integer DEFAULT 0,
    avg_delivery_hours numeric(6, 2),
    warranty_claims integer DEFAULT 0,
    pricing_deviations integer DEFAULT 0,
    
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    
    CONSTRAINT unique_dealer_score_date UNIQUE (dealer_id, score_date)
);

-- Dealer Alerts: Risk flags and notifications
CREATE TABLE IF NOT EXISTS public.dealer_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
    alert_type public.dealer_alert_type NOT NULL,
    severity public.alert_severity DEFAULT 'warning',
    title text NOT NULL,
    description text,
    related_order_id uuid REFERENCES public.part_orders(id),
    is_acknowledged boolean DEFAULT false,
    acknowledged_by uuid REFERENCES public.profiles(user_id),
    acknowledged_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_dealer_scores_dealer ON public.dealer_reliability_scores(dealer_id);
CREATE INDEX idx_dealer_scores_date ON public.dealer_reliability_scores(score_date);
CREATE INDEX idx_dealer_scores_composite ON public.dealer_reliability_scores(composite_score);
CREATE INDEX idx_dealer_alerts_dealer ON public.dealer_alerts(dealer_id);
CREATE INDEX idx_dealer_alerts_type ON public.dealer_alerts(alert_type);
CREATE INDEX idx_dealer_alerts_unack ON public.dealer_alerts(is_acknowledged) WHERE is_acknowledged = false;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER set_dealer_scores_updated_at
BEFORE UPDATE ON public.dealer_reliability_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.dealer_reliability_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_alerts ENABLE ROW LEVEL SECURITY;

-- Scores: Admin/Staff can view
CREATE POLICY "Admin and staff can view dealer scores"
ON public.dealer_reliability_scores FOR SELECT
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'staff', 'manager'));

-- Scores: Service role can manage (for RPC)
CREATE POLICY "Service role can manage dealer scores"
ON public.dealer_reliability_scores FOR ALL
TO service_role
USING (true);

-- Alerts: Admin/Staff can manage
CREATE POLICY "Admin and staff can manage dealer alerts"
ON public.dealer_alerts FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'staff', 'manager'));

-- ============================================================================
-- FUNCTIONS / RPCs
-- ============================================================================

-- RPC: Calculate Dealer Reliability Score
CREATE OR REPLACE FUNCTION public.rpc_calculate_dealer_score(
    p_dealer_id uuid,
    p_score_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_orders_fulfilled integer := 0;
    v_orders_total integer := 0;
    v_avg_delivery_hours numeric := 0;
    v_warranty_claims integer := 0;
    v_pricing_deviations integer := 0;
    
    v_availability_score integer := 70;
    v_delivery_speed_score integer := 70;
    v_quality_score integer := 70;
    v_pricing_compliance_score integer := 70;
    v_fraud_risk_score integer := 100;
    
    v_result jsonb;
BEGIN
    -- Count orders in last 30 days
    SELECT 
        COUNT(*) FILTER (WHERE order_status = 'delivered'),
        COUNT(*)
    INTO v_orders_fulfilled, v_orders_total
    FROM public.part_orders
    WHERE dealer_id = p_dealer_id
      AND created_at >= (p_score_date - interval '30 days');
    
    -- Calculate average delivery time
    SELECT COALESCE(AVG(
        EXTRACT(EPOCH FROM (actual_delivery_at - ordered_at)) / 3600
    ), 48)
    INTO v_avg_delivery_hours
    FROM public.part_orders
    WHERE dealer_id = p_dealer_id
      AND order_status = 'delivered'
      AND actual_delivery_at IS NOT NULL
      AND created_at >= (p_score_date - interval '30 days');
    
    -- Calculate Availability Score (based on fulfillment rate)
    IF v_orders_total > 0 THEN
        v_availability_score := LEAST(100, GREATEST(0,
            (v_orders_fulfilled::numeric / v_orders_total * 100)::integer
        ));
    END IF;
    
    -- Calculate Delivery Speed Score (ideal: < 24h = 100, > 72h = 50)
    v_delivery_speed_score := LEAST(100, GREATEST(50,
        100 - LEAST(50, ((v_avg_delivery_hours - 24) / 48 * 50)::integer)
    ));
    
    -- Quality Score: Deduct for received_condition issues (simplified)
    SELECT COUNT(*)
    INTO v_warranty_claims
    FROM public.part_orders
    WHERE dealer_id = p_dealer_id
      AND received_condition IN ('Damaged', 'Wrong Part')
      AND created_at >= (p_score_date - interval '30 days');
    
    v_quality_score := GREATEST(50, 100 - (v_warranty_claims * 10));
    
    -- Fraud Risk Score: Defaults to 100 (no risk), reduced by alerts
    SELECT COUNT(*)
    INTO v_pricing_deviations
    FROM public.dealer_alerts
    WHERE dealer_id = p_dealer_id
      AND alert_type IN ('fraud_suspected', 'pricing_variance')
      AND created_at >= (p_score_date - interval '90 days');
    
    v_fraud_risk_score := GREATEST(50, 100 - (v_pricing_deviations * 15));
    v_pricing_compliance_score := v_fraud_risk_score; -- Simplified: same logic
    
    -- Upsert the score
    INSERT INTO public.dealer_reliability_scores (
        dealer_id, score_date,
        availability_score, delivery_speed_score, quality_score,
        pricing_compliance_score, fraud_risk_score,
        orders_fulfilled, orders_total, avg_delivery_hours,
        warranty_claims, pricing_deviations
    )
    VALUES (
        p_dealer_id, p_score_date,
        v_availability_score, v_delivery_speed_score, v_quality_score,
        v_pricing_compliance_score, v_fraud_risk_score,
        v_orders_fulfilled, v_orders_total, v_avg_delivery_hours,
        v_warranty_claims, v_pricing_deviations
    )
    ON CONFLICT (dealer_id, score_date)
    DO UPDATE SET
        availability_score = EXCLUDED.availability_score,
        delivery_speed_score = EXCLUDED.delivery_speed_score,
        quality_score = EXCLUDED.quality_score,
        pricing_compliance_score = EXCLUDED.pricing_compliance_score,
        fraud_risk_score = EXCLUDED.fraud_risk_score,
        orders_fulfilled = EXCLUDED.orders_fulfilled,
        orders_total = EXCLUDED.orders_total,
        avg_delivery_hours = EXCLUDED.avg_delivery_hours,
        warranty_claims = EXCLUDED.warranty_claims,
        pricing_deviations = EXCLUDED.pricing_deviations,
        updated_at = now();
    
    -- Return result
    SELECT jsonb_build_object(
        'dealer_id', p_dealer_id,
        'score_date', p_score_date,
        'availability_score', v_availability_score,
        'delivery_speed_score', v_delivery_speed_score,
        'quality_score', v_quality_score,
        'pricing_compliance_score', v_pricing_compliance_score,
        'fraud_risk_score', v_fraud_risk_score,
        'composite_score', (v_availability_score * 25 + v_delivery_speed_score * 20 + v_quality_score * 25 + v_pricing_compliance_score * 15 + v_fraud_risk_score * 15) / 100
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;

-- RPC: Award Part Order (Convert Quote to Order)
CREATE OR REPLACE FUNCTION public.rpc_award_part_order(
    p_quote_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_quote record;
    v_order_id uuid;
    v_user_id uuid := auth.uid();
BEGIN
    -- Get quote details
    SELECT dq.*, pr.id as pr_id
    INTO v_quote
    FROM public.dealer_quotes dq
    JOIN public.part_requests pr ON dq.part_request_id = pr.id
    WHERE dq.id = p_quote_id;
    
    IF v_quote IS NULL THEN
        RAISE EXCEPTION 'Quote not found';
    END IF;
    
    IF v_quote.is_selected THEN
        RAISE EXCEPTION 'Quote already selected';
    END IF;
    
    -- Mark quote as selected
    UPDATE public.dealer_quotes
    SET is_selected = true
    WHERE id = p_quote_id;
    
    -- Update part request status
    UPDATE public.part_requests
    SET status = 'ordered', updated_at = now()
    WHERE id = v_quote.part_request_id;
    
    -- Create order
    INSERT INTO public.part_orders (
        quote_id, part_request_id, dealer_id, ordered_by,
        expected_delivery_at
    )
    VALUES (
        p_quote_id, v_quote.part_request_id, v_quote.dealer_id, v_user_id,
        now() + (v_quote.lead_time_hours * interval '1 hour')
    )
    RETURNING id INTO v_order_id;
    
    RETURN v_order_id;
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON public.dealer_reliability_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.dealer_alerts TO authenticated;

GRANT ALL ON public.dealer_reliability_scores TO service_role;
GRANT ALL ON public.dealer_alerts TO service_role;

GRANT EXECUTE ON FUNCTION public.rpc_calculate_dealer_score TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_calculate_dealer_score TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_award_part_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_award_part_order TO service_role;
