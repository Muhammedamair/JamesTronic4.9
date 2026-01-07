-- ============================================================================
-- C35 Dark Store Automation V2: Database Infrastructure
-- JamesTronic Platform
-- ============================================================================
-- Purpose: Warehouse management, bin tracking, and technician queues.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.bin_type AS ENUM (
    'fast_moving',  -- Front of store
    'standard',     -- Middle
    'bulk',         -- Back/Heavy
    'secure'        -- High value
);

CREATE TYPE public.bin_status AS ENUM (
    'empty',
    'partial',
    'full',
    'blocked'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. Dark Store Bins: Detailed storage locations
CREATE TABLE IF NOT EXISTS public.dark_store_bins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    
    bin_code text NOT NULL, -- e.g. A-01-01
    type public.bin_type NOT NULL DEFAULT 'standard',
    status public.bin_status NOT NULL DEFAULT 'empty',
    
    capacity_units integer DEFAULT 100,
    current_load_units integer DEFAULT 0,
    
    last_audited_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now() NOT NULL,
    
    UNIQUE(branch_id, bin_code)
);

-- 2. Daily Store Metrics: High-level inflow/outflow
CREATE TABLE IF NOT EXISTS public.dark_store_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    date date NOT NULL DEFAULT CURRENT_DATE,
    
    daily_inflow_count integer DEFAULT 0,
    daily_outflow_count integer DEFAULT 0,
    avg_repair_time_minutes integer DEFAULT 0,
    
    active_tech_count integer DEFAULT 0,
    bin_utilization_percent numeric(5, 2) DEFAULT 0.00,
    
    updated_at timestamptz DEFAULT now(),
    
    UNIQUE(branch_id, date)
);

-- 3. Technician Queues: Current workload per tech in the store
CREATE TABLE IF NOT EXISTS public.technician_queues (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    
    current_ticket_count integer DEFAULT 0,
    estimated_wait_minutes integer DEFAULT 0,
    status text CHECK (status IN ('active', 'break', 'offline')),
    
    last_updated timestamptz DEFAULT now(),
    
    UNIQUE(technician_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_bins_branch ON public.dark_store_bins(branch_id, status);
CREATE INDEX idx_queues_branch ON public.technician_queues(branch_id);

-- ============================================================================
-- RPCs
-- ============================================================================

-- RPC: Assign Bin (Simulated Logic)
-- Finds the first available bin of the right type
CREATE OR REPLACE FUNCTION public.rpc_assign_bin(
    p_branch_id uuid,
    p_type public.bin_type DEFAULT 'standard'
)
RETURNS TABLE (
    bin_id uuid,
    bin_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT id, b.bin_code
    FROM public.dark_store_bins b
    WHERE b.branch_id = p_branch_id
      AND b.type = p_type
      AND b.status IN ('empty', 'partial')
    ORDER BY b.bin_code ASC
    LIMIT 1;
END;
$$;

-- RPC: Get Store Metrics
-- Aggregates real-time bin data with history
CREATE OR REPLACE FUNCTION public.rpc_get_store_metrics(
    p_branch_id uuid
)
RETURNS TABLE (
    total_bins bigint,
    full_bins bigint,
    utilization numeric,
    active_techs bigint,
    queue_depth bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM public.dark_store_bins WHERE branch_id = p_branch_id),
        (SELECT COUNT(*) FROM public.dark_store_bins WHERE branch_id = p_branch_id AND status = 'full'),
        (SELECT COALESCE(AVG(current_load_units::numeric / NULLIF(capacity_units,0)) * 100, 0) 
         FROM public.dark_store_bins WHERE branch_id = p_branch_id),
        (SELECT COUNT(*) FROM public.technician_queues WHERE branch_id = p_branch_id AND status = 'active'),
        (SELECT COALESCE(SUM(current_ticket_count), 0) FROM public.technician_queues WHERE branch_id = p_branch_id);
END;
$$;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Seed Bins for the first found branch
DO $$
DECLARE
    v_branch_id uuid;
BEGIN
    SELECT id INTO v_branch_id FROM public.branches LIMIT 1;
    
    IF v_branch_id IS NOT NULL THEN
        -- Create A-Row (Fast Moving)
        INSERT INTO public.dark_store_bins (branch_id, bin_code, type, capacity_units, current_load_units, status)
        VALUES 
            (v_branch_id, 'A-01', 'fast_moving', 50, 45, 'partial'),
            (v_branch_id, 'A-02', 'fast_moving', 50, 10, 'partial'),
            (v_branch_id, 'A-03', 'fast_moving', 50, 0, 'empty')
        ON CONFLICT DO NOTHING;

        -- Create B-Row (Standard)
        INSERT INTO public.dark_store_bins (branch_id, bin_code, type, capacity_units, current_load_units, status)
        VALUES 
            (v_branch_id, 'B-01', 'standard', 100, 100, 'full'),
            (v_branch_id, 'B-02', 'standard', 100, 80, 'partial'),
            (v_branch_id, 'B-03', 'standard', 100, 20, 'partial')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.dark_store_bins TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.dark_store_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.technician_queues TO authenticated;

GRANT ALL ON public.dark_store_bins TO service_role;
GRANT ALL ON public.dark_store_metrics TO service_role;
GRANT ALL ON public.technician_queues TO service_role;

GRANT EXECUTE ON FUNCTION public.rpc_assign_bin TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_store_metrics TO authenticated;
