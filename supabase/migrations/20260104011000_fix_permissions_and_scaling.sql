-- Migration: Fix permissions and address scaling concerns
-- 1. Restore EXECUTE permissions to helper functions
-- 2. Enhance helper functions with SECURITY DEFINER for RLS bypass consistency
-- 3. Address the scaling question via comments and architecture reinforcement

-- 1. Enhance get_my_role to be more robust and secure
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role 
  FROM public.profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;
  
  RETURN COALESCE(v_role, 'customer');
END;
$$;

-- 2. Enhance get_my_profile_id to be more robust and secure
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id 
  FROM public.profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;
  
  RETURN v_id;
END;
$$;

-- 3. Restore EXECUTE permissions
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO anon;

-- 4. Audit Note on Architecture & Scaling
-- The 'profiles' table is the standard hub for all roles (admin, staff, technician, customer).
-- This centralized model is highly scalable (PostgreSQL handles millions of rows efficiently).
-- For role-specific data, specialized tables (e.g., 'customers', 'technicians') link back to this identity core.
COMMENT ON TABLE public.profiles IS 'Standardized profile hub. Scalable for any role quantity. Roles use user_id to map to auth.users.';

-- 5. Final Permission Check: Ensure profiles is readable for ID lookup if needed
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- 6. Ensure action_logs and tickets can be inserted into
-- Re-applying permissions just in case there was a revoke somewhere
GRANT INSERT ON public.tickets TO authenticated;
GRANT SELECT ON public.tickets TO authenticated;
GRANT INSERT ON public.action_logs TO authenticated;
GRANT SELECT ON public.action_logs TO authenticated;
