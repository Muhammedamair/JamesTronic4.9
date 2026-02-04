# Email Configuration Guide for JamesTronic

This guide explains how to set up email delivery for the OTP (One-Time Password) authentication system in JamesTronic.

## Environment Variables Required

To enable email delivery, you need to configure the following environment variables in your `.env.local` file:

```bash
# SMTP Configuration for Email Delivery
SMTP_HOST=smtp.gmail.com                    # SMTP server host (e.g., smtp.gmail.com, smtp.sendgrid.net)
SMTP_PORT=587                              # SMTP server port (587 for TLS, 465 for SSL)
SMTP_USER=your-email@gmail.com             # Your email address
SMTP_PASSWORD=your-app-password            # Your email password or app-specific password
SMTP_FROM_EMAIL=noreply@jamestronic.com   # Email address to send from
```

## Email Service Providers Setup

### 1. Gmail (Recommended for Development)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Navigate to Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
3. **Configure Environment Variables**:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-16-char-app-password
   SMTP_FROM_EMAIL=your-email@gmail.com
   ```

### 2. SendGrid (Recommended for Production)

1. **Create a SendGrid Account** at https://sendgrid.com
2. **Generate an API Key** in the SendGrid dashboard
3. **Use SendGrid's SMTP settings**:
   ```bash
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASSWORD=your-sendgrid-api-key
   SMTP_FROM_EMAIL=your-verified-sender@yourdomain.com
   ```

### 3. Outlook/Hotmail

```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
SMTP_FROM_EMAIL=your-email@outlook.com
```

## Testing Email Configuration

1. **Add the environment variables** to your `.env.local` file
2. **Restart your development server**:
   ```bash
   npm run dev
   ```
3. **Test the OTP flow** by entering an email address and clicking "Get OTP"
4. **Check your email** for the OTP message

## Troubleshooting

### Common Issues:

1. **Email not being sent**:
   - Verify all SMTP environment variables are set correctly
   - Check that your `.env.local` file is in the root of your project
   - Ensure your email provider allows SMTP access

2. **Authentication errors**:
   - For Gmail, make sure you're using an App Password, not your regular password
   - Verify the SMTP_USER matches your email address

3. **Connection timeouts**:
   - Check your internet connection
   - Verify the SMTP_HOST and SMTP_PORT are correct
   - Some networks may block certain SMTP ports

### Development Mode:

If you don't configure SMTP variables, the system will log the OTP to the console for development purposes:
```
[EMAIL SERVICE NOT CONFIGURED] OTP for user@example.com is: 123456
```

## Security Notes

- **Never commit** your `.env.local` file to version control
- **Use strong passwords** and app-specific passwords when available
- **Monitor your email service usage** to avoid exceeding limits
- **Keep your SMTP credentials secure** and rotate them periodically

## Production Considerations

- Use a dedicated email service provider (SendGrid, AWS SES, Mailgun)
- Implement proper error handling and retry mechanisms
- Monitor email delivery rates and bounces
- Consider using transactional email templates
- Implement rate limiting to prevent abuse

## Database Migration

To support email OTP functionality, you need to run the following database migration:

```sql
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
```

## Support

If you continue to have issues with email delivery:
1. Check the server console for error messages
2. Verify your email service provider settings
3. Make sure the email_otps table is created in your database
4. Test with a different email provider if needed