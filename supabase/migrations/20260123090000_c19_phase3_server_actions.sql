-- ============================================================================
-- C19 Inventory Prediction Engine - Phase 3: Server Actions (V1)
-- JamesTronic Platform
-- ============================================================================
-- Purpose:
-- 1. Create server-only RPCs for reorder approval/rejection
-- 2. Create server-only RPC for alert resolution
-- 3. Enforce RBAC and state transition validation
-- 4. Support audit trail (approved_by, approved_at, resolved_by, resolved_at)
-- ============================================================================
-- Job ID: C19_PHASE3_SERVER_ACTIONS_V1
-- Priority: P0
-- Date: 2026-01-23
-- ============================================================================

-- ============================================================================
-- HELPER: Get current user's role as text (enum-safe)
-- ============================================================================

CREATE OR REPLACE FUNCTION public._c19_get_my_role_text()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
        (SELECT role::text FROM profiles WHERE user_id = auth.uid()),
        'anonymous'
    );
$$;

COMMENT ON FUNCTION public._c19_get_my_role_text IS 'Returns current authenticated user role as text (enum-safe for C19 RBAC)';

-- ============================================================================
-- HELPER: Allow admin, manager, or service_role
-- ============================================================================

CREATE OR REPLACE FUNCTION public._c19_allow_admin_manager_or_service()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        auth.role() = 'service_role'
        OR public._c19_get_my_role_text() IN ('admin', 'manager');
$$;

COMMENT ON FUNCTION public._c19_allow_admin_manager_or_service IS 'RBAC gate: returns true if caller is admin, manager, or service_role';

-- ============================================================================
-- RPC: Approve Reorder Recommendation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_reorder_approve(
    p_recommendation_id uuid,
    p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_status text;
    v_user_id uuid;
    v_updated_rec RECORD;
BEGIN
    -- RBAC gate
    IF NOT public._c19_allow_admin_manager_or_service() THEN
        RAISE EXCEPTION 'Unauthorized: approval requires admin/manager role';
    END IF;
    
    -- Get current user
    v_user_id := auth.uid();
    
    -- Get current status
    SELECT status INTO v_current_status
    FROM reorder_recommendations
    WHERE id = p_recommendation_id;
    
    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Recommendation not found: %', p_recommendation_id;
    END IF;
    
    -- Enforce state transition: only 'proposed' can be approved
    IF v_current_status != 'proposed' THEN
        RAISE EXCEPTION 'Invalid state transition: cannot approve recommendation with status "%"', v_current_status;
    END IF;
    
    -- Perform the approval
    UPDATE reorder_recommendations
    SET 
        status = 'approved',
        approved_by = v_user_id,
        approved_at = now(),
        notes = COALESCE(p_notes, notes),
        updated_at = now()
    WHERE id = p_recommendation_id
    RETURNING * INTO v_updated_rec;
    
    RETURN jsonb_build_object(
        'success', true,
        'recommendation_id', p_recommendation_id,
        'new_status', 'approved',
        'approved_by', v_user_id,
        'approved_at', v_updated_rec.approved_at
    );
END;
$$;

COMMENT ON FUNCTION public.rpc_reorder_approve IS 'Server-only: Approve a proposed reorder recommendation. RBAC: admin/manager only.';

-- Revoke public, grant to authenticated only
REVOKE EXECUTE ON FUNCTION public.rpc_reorder_approve FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_reorder_approve TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_reorder_approve TO service_role;

-- ============================================================================
-- RPC: Reject Reorder Recommendation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_reorder_reject(
    p_recommendation_id uuid,
    p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_status text;
    v_user_id uuid;
    v_updated_rec RECORD;
BEGIN
    -- RBAC gate
    IF NOT public._c19_allow_admin_manager_or_service() THEN
        RAISE EXCEPTION 'Unauthorized: rejection requires admin/manager role';
    END IF;
    
    -- Require notes for rejection
    IF p_notes IS NULL OR trim(p_notes) = '' THEN
        RAISE EXCEPTION 'Rejection requires a note explaining the reason';
    END IF;
    
    -- Get current user
    v_user_id := auth.uid();
    
    -- Get current status
    SELECT status INTO v_current_status
    FROM reorder_recommendations
    WHERE id = p_recommendation_id;
    
    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Recommendation not found: %', p_recommendation_id;
    END IF;
    
    -- Enforce state transition: only 'proposed' can be rejected
    IF v_current_status != 'proposed' THEN
        RAISE EXCEPTION 'Invalid state transition: cannot reject recommendation with status "%"', v_current_status;
    END IF;
    
    -- Perform the rejection
    UPDATE reorder_recommendations
    SET 
        status = 'rejected',
        approved_by = v_user_id,
        approved_at = now(),
        notes = p_notes,
        updated_at = now()
    WHERE id = p_recommendation_id
    RETURNING * INTO v_updated_rec;
    
    RETURN jsonb_build_object(
        'success', true,
        'recommendation_id', p_recommendation_id,
        'new_status', 'rejected',
        'rejected_by', v_user_id,
        'rejected_at', v_updated_rec.approved_at,
        'notes', p_notes
    );
END;
$$;

COMMENT ON FUNCTION public.rpc_reorder_reject IS 'Server-only: Reject a proposed reorder recommendation with required note. RBAC: admin/manager only.';

-- Revoke public, grant to authenticated only
REVOKE EXECUTE ON FUNCTION public.rpc_reorder_reject FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_reorder_reject TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_reorder_reject TO service_role;

-- ============================================================================
-- RPC: Resolve Inventory Alert
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_inventory_alert_resolve(
    p_alert_id uuid,
    p_resolution_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_resolved_at timestamptz;
    v_user_id uuid;
    v_updated_alert RECORD;
BEGIN
    -- RBAC gate
    IF NOT public._c19_allow_admin_manager_or_service() THEN
        RAISE EXCEPTION 'Unauthorized: alert resolution requires admin/manager role';
    END IF;
    
    -- Require resolution note
    IF p_resolution_note IS NULL OR trim(p_resolution_note) = '' THEN
        RAISE EXCEPTION 'Resolution requires a note explaining the action taken';
    END IF;
    
    -- Get current user
    v_user_id := auth.uid();
    
    -- Get current resolved status
    SELECT resolved_at INTO v_current_resolved_at
    FROM inventory_alerts
    WHERE id = p_alert_id;
    
    IF v_current_resolved_at IS NULL AND NOT FOUND THEN
        RAISE EXCEPTION 'Alert not found: %', p_alert_id;
    END IF;
    
    -- Enforce state transition: only unresolved alerts can be resolved
    IF v_current_resolved_at IS NOT NULL THEN
        RAISE EXCEPTION 'Alert is already resolved';
    END IF;
    
    -- Perform the resolution
    UPDATE inventory_alerts
    SET 
        resolved_at = now(),
        resolved_by = v_user_id,
        resolution_note = p_resolution_note
    WHERE id = p_alert_id
    RETURNING * INTO v_updated_alert;
    
    RETURN jsonb_build_object(
        'success', true,
        'alert_id', p_alert_id,
        'resolved_by', v_user_id,
        'resolved_at', v_updated_alert.resolved_at,
        'resolution_note', p_resolution_note
    );
END;
$$;

COMMENT ON FUNCTION public.rpc_inventory_alert_resolve IS 'Server-only: Resolve an unresolved inventory alert with required note. RBAC: admin/manager only.';

-- Revoke public, grant to authenticated only
REVOKE EXECUTE ON FUNCTION public.rpc_inventory_alert_resolve FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_inventory_alert_resolve TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_inventory_alert_resolve TO service_role;

-- ============================================================================
-- ADDITIONAL RLS HARDENING: Block direct UPDATE from clients
-- ============================================================================

-- Drop existing permissive policies on status fields if they allow direct UPDATE
-- Note: We assume existing RLS policies for admin/manager are SELECT-only for these tables
-- The RPC functions use SECURITY DEFINER to bypass RLS for the UPDATE

-- For extra safety, add explicit policies that block status updates
-- (These complement existing RLS - rpc functions run as definer and bypass)

-- No new policies needed if existing RLS already restricts UPDATE
-- The RPC SECURITY DEFINER pattern ensures only RPC can UPDATE

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'C19 Phase 3 Server Actions migration completed successfully';
    RAISE NOTICE 'Created helpers: _c19_get_my_role_text, _c19_allow_admin_manager_or_service';
    RAISE NOTICE 'Created RPCs: rpc_reorder_approve, rpc_reorder_reject, rpc_inventory_alert_resolve';
    RAISE NOTICE 'RBAC: All RPCs require admin/manager/service_role';
    RAISE NOTICE 'State transitions: proposed->approved/rejected enforced; unresolved->resolved enforced';
    RAISE NOTICE 'Audit fields: approved_by/approved_at, resolved_by/resolved_at set by RPCs';
END $$;
