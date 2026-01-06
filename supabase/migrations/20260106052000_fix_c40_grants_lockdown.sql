-- Fix Pack: C40 Grants Lockdown (reduce attack surface)
-- Purpose: remove anon privileges on compliance tables.
-- RLS is the main gate, but anon should not have write privileges here.

ALTER TABLE public.compliance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_violations ENABLE ROW LEVEL SECURITY;

-- Remove all privileges from anon (critical)
REVOKE ALL PRIVILEGES ON TABLE public.compliance_policies FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.compliance_violations FROM anon;

-- Optional hardening: remove dangerous privileges from authenticated (keep CRUD only)
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.compliance_policies FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.compliance_violations FROM authenticated;

-- Ensure authenticated retains CRUD (admin/security are still authenticated users; RLS will enforce)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.compliance_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.compliance_violations TO authenticated;
