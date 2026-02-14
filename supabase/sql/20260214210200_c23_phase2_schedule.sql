-- ============================================================
-- C23 Phase 2: Scheduled Generator (pg_cron / pg_net)
-- Runs nightly at 02:00 UTC via Supabase pg_cron
-- Server-only: no client trigger path
-- ============================================================

-- Option 1: pg_cron schedule (if extension available)
-- This is the preferred approach: database-native, no external deps.

-- Enable pg_cron if not already
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Nightly schedule: 02:00 UTC every day
-- SELECT cron.schedule(
--   'c23-nightly-packets',
--   '0 2 * * *',
--   $$SELECT public.c23_generate_packets()$$
-- );

-- Weekly schedule: Sunday 03:00 UTC (optional, for 90-day trend recalc)
-- SELECT cron.schedule(
--   'c23-weekly-packets',
--   '0 3 * * 0',
--   $$SELECT public.c23_generate_packets()$$
-- );

-- NOTE: The above pg_cron statements are commented out because
-- pg_cron must be enabled in the Supabase dashboard first.
-- Once enabled, uncomment and apply.

-- ============================================================
-- Alternative: Use a Supabase Edge Function with service role
-- Deploy as: supabase functions deploy c23-generate-packets
-- Trigger via: Supabase Dashboard > Database > Cron Jobs
--   or via pg_net HTTP call to the Edge Function URL
-- ============================================================

-- For now, the generator can be invoked manually for testing:
-- SELECT public.c23_generate_packets();
-- This returns the number of packets generated.
