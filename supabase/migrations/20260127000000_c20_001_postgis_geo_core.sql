-- ============================================================================
-- C20 ExpansionOS - Phase 1: PostGIS Geo Core (V1.0)
-- JamesTronic Platform
-- ============================================================================
-- Purpose:
-- 1. Enable PostGIS extension for geographic data
-- 2. Create cities, geo_pincodes, competitor_locations, expansion_candidate_locations
-- 3. Implement multi-city capable RLS policies
-- 4. Add proper PostGIS types + GIST indexes
-- ============================================================================
-- Job ID: C20_PHASE1_GEO_CORE
-- Priority: P0
-- Date: 2026-01-27
-- ============================================================================

-- ============================================================================
-- STEP 0: Enable PostGIS Extension
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

COMMENT ON EXTENSION postgis IS 'PostGIS extension for geographic data types and functions';

-- ============================================================================
-- STEP 1: Helper Function for Multi-City RLS
-- ============================================================================
-- Design: Support multi-city managers via allowed_city_ids claim in JWT.
-- Falls back to city_id (single city) if allowed_city_ids not present.
-- Admins and service_role bypass city restrictions.

CREATE OR REPLACE FUNCTION public._c20_is_city_accessible(target_city_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_role text;
    v_allowed_cities uuid[];
    v_single_city uuid;
BEGIN
    -- Get role from JWT
    v_role := COALESCE(
        auth.jwt() ->> 'app_role',
        auth.jwt() ->> 'role',
        'anon'
    );
    
    -- Admins and service_role have full access
    IF v_role IN ('admin', 'super_admin', 'service_role') THEN
        RETURN true;
    END IF;
    
    -- Try to get allowed_city_ids array (multi-city support)
    BEGIN
        v_allowed_cities := ARRAY(
            SELECT jsonb_array_elements_text(
                (auth.jwt() -> 'app_metadata' -> 'allowed_city_ids')
            )::uuid
        );
    EXCEPTION WHEN OTHERS THEN
        v_allowed_cities := NULL;
    END;
    
    -- If allowed_city_ids exists, check if target city is in the list
    IF v_allowed_cities IS NOT NULL AND array_length(v_allowed_cities, 1) > 0 THEN
        RETURN target_city_id = ANY(v_allowed_cities);
    END IF;
    
    -- Fallback to single city_id claim
    v_single_city := (auth.jwt() -> 'app_metadata' ->> 'city_id')::uuid;
    IF v_single_city IS NOT NULL THEN
        RETURN target_city_id = v_single_city;
    END IF;
    
    -- No city access granted
    RETURN false;
END;
$$;

COMMENT ON FUNCTION public._c20_is_city_accessible(uuid) IS 
'Multi-city RLS helper: checks if current user can access the target city. Supports allowed_city_ids array or single city_id fallback.';

-- ============================================================================
-- STEP 2: Cities Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    state text,
    country text DEFAULT 'India',
    
    -- Geographic data (PostGIS types with SRID 4326 = WGS84)
    boundary geometry(MultiPolygon, 4326),
    centroid geography(Point, 4326),
    
    -- Metadata
    timezone text DEFAULT 'Asia/Kolkata',
    active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}',
    
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cities_name ON cities(name);
CREATE INDEX IF NOT EXISTS idx_cities_active ON cities(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_cities_boundary_gist ON cities USING GIST(boundary);
CREATE INDEX IF NOT EXISTS idx_cities_centroid_gist ON cities USING GIST(centroid);

COMMENT ON TABLE public.cities IS 'Geographic city boundaries for expansion planning';

-- ============================================================================
-- STEP 3: Geo Pincodes Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.geo_pincodes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    
    -- Pincode identity (stable keying)
    code text NOT NULL,
    name text, -- Optional friendly name
    
    -- Geographic data
    boundary geometry(MultiPolygon, 4326),
    centroid geography(Point, 4326),
    
    -- Metadata
    population_estimate integer,
    active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}',
    
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now(),
    
    -- Correction #3: Stable pincode identity
    CONSTRAINT uq_pincode_city_code UNIQUE(city_id, code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_geo_pincodes_city_id ON geo_pincodes(city_id);
CREATE INDEX IF NOT EXISTS idx_geo_pincodes_code ON geo_pincodes(code);
CREATE INDEX IF NOT EXISTS idx_geo_pincodes_active ON geo_pincodes(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_geo_pincodes_boundary_gist ON geo_pincodes USING GIST(boundary);
CREATE INDEX IF NOT EXISTS idx_geo_pincodes_centroid_gist ON geo_pincodes USING GIST(centroid);

COMMENT ON TABLE public.geo_pincodes IS 'Pincode polygons within cities for demand mapping';

-- ============================================================================
-- STEP 4: Competitor Locations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.competitor_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    
    -- Location
    location geography(Point, 4326) NOT NULL,
    
    -- Competitor info
    brand text NOT NULL,
    store_type text, -- 'service_center', 'retail', 'authorized_partner', etc.
    name text,
    address text,
    
    -- Intelligence
    estimated_capacity integer,
    service_categories text[], -- What they service
    notes text,
    metadata jsonb DEFAULT '{}',
    
    -- Audit
    source text, -- 'manual', 'scrape', 'partner_intel'
    verified_at timestamptz,
    active boolean DEFAULT true,
    
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_competitor_locations_city_id ON competitor_locations(city_id);
CREATE INDEX IF NOT EXISTS idx_competitor_locations_brand ON competitor_locations(brand);
CREATE INDEX IF NOT EXISTS idx_competitor_locations_location_gist ON competitor_locations USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_competitor_locations_active ON competitor_locations(active) WHERE active = true;

COMMENT ON TABLE public.competitor_locations IS 'Known competitor service points for competitive analysis';

-- ============================================================================
-- STEP 5: Expansion Candidate Locations Table
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'expansion_candidate_status'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.expansion_candidate_status AS ENUM (
      'identified',
      'under_evaluation',
      'shortlisted',
      'approved',
      'rejected',
      'launched'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.expansion_candidate_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    pincode_id uuid REFERENCES geo_pincodes(id) ON DELETE SET NULL,
    
    -- Location
    location geography(Point, 4326) NOT NULL,
    
    -- Candidate info
    name text NOT NULL,
    address text,
    property_type text, -- 'retail_space', 'warehouse', 'mall', etc.
    
    -- Status workflow
    status expansion_candidate_status DEFAULT 'identified',
    
    -- Scoring (populated by scenario runs)
    latest_score numeric(5, 2),
    latest_rank integer,
    latest_scenario_id uuid, -- FK added in Phase 2
    
    -- Cost/capacity estimates
    estimated_rent numeric(12, 2),
    estimated_capacity integer,
    estimated_setup_cost numeric(14, 2),
    
    -- Metadata
    source text, -- 'manual', 'ai_suggested', 'partner_referral'
    notes text,
    metadata jsonb DEFAULT '{}',
    
    -- Audit
    created_by uuid,
    approved_by uuid,
    approved_at timestamptz,
    
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expansion_candidates_city_id ON expansion_candidate_locations(city_id);
CREATE INDEX IF NOT EXISTS idx_expansion_candidates_pincode_id ON expansion_candidate_locations(pincode_id);
CREATE INDEX IF NOT EXISTS idx_expansion_candidates_status ON expansion_candidate_locations(status);
CREATE INDEX IF NOT EXISTS idx_expansion_candidates_location_gist ON expansion_candidate_locations USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_expansion_candidates_score ON expansion_candidate_locations(latest_score DESC NULLS LAST);

COMMENT ON TABLE public.expansion_candidate_locations IS 'Potential new service locations under evaluation';

-- ============================================================================
-- STEP 6: Enable RLS on All Tables
-- ============================================================================

ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_pincodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE expansion_candidate_locations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 7: RLS Policies - Cities
-- ============================================================================

-- Admin/Service: Full access
CREATE POLICY cities_admin_all ON cities
    FOR ALL
    TO authenticated, service_role
    USING (
        COALESCE(auth.jwt() ->> 'app_role', auth.jwt() ->> 'role', 'anon') 
        IN ('admin', 'super_admin', 'service_role')
    );

-- Manager: Read own city(ies) only
CREATE POLICY cities_manager_select ON cities
    FOR SELECT
    TO authenticated
    USING (
        _c20_is_city_accessible(id)
    );

-- ============================================================================
-- STEP 8: RLS Policies - Geo Pincodes
-- ============================================================================

-- Admin/Service: Full access
CREATE POLICY geo_pincodes_admin_all ON geo_pincodes
    FOR ALL
    TO authenticated, service_role
    USING (
        COALESCE(auth.jwt() ->> 'app_role', auth.jwt() ->> 'role', 'anon') 
        IN ('admin', 'super_admin', 'service_role')
    );

-- Manager: Read own city(ies) only
CREATE POLICY geo_pincodes_manager_select ON geo_pincodes
    FOR SELECT
    TO authenticated
    USING (
        _c20_is_city_accessible(city_id)
    );

-- ============================================================================
-- STEP 9: RLS Policies - Competitor Locations
-- ============================================================================

-- Admin/Service: Full access
CREATE POLICY competitor_locations_admin_all ON competitor_locations
    FOR ALL
    TO authenticated, service_role
    USING (
        COALESCE(auth.jwt() ->> 'app_role', auth.jwt() ->> 'role', 'anon') 
        IN ('admin', 'super_admin', 'service_role')
    );

-- Manager: Read own city(ies) only (competitor intel is sensitive)
CREATE POLICY competitor_locations_manager_select ON competitor_locations
    FOR SELECT
    TO authenticated
    USING (
        _c20_is_city_accessible(city_id)
    );

-- ============================================================================
-- STEP 10: RLS Policies - Expansion Candidate Locations
-- ============================================================================

-- Admin/Service: Full access
CREATE POLICY expansion_candidates_admin_all ON expansion_candidate_locations
    FOR ALL
    TO authenticated, service_role
    USING (
        COALESCE(auth.jwt() ->> 'app_role', auth.jwt() ->> 'role', 'anon') 
        IN ('admin', 'super_admin', 'service_role')
    );

-- Manager: Read own city(ies) only
CREATE POLICY expansion_candidates_manager_select ON expansion_candidate_locations
    FOR SELECT
    TO authenticated
    USING (
        _c20_is_city_accessible(city_id)
    );

-- Manager: Can create candidates in their city(ies)
CREATE POLICY expansion_candidates_manager_insert ON expansion_candidate_locations
    FOR INSERT
    TO authenticated
    WITH CHECK (
        _c20_is_city_accessible(city_id)
        AND COALESCE(auth.jwt() ->> 'app_role', auth.jwt() ->> 'role', 'anon') 
            IN ('manager', 'admin', 'super_admin')
    );

-- Manager: Can update candidates in their city(ies) (except approval fields)
CREATE POLICY expansion_candidates_manager_update ON expansion_candidate_locations
    FOR UPDATE
    TO authenticated
    USING (
        _c20_is_city_accessible(city_id)
        AND COALESCE(auth.jwt() ->> 'app_role', auth.jwt() ->> 'role', 'anon') 
            IN ('manager', 'admin', 'super_admin')
    );

-- ============================================================================
-- STEP 11: Audit Logging Helper
-- ============================================================================

CREATE OR REPLACE FUNCTION public._c20_log_access(
    p_table_name text,
    p_city_id uuid,
    p_action text,
    p_details jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert into ai_audit_log if it exists (from C15)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_audit_log') THEN
        INSERT INTO ai_audit_log (
            ai_module,
            event_type,
            payload,
            created_at
        ) VALUES (
            'expansion_os',
            'ACCESS_' || upper(p_action),
            jsonb_build_object(
                'table', p_table_name,
                'city_id', p_city_id,
                'user_id', auth.uid(),
                'role', COALESCE(auth.jwt() ->> 'app_role', auth.jwt() ->> 'role'),
                'details', p_details
            ),
            now()
        );
    END IF;
END;
$$;

COMMENT ON FUNCTION public._c20_log_access(text, uuid, text, jsonb) IS 
'Audit logging for C20 ExpansionOS table access';

-- ============================================================================
-- STEP 12: Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public._c20_is_city_accessible(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._c20_log_access(text, uuid, text, jsonb) TO authenticated, service_role;

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'C20 Phase 1: PostGIS Geo Core migration complete.';
    RAISE NOTICE 'Tables created: cities, geo_pincodes, competitor_locations, expansion_candidate_locations';
    RAISE NOTICE 'RLS enabled with multi-city support via _c20_is_city_accessible()';
    RAISE NOTICE 'GIST indexes added for all geographic columns';
END $$;
