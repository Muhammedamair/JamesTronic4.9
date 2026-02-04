-- Fix: Grant execute on get_my_role to authenticated users
-- This ensures the function is callable by authenticated users for RLS policies

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO service_role;

-- Also grant on _c19_get_my_role_text if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = '_c19_get_my_role_text' AND pronamespace = 'public'::regnamespace) THEN
        GRANT EXECUTE ON FUNCTION public._c19_get_my_role_text() TO authenticated;
        GRANT EXECUTE ON FUNCTION public._c19_get_my_role_text() TO anon;
        GRANT EXECUTE ON FUNCTION public._c19_get_my_role_text() TO service_role;
    END IF;
END $$;

-- Also grant on _c20_is_city_accessible if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = '_c20_is_city_accessible' AND pronamespace = 'public'::regnamespace) THEN
        GRANT EXECUTE ON FUNCTION public._c20_is_city_accessible(uuid) TO authenticated;
        GRANT EXECUTE ON FUNCTION public._c20_is_city_accessible(uuid) TO anon;
        GRANT EXECUTE ON FUNCTION public._c20_is_city_accessible(uuid) TO service_role;
    END IF;
END $$;
