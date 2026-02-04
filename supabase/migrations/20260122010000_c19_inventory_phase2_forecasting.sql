-- ============================================================================
-- C19 Inventory Prediction Engine - Phase 2: Forecasting & Recommendations (V1)
-- JamesTronic Platform
-- ============================================================================
-- Purpose:
-- 1. Create demand rollups (aggregate from C16 part_requests)
-- 2. Create forecast snapshots (7/30/90 windows with VFL scoring)
-- 3. Create reorder recommendations (with C18 dealer integration + approval workflow)
-- 4. Create inventory alerts (stockout/anomaly/supplier risk)
-- 5. Implement service-only compute RPCs
-- ============================================================================
-- Job ID: C19_PHASE2_FORECASTING_AND_REORDERS_V1
-- Priority: P0
-- Date: 2026-01-22
-- ============================================================================

-- ============================================================================
-- DEMAND SOURCE INTROSPECTION RESULTS
-- ============================================================================
-- Canonical Demand Source: public.part_requests
-- From Migration: 20260105100000_c7_5_dealer_foundation.sql
-- Schema: ticket_id uuid REFERENCES public.tickets(id)
-- Usage: Join part_requests with inventory_stock_ledger.part_id to aggregate demand
-- ============================================================================

-- ============================================================================
-- STEP 1: Part Demand Rollups Daily
-- ============================================================================

CREATE TABLE public.part_demand_rollups_daily (
    location_id uuid NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
    part_id uuid NOT NULL, -- References inventory_parts or parts_catalog
    day date NOT NULL,
    
    demand_count integer NOT NULL DEFAULT 0, -- Requests for this part
    fulfilled_count integer NOT NULL DEFAULT 0, -- Successfully fulfilled from stock
    unfulfilled_count integer NOT NULL DEFAULT 0, -- Stockouts/unfulfilled
    avg_lead_time_hours numeric(10, 2),
    
    computed_at timestamptz DEFAULT now() NOT NULL,
    
    PRIMARY KEY (location_id, part_id, day)
);

CREATE INDEX idx_demand_rollups_part_day ON part_demand_rollups_daily(part_id, day DESC);
CREATE INDEX idx_demand_rollups_location_day ON part_demand_rollups_daily(location_id, day DESC);
CREATE INDEX idx_demand_rollups_computed ON part_demand_rollups_daily(computed_at DESC);

COMMENT ON TABLE public.part_demand_rollups_daily IS 'Daily demand aggregation per location+part (90d history) from C16 part_requests';

-- ============================================================================
-- STEP 2: Inventory Forecast Snapshots (7/30/90 Windows with VFL Scoring)
-- ============================================================================

CREATE TABLE public.inventory_forecast_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id uuid NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
    part_id uuid NOT NULL, -- References inventory_parts or parts_catalog
    window_days integer NOT NULL CHECK (window_days IN (7, 30, 90)),
    
    forecast_qty numeric NOT NULL, -- Predicted demand for this window
    confidence_score integer NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
    
    drivers jsonb DEFAULT '{}', -- Contributing factors (trend, seasonality, variance)
    primary_reason text NOT NULL, -- Explainability (e.g., "Seasonal Demand Spike", "Insufficient Data")
    
    computed_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_forecast_snapshots_lookup ON inventory_forecast_snapshots(location_id, part_id, window_days, computed_at DESC);
CREATE INDEX idx_forecast_snapshots_low_confidence ON inventory_forecast_snapshots(confidence_score) WHERE confidence_score < 50;
CREATE INDEX idx_forecast_snapshots_recent ON inventory_forecast_snapshots(computed_at DESC);

COMMENT ON TABLE public.inventory_forecast_snapshots IS '7/30/90 forecasts per location+part with confidence + drivers (VFL pattern from C18)';
COMMENT ON COLUMN public.inventory_forecast_snapshots.confidence_score IS '0-100 scale, higher = more reliable forecast';
COMMENT ON COLUMN public.inventory_forecast_snapshots.drivers IS 'JSONB: {trend, seasonality, variance, sample_size}';

-- ============================================================================
-- STEP 3: Reorder Recommendations (Approval Workflow + C18 Integration)
-- ============================================================================

CREATE TABLE public.reorder_recommendations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id uuid NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
    part_id uuid NOT NULL, -- References inventory_parts or parts_catalog
    
    recommended_qty integer NOT NULL,
    target_days_cover integer NOT NULL, -- Cover X days of forecasted demand
    stockout_risk_score integer NOT NULL CHECK (stockout_risk_score BETWEEN 0 AND 100),
    
    -- C18 Integration: Suggested dealer based on reliability/trust
    suggested_dealer_id uuid REFERENCES dealers(id),
    
    evidence jsonb NOT NULL, -- Forecast, current stock, lead-time, dealer reliability
    value_score jsonb NOT NULL, -- VFL output (operational, trust, business, learning)
    
    status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected', 'ordered', 'received', 'cancelled')),
    
    approved_by uuid REFERENCES profiles(user_id),
    approved_at timestamptz,
    notes text,
    
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_reorder_recommendations_status ON reorder_recommendations(status, created_at DESC);
CREATE INDEX idx_reorder_recommendations_location_part ON reorder_recommendations(location_id, part_id, created_at DESC);
CREATE INDEX idx_reorder_recommendations_risk ON reorder_recommendations(stockout_risk_score DESC) WHERE status = 'proposed';
CREATE INDEX idx_reorder_recommendations_dealer ON reorder_recommendations(suggested_dealer_id);

COMMENT ON TABLE public.reorder_recommendations IS 'Explainable reorder suggestions with approval workflow and C18 dealer integration';
COMMENT ON COLUMN public.reorder_recommendations.suggested_dealer_id IS 'Best dealer from C18 dealer_score_snapshots (reliability + trust)';
COMMENT ON COLUMN public.reorder_recommendations.evidence IS 'JSONB: {forecast, current_stock, lead_time, dealer_snapshot}';

-- ============================================================================
-- STEP 4: Inventory Alerts (Stockout/Anomaly/Supplier Risk)
-- ============================================================================

CREATE TABLE public.inventory_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id uuid REFERENCES inventory_locations(id) ON DELETE CASCADE,
    part_id uuid, -- References inventory_parts or parts_catalog (nullable for system-wide alerts)
    
    severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    category text NOT NULL CHECK (category IN ('stockout', 'anomaly', 'forecast_drift', 'supplier_risk')),
    
    message text NOT NULL,
    evidence jsonb DEFAULT '{}',
    
    resolved_at timestamptz,
    resolved_by uuid REFERENCES profiles(user_id),
    resolution_note text,
    
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_inventory_alerts_active ON inventory_alerts(severity, created_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX idx_inventory_alerts_location ON inventory_alerts(location_id, created_at DESC);
CREATE INDEX idx_inventory_alerts_category ON inventory_alerts(category, created_at DESC);

COMMENT ON TABLE public.inventory_alerts IS 'Stockout risk, anomalies, forecast drift, and supplier risk alerts with evidence + resolution';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.part_demand_rollups_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_forecast_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reorder_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_alerts ENABLE ROW LEVEL SECURITY;

-- Admin/Manager read access
CREATE POLICY "Admin and manager can view demand rollups"
ON public.part_demand_rollups_daily FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role::text IN ('admin', 'manager'))
);

CREATE POLICY "Admin and manager can view forecasts"
ON public.inventory_forecast_snapshots FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role::text IN ('admin', 'manager'))
);

CREATE POLICY "Admin and manager can view and update reorder recommendations"
ON public.reorder_recommendations FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role::text IN ('admin', 'manager'))
);

CREATE POLICY "Admin and manager can view and update alerts"
ON public.inventory_alerts FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role::text IN ('admin', 'manager'))
);

-- Service role full access (for scheduled jobs)
CREATE POLICY "Service role full access to demand rollups"
ON public.part_demand_rollups_daily FOR ALL
TO service_role
USING (true);

CREATE POLICY "Service role full access to forecasts"
ON public.inventory_forecast_snapshots FOR ALL
TO service_role
USING (true);

CREATE POLICY "Service role can insert reorder recommendations"
ON public.reorder_recommendations FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can insert alerts"
ON public.inventory_alerts FOR INSERT
TO service_role
WITH CHECK (true);

-- ============================================================================
-- RPC 1: Compute Part Demand (Service-Only)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_compute_part_demand(
    p_days_back integer DEFAULT 90
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rows_inserted integer := 0;
    v_start_date date;
BEGIN
    -- Permission gate: service_role only
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: demand computation requires service_role privileges';
    END IF;
    
    v_start_date := CURRENT_DATE - p_days_back;
    
    -- Aggregate demand from inventory_stock_ledger (C19 canonical source for consumption)
    -- Using ledger 'consume' and 'transfer_out' events as demand signals.
    -- Assuming qty is negative for these types, ABS() gets the magnitude.
    INSERT INTO public.part_demand_rollups_daily (location_id, part_id, day, demand_count, fulfilled_count, unfulfilled_count, computed_at)
    SELECT 
        isl.location_id,
        isl.part_id,
        isl.occurred_at::date as day,
        SUM(ABS(isl.qty)) as demand_count,
        -- In ledger logic, consumption implies fulfillment from stock.
        SUM(ABS(isl.qty)) as fulfilled_count,
        -- Unfulfilled demand isn't easily captured in a successful transaction ledger without explicit 'stockout' events.
        -- For V1, we assume 0 unfulfilled here (captured separately via alerts).
        0 as unfulfilled_count,
        now() as computed_at
    FROM public.inventory_stock_ledger isl
    WHERE isl.occurred_at >= v_start_date
      AND isl.movement_type IN ('consume', 'transfer_out') -- Consumption = Demand
    GROUP BY isl.location_id, isl.part_id, isl.occurred_at::date
    ON CONFLICT (location_id, part_id, day)
    DO UPDATE SET
        demand_count = EXCLUDED.demand_count,
        fulfilled_count = EXCLUDED.fulfilled_count,
        unfulfilled_count = EXCLUDED.unfulfilled_count,
        computed_at = EXCLUDED.computed_at;
    
    GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
    
    RETURN jsonb_build_object(
        'success', true,
        'rows_processed', v_rows_inserted,
        'start_date', v_start_date,
        'end_date', CURRENT_DATE
    );
END;
$$;

COMMENT ON FUNCTION public.rpc_compute_part_demand IS 'V1: Aggregate demand from C16 part_requests. Service-role only (scheduled job).';

GRANT EXECUTE ON FUNCTION public.rpc_compute_part_demand TO service_role;

-- ============================================================================
-- RPC 2: Compute Inventory Forecast (Service-Only, VFL Scoring)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_compute_inventory_forecast()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_location RECORD;
    v_part RECORD;
    v_window integer;
    v_forecast_qty numeric;
    v_confidence integer;
    v_drivers jsonb;
    v_primary_reason text;
    v_sample_size integer;
    v_avg_demand numeric;
    v_snapshots_created integer := 0;
BEGIN
    -- Permission gate: service_role only
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: forecast computation requires service_role privileges';
    END IF;
    
    -- For each active location
    FOR v_location IN SELECT * FROM inventory_locations WHERE active = true
    LOOP
        -- For each part with demand history
        FOR v_part IN 
            SELECT DISTINCT part_id 
            FROM part_demand_rollups_daily 
            WHERE location_id = v_location.id
        LOOP
            -- Compute forecasts for 7/30/90 windows
            FOREACH v_window IN ARRAY ARRAY[7, 30, 90]
            LOOP
                -- Calculate average demand over window
                SELECT 
                    COUNT(*) as sample_size,
                    COALESCE(AVG(demand_count), 0) as avg_demand
                INTO v_sample_size, v_avg_demand
                FROM part_demand_rollups_daily
                WHERE location_id = v_location.id
                  AND part_id = v_part.part_id
                  AND day >= CURRENT_DATE - v_window;
                
                -- Forecast = avg_demand * window_days (simple linear projection)
                v_forecast_qty := v_avg_demand * v_window;
                
                -- Confidence based on sample size (VFL pattern)
                v_confidence := CASE
                    WHEN v_sample_size >= v_window * 0.7 THEN 90 -- High confidence
                    WHEN v_sample_size >= v_window * 0.3 THEN 70 -- Medium confidence
                    WHEN v_sample_size > 0 THEN 50 -- Low confidence
                    ELSE 30 -- Very low confidence (insufficient data)
                END;
                
                -- Primary reason
                v_primary_reason := CASE
                    WHEN v_sample_size = 0 THEN 'Insufficient Data'
                    WHEN v_avg_demand > 5 THEN 'High Demand Pattern'
                    WHEN v_avg_demand > 1 THEN 'Moderate Demand'
                    ELSE 'Low Demand'
                END;
                
                -- Drivers
                v_drivers := jsonb_build_object(
                    'sample_size', v_sample_size,
                    'avg_daily_demand', v_avg_demand,
                    'window_days', v_window,
                    'trend', 'stable' -- V1: simplified, V2 would calculate actual trend
                );
                
                -- Insert forecast snapshot
                INSERT INTO inventory_forecast_snapshots (
                    location_id, part_id, window_days,
                    forecast_qty, confidence_score,
                    drivers, primary_reason, computed_at
                )
                VALUES (
                    v_location.id, v_part.part_id, v_window,
                    v_forecast_qty, v_confidence,
                    v_drivers, v_primary_reason, now()
                );
                
                v_snapshots_created := v_snapshots_created + 1;
            END LOOP; -- windows
        END LOOP; -- parts
    END LOOP; -- locations
    
    RETURN jsonb_build_object(
        'success', true,
        'snapshots_created', v_snapshots_created
    );
END;
$$;

COMMENT ON FUNCTION public.rpc_compute_inventory_forecast IS 'V1: Compute 7/30/90 forecasts with VFL confidence scoring. Service-role only (scheduled job).';

GRANT EXECUTE ON FUNCTION public.rpc_compute_inventory_forecast TO service_role;

-- ============================================================================
-- RPC 3: Generate Reorder Recommendations (Service-Only, C18 Integration)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_generate_reorder_recommendations(
    p_risk_threshold integer DEFAULT 70,
    p_confidence_threshold integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_forecast RECORD;
    v_current_stock RECORD;
    v_stockout_risk integer;
    v_suggested_dealer_id uuid;
    v_dealer_snapshot jsonb;
    v_evidence jsonb;
    v_value_score jsonb;
    v_recommendations_created integer := 0;
    v_alerts_created integer := 0;
BEGIN
    -- Permission gate: service_role only
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: reorder generation requires service_role privileges';
    END IF;
    
    -- For each recent forecast (7-day window, high priority)
    FOR v_forecast IN
        SELECT * FROM inventory_forecast_snapshots
        WHERE window_days = 7
          AND computed_at >= now() - INTERVAL '1 day'
          AND confidence_score >= p_confidence_threshold
    LOOP
        -- Get current stock
        SELECT * INTO v_current_stock
        FROM inventory_stock_current
        WHERE location_id = v_forecast.location_id
          AND part_id = v_forecast.part_id;
        
        -- Calculate stockout risk
        v_stockout_risk := CASE
            WHEN v_current_stock.available IS NULL OR v_current_stock.available <= 0 THEN 100
            WHEN v_current_stock.available < v_forecast.forecast_qty * 0.5 THEN 80
            WHEN v_current_stock.available < v_forecast.forecast_qty THEN 60
            ELSE 30
        END;
        
        -- Only create recommendation if risk exceeds threshold
        IF v_stockout_risk >= p_risk_threshold THEN
            -- C18 Integration: Select best dealer
            SELECT d.id, 
                   jsonb_build_object(
                       'dealer_id', d.id,
                       'dealer_name', d.name,
                       'reliability_score', dss.reliability_score,
                       'trust_value', dss.trust_value,
                       'confidence_score', dss.confidence_score
                   )
            INTO v_suggested_dealer_id, v_dealer_snapshot
            FROM dealers d
            LEFT JOIN LATERAL (
                SELECT * FROM dealer_score_snapshots
                WHERE dealer_id = d.id
                  AND window_days = 7
                ORDER BY computed_at DESC
                LIMIT 1
            ) dss ON true
            WHERE d.status = 'active'
              AND dss.reliability_score >= 70
              AND dss.confidence_score >= 50
            ORDER BY dss.trust_value DESC NULLS LAST, dss.reliability_score DESC NULLS LAST
            LIMIT 1;
            
            -- Build evidence
            v_evidence := jsonb_build_object(
                'forecast', v_forecast.forecast_qty,
                'current_available', COALESCE(v_current_stock.available, 0),
                'stockout_risk', v_stockout_risk,
                'forecast_confidence', v_forecast.confidence_score,
                'dealer_snapshot', v_dealer_snapshot
            );
            
            -- Build VFL value_score
            v_value_score := jsonb_build_object(
                'operational_value', v_stockout_risk, -- High risk = high operational value to reorder
                'trust_value', COALESCE((v_dealer_snapshot->>'trust_value')::integer, 50),
                'business_value', LEAST(v_stockout_risk, 100),
                'learning_value', 100 - v_forecast.confidence_score
            );
            
           -- Create reorder recommendation
            INSERT INTO reorder_recommendations (
                location_id, part_id,
                recommended_qty, target_days_cover, stockout_risk_score,
                suggested_dealer_id, evidence, value_score,
                status
            )
            VALUES (
                v_forecast.location_id, v_forecast.part_id,
                CEIL(v_forecast.forecast_qty * 1.2), 7, v_stockout_risk,
                v_suggested_dealer_id, v_evidence, v_value_score,
                'proposed'
            );
            
            v_recommendations_created := v_recommendations_created + 1;
            
            -- Emit critical alert if risk is very high
            IF v_stockout_risk >= 90 THEN
                INSERT INTO inventory_alerts (
                    location_id, part_id,
                    severity, category, message, evidence
                )
                VALUES (
                    v_forecast.location_id, v_forecast.part_id,
                    'critical', 'stockout',
                    format('Critical stockout risk (score: %s) for part at location', v_stockout_risk),
                    v_evidence
                );
                
                v_alerts_created := v_alerts_created + 1;
            END IF;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'recommendations_created', v_recommendations_created,
        'alerts_created', v_alerts_created
    );
END;
$$;

COMMENT ON FUNCTION public.rpc_generate_reorder_recommendations IS 'V1: Generate reorder queue using stockout risk + C18 dealer reliability. Service-role only (scheduled job).';

GRANT EXECUTE ON FUNCTION public.rpc_generate_reorder_recommendations TO service_role;

-- ============================================================================
-- RPC 4: Inventory Dashboard Summary (Admin/Manager Read)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_inventory_dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_low_stock_count integer;
    v_critical_alerts integer;
    v_pending_reorders integer;
    v_high_risk_parts jsonb;
BEGIN
    -- Permission gate (reuse C19 helper)
    IF NOT public._c19_allow_admin_or_service() THEN
        RAISE EXCEPTION 'Unauthorized: dashboard summary requires admin/manager/service role';
    END IF;
    
    -- Low stock count (available < 10)
    SELECT COUNT(*) INTO v_low_stock_count
    FROM inventory_stock_current
    WHERE available < 10;
    
    -- Critical alerts (unresolved)
    SELECT COUNT(*) INTO v_critical_alerts
    FROM inventory_alerts
    WHERE resolved_at IS NULL AND severity = 'critical';
    
    -- Pending reorders
    SELECT COUNT(*) INTO v_pending_reorders
    FROM reorder_recommendations
    WHERE status = 'proposed';
    
    -- High risk parts (top 5 by stockout risk)
    SELECT jsonb_agg(
        jsonb_build_object(
            'part_id', part_id,
            'location_id', location_id,
            'stockout_risk_score', stockout_risk_score,
            'recommended_qty', recommended_qty
        ) ORDER BY stockout_risk_score DESC
    )
    INTO v_high_risk_parts
    FROM (
        SELECT * FROM reorder_recommendations
        WHERE status = 'proposed'
        ORDER BY stockout_risk_score DESC
        LIMIT 5
    ) t;
    
    RETURN jsonb_build_object(
        'low_stock_count', v_low_stock_count,
        'critical_alerts', v_critical_alerts,
        'pending_reorders', v_pending_reorders,
        'high_risk_parts', COALESCE(v_high_risk_parts, '[]'::jsonb)
    );
END;
$$;

COMMENT ON FUNCTION public.rpc_inventory_dashboard_summary IS 'Fast admin dashboard summary: low stock, alerts, pending reorders, high risk parts';

GRANT EXECUTE ON FUNCTION public.rpc_inventory_dashboard_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_inventory_dashboard_summary TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'C19 Phase 2 migration completed successfully';
    RAISE NOTICE 'Created: part_demand_rollups_daily, inventory_forecast_snapshots, reorder_recommendations, inventory_alerts';
    RAISE NOTICE 'Created RPCs: rpc_compute_part_demand, rpc_compute_inventory_forecast, rpc_generate_reorder_recommendations, rpc_inventory_dashboard_summary';
    RAISE NOTICE 'C18 Integration: reorder recommendations use dealer_score_snapshots for supplier selection';
    RAISE NOTICE 'VFL Scoring: forecasts include confidence (0-100) + explainability (drivers + primary_reason)';
    RAISE NOTICE 'Approval Workflow: reorders require admin/manager approval (status=proposed by default)';
    RAISE NOTICE 'RLS enabled on all tables';
END $$;
