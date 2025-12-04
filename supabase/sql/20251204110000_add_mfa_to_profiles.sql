-- Add MFA-related columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mfa_enabled_at TIMESTAMPTZ;

-- Add attempt_count column to admin_mfa_sessions table
ALTER TABLE admin_mfa_sessions
ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0;

-- Update the admin_mfa_sessions RLS to allow admins to update MFA attempts
-- We need to add a new policy for updates specifically

-- First, let's check if we need to modify the existing policy or add a new one
-- Existing policy: CREATE POLICY "Admins can manage all MFA sessions" ON public.admin_mfa_sessions
-- FOR ALL USING (get_my_role() = 'admin');

-- The existing policy should handle updates, but we'll make sure it's properly configured
DROP POLICY IF EXISTS "Admins can manage all MFA sessions" ON public.admin_mfa_sessions;

-- Create a comprehensive policy for admin MFA sessions
CREATE POLICY "Users can view own MFA sessions" ON public.admin_mfa_sessions
    FOR SELECT USING (
        auth.uid() = user_id OR
        get_my_role() = 'admin'
    );

CREATE POLICY "Admins can manage all MFA sessions" ON public.admin_mfa_sessions
    FOR ALL USING (
        get_my_role() = 'admin'
    );