-- Migration: C21 Base Rates Temporal Hardening (Option C)
-- Purpose: 
-- 1. Drop strict UNIQUE(service_code, city_id, ruleset_version) constraint
-- 2. Add partial UNIQUE index for current active row (where effective_to IS NULL)
-- 3. This allows append-only history while enforcing one 'current' rate per city/service

BEGIN;

-- 1. Drop the old constraint
ALTER TABLE public.pricing_base_rates 
DROP CONSTRAINT IF EXISTS pricing_base_rates_service_code_city_id_ruleset_version_key;

-- 2. Create the new partial unique index
-- Only allow one "currently active" (non-end-dated) row per city/service
CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_base_rates_current_active
ON public.pricing_base_rates (city_id, service_code)
WHERE effective_to IS NULL;

-- 3. Add comment to document the change
COMMENT ON TABLE public.pricing_base_rates IS 
'C21: Base pricing per service+city. Temporal versioning: 1 active row (effective_to IS NULL) per city/service.';

COMMIT;
