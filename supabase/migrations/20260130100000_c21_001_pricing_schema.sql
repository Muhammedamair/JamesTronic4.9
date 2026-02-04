-- ============================================================================
-- C21 Dynamic Pricing Engine v1 - Database Schema
-- JamesTronic Platform
-- ============================================================================
-- Purpose:
-- 1. Create service taxonomy with canonical service_code structure
-- 2. Create pricing tables with guardrails, rulesets, quotes, and audit
-- 3. Implement RLS using C20 auth helpers (_c20_app_role, _c20_is_city_accessible)
-- 4. Define check constraints and indexes per hardening spec
-- ============================================================================
-- Job ID: C21_DYNAMIC_PRICING_V1_P1_P2
-- Date: 2026-01-30
-- ============================================================================

-- ============================================================================
-- STEP 1: SERVICE TAXONOMY (pricing_service_catalog)
-- ============================================================================
-- Canonical service_code structure: {CAT}_{SUBCAT}_{BAND}_{ACTION}

CREATE TABLE IF NOT EXISTS public.pricing_service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code TEXT UNIQUE NOT NULL,       -- e.g., 'TV_INSTALL_WALL_32_43'
  category TEXT NOT NULL,                   -- TV, MW, LAPTOP
  subcategory TEXT NOT NULL,                -- install, repair, battery, etc.
  size_band TEXT,                            -- 24-32, 40-43, 46-55, 65-75, 76-85
  model_band TEXT,                           -- standard, gaming, premium
  description TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.pricing_service_catalog IS
'C21: Canonical service taxonomy for dynamic pricing. V1 covers TV/MW/Laptop.';

-- ============================================================================
-- STEP 2: BASE RATES (pricing_base_rates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pricing_base_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code TEXT NOT NULL REFERENCES public.pricing_service_catalog(service_code) ON DELETE CASCADE,
  city_id UUID NOT NULL REFERENCES public.cities(id),
  labor_base DECIMAL(10,2) NOT NULL,
  parts_markup_pct DECIMAL(5,2) DEFAULT 15.00 CHECK (parts_markup_pct >= 0 AND parts_markup_pct <= 200),
  transport_base DECIMAL(10,2) DEFAULT 0,
  diagnostic_fee DECIMAL(10,2) DEFAULT 299,
  effective_from TIMESTAMPTZ DEFAULT now(),
  effective_to TIMESTAMPTZ,
  ruleset_version TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(service_code, city_id, ruleset_version)
);

COMMENT ON TABLE public.pricing_base_rates IS
'C21: Base pricing per service+city. Versioned by ruleset for audit trail.';

-- ============================================================================
-- STEP 3: GUARDRAILS (pricing_guardrails)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pricing_guardrails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES public.cities(id),
  service_code TEXT NOT NULL REFERENCES public.pricing_service_catalog(service_code) ON DELETE CASCADE,
  min_total DECIMAL(10,2) NOT NULL,
  max_total DECIMAL(10,2) NOT NULL,
  max_discount_pct DECIMAL(5,2) DEFAULT 25.00 CHECK (max_discount_pct >= 0 AND max_discount_pct <= 100),
  max_surge_pct DECIMAL(5,2) DEFAULT 50.00 CHECK (max_surge_pct >= 0 AND max_surge_pct <= 300),
  floor_margin_pct DECIMAL(5,2) DEFAULT 10.00 CHECK (floor_margin_pct >= 0 AND floor_margin_pct <= 100),
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(city_id, service_code),
  CONSTRAINT guardrails_min_max CHECK (min_total <= max_total)
);

COMMENT ON TABLE public.pricing_guardrails IS
'C21: Per city+service guardrails. Quotes must fall within min/max and respect margin floor.';

-- ============================================================================
-- STEP 4: RULESETS (pricing_rulesets) - Versioned
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pricing_rulesets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT UNIQUE NOT NULL,              -- e.g., 'v1.0.0-2026-01-30'
  rules JSONB NOT NULL DEFAULT '{}',         -- urgency/complexity/promo rules
  is_active BOOLEAN DEFAULT false,
  activated_at TIMESTAMPTZ,
  activated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Partial unique index: only 1 active ruleset at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_rulesets_single_active
  ON public.pricing_rulesets (is_active) WHERE is_active = true;

COMMENT ON TABLE public.pricing_rulesets IS
'C21: Versioned pricing rules for urgency, complexity, promo. Only 1 active at a time.';

-- ============================================================================
-- STEP 5: QUOTES (pricing_quotes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pricing_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_key TEXT UNIQUE NOT NULL,            -- hash for idempotency
  city_id UUID NOT NULL REFERENCES public.cities(id),
  customer_id UUID REFERENCES public.profiles(id),
  ticket_id UUID,                            -- Optional binding to repair_tickets
  service_code TEXT NOT NULL REFERENCES public.pricing_service_catalog(service_code),
  
  -- Breakdown components
  labor_amount DECIMAL(10,2) NOT NULL,
  parts_amount DECIMAL(10,2) DEFAULT 0,
  parts_cost DECIMAL(10,2) DEFAULT 0,        -- Raw parts cost before markup
  transport_amount DECIMAL(10,2) DEFAULT 0,
  diagnostic_amount DECIMAL(10,2) DEFAULT 0,
  urgency_surcharge DECIMAL(10,2) DEFAULT 0,
  complexity_surcharge DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- Metadata for replayability
  ruleset_version TEXT NOT NULL,
  input_hash TEXT,                           -- Hash of inputs for debugging
  reason_codes TEXT[] DEFAULT '{}',          -- e.g., {'URGENCY_PREMIUM', 'COMPLEXITY_HIGH'}
  customer_explanation TEXT,                 -- Trust-safe explanation
  
  -- State machine
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'blocked', 'anomaly')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pricing_quotes_city_service_created 
  ON public.pricing_quotes(city_id, service_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_quotes_ticket 
  ON public.pricing_quotes(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pricing_quotes_customer
  ON public.pricing_quotes(customer_id) WHERE customer_id IS NOT NULL;

COMMENT ON TABLE public.pricing_quotes IS
'C21: Quote records with deterministic pricing, lock expiry, and full audit trail.';

-- ============================================================================
-- STEP 6: AUDIT LOG (pricing_audit_log)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pricing_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'PRICE_QUOTE_CREATED',
    'PRICE_QUOTE_ACCEPTED',
    'PRICE_QUOTE_EXPIRED',
    'PRICE_QUOTE_BLOCKED_GUARDRAIL',
    'PRICE_QUOTE_FLAGGED_ANOMALY',
    'RULESET_ACTIVATED',
    'RULESET_DEACTIVATED',
    'GUARDRAIL_UPDATED',
    'CITY_PRICING_ENABLED',
    'CITY_PRICING_DISABLED'
  )),
  quote_id UUID REFERENCES public.pricing_quotes(id),
  city_id UUID NOT NULL REFERENCES public.cities(id),
  actor_id UUID REFERENCES auth.users(id),
  actor_role TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for city-scoped audit queries
CREATE INDEX IF NOT EXISTS idx_pricing_audit_log_city_created 
  ON public.pricing_audit_log(city_id, created_at DESC);

COMMENT ON TABLE public.pricing_audit_log IS
'C21: Immutable audit trail for all pricing events. City-scoped access for managers.';

-- ============================================================================
-- STEP 7: MARKET BENCHMARKS (for guardrail computation only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.market_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,                    -- TV, MW, LAPTOP
  service_code TEXT,                         -- Optional link to catalog
  size_band TEXT,
  model_band TEXT,
  description TEXT NOT NULL,
  competitor_total DECIMAL(10,2),            -- Total service charge
  competitor_labor DECIMAL(10,2),            -- Labor component if split
  source_confidence TEXT DEFAULT 'HIGH' CHECK (source_confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  effective_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for benchmark lookups
CREATE INDEX IF NOT EXISTS idx_market_benchmarks_category 
  ON public.market_benchmarks(category, service_code, size_band, model_band);

COMMENT ON TABLE public.market_benchmarks IS
'C21: Competitor pricing data for guardrail computation. LOW confidence rows excluded from caps.';

-- ============================================================================
-- STEP 8: ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.pricing_service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_base_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_guardrails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rulesets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_benchmarks ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 9: RLS POLICIES
-- ============================================================================
-- Using C20 canonical helpers: _c20_app_role(), _c20_is_city_accessible()

-- Service Catalog: Public read (needed for quote requests)
CREATE POLICY "service_catalog_public_read" ON public.pricing_service_catalog
  FOR SELECT USING (is_active = true);

-- Base Rates: Admin/Manager read only
CREATE POLICY "base_rates_admin_manager_read" ON public.pricing_base_rates
  FOR SELECT USING (
    public._c20_app_role() IN ('admin', 'super_admin')
    OR (public._c20_app_role() = 'manager' AND public._c20_is_city_accessible(city_id))
  );

-- Guardrails: Admin/Manager city-scoped read
CREATE POLICY "guardrails_admin_manager_read" ON public.pricing_guardrails
  FOR SELECT USING (
    public._c20_app_role() IN ('admin', 'super_admin')
    OR (public._c20_app_role() = 'manager' AND public._c20_is_city_accessible(city_id))
  );

-- Rulesets: Admin only (managers can view active only)
CREATE POLICY "rulesets_admin_read" ON public.pricing_rulesets
  FOR SELECT USING (
    public._c20_app_role() IN ('admin', 'super_admin')
    OR (is_active = true)  -- Everyone can see active ruleset version
  );

-- Quotes: Customer reads own, Manager city-scoped, Admin global
CREATE POLICY "quotes_customer_read_own" ON public.pricing_quotes
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "quotes_manager_city_read" ON public.pricing_quotes
  FOR SELECT USING (
    public._c20_app_role() = 'manager' AND public._c20_is_city_accessible(city_id)
  );

CREATE POLICY "quotes_admin_read" ON public.pricing_quotes
  FOR SELECT USING (public._c20_app_role() IN ('admin', 'super_admin'));

-- Audit Log: Manager city-scoped, Admin global, Customer/Technician BLOCKED
CREATE POLICY "audit_manager_city_read" ON public.pricing_audit_log
  FOR SELECT USING (
    public._c20_app_role() = 'manager' AND public._c20_is_city_accessible(city_id)
  );

CREATE POLICY "audit_admin_read" ON public.pricing_audit_log
  FOR SELECT USING (public._c20_app_role() IN ('admin', 'super_admin'));

-- Market Benchmarks: Admin/Manager read only
CREATE POLICY "benchmarks_admin_manager_read" ON public.market_benchmarks
  FOR SELECT USING (
    public._c20_app_role() IN ('admin', 'super_admin', 'manager')
  );

-- ============================================================================
-- STEP 10: REASON CODES TYPE
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'pricing_reason_code' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.pricing_reason_code AS ENUM (
      'BASE_RATE',
      'URGENCY_SAME_DAY',
      'URGENCY_NEXT_DAY',
      'URGENCY_STANDARD',
      'COMPLEXITY_SIMPLE',
      'COMPLEXITY_STANDARD',
      'COMPLEXITY_COMPLEX',
      'TRANSPORT_LOCAL',
      'TRANSPORT_EXTENDED',
      'PARTS_OEM',
      'PARTS_COMPATIBLE',
      'PROMO_APPLIED',
      'GUARDRAIL_MIN_ENFORCED',
      'GUARDRAIL_MAX_ENFORCED',
      'MARGIN_FLOOR_APPLIED'
    );
  END IF;
END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'C21 Dynamic Pricing v1: Schema created.';
  RAISE NOTICE 'Tables: pricing_service_catalog, pricing_base_rates, pricing_guardrails, pricing_rulesets, pricing_quotes, pricing_audit_log, market_benchmarks';
  RAISE NOTICE 'RLS: City-scoped for managers using _c20_is_city_accessible(), Admin global access.';
  RAISE NOTICE 'Constraints: min<=max, discount 0-100, surge 0-300, markup 0-200';
END $$;
