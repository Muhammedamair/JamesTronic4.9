-- C16: Transporter Engine V0 - Test Bundle
-- This file contains SQL to test the basic functionality of the transport system

-- Test 1: Create a basic transport job (as admin/staff)
-- This assumes you have:
-- - A ticket with ID (existing in the system)
-- - A branch with ID (from C14)
-- - A transporter profile with ID

-- Example test data (replace with actual IDs from your system):
/*
INSERT INTO public.transport_jobs (
  ticket_id,
  branch_id,
  job_type,
  status,
  assigned_transporter_id,
  pickup_notes,
  drop_notes,
  pickup_address_text,
  drop_address_text,
  pickup_lat,
  pickup_lng,
  drop_lat,
  drop_lng,
  scheduled_at
) VALUES (
  'existing-ticket-id',      -- Replace with actual ticket ID
  'existing-branch-id',      -- Replace with actual branch ID
  'PICKUP',                  -- job_type
  'assigned',                -- status
  'transporter-profile-id',  -- assigned_transporter_id
  'Please wait at the gate', -- pickup_notes
  'Leave at reception',      -- drop_notes
  '123 Main St, City',       -- pickup_address_text
  '456 Park Ave, City',      -- drop_address_text
  17.4474,                   -- pickup_lat (example: Hyderabad)
  78.3762,                   -- pickup_lng
  17.4500,                   -- drop_lat
  78.3800,                   -- drop_lng
  NOW() + INTERVAL '1 hour'  -- scheduled_at
);

-- Test 2: Create a custody event (as transporter)
INSERT INTO public.custody_ledger (
  transport_job_id,
  ticket_id,
  event_type,
  event_meta,
  actor_id,
  actor_role
) VALUES (
  'transport-job-id-from-above',  -- transport_job_id
  'same-ticket-id-as-above',      -- ticket_id
  'PICKUP_CONFIRMED',             -- event_type
  '{"proof_photo_url": "https://example.com/photo.jpg", "notes": "Item picked up successfully"}', -- event_meta
  'transporter-profile-id',       -- actor_id
  'transporter'                   -- actor_role
);

-- Test 3: Insert a location ping (as transporter)
INSERT INTO public.transporter_location_pings (
  transporter_id,
  lat,
  lng,
  accuracy_meters
) VALUES (
  'transporter-profile-id',  -- transporter_id
  17.4475,                   -- lat (slightly different from pickup)
  78.3765,                   -- lng
  5.0                        -- accuracy_meters
);
*/

-- Test 4: Verify RLS policies work (these should return different results based on user role)
-- As a transporter, you should only see jobs assigned to you:
-- SELECT * FROM public.transport_jobs WHERE assigned_transporter_id = get_my_profile_id();

-- As a customer, you should only see jobs related to your tickets:
-- SELECT tj.* FROM public.transport_jobs tj
-- JOIN public.tickets t ON tj.ticket_id = t.id
-- JOIN public.customers c ON t.customer_id = c.id
-- WHERE c.user_id = auth.uid();

-- As admin/staff, you should see all jobs:
-- SELECT * FROM public.transport_jobs;