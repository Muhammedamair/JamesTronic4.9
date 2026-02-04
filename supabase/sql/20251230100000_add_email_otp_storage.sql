-- Create table to store email OTPs with expiration
CREATE TABLE IF NOT EXISTS public.email_otps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '10 minutes',
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE
);

-- Create index for efficient email lookups
CREATE INDEX IF NOT EXISTS idx_email_otps_email ON public.email_otps (email);

-- Create index for expired OTP cleanup
CREATE INDEX IF NOT EXISTS idx_email_otps_expires_at ON public.email_otps (expires_at);

-- Create index for active OTP lookups (unverified and not expired)
-- Using all relevant columns in the index, without a predicate that uses NOW()
CREATE INDEX IF NOT EXISTS idx_email_otps_active ON public.email_otps (email, otp, verified, expires_at);

-- RLS policy: For email OTPs, we'll allow service role full access
-- Since OTPs are verified by the API and not directly by users, we may not need complex RLS
-- The verification happens in the API layer, not through direct DB access
ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage OTP records
CREATE POLICY "Service role full access" ON public.email_otps
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to clean up expired OTPs
CREATE OR REPLACE FUNCTION cleanup_expired_email_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM public.email_otps WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a function to verify an OTP
CREATE OR REPLACE FUNCTION verify_email_otp(p_email TEXT, p_otp TEXT)
RETURNS TABLE(success BOOLEAN, message TEXT, user_id UUID) AS $$
DECLARE
  found_otp RECORD;
  user_profile RECORD;
BEGIN
  -- Find the OTP record
  SELECT * INTO found_otp
  FROM public.email_otps
  WHERE email = p_email
    AND otp = p_otp
    AND verified = FALSE
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  -- Check if OTP exists and is valid
  IF found_otp IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Invalid or expired OTP', NULL::UUID;
    RETURN;
  END IF;

  -- Mark OTP as verified
  UPDATE public.email_otps
  SET verified = TRUE, verified_at = NOW()
  WHERE id = found_otp.id;

  -- Get user ID if exists
  SELECT user_id INTO user_profile FROM profiles WHERE email = p_email LIMIT 1;

  -- If user doesn't exist, create a default profile
  IF user_profile.user_id IS NULL THEN
    -- Create a new user in auth if needed and a profile
    -- This is a simplified approach - in practice, you'd handle this differently
    RETURN QUERY SELECT TRUE, 'OTP verified successfully', NULL::UUID;
  ELSE
    RETURN QUERY SELECT TRUE, 'OTP verified successfully', user_profile.user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;