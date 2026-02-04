-- ============================================================================
-- C20 ExpansionOS - Phase 2: Demand & Travel Cache (V1.0)
-- JamesTronic Platform
-- ============================================================================
-- Purpose:
-- 1. Create demand_points_daily (heatmap base data)
-- 2. Create travel_time_matrix_cache (store/candidate -> pincode routing)
-- 3. Enforce strict uniqueness and foreign key constraints
-- 4. Apply RLS: Manager SELECT (city-scoped), Admin/Service FULL
-- ============================================================================
-- Job ID: C20_PHASE2_CACHE_LAYERS
-- Priority: P0
-- Date: 2026-01-27
-- ============================================================================

-- ============================================================================
-- STEP 1: Demand Points Daily (Heatmap Base)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.demand_points_daily (
    -- Composite Primary Key
    day date NOT NULL,
    city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    pincode_id uuid NOT NULL REFERENCES geo_pincodes(id) ON DELETE CASCADE,
    device_category text NOT NULL, -- 'smartphone', 'laptop', etc.
    
    -- Measures
    ticket_count integer DEFAULT 0,
    gross_revenue_inr numeric(12, 2) DEFAULT 0,
    
    -- Metadata
    updated_at timestamptz DEFAULT now(),
    
    PRIMARY KEY (day, city_id, pincode_id, device_category)
);

-- Indexes for heatmap queries
CREATE INDEX IF NOT EXISTS idx_demand_points_city_day ON demand_points_daily(city_id, day);
CREATE INDEX IF NOT EXISTS idx_demand_points_pincode ON demand_points_daily(pincode_id);

COMMENT ON TABLE public.demand_points_daily IS 'Daily aggregated demand by pincode and category for heatmaps';

-- ============================================================================
-- STEP 2: Travel Time Matrix Cache (Routing Intelligence)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.travel_time_matrix_cache (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    
    -- Origin: Exactly ONE of from_store_id or from_candidate_id must be set
    -- Note: referencing inventory_locations(id) for stores
    from_store_id uuid REFERENCES inventory_locations(id) ON DELETE CASCADE,
    from_candidate_id uuid REFERENCES expansion_candidate_locations(id) ON DELETE CASCADE,
    
    -- Destination
    to_pincode_id uuid NOT NULL REFERENCES geo_pincodes(id) ON DELETE CASCADE,
    
    -- Time Bucket (0-23 hours)
    hour_bucket smallint NOT NULL CHECK (hour_bucket >= 0 AND hour_bucket <= 23),
    
    -- Metrics
    eta_median_minutes numeric(6, 2),
    eta_p90_minutes numeric(6, 2),
    distance_km numeric(6, 2),
    
    updated_at timestamptz DEFAULT now(),
    
    -- Constraint: Exactly one origin
    CONSTRAINT check_travel_origin_one_of CHECK (
        (from_store_id IS NOT NULL AND from_candidate_id IS NULL) OR
        (from_store_id IS NULL AND from_candidate_id IS NOT NULL)
    ),
    
    -- Constraint: Unique cache entry
    CONSTRAINT uq_travel_matrix_entry UNIQUE NULLS NOT DISTINCT (
        city_id, 
        from_store_id, 
        from_candidate_id, 
        to_pincode_id, 
        hour_bucket
    )
);

-- Indexes for routing lookups
CREATE INDEX IF NOT EXISTS idx_travel_matrix_city_bucket ON travel_time_matrix_cache(city_id, hour_bucket);
CREATE INDEX IF NOT EXISTS idx_travel_matrix_from_store ON travel_time_matrix_cache(from_store_id) WHERE from_store_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_travel_matrix_from_candidate ON travel_time_matrix_cache(from_candidate_id) WHERE from_candidate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_travel_matrix_to_pincode ON travel_time_matrix_cache(to_pincode_id);

COMMENT ON TABLE public.travel_time_matrix_cache IS 'Cached travel times (store/candidate -> pincode) by hour of day';

-- ============================================================================
-- STEP 3: RLS Policies - Demand Points Daily
-- ============================================================================

ALTER TABLE demand_points_daily ENABLE ROW LEVEL SECURITY;

-- Manager: Read own city only
CREATE POLICY demand_points_manager_select ON demand_points_daily
    FOR SELECT
    TO authenticated
    USING (
        _c20_is_city_accessible(city_id)
    );

-- Admin/Service: Full access + Write
CREATE POLICY demand_points_admin_all ON demand_points_daily
    FOR ALL
    TO authenticated, service_role
    USING (
        _c20_app_role() IN ('admin', 'super_admin') OR auth.role() = 'service_role'
    );

-- ============================================================================
-- STEP 4: RLS Policies - Travel Time Matrix Cache
-- ============================================================================

ALTER TABLE travel_time_matrix_cache ENABLE ROW LEVEL SECURITY;

-- Manager: Read own city only
CREATE POLICY travel_matrix_manager_select ON travel_time_matrix_cache
    FOR SELECT
    TO authenticated
    USING (
        _c20_is_city_accessible(city_id)
    );

-- Admin/Service: Full access + Write
CREATE POLICY travel_matrix_admin_all ON travel_time_matrix_cache
    FOR ALL
    TO authenticated, service_role
    USING (
        _c20_app_role() IN ('admin', 'super_admin') OR auth.role() = 'service_role'
    );

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'C20 Phase 2: Demand & Travel Cache migration complete.';
    RAISE NOTICE 'Tables: demand_points_daily, travel_time_matrix_cache';
    RAISE NOTICE 'Constraints: strict unique keys and origin checks applied';
    RAISE NOTICE 'RLS: Manager read-only (city-scoped), Admin/Service full';
END $$;
