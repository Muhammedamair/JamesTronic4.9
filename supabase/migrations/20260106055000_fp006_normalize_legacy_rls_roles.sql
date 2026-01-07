-- FP-006: Normalize legacy RLS role tokens (manager/owner) to real app_role enum roles.
-- RULE: If original policy referenced 'staff', keep admin+staff access; else admin-only.
-- This prevents future role drift and removes dead/legacy tokens from live pg_policies.

DO $$
DECLARE
  r RECORD;
  predicate TEXT;
BEGIN
  FOR r IN
    SELECT
      schemaname,
      tablename,
      policyname,
      cmd,
      qual::text AS qual_txt,
      COALESCE(with_check::text, '') AS with_check_txt
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        qual ILIKE '%manager%' OR qual ILIKE '%owner%' OR
        COALESCE(with_check::text,'') ILIKE '%manager%' OR
        COALESCE(with_check::text,'') ILIKE '%owner%'
      )
      AND (
        qual ILIKE '%get_user_role_for_rls()%' OR
        qual ILIKE '%get_my_role()%' OR
        qual ILIKE '%auth.jwt()%'
      )
  LOOP
    IF r.qual_txt ILIKE '%staff%' OR r.with_check_txt ILIKE '%staff%' THEN
      predicate :=
        'EXISTS (SELECT 1 FROM public.profiles p ' ||
        'WHERE p.id = auth.uid() AND p.role IN (''admin''::app_role, ''staff''::app_role))';
    ELSE
      predicate :=
        'EXISTS (SELECT 1 FROM public.profiles p ' ||
        'WHERE p.id = auth.uid() AND p.role = ''admin''::app_role)';
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);

    IF r.cmd = 'SELECT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s);',
        r.policyname, r.tablename, predicate
      );
    ELSIF r.cmd = 'INSERT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s);',
        r.policyname, r.tablename, predicate
      );
    ELSIF r.cmd = 'UPDATE' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s);',
        r.policyname, r.tablename, predicate, predicate
      );
    ELSIF r.cmd = 'DELETE' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s);',
        r.policyname, r.tablename, predicate
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR %s TO authenticated USING (%s) WITH CHECK (%s);',
        r.policyname, r.tablename, r.cmd, predicate, predicate
      );
    END IF;
  END LOOP;
END $$;
