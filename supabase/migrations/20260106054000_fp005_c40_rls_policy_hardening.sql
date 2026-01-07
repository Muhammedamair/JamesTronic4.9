-- FP-005: C40 RLS Policy Hardening (role alignment + remove broad read)

-- 1) Remove overly-broad policy (readable by all authenticated)
DROP POLICY IF EXISTS "Authenticated users can view compliance policies"
ON public.compliance_policies;

-- 2) Replace misaligned admin policy (manager/owner do not exist in app_role)
DROP POLICY IF EXISTS "Admins can manage compliance policies"
ON public.compliance_policies;

-- 3) Recreate correct policies using app_role enum in profiles.role

-- Read: only admin + staff
CREATE POLICY "C40: Admin/Staff can read compliance_policies"
ON public.compliance_policies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin'::app_role, 'staff'::app_role)
  )
);

-- Write: admin only
CREATE POLICY "C40: Admin can manage compliance_policies"
ON public.compliance_policies
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'::app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'::app_role
  )
);

-- 4) Harden compliance_violations policy (replace misaligned roles if present)
DROP POLICY IF EXISTS "Admins can view and manage violations"
ON public.compliance_violations;

-- Read: admin + staff
CREATE POLICY "C40: Admin/Staff can read compliance_violations"
ON public.compliance_violations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin'::app_role, 'staff'::app_role)
  )
);

-- Write: admin only (even though grants are SELECT-only now, keep policy correct)
CREATE POLICY "C40: Admin can manage compliance_violations"
ON public.compliance_violations
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'::app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'::app_role
  )
);

-- Optional hardening (safe even if already forced):
ALTER TABLE public.compliance_policies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_violations FORCE ROW LEVEL SECURITY;
