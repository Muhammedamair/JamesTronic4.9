-- ============================================================================
-- C19 Inventory Prediction Engine: Foundation Migration
-- JamesTronic Platform
-- ============================================================================
-- Purpose: AI-powered inventory prediction for parts demand forecasting.
-- Creates tables for forecasts, safety stock, turnover metrics, and alerts.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.forecast_confidence AS ENUM (
    'low',
    'medium',
    'high',
    'very_high'
);

CREATE TYPE public.alert_priority AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);

CREATE TYPE public.forecast_horizon AS ENUM (
    'daily',
    'weekly',
    'monthly',
    'quarterly'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Parts Demand Forecasts: AI-generated predictions
CREATE TABLE IF NOT EXISTS public.parts_demand_forecasts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    part_category text NOT NULL, -- TV Backlight, AC Compressor, etc.
    brand text,
    model_pattern text, -- Regex or pattern for model matching
    location_id uuid, -- Dark store or city ID (nullable for global)
    city text,
    
    forecast_date date NOT NULL DEFAULT CURRENT_DATE,
    horizon public.forecast_horizon DEFAULT 'weekly',
    
    predicted_demand integer NOT NULL DEFAULT 0,
    confidence public.forecast_confidence DEFAULT 'medium',
    confidence_score numeric(5,2) DEFAULT 70.00, -- 0-100 scale
    
    -- Factors used in prediction
    historical_avg numeric(10,2),
    seasonal_factor numeric(4,2) DEFAULT 1.00, -- Multiplier
    growth_trend numeric(4,2) DEFAULT 1.00,
    brand_factor numeric(4,2) DEFAULT 1.00,
    
    -- Actuals for validation
    actual_demand integer,
    forecast_error numeric(10,2),
    
    model_version text DEFAULT 'v1.0',
    generated_at timestamptz DEFAULT now() NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Safety Stock Levels: Optimal minimum stock per part/location
CREATE TABLE IF NOT EXISTS public.safety_stock_levels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    part_category text NOT NULL,
    brand text,
    location_id uuid,
    city text,
    
    current_stock integer DEFAULT 0,
    safety_stock integer NOT NULL DEFAULT 5,
    reorder_point integer NOT NULL DEFAULT 10,
    max_stock integer DEFAULT 50,
    
    -- Calculation inputs
    avg_daily_demand numeric(10,2) DEFAULT 1.00,
    lead_time_days integer DEFAULT 3,
    service_level_target numeric(4,2) DEFAULT 95.00, -- 95% = Z-score 1.65
    demand_std_dev numeric(10,2) DEFAULT 0.5,
    lead_time_std_dev numeric(10,2) DEFAULT 0.5,
    
    last_calculated_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    
    CONSTRAINT unique_safety_stock UNIQUE (part_category, brand, location_id, city)
);

-- Inventory Turnover Metrics: Performance tracking
CREATE TABLE IF NOT EXISTS public.inventory_turnover_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    part_category text NOT NULL,
    location_id uuid,
    city text,
    metric_date date NOT NULL DEFAULT CURRENT_DATE,
    
    turnover_rate numeric(6,2), -- Annual turnover rate
    days_on_hand numeric(6,2), -- Avg days in inventory
    fill_rate numeric(5,2), -- % of demand fulfilled from stock
    stockout_days integer DEFAULT 0,
    
    cost_of_goods_sold numeric(12,2),
    avg_inventory_value numeric(12,2),
    
    created_at timestamptz DEFAULT now() NOT NULL,
    
    CONSTRAINT unique_turnover_metric UNIQUE (part_category, location_id, city, metric_date)
);

-- Seasonal Patterns: Historical demand patterns
CREATE TABLE IF NOT EXISTS public.seasonal_patterns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    part_category text NOT NULL,
    month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
    
    demand_index numeric(4,2) DEFAULT 1.00, -- 1.0 = average, 1.5 = 50% higher
    confidence public.forecast_confidence DEFAULT 'medium',
    sample_size integer DEFAULT 0, -- Data points used
    
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    
    CONSTRAINT unique_seasonal_pattern UNIQUE (part_category, month)
);

-- Emergency Stock Triggers: Low stock alerts
CREATE TABLE IF NOT EXISTS public.emergency_stock_triggers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    part_category text NOT NULL,
    brand text,
    location_id uuid,
    city text,
    
    current_stock integer NOT NULL,
    safety_stock integer NOT NULL,
    shortfall integer GENERATED ALWAYS AS (safety_stock - current_stock) STORED,
    
    priority public.alert_priority DEFAULT 'medium',
    is_resolved boolean DEFAULT false,
    resolved_at timestamptz,
    resolved_by uuid REFERENCES public.profiles(user_id),
    
    -- Auto-order suggestion
    suggested_order_qty integer,
    suggested_dealer_id uuid REFERENCES public.dealers(id),
    
    triggered_at timestamptz DEFAULT now() NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_forecasts_category ON public.parts_demand_forecasts(part_category);
CREATE INDEX idx_forecasts_city ON public.parts_demand_forecasts(city);
CREATE INDEX idx_forecasts_date ON public.parts_demand_forecasts(forecast_date);
CREATE INDEX idx_safety_stock_category ON public.safety_stock_levels(part_category);
CREATE INDEX idx_safety_stock_city ON public.safety_stock_levels(city);
CREATE INDEX idx_turnover_date ON public.inventory_turnover_metrics(metric_date);
CREATE INDEX idx_emergency_unresolved ON public.emergency_stock_triggers(is_resolved) WHERE is_resolved = false;
CREATE INDEX idx_emergency_priority ON public.emergency_stock_triggers(priority);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER set_forecasts_updated_at
BEFORE UPDATE ON public.parts_demand_forecasts
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER set_safety_stock_updated_at
BEFORE UPDATE ON public.safety_stock_levels
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER set_seasonal_updated_at
BEFORE UPDATE ON public.seasonal_patterns
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.parts_demand_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_turnover_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonal_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_stock_triggers ENABLE ROW LEVEL SECURITY;

-- Admin/Staff can manage all inventory data
CREATE POLICY "Admin can manage forecasts"
ON public.parts_demand_forecasts FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'staff', 'manager'));

CREATE POLICY "Admin can manage safety_stock"
ON public.safety_stock_levels FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'staff', 'manager'));

CREATE POLICY "Admin can manage turnover_metrics"
ON public.inventory_turnover_metrics FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'staff', 'manager'));

CREATE POLICY "Admin can manage seasonal_patterns"
ON public.seasonal_patterns FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'staff', 'manager'));

CREATE POLICY "Admin can manage emergency_triggers"
ON public.emergency_stock_triggers FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'staff', 'manager'));

-- ============================================================================
-- FUNCTIONS / RPCs
-- ============================================================================

-- RPC: Calculate Safety Stock using statistical formula
CREATE OR REPLACE FUNCTION public.rpc_calculate_safety_stock(
    p_part_category text,
    p_city text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_avg_demand numeric := 1.0;
    v_demand_std numeric := 0.5;
    v_lead_time integer := 3;
    v_lead_time_std numeric := 0.5;
    v_service_level numeric := 95.0;
    v_z_score numeric := 1.65; -- For 95% service level
    v_safety_stock integer;
    v_reorder_point integer;
    v_result jsonb;
BEGIN
    -- Get historical demand data (simplified - would use actual ticket/order data)
    -- For now, use existing safety stock data or defaults
    SELECT 
        COALESCE(avg_daily_demand, 1.0),
        COALESCE(demand_std_dev, 0.5),
        COALESCE(lead_time_days, 3),
        COALESCE(lead_time_std_dev, 0.5)
    INTO v_avg_demand, v_demand_std, v_lead_time, v_lead_time_std
    FROM public.safety_stock_levels
    WHERE part_category = p_part_category
      AND (city = p_city OR (p_city IS NULL AND city IS NULL))
    LIMIT 1;

    -- Calculate safety stock using the formula:
    -- SS = Z × √(LT × σD² + D² × σLT²)
    v_safety_stock := CEIL(
        v_z_score * SQRT(
            v_lead_time * POWER(v_demand_std, 2) + 
            POWER(v_avg_demand, 2) * POWER(v_lead_time_std, 2)
        )
    );
    
    -- Reorder point = (Average Demand × Lead Time) + Safety Stock
    v_reorder_point := CEIL(v_avg_demand * v_lead_time) + v_safety_stock;

    -- Upsert the calculation
    INSERT INTO public.safety_stock_levels (
        part_category, city, safety_stock, reorder_point,
        avg_daily_demand, demand_std_dev, lead_time_days, lead_time_std_dev,
        service_level_target, last_calculated_at
    )
    VALUES (
        p_part_category, p_city, v_safety_stock, v_reorder_point,
        v_avg_demand, v_demand_std, v_lead_time, v_lead_time_std,
        v_service_level, now()
    )
    ON CONFLICT (part_category, brand, location_id, city)
    DO UPDATE SET
        safety_stock = EXCLUDED.safety_stock,
        reorder_point = EXCLUDED.reorder_point,
        last_calculated_at = now(),
        updated_at = now();

    v_result := jsonb_build_object(
        'part_category', p_part_category,
        'city', p_city,
        'safety_stock', v_safety_stock,
        'reorder_point', v_reorder_point,
        'avg_daily_demand', v_avg_demand,
        'lead_time_days', v_lead_time,
        'service_level', v_service_level
    );
    
    RETURN v_result;
END;
$$;

-- RPC: Check and Create Emergency Stock Alerts
CREATE OR REPLACE FUNCTION public.rpc_check_emergency_stock()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_alerts_created integer := 0;
    v_record record;
BEGIN
    -- Find all parts where current_stock < safety_stock
    FOR v_record IN
        SELECT 
            part_category, brand, location_id, city,
            current_stock, safety_stock
        FROM public.safety_stock_levels
        WHERE current_stock < safety_stock
          AND NOT EXISTS (
              SELECT 1 FROM public.emergency_stock_triggers est
              WHERE est.part_category = safety_stock_levels.part_category
                AND est.city = safety_stock_levels.city
                AND est.is_resolved = false
          )
    LOOP
        -- Create alert
        INSERT INTO public.emergency_stock_triggers (
            part_category, brand, location_id, city,
            current_stock, safety_stock,
            priority, suggested_order_qty
        )
        VALUES (
            v_record.part_category, v_record.brand, v_record.location_id, v_record.city,
            v_record.current_stock, v_record.safety_stock,
            CASE 
                WHEN v_record.current_stock = 0 THEN 'critical'
                WHEN v_record.current_stock < v_record.safety_stock / 2 THEN 'high'
                ELSE 'medium'
            END,
            v_record.safety_stock - v_record.current_stock + 5 -- Order to safety + buffer
        );
        
        v_alerts_created := v_alerts_created + 1;
    END LOOP;
    
    RETURN v_alerts_created;
END;
$$;

-- RPC: Generate Simple Demand Forecast
CREATE OR REPLACE FUNCTION public.rpc_generate_demand_forecast(
    p_part_category text,
    p_city text DEFAULT NULL,
    p_horizon_days integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_historical_avg numeric := 2.0;
    v_seasonal_factor numeric := 1.0;
    v_predicted_demand integer;
    v_confidence text := 'medium';
    v_result jsonb;
BEGIN
    -- Get seasonal factor for current month
    SELECT COALESCE(demand_index, 1.0)
    INTO v_seasonal_factor
    FROM public.seasonal_patterns
    WHERE part_category = p_part_category
      AND month = EXTRACT(MONTH FROM CURRENT_DATE);

    -- Simple forecast: historical avg × seasonal factor × horizon
    v_predicted_demand := CEIL(v_historical_avg * v_seasonal_factor * p_horizon_days);
    
    -- Confidence based on data availability
    v_confidence := CASE
        WHEN v_seasonal_factor != 1.0 THEN 'high'
        ELSE 'medium'
    END;

    -- Store forecast
    INSERT INTO public.parts_demand_forecasts (
        part_category, city, forecast_date, horizon,
        predicted_demand, confidence, historical_avg, seasonal_factor
    )
    VALUES (
        p_part_category, p_city, CURRENT_DATE,
        CASE WHEN p_horizon_days <= 7 THEN 'weekly' ELSE 'monthly' END,
        v_predicted_demand, v_confidence::forecast_confidence, v_historical_avg, v_seasonal_factor
    );

    v_result := jsonb_build_object(
        'part_category', p_part_category,
        'city', p_city,
        'horizon_days', p_horizon_days,
        'predicted_demand', v_predicted_demand,
        'confidence', v_confidence,
        'seasonal_factor', v_seasonal_factor
    );
    
    RETURN v_result;
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parts_demand_forecasts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_stock_levels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_turnover_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seasonal_patterns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_stock_triggers TO authenticated;

GRANT ALL ON public.parts_demand_forecasts TO service_role;
GRANT ALL ON public.safety_stock_levels TO service_role;
GRANT ALL ON public.inventory_turnover_metrics TO service_role;
GRANT ALL ON public.seasonal_patterns TO service_role;
GRANT ALL ON public.emergency_stock_triggers TO service_role;

GRANT EXECUTE ON FUNCTION public.rpc_calculate_safety_stock TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_check_emergency_stock TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_generate_demand_forecast TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_calculate_safety_stock TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_check_emergency_stock TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_generate_demand_forecast TO service_role;
