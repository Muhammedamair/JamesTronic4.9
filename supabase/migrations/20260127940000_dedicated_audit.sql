-- ============================================================================
-- C20 ExpansionOS - Phase 3.2: Dedicated Audit Log
-- JamesTronic Platform
-- ============================================================================
-- Purpose:
-- 1. Create expansion_audit_log (since ai_audit_log is a view/immutable)
-- 2. Update _c20_log_access to use dedicated table
-- ============================================================================

-- 1. Create Table
CREATE TABLE IF NOT EXISTS public.expansion_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_module text NOT NULL,
    event_type text NOT NULL,
    payload jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL,
    
    -- Metadata
    user_id uuid, -- Link to auth.users (optional)
    role text,    -- Snapshot of role at time of action
    details jsonb -- Additional context
);

CREATE INDEX IF NOT EXISTS idx_expansion_audit_module ON expansion_audit_log(ai_module);
CREATE INDEX IF NOT EXISTS idx_expansion_audit_created ON expansion_audit_log(created_at DESC);

-- 2. RLS
ALTER TABLE expansion_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_service_all ON expansion_audit_log
    FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);

-- Admin read-only
CREATE POLICY audit_admin_select ON expansion_audit_log
    FOR SELECT
    TO authenticated
    USING (public._c20_app_role() IN ('admin', 'super_admin'));

-- 3. Update Helper
CREATE OR REPLACE FUNCTION public._c20_log_access(
    p_table_name text,
    p_city_id uuid, -- Logged inside payload/details
    p_action text,
    p_details jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    INSERT INTO expansion_audit_log (
        ai_module,
        event_type,
        payload,
        user_id,
        role,
        details,
        created_at
    ) VALUES (
        'expansion_os',
        'ACCESS_' || upper(p_action),
        jsonb_build_object(
            'table', p_table_name,
            'city_id', p_city_id
        ),
        auth.uid(),
        public._c20_app_role(),
        p_details,
        now()
    );
END;
$$;
