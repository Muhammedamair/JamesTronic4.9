-- Phase C9.4: Admin MFA Hardening & Anomaly Protection

-- Extend admin_mfa_sessions table with additional fields for anomaly detection
ALTER TABLE admin_mfa_sessions 
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS mfa_method TEXT DEFAULT 'totp',
ADD COLUMN IF NOT EXISTS challenge_type TEXT DEFAULT 'login',
ADD COLUMN IF NOT EXISTS trust_device BOOLEAN DEFAULT FALSE;

-- Create admin_security_events table for tracking security events
CREATE TABLE IF NOT EXISTS admin_security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB,
    severity TEXT NOT NULL DEFAULT 'info'
);

-- Enable Row Level Security on the new table
ALTER TABLE admin_security_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admin_security_events
CREATE POLICY "Admins can view all security events" ON admin_security_events
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Staff can view non-critical security events" ON admin_security_events
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.role = 'staff'
        )
        AND severity IN ('info', 'warning')
    );

-- Create policy for service role to insert events
CREATE POLICY "Service role can insert security events" ON admin_security_events
    FOR INSERT TO service_role
    WITH CHECK (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_admin_security_events_user_id ON admin_security_events(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_security_events_timestamp ON admin_security_events(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_admin_security_events_type ON admin_security_events(event_type);