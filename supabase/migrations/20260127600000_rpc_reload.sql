-- Force schema cache reload via simple notify
CREATE OR REPLACE FUNCTION public.rpc_reload_schema()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_reload_schema() TO authenticated, service_role, anon;
