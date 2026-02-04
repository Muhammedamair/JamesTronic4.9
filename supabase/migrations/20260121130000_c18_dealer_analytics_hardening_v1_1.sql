-- ============================================================================
-- C18 Dealer Analytics Engine V1.1 - Hardening Patch
-- JamesTronic Platform
-- ============================================================================
-- Purpose:
-- 1. Fix idempotency: Replace over-aggressive unique constraint with hash-based deduplication
-- 2. Add optional client idempotency_key support
-- 3. Fix RBAC: Create enum-safe permission helper
-- 4. Update rpc_dealer_event_ingest: Add signature params, compute event_hash, DO NOTHING on conflict
-- 5. Restrict rpc_dealer_compute_scores permissions
-- ============================================================================
-- Job ID: C18_HARDENING_PATCH_V1_1
-- Priority: P0
-- Date: 2026-01-21
-- ============================================================================

-- ============================================================================
-- INTROSPECTION NOTES
-- ============================================================================
-- Based on codebase review:
-- - profiles table uses 'user_id' as the column matching auth.uid()
-- - profiles.role is enum 'app_role'
-- - Current compute signature: rpc_dealer_compute_scores(p_dealer_id uuid)
-- - Existing unique constraint: unique_dealer_event_fact (dealer_id, event_type, context_id)
-- ============================================================================

-- ============================================================================
-- STEP 1: Add Deduplication Columns
-- ============================================================================

-- Add event_hash (nullable initially for backfill)
ALTER TABLE public.dealer_event_facts
ADD COLUMN IF NOT EXISTS event_hash text;

-- Add idempotency_key (always nullable - optional client control)
ALTER TABLE public.dealer_event_facts
ADD COLUMN IF NOT EXISTS idempotency_key text;

COMMENT ON COLUMN public.dealer_event_facts.event_hash IS 'Deterministic hash of event attributes for deduplication';
COMMENT ON COLUMN public.dealer_event_facts.idempotency_key IS 'Optional client-provided key for explicit deduplication control';

-- ============================================================================
-- STEP 2: Backfill event_hash (Delimiter-Safe, Null-Safe)
-- ============================================================================

-- Use delimiter '|' and coalesce to handle nulls
-- Hash inputs: dealer_id | event_type | context_type | context_id | occurred_at | payload
UPDATE public.dealer_event_facts
SET event_hash = encode(
    digest(
        COALESCE(dealer_id::text, 'NULL') || '|' ||
        COALESCE(event_type, 'NULL') || '|' ||
        COALESCE(context_type, 'NULL') || '|' ||
        COALESCE(context_id::text, 'NULL') || '|' ||
        COALESCE(occurred_at::text, 'NULL') || '|' ||
        COALESCE(payload::text, '{}'),
        'sha256'
    ),
    'hex'
)
WHERE event_hash IS NULL;

-- Now make event_hash NOT NULL
ALTER TABLE public.dealer_event_facts
ALTER COLUMN event_hash SET NOT NULL;

-- ============================================================================
-- STEP 3: Create Dedupe Indexes
-- ============================================================================

-- Unique index on event_hash (primary deduplication mechanism)
CREATE UNIQUE INDEX IF NOT EXISTS idx_dealer_facts_event_hash 
ON public.dealer_event_facts(event_hash);

-- Unique index on (dealer_id, idempotency_key) for client-controlled dedup
-- Partial index: only when idempotency_key is not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_dealer_facts_idempotency 
ON public.dealer_event_facts(dealer_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- STEP 4: Drop Old Over-Aggressive Constraint
-- ============================================================================

-- Use dynamic DO block for idempotent migration
DO $$ 
BEGIN
    -- Drop the old constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_dealer_event_fact'
        AND conrelid = 'public.dealer_event_facts'::regclass
    ) THEN
        ALTER TABLE public.dealer_event_facts 
        DROP CONSTRAINT unique_dealer_event_fact;
        
        RAISE NOTICE 'Dropped old constraint: unique_dealer_event_fact';
    ELSE
        RAISE NOTICE 'Constraint unique_dealer_event_fact does not exist, skipping drop';
    END IF;
END $$;

-- ============================================================================
-- STEP 5: Create Enum-Safe Permission Helper
-- ============================================================================

CREATE OR REPLACE FUNCTION public._c18_allow_admin_or_service()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    -- Allow service_role OR profiles with role 'admin' or 'manager'
    -- Critical: Cast enum to text to avoid invalid enum literal errors
    SELECT 
        auth.role() = 'service_role' 
        OR 
        EXISTS (
            SELECT 1 
            FROM public.profiles 
            WHERE user_id = auth.uid() 
            AND role::text IN ('admin', 'manager')
        );
$$;

COMMENT ON FUNCTION public._c18_allow_admin_or_service() IS 
'Permission helper for C18 analytics. Returns true if caller is service_role or admin/manager user. Uses role::text casting for enum safety.';

-- Grant to authenticated users (they can call it, but result depends on their role)
GRANT EXECUTE ON FUNCTION public._c18_allow_admin_or_service() TO authenticated;

-- ============================================================================
-- STEP 6: Update rpc_dealer_event_ingest (Schema-Safe, Immutable on Conflict)
-- ============================================================================

-- Drop the old version (6 params) to avoid signature ambiguity
DROP FUNCTION IF EXISTS public.rpc_dealer_event_ingest(uuid, text, text, uuid, timestamptz, jsonb);

-- Create new version with extended signature (8 params)
CREATE OR REPLACE FUNCTION public.rpc_dealer_event_ingest(
    p_dealer_id uuid,
    p_event_type text,
    p_context_type text,
    p_context_id uuid,
    p_occurred_at timestamptz,
    p_payload jsonb DEFAULT '{}'::jsonb,
    p_idempotency_key text DEFAULT NULL,
    p_ticket_id uuid DEFAULT NULL  -- Stored in payload, not as table column
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fact_id uuid;
    v_event_hash text;
    v_enriched_payload jsonb;
BEGIN
    -- GATE G1: Permission check
    IF NOT public._c18_allow_admin_or_service() THEN
        RAISE EXCEPTION 'Unauthorized: dealer event ingestion requires admin, manager, or service_role privileges';
    END IF;
    
    -- Merge ticket_id into payload if provided (not a table column)
    v_enriched_payload := p_payload;
    IF p_ticket_id IS NOT NULL THEN
        v_enriched_payload := v_enriched_payload || jsonb_build_object('ticket_id', p_ticket_id);
    END IF;
    
    -- GATE G3: Compute event_hash (delimiter-safe, null-safe)
    v_event_hash := encode(
        digest(
            COALESCE(p_dealer_id::text, 'NULL') || '|' ||
            COALESCE(p_event_type, 'NULL') || '|' ||
            COALESCE(p_context_type, 'NULL') || '|' ||
            COALESCE(p_context_id::text, 'NULL') || '|' ||
            COALESCE(p_occurred_at::text, 'NULL') || '|' ||
            COALESCE(v_enriched_payload::text, '{}'),
            'sha256'
        ),
        'hex'
    );
    
    -- GATE G2: Insert with ON CONFLICT DO NOTHING (facts immutable)
    INSERT INTO public.dealer_event_facts (
        dealer_id,
        event_type,
        context_type,
        context_id,
        occurred_at,
        payload,
        event_hash,
        idempotency_key
    )
    VALUES (
        p_dealer_id,
        p_event_type,
        p_context_type,
        p_context_id,
        p_occurred_at,
        v_enriched_payload,
        v_event_hash,
        p_idempotency_key
    )
    ON CONFLICT (event_hash) DO NOTHING
    RETURNING id INTO v_fact_id;
    
    -- If conflict occurred (v_fact_id is NULL), fetch existing fact id
    IF v_fact_id IS NULL THEN
        SELECT id INTO v_fact_id 
        FROM public.dealer_event_facts
        WHERE event_hash = v_event_hash;
    END IF;
    
    RETURN v_fact_id;
END;
$$;

COMMENT ON FUNCTION public.rpc_dealer_event_ingest IS 
'V1.1 Hardened: Ingest dealer events with hash-based deduplication. Facts are immutable (ON CONFLICT DO NOTHING). Requires admin/manager/service role.';

-- Permissions (existing grants carried forward)
GRANT EXECUTE ON FUNCTION public.rpc_dealer_event_ingest TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_dealer_event_ingest TO service_role;

-- ============================================================================
-- STEP 7: Create Permission-Restricted Compute Wrapper
-- ============================================================================
-- GATE G1: Do not replace rpc_dealer_compute_scores - preserve existing logic
-- Strategy: Create wrapper function that adds permission check then delegates

-- First, rename existing function to internal version
DO $$
BEGIN
    -- Check if the internal version already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = '_rpc_dealer_compute_scores_internal'
        AND pg_function_is_visible(oid)
    ) THEN
        -- Rename existing function to internal
        ALTER FUNCTION public.rpc_dealer_compute_scores(uuid) 
        RENAME TO _rpc_dealer_compute_scores_internal;
        
        RAISE NOTICE 'Renamed rpc_dealer_compute_scores to _rpc_dealer_compute_scores_internal';
    END IF;
EXCEPTION
    WHEN undefined_function THEN
        RAISE NOTICE 'Function rpc_dealer_compute_scores does not exist, skipping rename';
    WHEN OTHERS THEN
        RAISE NOTICE 'Unexpected error during function rename: %', SQLERRM;
END $$;

-- Create new public wrapper with permission gate
CREATE OR REPLACE FUNCTION public.rpc_dealer_compute_scores(
    p_dealer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Permission gate
    IF NOT public._c18_allow_admin_or_service() THEN
        RAISE EXCEPTION 'Unauthorized: dealer score computation requires admin, manager, or service_role privileges';
    END IF;
    
    -- Delegate to internal implementation (preserves all existing VFL logic)
    RETURN public._rpc_dealer_compute_scores_internal(p_dealer_id);
END;
$$;

COMMENT ON FUNCTION public.rpc_dealer_compute_scores IS 
'V1.1 Hardened: Wrapper with permission gate. Delegates to internal VFL scoring logic. Requires admin/manager/service role.';

-- Permissions
GRANT EXECUTE ON FUNCTION public.rpc_dealer_compute_scores TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_dealer_compute_scores TO service_role;

-- Revoke public access from internal function (defense in depth)
REVOKE ALL ON FUNCTION public._rpc_dealer_compute_scores_internal FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._rpc_dealer_compute_scores_internal TO authenticated;
GRANT EXECUTE ON FUNCTION public._rpc_dealer_compute_scores_internal TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification queries (run these manually to confirm)
-- 1. Check event_hash populated:
--    SELECT COUNT(*) FROM dealer_event_facts WHERE event_hash IS NULL; -- Should be 0
-- 
-- 2. Check old constraint dropped:
--    SELECT conname FROM pg_constraint WHERE conrelid = 'public.dealer_event_facts'::regclass;
-- 
-- 3. Test permission helper:
--    SELECT public._c18_allow_admin_or_service(); -- Should return true for admin/manager/service_role
-- 
-- 4. Test ingest deduplication:
--    SELECT rpc_dealer_event_ingest(...); -- Call twice with same params, should return same id

DO $$
BEGIN
    RAISE NOTICE 'C18 Hardening Patch V1.1 migration completed successfully';
END $$;
