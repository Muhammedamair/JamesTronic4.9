-- Ensure the heatmap view runs as INVOKER (so caller RLS applies), if supported.
DO $$
BEGIN
  EXECUTE 'ALTER VIEW public.c20_heatmap_points_v1 SET (security_invoker=true)';
EXCEPTION WHEN OTHERS THEN
  -- If Postgres version doesn’t support security_invoker, do nothing.
  -- RLS should still apply via underlying tables, but this avoids accidental bypass.
  NULL;
END $$;
