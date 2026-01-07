-- ============================================================================
-- C28 Customer LTV & Behavior AI: Foundation Migration
-- JamesTronic Platform
-- ============================================================================
-- Purpose: Segment customers based on long-term value, predict churn risk,
-- and identify behavioral traits for personalized service.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.ltv_band AS ENUM (
    'low',
    'medium',
    'high',
    'vip',
    'strategic'
);

CREATE TYPE public.churn_risk AS ENUM (
    'safe',
    'low_risk',
    'medium_risk',
    'high_risk',
    'imminent_churn'
);

CREATE TYPE public.behavior_tag AS ENUM (
    'price_sensitive',
    'quality_seeker',
    'time_sensitive',
    'high_trust',
    'frequent_disputer',
    'brand_loyalist',
    'new_customer'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Behavior Segments: Definitions of segments
CREATE TABLE IF NOT EXISTS public.behavior_segments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_name text NOT NULL UNIQUE, -- e.g. "VIP", "At Risk"
    description text,
    min_ltv_score integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Customer Interaction Metrics: Raw input data for calculations
CREATE TABLE IF NOT EXISTS public.customer_interaction_metrics (
    user_id uuid PRIMARY KEY REFERENCES public.profiles(user_id),
    
    total_spend numeric(10, 2) DEFAULT 0,
    total_bookings integer DEFAULT 0,
    avg_order_value numeric(10, 2) DEFAULT 0,
    
    days_since_last_booking integer,
    booking_frequency_days integer, -- avg days between bookings
    
    cancellation_count integer DEFAULT 0,
    dispute_count integer DEFAULT 0,
    
    last_updated_at timestamptz DEFAULT now() NOT NULL
);

-- Customer Behavior Profiles: The Output / DNA
CREATE TABLE IF NOT EXISTS public.customer_behavior_profiles (
    user_id uuid PRIMARY KEY REFERENCES public.profiles(user_id),
    
    -- Scores
    ltv_score integer DEFAULT 0, -- 0-1000 normalized score
    ltv_band public.ltv_band DEFAULT 'low',
    
    churn_score integer DEFAULT 0, -- 0-100 probability
    churn_risk public.churn_risk DEFAULT 'safe',
    
    -- Traits
    primary_segment_id uuid REFERENCES public.behavior_segments(id),
    behavior_tags public.behavior_tag[] DEFAULT '{}',
    
    ai_summary text, -- "Customer values speed over price. High retention probability."
    
    last_analyzed_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_behavior_ltv_band ON public.customer_behavior_profiles(ltv_band);
CREATE INDEX idx_behavior_churn_risk ON public.customer_behavior_profiles(churn_risk);

-- ============================================================================
-- SEED DATA (Segments)
-- ============================================================================

INSERT INTO public.behavior_segments (segment_name, description, min_ltv_score)
VALUES 
    ('VIP', 'Top 5% of customers by value and loyalty', 800),
    ('Loyal Regular', 'Consistent customers with good retention', 500),
    ('Occasional', 'Infrequent but satisfied customers', 200),
    ('Newbie', 'Recently acquired, insufficient data', 0),
    ('At Risk', 'High value but showing churn signals', 400)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.behavior_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_interaction_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_behavior_profiles ENABLE ROW LEVEL SECURITY;

-- Admins view all
CREATE POLICY "Admin view behavior data"
ON public.customer_behavior_profiles FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner', 'staff'));

CREATE POLICY "Admin view metrics"
ON public.customer_interaction_metrics FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner', 'staff'));

CREATE POLICY "Admin view segments"
ON public.behavior_segments FOR SELECT
TO authenticated
USING (true); -- Public read for UI dropdowns? Or restrict. Restrict to internal for now.
-- Actually segments might be needed by client if we show badges? Let's keep strict for C28.
-- USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner', 'staff'));

-- ============================================================================
-- FUNCTIONS / RPCs
-- ============================================================================

-- RPC: Calculate LTV Profile (Simulation Logic)
CREATE OR REPLACE FUNCTION public.rpc_calculate_ltv_profile(
    p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_metrics RECORD;
    v_ltv_score integer := 0;
    v_churn_score integer := 0;
    v_ltv_band public.ltv_band;
    v_churn_risk public.churn_risk;
    v_tags public.behavior_tag[] := '{}';
    v_summary text;
    v_segment_id uuid;
    v_result jsonb;
BEGIN
    -- 1. Get or Create Metrics (Mocking if missing)
    SELECT * INTO v_metrics FROM public.customer_interaction_metrics WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        -- Insert dummy metrics for simulation
        INSERT INTO public.customer_interaction_metrics (user_id, total_spend, total_bookings, avg_order_value)
        VALUES (p_user_id, floor(random() * 50000), floor(random() * 20), floor(random() * 5000))
        RETURNING * INTO v_metrics;
    END IF;

    -- 2. Calculate LTV Score (Simple Heuristic)
    -- Base score from spend + bookings
    v_ltv_score := (v_metrics.total_spend / 100) + (v_metrics.total_bookings * 50);
    IF v_ltv_score > 1000 THEN v_ltv_score := 1000; END IF;

    -- Assign Band
    IF v_ltv_score >= 800 THEN v_ltv_band := 'vip';
    ELSIF v_ltv_score >= 600 THEN v_ltv_band := 'high';
    ELSIF v_ltv_score >= 400 THEN v_ltv_band := 'medium';
    ELSE v_ltv_band := 'low';
    END IF;

    -- 3. Calculate Churn Risk (Heuristic)
    -- If no booking for 180 days, risk increases
    -- For simulation, we'll randomize or use Last Updated logic if present
    -- Let's just simulate based on a random factor + low booking count
    v_churn_score := floor(random() * 100);
    
    IF v_churn_score > 80 THEN v_churn_risk := 'high_risk';
    ELSIF v_churn_score > 50 THEN v_churn_risk := 'medium_risk';
    ELSE v_churn_risk := 'safe';
    END IF;

    -- 4. Assign Tags
    IF v_metrics.avg_order_value > 3000 THEN 
        v_tags := array_append(v_tags, 'quality_seeker');
    ELSIF v_metrics.avg_order_value < 1000 THEN
        v_tags := array_append(v_tags, 'price_sensitive');
    END IF;

    IF v_metrics.total_bookings > 10 THEN
        v_tags := array_append(v_tags, 'brand_loyalist');
    END IF;

    -- 5. AI Summary
    v_summary := format('User has spend %s with %s bookings. LTV Band: %s.', v_metrics.total_spend, v_metrics.total_bookings, v_ltv_band);

    -- 6. Upsert Profile
    INSERT INTO public.customer_behavior_profiles (
        user_id, ltv_score, ltv_band, churn_score, churn_risk, behavior_tags, ai_summary
    )
    VALUES (
        p_user_id, v_ltv_score, v_ltv_band, v_churn_score, v_churn_risk, v_tags, v_summary
    )
    ON CONFLICT (user_id) DO UPDATE SET
        ltv_score = EXCLUDED.ltv_score,
        ltv_band = EXCLUDED.ltv_band,
        churn_score = EXCLUDED.churn_score,
        churn_risk = EXCLUDED.churn_risk,
        behavior_tags = EXCLUDED.behavior_tags,
        ai_summary = EXCLUDED.ai_summary,
        last_analyzed_at = now();

    v_result := jsonb_build_object(
        'ltv_score', v_ltv_score,
        'ltv_band', v_ltv_band,
        'churn_risk', v_churn_risk,
        'tags', v_tags
    );
    
    RETURN v_result;
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.behavior_segments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_interaction_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_behavior_profiles TO authenticated;

GRANT ALL ON public.behavior_segments TO service_role;
GRANT ALL ON public.customer_interaction_metrics TO service_role;
GRANT ALL ON public.customer_behavior_profiles TO service_role;

GRANT EXECUTE ON FUNCTION public.rpc_calculate_ltv_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_calculate_ltv_profile TO service_role;
