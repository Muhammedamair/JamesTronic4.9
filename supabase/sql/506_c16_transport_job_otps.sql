-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create table if missing
CREATE TABLE IF NOT EXISTS public.transport_job_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transport_job_id UUID NOT NULL REFERENCES public.transport_jobs(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('PICKUP_HANDOVER', 'DROP_HANDOVER')),
  otp_hash TEXT NOT NULL,
  otp_salt TEXT DEFAULT gen_random_uuid()::TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  max_attempts INTEGER NOT NULL DEFAULT 5,
  attempts_used INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transport_job_otps_job_id ON public.transport_job_otps(transport_job_id);
CREATE INDEX IF NOT EXISTS idx_transport_job_otps_purpose ON public.transport_job_otps(purpose);
CREATE INDEX IF NOT EXISTS idx_transport_job_otps_expires_at ON public.transport_job_otps(expires_at);
CREATE INDEX IF NOT EXISTS idx_transport_job_otps_active_on_not_consumed
  ON public.transport_job_otps(transport_job_id, purpose)
  WHERE consumed_at IS NULL;

-- Enable RLS
ALTER TABLE public.transport_job_otps ENABLE ROW LEVEL SECURITY;

-- Create deny SELECT policy if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'transport_job_otps'
      AND policyname = 'transport_job_otps_deny_select'
  ) THEN
    EXECUTE $create_policy$
      CREATE POLICY transport_job_otps_deny_select ON public.transport_job_otps
        FOR SELECT
        USING (false);
    $create_policy$;
  END IF;
END
$$;

-- Create service_ops policy if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'transport_job_otps'
      AND policyname = 'transport_job_otps_service_ops'
  ) THEN
    EXECUTE $create_policy$
      CREATE POLICY transport_job_otps_service_ops ON public.transport_job_otps
        FOR ALL
        USING (
          (auth.jwt() ->> 'role') IS NOT NULL AND (auth.jwt() ->> 'role') = 'service_role'
        )
        WITH CHECK (
          (auth.jwt() ->> 'role') IS NOT NULL AND (auth.jwt() ->> 'role') = 'service_role'
        );
    $create_policy$;
  END IF;
END
$$;

-- Create disable client insert policy if missing (INSERT uses only WITH CHECK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'transport_job_otps'
      AND policyname = 'transport_job_otps_disable_client_insert'
  ) THEN
    EXECUTE $create_policy$
      CREATE POLICY transport_job_otps_disable_client_insert ON public.transport_job_otps
        FOR INSERT
        WITH CHECK (false);
    $create_policy$;
  END IF;
END
$$;