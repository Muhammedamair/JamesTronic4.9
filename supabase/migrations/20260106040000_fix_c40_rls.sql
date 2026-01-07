-- ============================================================================
-- FIX: Enable RLS on C40 AI Governance Tables
-- JamesTronic Platform
-- ============================================================================

-- 1. Enable RLS on all C40 tables
ALTER TABLE public.compliance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Create Policies for Compliance Policies (Read-Only for most, Manage for Admins)

-- Everyone authenticated can read policies (to know the rules)
CREATE POLICY "Authenticated users can view compliance policies"
ON public.compliance_policies FOR SELECT
TO authenticated
USING (true);

-- Only Admins/Managers can manage policies
CREATE POLICY "Admins can manage compliance policies"
ON public.compliance_policies FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));


-- 3. Create Policies for Compliance Violations (Strict Access)

-- View: Admins + The assigned resolver + potentially the person involved (if we link user_id)
-- For now, strictly Admin/Manager/Owner
CREATE POLICY "Admins can view and manage violations"
ON public.compliance_violations FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));


-- 4. Create Policies for AI Audit Logs (Transparency but Controlled)

-- Admins can view all logs
CREATE POLICY "Admins can view ai audit logs"
ON public.ai_audit_logs FOR SELECT
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

-- Users can view their own logs (Transparency)
CREATE POLICY "Users can view their own ai audit logs"
ON public.ai_audit_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- System Service Role has full access (Implicit in Supabase but good to be clear in design)
GRANT ALL ON public.compliance_policies TO service_role;
GRANT ALL ON public.compliance_violations TO service_role;
GRANT ALL ON public.ai_audit_logs TO service_role;
