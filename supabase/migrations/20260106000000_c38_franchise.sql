-- ============================================================================
-- C38 National Expansion & Franchise Intelligence: Database Infrastructure
-- JamesTronic Platform
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.territory_status AS ENUM (
    'analyzing',
    'open_for_franchise',
    'assigned',
    'active',
    'saturated'
);

CREATE TYPE public.application_status AS ENUM (
    'new',
    'screening',
    'interview',
    'approved',
    'rejected',
    'onboarding'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. Franchise Territories: Expansion Zones
CREATE TABLE IF NOT EXISTS public.franchise_territories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,        -- e.g. "Mumbai - Andheri West"
    city text NOT NULL,
    pin_codes text[] DEFAULT '{}',
    
    status public.territory_status DEFAULT 'analyzing',
    
    density_score integer DEFAULT 0, -- 0-100 (Heatmap value)
    estimated_revenue_potential numeric(10, 2) DEFAULT 0.00,
    required_investment numeric(10, 2) DEFAULT 0.00,
    
    created_at timestamptz DEFAULT now()
);

-- 2. Franchise Applications: Pipeline
CREATE TABLE IF NOT EXISTS public.franchise_applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    territory_id uuid REFERENCES public.franchise_territories(id),
    
    applicant_name text NOT NULL,
    email text NOT NULL,
    phone text,
    
    status public.application_status DEFAULT 'new',
    
    financial_score integer DEFAULT 0, -- 0-100
    experience_score integer DEFAULT 0, -- 0-100
    location_score integer DEFAULT 0, -- 0-100
    
    notes text,
    documents_url text[],
    
    applied_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Franchise Metrics: Performance of active territories (Stub for future C39)
CREATE TABLE IF NOT EXISTS public.franchise_metrics (
    territory_id uuid PRIMARY KEY REFERENCES public.franchise_territories(id),
    
    monthly_revenue numeric(10, 2) DEFAULT 0.00,
    active_techs integer DEFAULT 0,
    customer_satisfaction numeric(3, 1) DEFAULT 0.0,
    
    last_updated timestamptz DEFAULT now()
);

-- ============================================================================
-- RPCs
-- ============================================================================

-- RPC: Auto Score Application (Simulated Intelligence)
CREATE OR REPLACE FUNCTION public.rpc_auto_score_application(
    p_application_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Heuristic scoring based on randomness for simulation
    -- In real life, this would analyze uploaded financial docs
    UPDATE public.franchise_applications
    SET 
        financial_score = floor(random() * 40 + 60), -- 60-100
        experience_score = floor(random() * 50 + 40), -- 40-90
        location_score = floor(random() * 30 + 70), -- 70-100
        updated_at = now()
    WHERE id = p_application_id;
END;
$$;

-- RPC: Get Expansion Heatmap
-- Returns territory data for visualization
CREATE OR REPLACE FUNCTION public.rpc_get_expansion_heatmap()
RETURNS TABLE (
    id uuid,
    name text,
    city text,
    status public.territory_status,
    density_score integer,
    estimated_revenue_potential numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.name, t.city, t.status, t.density_score, t.estimated_revenue_potential
    FROM public.franchise_territories t
    ORDER BY t.density_score DESC;
END;
$$;

-- ============================================================================
-- SEED DATA
-- ============================================================================

DO $$
DECLARE
    v_territory_id uuid;
BEGIN
    -- 1. High Potential Territory
    INSERT INTO public.franchise_territories (name, city, status, density_score, estimated_revenue_potential, required_investment)
    VALUES ('Mumbai - Andheri West', 'Mumbai', 'open_for_franchise', 95, 500000.00, 1500000.00)
    RETURNING id INTO v_territory_id;

    -- 2. Application for above
    INSERT INTO public.franchise_applications (territory_id, applicant_name, email, status, financial_score, experience_score)
    VALUES (v_territory_id, 'Rahul Sharma', 'rahul.s@example.com', 'screening', 85, 90);

    -- Other Territories
    INSERT INTO public.franchise_territories (name, city, status, density_score, estimated_revenue_potential)
    VALUES 
    ('Bangalore - Koramangala', 'Bangalore', 'analyzing', 88, 450000.00),
    ('Delhi - South Ex', 'Delhi', 'open_for_franchise', 92, 480000.00),
    ('Hyderabad - Gachibowli', 'Hyderabad', 'active', 75, 300000.00),
    ('Pune - Viman Nagar', 'Pune', 'analyzing', 60, 200000.00);

END $$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.franchise_territories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.franchise_applications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.franchise_metrics TO authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_auto_score_application TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_expansion_heatmap TO authenticated;

GRANT ALL ON public.franchise_territories TO service_role;
GRANT ALL ON public.franchise_applications TO service_role;
GRANT ALL ON public.franchise_metrics TO service_role;
