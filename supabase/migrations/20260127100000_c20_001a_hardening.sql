-- ============================================================================
-- C20 ExpansionOS - Phase 1.1: Security Hardening Patch
-- JamesTronic Platform
-- ============================================================================
-- Purpose:
-- 1. Harden SECURITY DEFINER functions with explicit search_path
-- 2. Add canonical role extractor _c20_app_role()
-- 3. Make enum creation idempotent
-- 4. Add PostGIS enabled test helper
-- ============================================================================
-- Job ID: C20_PHASE1_1_HARDENING
-- Priority: P0 (Security)
-- Date: 2026-01-27
-- ============================================================================

-- ============================================================================
-- STEP 1: Canonical Role Extractor (Hardened)
-- ============================================================================
-- Checks app_role in multiple JWT locations for platform compatibility

CREATE OR REPLACE FUNCTION public._c20_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'app_role',
    auth.jwt() -> 'app_metadata' ->> 'app_role',
    auth.jwt() -> 'user_metadata' ->> 'app_role',
    auth.jwt() ->> 'role',
    'anon'
  );
$$;

COMMENT ON FUNCTION public._c20_app_role() IS
'Canonical role extractor for C20 (checks top-level + app_metadata/user_metadata fallbacks).';

-- ============================================================================
-- STEP 2: Hardened Multi-City Access Helper
-- ============================================================================
-- Replaces previous version with proper search_path and consistent role extraction

CREATE OR REPLACE FUNCTION public._c20_is_city_accessible(target_city_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text;
  v_allowed_cities uuid[];
  v_single_city uuid;
  v_allowed_raw jsonb;
BEGIN
  v_role := public._c20_app_role();

  -- Admin + service bypass
  IF v_role IN ('admin', 'super_admin') OR auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  -- Read allowed_city_ids from app_metadata first (preferred), then fallback
  v_allowed_raw :=
    COALESCE(
      auth.jwt() -> 'app_metadata' -> 'allowed_city_ids',
      auth.jwt() -> 'allowed_city_ids'
    );

  IF jsonb_typeof(v_allowed_raw) = 'array' THEN
    v_allowed_cities := ARRAY(
      SELECT jsonb_array_elements_text(v_allowed_raw)::uuid
    );
  END IF;

  IF v_allowed_cities IS NOT NULL AND array_length(v_allowed_cities, 1) > 0 THEN
    RETURN target_city_id = ANY(v_allowed_cities);
  END IF;

  -- Fallback single city_id
  v_single_city :=
    COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'city_id')::uuid,
      (auth.jwt() ->> 'city_id')::uuid
    );

  IF v_single_city IS NOT NULL THEN
    RETURN target_city_id = v_single_city;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public._c20_is_city_accessible(uuid) IS 
'Multi-city RLS helper with hardened search_path. Checks allowed_city_ids[] array or city_id fallback.';

-- ============================================================================
-- STEP 3: Idempotent Enum Creation
-- ============================================================================
-- Wrap enum creation to avoid migration re-run errors

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'expansion_candidate_status'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.expansion_candidate_status AS ENUM
      ('identified','under_evaluation','shortlisted','approved','rejected','launched');
  END IF;
END $$;

-- ============================================================================
-- STEP 4: PostGIS Enabled Test Helper
-- ============================================================================
-- Reliable way to check PostGIS from client (pg_extension not exposed via PostgREST)

CREATE OR REPLACE FUNCTION public._c20_postgis_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis');
$$;

COMMENT ON FUNCTION public._c20_postgis_enabled() IS 
'Returns true if PostGIS extension is enabled. Safe to call from client.';

-- ============================================================================
-- STEP 5: Audit Access Helper (Hardened)
-- ============================================================================

CREATE OR REPLACE FUNCTION public._c20_log_access(
    p_table_name text,
    p_city_id uuid,
    p_action text,
    p_details jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Insert into ai_audit_log if it exists (from C15)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_audit_log') THEN
        INSERT INTO ai_audit_log (
            ai_module,
            event_type,
            payload,
            created_at
        ) VALUES (
            'expansion_os',
            'ACCESS_' || upper(p_action),
            jsonb_build_object(
                'table', p_table_name,
                'city_id', p_city_id,
                'user_id', auth.uid(),
                'role', public._c20_app_role(),
                'details', p_details
            ),
            now()
        );
    END IF;
END;
$$;

-- ============================================================================
-- STEP 6: Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public._c20_postgis_enabled() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._c20_app_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._c20_is_city_accessible(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._c20_log_access(text, uuid, text, jsonb) TO authenticated, service_role;

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'C20 Phase 1.1: Security hardening patch applied.';
    RAISE NOTICE 'Hardened: _c20_app_role(), _c20_is_city_accessible(), _c20_log_access()';
    RAISE NOTICE 'Added: _c20_postgis_enabled() test helper';
    RAISE NOTICE 'Fixed: Enum creation now idempotent';
END $$;
