-- Create user_sessions table with refresh token functionality
CREATE TABLE public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    refresh_token_hash TEXT NOT NULL,
    device_fingerprint TEXT,
    ip_address TEXT,
    user_agent TEXT,
    role TEXT NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create indexes
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions (user_id);
CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions (expires_at);
CREATE INDEX idx_user_sessions_refresh_token_hash ON public.user_sessions (refresh_token_hash);
CREATE INDEX idx_user_sessions_active_user ON public.user_sessions (user_id) WHERE revoked = FALSE;

-- Enable Row Level Security
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only view their own sessions (and admins can view all)
CREATE POLICY "Users can view own sessions" ON public.user_sessions
    FOR SELECT USING (
        auth.uid() = user_id OR
        get_my_role() = 'admin'
    );

-- No INSERT/UPDATE/DELETE policies for anon/auth roles
-- Writes will be done via service role in Next.js API (bypass RLS)

-- Create admin_mfa_sessions table for admin MFA integration
CREATE TABLE public.admin_mfa_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.user_sessions(id) ON DELETE CASCADE,
    mfa_token_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    attempt_count INTEGER DEFAULT 0
);

-- Create indexes for admin_mfa_sessions
CREATE INDEX idx_admin_mfa_sessions_user_id ON public.admin_mfa_sessions (user_id);
CREATE INDEX idx_admin_mfa_sessions_session_id ON public.admin_mfa_sessions (session_id);
CREATE INDEX idx_admin_mfa_sessions_expires_at ON public.admin_mfa_sessions (expires_at);

-- Enable RLS for admin_mfa_sessions
ALTER TABLE public.admin_mfa_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_mfa_sessions
CREATE POLICY "Users can view own MFA sessions" ON public.admin_mfa_sessions
    FOR SELECT USING (
        auth.uid() = user_id OR
        get_my_role() = 'admin'
    );

CREATE POLICY "Admins can manage all MFA sessions" ON public.admin_mfa_sessions
    FOR ALL USING (
        get_my_role() = 'admin'
    );