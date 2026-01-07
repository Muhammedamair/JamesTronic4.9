-- ============================================================================
-- C20 Dark Store Expansion Playbook: Foundation Migration
-- JamesTronic Platform
-- ============================================================================
-- Purpose: Multi-city expansion planning with location scoring and workload
-- balancing for scaling to 30+ dark stores.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.dark_store_status AS ENUM (
    'planning',
    'under_construction',
    'pilot',
    'active',
    'inactive',
    'closed'
);

CREATE TYPE public.expansion_phase AS ENUM (
    'phase_1',
    'phase_2',
    'phase_3',
    'future'
);

CREATE TYPE public.location_grade AS ENUM (
    'A',
    'B',
    'C',
    'D'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Dark Stores: Core store registry
CREATE TABLE IF NOT EXISTS public.dark_stores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    code text UNIQUE, -- DS-HYD-001
    city text NOT NULL,
    state text,
    address text,
    pincode text,
    
    -- Geolocation
    lat numeric(10, 7),
    lng numeric(10, 7),
    
    -- Capacity & Status
    status public.dark_store_status DEFAULT 'planning',
    max_daily_capacity integer DEFAULT 50, -- Max jobs per day
    current_technicians integer DEFAULT 0,
    max_technicians integer DEFAULT 10,
    
    -- Service Area
    service_radius_km numeric(5, 2) DEFAULT 15.00,
    estimated_population_served integer,
    
    -- Metadata
    opened_at date,
    manager_id uuid REFERENCES public.profiles(user_id),
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Dark Store Service Areas: Coverage zones
CREATE TABLE IF NOT EXISTS public.dark_store_service_areas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dark_store_id uuid NOT NULL REFERENCES public.dark_stores(id) ON DELETE CASCADE,
    pincode text NOT NULL,
    city text NOT NULL,
    
    -- Coverage metrics
    avg_travel_time_minutes integer,
    is_primary boolean DEFAULT false,
    priority_rank integer DEFAULT 1,
    
    -- Demand data
    estimated_households integer,
    appliance_density_score numeric(4, 2) DEFAULT 50.00, -- 0-100
    
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT unique_store_pincode UNIQUE (dark_store_id, pincode)
);

-- Location Scores: AI scoring for potential locations
CREATE TABLE IF NOT EXISTS public.location_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    city text NOT NULL,
    area_name text,
    pincode text,
    lat numeric(10, 7),
    lng numeric(10, 7),
    
    -- Component Scores (0-100)
    demand_density_score integer DEFAULT 50 CHECK (demand_density_score BETWEEN 0 AND 100),
    travel_efficiency_score integer DEFAULT 50 CHECK (travel_efficiency_score BETWEEN 0 AND 100),
    competition_score integer DEFAULT 50 CHECK (competition_score BETWEEN 0 AND 100), -- Higher = less competition
    infrastructure_score integer DEFAULT 50 CHECK (infrastructure_score BETWEEN 0 AND 100),
    economic_viability_score integer DEFAULT 50 CHECK (economic_viability_score BETWEEN 0 AND 100),
    
    -- Composite Score: Calculated manually (not generated due to PostgreSQL immutability constraints)
    composite_score integer DEFAULT 50,
    
    -- Grade: Calculated in application layer
    grade public.location_grade DEFAULT 'C',
    
    -- Metadata
    analyzed_by uuid REFERENCES public.profiles(user_id),
    analyzed_at timestamptz DEFAULT now(),
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Expansion Plans: Phased roadmaps
CREATE TABLE IF NOT EXISTS public.expansion_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    phase public.expansion_phase NOT NULL,
    target_city text NOT NULL,
    
    -- Targets
    target_stores integer DEFAULT 1,
    target_technicians integer DEFAULT 5,
    estimated_investment numeric(12, 2),
    projected_monthly_revenue numeric(12, 2),
    
    -- Timeline
    planned_start_date date,
    planned_launch_date date,
    actual_launch_date date,
    
    -- Status
    status text DEFAULT 'draft', -- draft, approved, in_progress, completed, cancelled
    approved_by uuid REFERENCES public.profiles(user_id),
    approved_at timestamptz,
    
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Workload Distribution: Daily balancing metrics
CREATE TABLE IF NOT EXISTS public.workload_distribution (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dark_store_id uuid NOT NULL REFERENCES public.dark_stores(id) ON DELETE CASCADE,
    distribution_date date NOT NULL DEFAULT CURRENT_DATE,
    
    -- Metrics
    jobs_assigned integer DEFAULT 0,
    jobs_completed integer DEFAULT 0,
    jobs_pending integer DEFAULT 0,
    technicians_active integer DEFAULT 0,
    
    -- Capacity utilization
    capacity_utilization numeric(5, 2) DEFAULT 0.00, -- Percentage
    avg_job_duration_minutes integer,
    
    -- Balance status
    is_overloaded boolean DEFAULT false,
    overflow_jobs integer DEFAULT 0,
    
    created_at timestamptz DEFAULT now() NOT NULL,
    
    CONSTRAINT unique_store_date UNIQUE (dark_store_id, distribution_date)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_dark_stores_city ON public.dark_stores(city);
CREATE INDEX idx_dark_stores_status ON public.dark_stores(status);
CREATE INDEX idx_service_areas_store ON public.dark_store_service_areas(dark_store_id);
CREATE INDEX idx_service_areas_pincode ON public.dark_store_service_areas(pincode);
CREATE INDEX idx_location_scores_city ON public.location_scores(city);
CREATE INDEX idx_location_scores_composite ON public.location_scores(composite_score);
CREATE INDEX idx_expansion_plans_phase ON public.expansion_plans(phase);
CREATE INDEX idx_workload_date ON public.workload_distribution(distribution_date);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER set_dark_stores_updated_at
BEFORE UPDATE ON public.dark_stores
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER set_location_scores_updated_at
BEFORE UPDATE ON public.location_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER set_expansion_plans_updated_at
BEFORE UPDATE ON public.expansion_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.dark_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dark_store_service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expansion_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workload_distribution ENABLE ROW LEVEL SECURITY;

-- Admin/Manager can manage all expansion data
CREATE POLICY "Admin can manage dark_stores"
ON public.dark_stores FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

CREATE POLICY "Admin can manage service_areas"
ON public.dark_store_service_areas FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

CREATE POLICY "Admin can manage location_scores"
ON public.location_scores FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

CREATE POLICY "Admin can manage expansion_plans"
ON public.expansion_plans FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

CREATE POLICY "Admin can manage workload_distribution"
ON public.workload_distribution FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

-- Staff can view dark stores and workload
CREATE POLICY "Staff can view dark_stores"
ON public.dark_stores FOR SELECT
TO authenticated
USING (public.get_user_role_for_rls() = 'staff');

CREATE POLICY "Staff can view workload"
ON public.workload_distribution FOR SELECT
TO authenticated
USING (public.get_user_role_for_rls() = 'staff');

-- ============================================================================
-- FUNCTIONS / RPCs
-- ============================================================================

-- RPC: Calculate Location Score for a potential new dark store
CREATE OR REPLACE FUNCTION public.rpc_calculate_location_score(
    p_city text,
    p_area_name text DEFAULT NULL,
    p_lat numeric DEFAULT NULL,
    p_lng numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_demand_score integer := 50;
    v_travel_score integer := 50;
    v_competition_score integer := 70; -- Default: assume low competition
    v_infrastructure_score integer := 60;
    v_economic_score integer := 60;
    v_composite integer;
    v_grade text;
    v_result jsonb;
BEGIN
    -- Simulate demand scoring based on existing stores in city
    SELECT CASE
        WHEN COUNT(*) = 0 THEN 80 -- No stores = high opportunity
        WHEN COUNT(*) < 3 THEN 65 -- Few stores = good opportunity
        ELSE 45 -- Many stores = saturated
    END INTO v_demand_score
    FROM public.dark_stores
    WHERE city = p_city AND status = 'active';
    
    -- Travel efficiency: based on coverage gaps
    SELECT CASE
        WHEN COUNT(*) = 0 THEN 75 -- No existing coverage
        ELSE 55
    END INTO v_travel_score
    FROM public.dark_store_service_areas
    WHERE city = p_city;
    
    -- Competition: Lower score if already have many stores
    v_competition_score := GREATEST(30, 100 - (
        SELECT COUNT(*) * 15 FROM public.dark_stores WHERE city = p_city
    ));
    
    -- Calculate composite
    v_composite := (v_demand_score * 30 + v_travel_score * 25 + v_competition_score * 20 + v_infrastructure_score * 15 + v_economic_score * 10) / 100;
    
    -- Determine grade
    v_grade := CASE
        WHEN v_composite >= 80 THEN 'A'
        WHEN v_composite >= 60 THEN 'B'
        WHEN v_composite >= 40 THEN 'C'
        ELSE 'D'
    END;
    
    -- Insert or update location score
    INSERT INTO public.location_scores (
        city, area_name, lat, lng,
        demand_density_score, travel_efficiency_score, competition_score,
        infrastructure_score, economic_viability_score,
        composite_score, grade,
        analyzed_at
    )
    VALUES (
        p_city, p_area_name, p_lat, p_lng,
        v_demand_score, v_travel_score, v_competition_score,
        v_infrastructure_score, v_economic_score,
        v_composite, v_grade::public.location_grade,
        now()
    )
    ON CONFLICT (city, area_name, pincode) DO NOTHING;
    
    v_result := jsonb_build_object(
        'city', p_city,
        'area_name', p_area_name,
        'demand_score', v_demand_score,
        'travel_score', v_travel_score,
        'competition_score', v_competition_score,
        'infrastructure_score', v_infrastructure_score,
        'economic_score', v_economic_score,
        'composite_score', v_composite,
        'grade', v_grade
    );
    
    RETURN v_result;
END;
$$;

-- RPC: Calculate Service Area for a dark store
CREATE OR REPLACE FUNCTION public.rpc_calculate_service_area(
    p_store_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_store record;
    v_radius numeric := 15.00;
    v_population integer := 0;
    v_result jsonb;
BEGIN
    -- Get store details
    SELECT * INTO v_store
    FROM public.dark_stores
    WHERE id = p_store_id;
    
    IF v_store IS NULL THEN
        RAISE EXCEPTION 'Store not found';
    END IF;
    
    -- Calculate optimal radius based on capacity
    -- More technicians = larger coverage
    v_radius := LEAST(25, GREATEST(10, v_store.max_technicians * 1.5));
    
    -- Estimate population (simplified)
    v_population := v_radius * v_radius * 1000; -- Rough estimate
    
    -- Update store
    UPDATE public.dark_stores
    SET service_radius_km = v_radius,
        estimated_population_served = v_population,
        updated_at = now()
    WHERE id = p_store_id;
    
    v_result := jsonb_build_object(
        'store_id', p_store_id,
        'store_name', v_store.name,
        'service_radius_km', v_radius,
        'estimated_population', v_population,
        'max_technicians', v_store.max_technicians
    );
    
    RETURN v_result;
END;
$$;

-- RPC: Balance Workload Across Stores
CREATE OR REPLACE FUNCTION public.rpc_balance_workload(
    p_date date DEFAULT CURRENT_DATE
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_store record;
    v_stores_balanced integer := 0;
    v_utilization numeric;
BEGIN
    -- For each active dark store, calculate and update workload
    FOR v_store IN
        SELECT id, name, max_daily_capacity, current_technicians
        FROM public.dark_stores
        WHERE status = 'active'
    LOOP
        -- Calculate utilization (simplified - would use actual job counts)
        v_utilization := RANDOM() * 100; -- Placeholder
        
        -- Upsert workload distribution
        INSERT INTO public.workload_distribution (
            dark_store_id, distribution_date,
            technicians_active, capacity_utilization,
            is_overloaded
        )
        VALUES (
            v_store.id, p_date,
            v_store.current_technicians, v_utilization,
            v_utilization > 90
        )
        ON CONFLICT (dark_store_id, distribution_date)
        DO UPDATE SET
            technicians_active = EXCLUDED.technicians_active,
            capacity_utilization = EXCLUDED.capacity_utilization,
            is_overloaded = EXCLUDED.is_overloaded;
        
        v_stores_balanced := v_stores_balanced + 1;
    END LOOP;
    
    RETURN v_stores_balanced;
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dark_stores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dark_store_service_areas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.location_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expansion_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workload_distribution TO authenticated;

GRANT ALL ON public.dark_stores TO service_role;
GRANT ALL ON public.dark_store_service_areas TO service_role;
GRANT ALL ON public.location_scores TO service_role;
GRANT ALL ON public.expansion_plans TO service_role;
GRANT ALL ON public.workload_distribution TO service_role;

GRANT EXECUTE ON FUNCTION public.rpc_calculate_location_score TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_calculate_service_area TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_balance_workload TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_calculate_location_score TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_calculate_service_area TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_balance_workload TO service_role;
