CREATE OR REPLACE FUNCTION public.debug_auth()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'auth.role', auth.role(),
    'current_user', current_user,
    'jwt', auth.jwt()
  );
$$;
