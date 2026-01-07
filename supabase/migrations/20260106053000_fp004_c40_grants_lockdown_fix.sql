-- FP-004: C40 Governance Grants Lockdown (Authenticated WRITE revoke)
-- Goal: Authenticated users must not be able to INSERT/UPDATE/DELETE governance tables directly.
-- Read access remains possible but is still constrained by RLS policies.

-- Remove any accidental grants
REVOKE ALL PRIVILEGES ON TABLE public.compliance_policies   FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.compliance_violations FROM anon, authenticated;

-- Allow read only (RLS will still gate to admin-only policies)
GRANT SELECT ON TABLE public.compliance_policies   TO authenticated;
GRANT SELECT ON TABLE public.compliance_violations TO authenticated;

-- Keep service_role fully capable (defensive explicit grant)
GRANT ALL PRIVILEGES ON TABLE public.compliance_policies   TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.compliance_violations TO service_role;
