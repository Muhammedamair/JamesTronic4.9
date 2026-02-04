-- Migration: C21.11 Quotes Governance Columns
-- Purpose: Add immutable snapshot fields for explainability + dispute-proof pricing.

BEGIN;

-- 1. Add governance columns to pricing_quotes
ALTER TABLE public.pricing_quotes
  ADD COLUMN IF NOT EXISTS ruleset_id UUID REFERENCES public.pricing_rulesets(id);

ALTER TABLE public.pricing_quotes
  ADD COLUMN IF NOT EXISTS base_rate_ref JSONB NOT NULL DEFAULT '{}';

ALTER TABLE public.pricing_quotes
  ADD COLUMN IF NOT EXISTS guardrail_ref JSONB NOT NULL DEFAULT '{}';

ALTER TABLE public.pricing_quotes
  ADD COLUMN IF NOT EXISTS breakdown JSONB NOT NULL DEFAULT '{}';

ALTER TABLE public.pricing_quotes
  ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES auth.users(id);

-- 2. Backfill defaults (no existing data, so this is mostly future-proofing)
-- No operation needed for fresh installs

-- 3. Add index for city-scoped queries (already exists, but ensuring)
CREATE INDEX IF NOT EXISTS idx_pricing_quotes_city_created
  ON public.pricing_quotes(city_id, created_at DESC);

-- 4. Enforce quote_key uniqueness (already exists from C21.1, but re-confirming)
-- unique (quote_key) is already part of CREATE TABLE

COMMIT;
