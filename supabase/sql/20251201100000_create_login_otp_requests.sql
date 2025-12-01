-- Create login_otp_requests table
CREATE TABLE public.login_otp_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_e164 TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    ip_address TEXT,
    user_agent TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    meta JSONB NOT NULL DEFAULT '{}'::JSONB
);

-- Create indexes
CREATE INDEX idx_login_otp_requests_phone_created_at ON public.login_otp_requests (phone_e164, created_at DESC);
CREATE INDEX idx_login_otp_requests_expires_at ON public.login_otp_requests (expires_at);
CREATE UNIQUE INDEX idx_login_otp_requests_phone_unconsumed ON public.login_otp_requests (phone_e164) WHERE consumed_at IS NULL;

-- Enable Row Level Security
ALTER TABLE public.login_otp_requests ENABLE ROW LEVEL SECURITY;

-- Note: No policies are created as this table should only be accessed by backend APIs using service role