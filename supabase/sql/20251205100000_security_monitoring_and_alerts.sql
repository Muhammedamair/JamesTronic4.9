-- Phase C10: Security Monitoring & Automated Alerts Layer
-- Implement centralized security monitoring with rule-based alerts

-- Create security_alert_rules table
CREATE TABLE IF NOT EXISTS public.security_alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    severity TEXT NOT NULL DEFAULT 'warning', 
    source_type TEXT NOT NULL, 
    condition JSONB NOT NULL, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create security_alerts table
CREATE TABLE IF NOT EXISTS public.security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES public.security_alert_rules(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    status TEXT NOT NULL DEFAULT 'open', 
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Create security_notification_channels table
CREATE TABLE IF NOT EXISTS public.security_notification_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_type TEXT NOT NULL, 
    target TEXT NOT NULL,         
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on all new tables
ALTER TABLE public.security_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_notification_channels ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for security_alert_rules
CREATE POLICY "Admins can manage security alert rules" ON public.security_alert_rules
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Create RLS policies for security_alerts
CREATE POLICY "Admins can view all security alerts" ON public.security_alerts
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Staff can view non-critical security alerts" ON public.security_alerts
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'staff'
        )
        AND severity IN ('info', 'warning')
    );

-- Create policy for service role to insert alerts
CREATE POLICY "Service role can insert security alerts" ON public.security_alerts
    FOR INSERT TO service_role
    WITH CHECK (true);

-- Create RLS policy for security_notification_channels
CREATE POLICY "Admins can manage notification channels" ON public.security_notification_channels
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_alert_rules_is_active ON public.security_alert_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_security_alert_rules_source_type ON public.security_alert_rules(source_type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_rule_id ON public.security_alerts(rule_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON public.security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON public.security_alerts(status);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON public.security_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_security_notification_channels_active ON public.security_notification_channels(is_active);

-- Insert default security alert rules
INSERT INTO public.security_alert_rules (name, description, severity, source_type, condition) VALUES
(
    'MULTIPLE_ADMIN_MFA_FAILURES',
    'Detect multiple MFA failures for an admin in short time',
    'high',
    'admin_security_events',
    '{
      "event_type": "MFA_CHALLENGE_FAILED",
      "window_minutes": 15,
      "threshold": 5,
      "group_by": "admin_user_id"
    }'
),
(
    'DEVICE_CONFLICT_STORM',
    'Detect possible credential sharing or attack on technician account',
    'high',
    'device_lock_conflicts',
    '{
      "window_minutes": 30,
      "threshold": 3,
      "group_by": "user_id"
    }'
),
(
    'OTP_ABUSE_SINGLE_NUMBER',
    'Detect repeated OTP requests from a single phone number',
    'medium',
    'login_otp_requests',
    '{
      "window_minutes": 10,
      "threshold": 10,
      "group_by": "phone_e164"
    }'
);