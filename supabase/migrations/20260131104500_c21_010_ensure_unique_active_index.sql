-- Migration: C21.10 Ensure Unique Active Index
-- Purpose: Strictly enforce single-active invariant for pricing_rulesets.
-- We previously had `idx_pricing_rulesets_single_active`. 
-- We will drop it and recreate as `uq_pricing_rulesets_single_active` to match governance spec.

BEGIN;

DROP INDEX IF EXISTS public.idx_pricing_rulesets_single_active;
DROP INDEX IF EXISTS public.uq_pricing_rulesets_single_active;

CREATE UNIQUE INDEX uq_pricing_rulesets_single_active
ON public.pricing_rulesets (is_active)
WHERE is_active = true;

COMMIT;
