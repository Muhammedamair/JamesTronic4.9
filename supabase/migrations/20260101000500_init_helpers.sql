-- Helper function to get the current user's application role
-- Restored for dependency resolution
-- V5: Add 'security' and 'hr' to app_role ENUM (Sync with init_profiles)

CREATE EXTENSION IF NOT EXISTS postgis;

-- (Enum creation moved to init_profiles.sql to satisfy dependency, but keeping safe check here is fine)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM (
            'super_admin',
            'admin',
            'manager',
            'staff',
            'customer',
            'technician',
            'transporter',
            'dealer',
            'security',
            'hr'
        );
    END IF;
END $$;


CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_role text;
BEGIN
  -- 1. Check app_metadata for 'app_role' (Set by Custom Claims or Hook)
  v_role := auth.jwt() -> 'app_metadata' ->> 'app_role';
  IF v_role IS NOT NULL THEN
      RETURN v_role;
  END IF;

  -- 2. Check metadata 'role'
  v_role := auth.jwt() -> 'app_metadata' ->> 'role';
  IF v_role IS NOT NULL THEN
      RETURN v_role;
  END IF;

  -- 3. Check profiles table if it exists (legacy/fallback)
  BEGIN
    SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid(); -- Explicit Cast
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF v_role IS NOT NULL THEN
      RETURN v_role;
  END IF;

  -- 4. Fallback to auth.role() (postgres role)
  RETURN auth.role();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, service_role, anon;
