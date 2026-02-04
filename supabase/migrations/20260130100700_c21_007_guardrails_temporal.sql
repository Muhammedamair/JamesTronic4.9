-- Migration: C21 Guardrails Temporal Hardening (Option B)
-- Purpose:
-- 1) Add effective_from/effective_to to pricing_guardrails
-- 2) Replace UNIQUE(city_id, service_code) with partial unique index for "current" row
-- 3) Preserve full history for audit/replay

BEGIN;

-- 1) Add temporal columns (safe defaults)
ALTER TABLE public.pricing_guardrails
  ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS effective_to   TIMESTAMPTZ;

-- 2) Backfill effective_from from created_at (Critical for history)
UPDATE public.pricing_guardrails
SET effective_from = COALESCE(created_at, now())
WHERE effective_from IS NULL;

-- 3) Enforce NOT NULL and DEFAULT now() after backfill
ALTER TABLE public.pricing_guardrails
  ALTER COLUMN effective_from SET NOT NULL,
  ALTER COLUMN effective_from SET DEFAULT now();

-- 4) Drop old uniqueness constraint
ALTER TABLE public.pricing_guardrails
DROP CONSTRAINT IF EXISTS pricing_guardrails_city_id_service_code_key;

-- 5) Enforce: only one current row per city/service
CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_guardrails_current_active
ON public.pricing_guardrails (city_id, service_code)
WHERE effective_to IS NULL;

-- 6) Helpful index for as-of queries
CREATE INDEX IF NOT EXISTS idx_pricing_guardrails_temporal_lookup
ON public.pricing_guardrails (city_id, service_code, effective_from DESC);

COMMENT ON TABLE public.pricing_guardrails IS
'C21: Temporal guardrails per city/service. One active row (effective_to IS NULL) per city/service; history preserved for replay.';

COMMIT;
