-- ============================================================================
-- C18 Dealer Analytics Engine V1
-- JamesTronic Platform
-- ============================================================================
-- Purpose: 
-- 1. Create immutable fact log for dealer events.
-- 2. Create windowed score snapshots (7/30/90 days).
-- 3. Implement Value Function Logic (VFL) compliant scoring RPCs.
-- 4. Provide fast dashboard rollups.
-- ============================================================================

-- ============================================================================
-- 1. Dealer Event Facts (Flight Recorder)
-- ============================================================================

-- Fact types: 'part_request_response', 'delivery', 'invoice_issue', 'return', 'quality_incident'
CREATE TABLE IF NOT EXISTS public.dealer_event_facts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
    event_type text NOT NULL, 
    context_type text NOT NULL, -- 'ticket', 'part_order', 'invoice', etc.
    context_id uuid, -- Reference to the source entity
    occurred_at timestamptz NOT NULL,
    payload jsonb DEFAULT '{}', -- Stores specific metrics (e.g., delivery delay hours)
    created_at timestamptz DEFAULT now() NOT NULL,
    
    -- Idempotency key: prevent processing same event twice
    CONSTRAINT unique_dealer_event_fact UNIQUE (dealer_id, event_type, context_id)
);

CREATE INDEX idx_dealer_facts_dealer_date ON public.dealer_event_facts(dealer_id, occurred_at DESC);
CREATE INDEX idx_dealer_facts_type ON public.dealer_event_facts(event_type);

-- RLS: Admin only. Dealers CANNOT read raw facts directly (yet).
ALTER TABLE public.dealer_event_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and manager can view dealer event facts"
ON public.dealer_event_facts FOR SELECT
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager'));

CREATE POLICY "Admin and manager can insert dealer event facts"
ON public.dealer_event_facts FOR INSERT
TO authenticated
WITH CHECK (public.get_user_role_for_rls() IN ('admin', 'manager'));

-- ============================================================================
-- 2. Dealer Score Snapshots (Explainable VFL Scores)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dealer_score_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
    window_days integer NOT NULL, -- 7, 30, 90
    computed_at timestamptz DEFAULT now() NOT NULL,
    
    -- Core 30d Score (0-100)
    reliability_score integer CHECK (reliability_score BETWEEN 0 AND 100),
    confidence_score integer CHECK (confidence_score BETWEEN 0 AND 100),
    
    -- Explainability
    primary_reason text,
    contributing_factors text[], -- Array of reasons like ["High Delivery Delay", "Invoice Warning"]
    
    -- VFL Outputs (Governance)
    operational_value integer CHECK (operational_value BETWEEN 0 AND 100),
    trust_value integer CHECK (trust_value BETWEEN 0 AND 100),
    business_value integer CHECK (business_value BETWEEN 0 AND 100),
    learning_value integer CHECK (learning_value BETWEEN 0 AND 100),
    
    -- Raw Metrics Snapshot (for debugging/audit)
    metrics_snapshot jsonb DEFAULT '{}',
    
    -- Unique snapshot per window per day (approx)
    -- We allow re-computing same day, but typically one per day is enough. 
    -- We won't enforce unique constraint here to allow multiple runs/day if needed, 
    -- but usually we query 'ORDER BY computed_at DESC LIMIT 1'.
    
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_dealer_snapshots_lookup ON public.dealer_score_snapshots(dealer_id, window_days, computed_at DESC);

-- RLS: Admin/Manager view. 
ALTER TABLE public.dealer_score_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and manager can view dealer score snapshots"
ON public.dealer_score_snapshots FOR SELECT
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager'));

-- ============================================================================
-- 3. RPC: Ingest Event (Idempotent)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_dealer_event_ingest(
    p_dealer_id uuid,
    p_event_type text,
    p_context_type text,
    p_context_id uuid,
    p_occurred_at timestamptz,
    p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as owner (postgres) to bypass RLS for system ingestion if needed
AS $$
DECLARE
    v_fact_id uuid;
BEGIN
    -- Try insert, ignore on conflict (idempotent)
    INSERT INTO public.dealer_event_facts (
        dealer_id, event_type, context_type, context_id, occurred_at, payload
    )
    VALUES (
        p_dealer_id, p_event_type, p_context_type, p_context_id, p_occurred_at, p_payload
    )
    ON CONFLICT (dealer_id, event_type, context_id) 
    DO UPDATE SET payload = EXCLUDED.payload -- Optional: update payload if same event re-sent with new info
    RETURNING id INTO v_fact_id;
    
    -- If duplicate (v_fact_id is null due to ON CONFLICT DO HIGHER UP if we didn't use UPDATE), fetch existing
    IF v_fact_id IS NULL THEN
        SELECT id INTO v_fact_id FROM public.dealer_event_facts 
        WHERE dealer_id = p_dealer_id AND event_type = p_event_type AND context_id = p_context_id;
    END IF;
    
    RETURN v_fact_id;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.rpc_dealer_event_ingest TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_dealer_event_ingest TO service_role;


-- ============================================================================
-- 4. RPC: Compute Scores (The VFL Engine)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_dealer_compute_scores(
    p_dealer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_window_days integer[] := ARRAY[7, 30, 90];
    v_window integer;
    v_start_date timestamptz;
    
    -- Metrics
    v_total_orders integer;
    v_late_deliveries integer;
    v_quality_issues integer;
    v_response_time_sum numeric;
    v_response_count integer;
    
    -- Scores
    v_reliability_score integer;
    v_confidence_score integer;
    v_trust_score integer;
    
    -- Explainability
    v_reasons text[];
    v_primary_reason text;
    
    -- Output
    v_result jsonb := '[]'::jsonb;
    v_snapshot_id uuid;
BEGIN
    FOREACH v_window IN ARRAY v_window_days
    LOOP
        v_start_date := now() - (v_window || ' days')::interval;
        v_reasons := ARRAY[]::text[];
        
        -- 1. Gather Metrics from Facts
        -- Note: This is a simplified logic for the example. Real logic would be more complex queries.
        
        -- Late Deliveries
        SELECT COUNT(*) INTO v_late_deliveries
        FROM public.dealer_event_facts
        WHERE dealer_id = p_dealer_id 
          AND event_type = 'delivery_delayed'
          AND occurred_at >= v_start_date;
          
        -- Quality Issues
        SELECT COUNT(*) INTO v_quality_issues
        FROM public.dealer_event_facts
        WHERE dealer_id = p_dealer_id
          AND event_type IN ('return', 'quality_incident')
          AND occurred_at >= v_start_date;
          
        -- Total "Good" Events (proxy for volume)
        SELECT COUNT(*) INTO v_total_orders
        FROM public.dealer_event_facts
        WHERE dealer_id = p_dealer_id
          AND event_type = 'order_fulfilled'
          AND occurred_at >= v_start_date;
        
        -- 2. Calculate BASE SCORES
        
        -- Start at 100
        v_reliability_score := 100;
        
        -- Penalties
        IF v_total_orders > 0 THEN
             -- Deduct 10 points per late delivery, capped at 40
            v_reliability_score := v_reliability_score - LEAST(40, (v_late_deliveries * 10));
            
            -- Deduct 20 points per quality issue, big impact
            v_reliability_score := v_reliability_score - (v_quality_issues * 20);
        ELSE
            -- No data = Neutral score 70
            v_reliability_score := 70; 
            v_reasons := array_append(v_reasons, 'Insufficient Data');
        END IF;
        
        -- Floor at 0
        v_reliability_score := GREATEST(0, v_reliability_score);
        
        -- 3. Explainability
        IF v_late_deliveries > 0 THEN
            v_reasons := array_append(v_reasons, 'Delayed Deliveries Detected');
        END IF;
        IF v_quality_issues > 0 THEN
            v_reasons := array_append(v_reasons, 'Quality Incidents Reported');
        END IF;
        IF v_reliability_score > 90 THEN
             v_reasons := array_append(v_reasons, 'Excellent Performance');
        END IF;
        
        IF array_length(v_reasons, 1) > 0 THEN
            v_primary_reason := v_reasons[1]; -- Pick first main reason
        ELSE
            v_primary_reason := 'Stable Performance';
        END IF;

        -- 4. Calculate Confidence
        -- More volume = higher confidence
        IF v_total_orders >= 10 THEN
            v_confidence_score := 90;
        ELSIF v_total_orders >= 5 THEN
             v_confidence_score := 70;
        ELSE
             v_confidence_score := 40; -- Low confidence
        END IF;
        
        -- 5. Calculate Trust Value (VFL)
        -- Trust drops heavily on quality/fraud issues
        v_trust_score := GREATEST(0, 100 - (v_quality_issues * 30));

        -- 6. Insert Snapshot
        INSERT INTO public.dealer_score_snapshots (
            dealer_id, window_days, reliability_score, confidence_score,
            primary_reason, contributing_factors,
            operational_value, trust_value, business_value, learning_value,
            metrics_snapshot
        )
        VALUES (
            p_dealer_id, v_window, v_reliability_score, v_confidence_score,
            v_primary_reason, v_reasons,
            v_reliability_score, v_trust_score, v_reliability_score, 50, -- Simplified VFL mapping
            jsonb_build_object(
                'late_deliveries', v_late_deliveries,
                'quality_issues', v_quality_issues,
                'total_orders', v_total_orders
            )
        )
        RETURNING id INTO v_snapshot_id;
        
        -- Add to result
        v_result := v_result || jsonb_build_object(
            'window', v_window,
            'score', v_reliability_score,
            'reason', v_primary_reason
        );
        
    END LOOP;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_dealer_compute_scores TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_dealer_compute_scores TO service_role;

-- ============================================================================
-- 5. RPC: Dashboard Summary
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_dealer_dashboard_summary(
    p_window_days integer DEFAULT 30,
    p_limit integer DEFAULT 50,
    p_offset integer DEFAULT 0,
    p_status_filter text DEFAULT NULL -- e.g. 'risk' to show only scores < 70
)
RETURNS TABLE (
    dealer_id uuid,
    dealer_name text,
    city text,
    reliability_score integer,
    confidence_score integer,
    trust_value integer,
    trend text, -- 'up', 'down', 'flat' (placeholder for now)
    primary_reason text,
    last_computed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.name,
        d.city,
        s.reliability_score,
        s.confidence_score,
        s.trust_value,
        'flat'::text as trend, -- TODO: Calculate delta vs previous snapshot
        s.primary_reason,
        s.computed_at
    FROM public.dealers d
    JOIN LATERAL (
        SELECT * FROM public.dealer_score_snapshots s2
        WHERE s2.dealer_id = d.id AND s2.window_days = p_window_days
        ORDER BY s2.computed_at DESC
        LIMIT 1
    ) s ON true
    WHERE (p_status_filter IS NULL OR 
           (p_status_filter = 'risk' AND s.reliability_score < 70))
    ORDER BY s.reliability_score ASC -- Show lowest scores first by default for admin attention
    LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_dealer_dashboard_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_dealer_dashboard_summary TO service_role;
