-- ============================================================================
-- C37 Insurance & Warranty Liability Engine: Database Infrastructure
-- JamesTronic Platform
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.policy_type AS ENUM (
    'device_protection',  -- Full device insurance
    'repair_warranty',    -- Warranty on specific repair
    'transit_insurance'   -- Shipping coverage
);

CREATE TYPE public.claim_status AS ENUM (
    'draft',
    'submitted',
    'under_review',
    'approved',
    'rejected',
    'paid'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. Insurance Providers: B2B Partners (Internal or External)
CREATE TABLE IF NOT EXISTS public.insurance_providers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    api_endpoint text, -- Mocked for now
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 2. Warranty Policies: Active coverage
CREATE TABLE IF NOT EXISTS public.warranty_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid REFERENCES public.tickets(id),
    provider_id uuid REFERENCES public.insurance_providers(id),
    
    type public.policy_type NOT NULL,
    policy_number text NOT NULL,
    
    start_date timestamptz DEFAULT now(),
    end_date timestamptz NOT NULL,
    
    premium_amount numeric(10, 2) DEFAULT 0.00,
    liability_limit numeric(10, 2) DEFAULT 0.00,
    
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 3. Warranty Claims: Requests for payout
CREATE TABLE IF NOT EXISTS public.warranty_claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id uuid REFERENCES public.warranty_policies(id),
    
    claim_type text NOT NULL, -- e.g. "Accidental Damage", "Part Failure"
    amount_claimed numeric(10, 2) NOT NULL,
    amount_approved numeric(10, 2) DEFAULT 0.00,
    
    status public.claim_status DEFAULT 'draft',
    description text,
    evidence_urls text[], -- Array of image URLs
    
    submitted_at timestamptz,
    resolved_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- RPCs
-- ============================================================================

-- RPC: Get Active Liabilities
-- Sums up potential exposure from active policies
CREATE OR REPLACE FUNCTION public.rpc_get_active_liabilities()
RETURNS TABLE (
    total_policies bigint,
    total_exposure numeric,
    active_claims_count bigint,
    pending_claims_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM public.warranty_policies WHERE is_active = true),
        (SELECT COALESCE(SUM(liability_limit), 0) FROM public.warranty_policies WHERE is_active = true),
        (SELECT COUNT(*) FROM public.warranty_claims WHERE status IN ('submitted', 'under_review')),
        (SELECT COALESCE(SUM(amount_claimed), 0) FROM public.warranty_claims WHERE status IN ('submitted', 'under_review'));
END;
$$;

-- ============================================================================
-- SEED DATA
-- ============================================================================

DO $$
DECLARE
    v_provider_id uuid;
    v_ticket_id uuid;
    v_policy_id uuid;
BEGIN
    -- 1. Create Provider
    INSERT INTO public.insurance_providers (name, api_endpoint)
    VALUES ('JamesProtect Standard', 'https://api.jamesprotect.internal/v1')
    RETURNING id INTO v_provider_id;

    -- 2. Find a Ticket
    SELECT id INTO v_ticket_id FROM public.tickets LIMIT 1;

    -- 3. Create Sample Policy
    IF v_ticket_id IS NOT NULL THEN
        INSERT INTO public.warranty_policies (ticket_id, provider_id, type, policy_number, end_date, premium_amount, liability_limit)
        VALUES (v_ticket_id, v_provider_id, 'repair_warranty', 'JP-2026-001', now() + interval '90 days', 499.00, 5000.00)
        RETURNING id INTO v_policy_id;
        
        -- 4. Create Sample Claim
        INSERT INTO public.warranty_claims (policy_id, claim_type, amount_claimed, status, description, submitted_at)
        VALUES (v_policy_id, 'Part Failure', 1200.00, 'submitted', 'Screen flickering after repair.', now());
    END IF;
END $$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.insurance_providers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.warranty_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.warranty_claims TO authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_get_active_liabilities TO authenticated;

GRANT ALL ON public.insurance_providers TO service_role;
GRANT ALL ON public.warranty_policies TO service_role;
GRANT ALL ON public.warranty_claims TO service_role;
