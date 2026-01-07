-- ============================================================================
-- C29 Supply Chain Optimizer AI: Foundation Migration (Revised)
-- JamesTronic Platform
-- ============================================================================
-- Purpose: Forecast parts demand, predict stockouts, and recommend inventory.
-- FIX: Now includes creation of inventory_parts and inventory_items since
-- they were not present in previous chapters (C19 used text fields).
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.forecast_period AS ENUM (
    'daily',
    'weekly',
    'monthly'
);

CREATE TYPE public.stockout_risk_level AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);

CREATE TYPE public.recommendation_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'ordered'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- [NEW] Master Parts Catalog
CREATE TABLE IF NOT EXISTS public.inventory_parts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sku text UNIQUE NOT NULL,
    name text NOT NULL,
    category text, -- e.g. "TV Backlight"
    brand text,
    description text,
    
    cost_price numeric(10, 2),
    updated_at timestamptz DEFAULT now() NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- [NEW] Inventory Items (Stock at specific stores)
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id uuid REFERENCES public.inventory_parts(id) NOT NULL,
    store_id uuid REFERENCES public.dark_stores(id) NOT NULL,
    
    quantity integer DEFAULT 0,
    min_stock_level integer DEFAULT 5, -- Safety stock
    max_stock_level integer DEFAULT 50,
    
    aisle_location text,
    updated_at timestamptz DEFAULT now() NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    
    CONSTRAINT unique_store_part UNIQUE (store_id, part_id)
);

-- Inventory Forecasts: Predicted demand
CREATE TABLE IF NOT EXISTS public.inventory_forecasts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    part_id uuid REFERENCES public.inventory_parts(id) NOT NULL,
    store_id uuid REFERENCES public.dark_stores(id) NOT NULL,
    
    forecast_date date NOT NULL, -- The date/week being predicted
    period public.forecast_period DEFAULT 'weekly',
    
    predicted_quantity integer NOT NULL,
    confidence_score numeric(3, 2), -- 0.0-1.0
    
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Stockout Alerts: Warnings for potential shortages
CREATE TABLE IF NOT EXISTS public.stockout_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    part_id uuid REFERENCES public.inventory_parts(id) NOT NULL,
    store_id uuid REFERENCES public.dark_stores(id) NOT NULL,
    
    risk_level public.stockout_risk_level DEFAULT 'medium',
    predicted_stockout_date date,
    
    current_stock integer NOT NULL,
    predicted_demand_next_7_days integer NOT NULL,
    
    is_resolved boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Procurement Recommendations: Smart ordering logic
CREATE TABLE IF NOT EXISTS public.procurement_recommendations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    part_id uuid REFERENCES public.inventory_parts(id) NOT NULL,
    target_store_id uuid REFERENCES public.dark_stores(id) NOT NULL,
    
    recommended_dealer_id uuid REFERENCES public.dealers(id),
    recommended_quantity integer NOT NULL,
    estimated_cost numeric(10, 2),
    
    reason text, -- "Stockout predicted in 3 days based on seasonal demand"
    status public.recommendation_status DEFAULT 'pending',
    
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Part Seasonality Rules: Adjustments for seasons
CREATE TABLE IF NOT EXISTS public.part_seasonality_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    category_id uuid, -- Applies to whole category or specific part (if matches part catalog category string)
    season_name text, -- "Summer", "Monsoon"
    multiplier numeric(3, 2) DEFAULT 1.0, -- 1.5 = +50% demand
    
    start_month integer, -- 1-12
    end_month integer, -- 1-12
    
    is_active boolean DEFAULT true
);

-- ============================================================================
-- SEED DATA (Mock Parts)
-- ============================================================================
-- Insert some dummy parts so the simulation works immediately
INSERT INTO public.inventory_parts (sku, name, category, brand, cost_price)
VALUES 
    ('TV-LED-32', '32 Inch LED Backlight Strip', 'TV', 'Sony', 450.00),
    ('AC-COMP-1T', '1 Ton AC Compressor', 'AC', 'LG', 4500.00),
    ('WM-MOTOR-FL', 'Front Load Motor', 'Washing Machine', 'Samsung', 2200.00),
    ('MW-MAG-01', 'Microwave Magnetron', 'Microwave', 'IFB', 850.00)
ON CONFLICT (sku) DO NOTHING;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_inventory_store ON public.inventory_items(store_id);
CREATE INDEX idx_forecasts_store_part ON public.inventory_forecasts(store_id, part_id);
CREATE INDEX idx_alerts_unresolved ON public.stockout_alerts(store_id) WHERE is_resolved = false;
CREATE INDEX idx_recs_status ON public.procurement_recommendations(status);

-- ============================================================================
-- FUNCTIONS / RPCs
-- ============================================================================

-- RPC: Generate Store Replenishment Forecast (Simulation)
CREATE OR REPLACE FUNCTION public.rpc_generate_store_replenishment_forecast(
    p_store_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_part RECORD;
    v_forecast_qty integer;
    v_current_stock integer;
    v_risk_level public.stockout_risk_level;
BEGIN
    -- Loop through active parts in catalog (simulate presence in store)
    
    FOR v_part IN 
        SELECT p.id, p.name, COALESCE(i.quantity, 0) as stock 
        FROM public.inventory_parts p
        LEFT JOIN public.inventory_items i ON i.part_id = p.id AND i.store_id = p_store_id
    LOOP
        -- 1. Simulate Demand (Random for now, normally based on history)
        v_forecast_qty := floor(random() * 20) + 1; -- 1 to 20 units per week
        
        -- 2. Insert Forecast
        INSERT INTO public.inventory_forecasts (part_id, store_id, forecast_date, predicted_quantity, confidence_score)
        VALUES (v_part.id, p_store_id, CURRENT_DATE + interval '7 days', v_forecast_qty, 0.85);
        
        -- 3. Check Stockout Risk
        v_current_stock := v_part.stock;
        
        IF v_current_stock < v_forecast_qty THEN
            -- Risk!
            IF v_current_stock = 0 THEN v_risk_level := 'critical';
            ELSIF v_current_stock < (v_forecast_qty * 0.3) THEN v_risk_level := 'high';
            ELSE v_risk_level := 'medium';
            END IF;
            
            INSERT INTO public.stockout_alerts (
                part_id, store_id, risk_level, current_stock, predicted_demand_next_7_days, predicted_stockout_date
            )
            VALUES (
                v_part.id, p_store_id, v_risk_level, v_current_stock, v_forecast_qty, CURRENT_DATE + interval '3 days'
            );
            
            -- 4. Generate Recommendation
            INSERT INTO public.procurement_recommendations (
                part_id, target_store_id, recommended_quantity, reason
            )
            VALUES (
                v_part.id, p_store_id, (v_forecast_qty * 2) - v_current_stock, -- Target 2 weeks cover
                format('Predicted stockout. Demand: %s, Stock: %s', v_forecast_qty, v_current_stock)
            );
        END IF;
    END LOOP;
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT ALL ON public.inventory_parts TO authenticated;
GRANT ALL ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_forecasts TO authenticated;
GRANT ALL ON public.stockout_alerts TO authenticated;
GRANT ALL ON public.procurement_recommendations TO authenticated;
GRANT ALL ON public.part_seasonality_rules TO authenticated;

GRANT ALL ON public.inventory_parts TO service_role;
GRANT ALL ON public.inventory_items TO service_role;
GRANT ALL ON public.inventory_forecasts TO service_role;
GRANT ALL ON public.stockout_alerts TO service_role;
GRANT ALL ON public.procurement_recommendations TO service_role;
GRANT ALL ON public.part_seasonality_rules TO service_role;

GRANT EXECUTE ON FUNCTION public.rpc_generate_store_replenishment_forecast TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_generate_store_replenishment_forecast TO service_role;
