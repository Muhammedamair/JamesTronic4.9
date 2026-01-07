# Database Migration for Email OTP Support

## Overview
This migration adds support for email-based OTP authentication to the JamesTronic platform.

## Changes Included
- Adds `email` column to the `login_otp_requests` table
- Updates the `channel` constraint to include 'email' option
- Creates indexes for efficient email-based queries
- Updates unique constraints to work with both phone and email

## Prerequisites
Before running the migration, ensure you have:
- Supabase project access
- Service role key for your Supabase project
- Environment variables configured:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Running the Migration

### Option 1: Using the Migration Script
1. Install dependencies:
   ```bash
   npm install @supabase/supabase-js
   ```

2. Run the migration script:
   ```bash
   node scripts/run-db-migration.js
   ```

### Option 2: Manual SQL Execution
Execute the following SQL commands directly in your Supabase SQL Editor:

```sql
-- Add email column to login_otp_requests table
ALTER TABLE public.login_otp_requests ADD COLUMN IF NOT EXISTS email TEXT;

-- Update the channel constraint to include 'email'
ALTER TABLE public.login_otp_requests DROP CONSTRAINT IF EXISTS login_otp_requests_channel_check;
ALTER TABLE public.login_otp_requests ADD CONSTRAINT login_otp_requests_channel_check CHECK (channel IN ('whatsapp', 'sms', 'email'));

-- Create indexes for email-based queries
CREATE INDEX IF NOT EXISTS idx_login_otp_requests_email_created_at ON public.login_otp_requests (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_otp_requests_email_unconsumed ON public.login_otp_requests (email) WHERE consumed_at IS NULL AND email IS NOT NULL;

-- Update the unique constraint to be conditional based on channel
DROP INDEX IF EXISTS idx_login_otp_requests_phone_unconsumed;
CREATE UNIQUE INDEX IF NOT EXISTS idx_login_otp_requests_phone_unconsumed ON public.login_otp_requests (phone_e164) WHERE consumed_at IS NULL AND phone_e164 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_login_otp_requests_email_unconsumed ON public.login_otp_requests (email) WHERE consumed_at IS NULL AND email IS NOT NULL;
```

## Post-Migration Steps
1. Restart your application server
2. Test email OTP functionality
3. Verify that phone OTP functionality still works

## Rollback (if needed)
If you need to rollback these changes, execute:

```sql
-- Drop email column
ALTER TABLE public.login_otp_requests DROP COLUMN IF EXISTS email;

-- Restore original channel constraint
ALTER TABLE public.login_otp_requests DROP CONSTRAINT IF EXISTS login_otp_requests_channel_check;
ALTER TABLE public.login_otp_requests ADD CONSTRAINT login_otp_requests_channel_check CHECK (channel IN ('whatsapp', 'sms'));

-- Drop email indexes
DROP INDEX IF EXISTS idx_login_otp_requests_email_created_at;
DROP INDEX IF EXISTS idx_login_otp_requests_email_unconsumed;

-- Restore original unique constraint
DROP INDEX IF EXISTS idx_login_otp_requests_phone_unconsumed;
CREATE UNIQUE INDEX IF NOT EXISTS idx_login_otp_requests_phone_unconsumed ON public.login_otp_requests (phone_e164) WHERE consumed_at IS NULL;
```

## Troubleshooting
- If you get permission errors, ensure you're using the service role key (not the anon key)
- If the migration script fails, you may need to run the SQL commands manually
- Make sure your Supabase project has the necessary permissions to alter tables