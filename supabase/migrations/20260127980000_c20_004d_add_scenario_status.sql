-- ============================================================================
-- C20 ExpansionOS - Phase 4.x: Fix Missing Status Column
-- JamesTronic Platform
-- ============================================================================
-- Purpose:
-- Add 'status' column to expansion_scenarios if missing.
-- Likely missed in Phase 2 DDL.
-- ============================================================================
-- Job ID: C20_PHASE4_FIX_STATUS
-- Priority: P1 (Blocker)
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='expansion_scenarios' AND column_name='status'
    ) THEN
        ALTER TABLE public.expansion_scenarios
        ADD COLUMN status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived'));
        
        RAISE NOTICE 'Added status column to expansion_scenarios';
    END IF;
END $$;
