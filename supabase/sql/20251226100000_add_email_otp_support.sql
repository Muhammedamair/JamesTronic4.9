-- Add email column to login_otp_requests table and update channel constraint
ALTER TABLE public.login_otp_requests ADD COLUMN IF NOT EXISTS email TEXT;

-- Update the channel constraint to include 'email'
ALTER TABLE public.login_otp_requests DROP CONSTRAINT IF EXISTS login_otp_requests_channel_check;
ALTER TABLE public.login_otp_requests ADD CONSTRAINT login_otp_requests_channel_check CHECK (channel IN ('whatsapp', 'sms', 'email'));

-- Create index for email-based queries
CREATE INDEX IF NOT EXISTS idx_login_otp_requests_email_created_at ON public.login_otp_requests (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_otp_requests_email_unconsumed ON public.login_otp_requests (email) WHERE consumed_at IS NULL AND email IS NOT NULL;

-- Update the unique constraint to be conditional based on channel
DROP INDEX IF EXISTS idx_login_otp_requests_phone_unconsumed;
CREATE UNIQUE INDEX IF NOT EXISTS idx_login_otp_requests_phone_unconsumed ON public.login_otp_requests (phone_e164) WHERE consumed_at IS NULL AND phone_e164 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_login_otp_requests_email_unconsumed ON public.login_otp_requests (email) WHERE consumed_at IS NULL AND email IS NOT NULL;