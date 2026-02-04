-- C12.1: Add composite index for ticket_events table
-- Improves query performance for fetching events by ticket_id and created_at

-- Create composite index for ticket_events (ticket_id, created_at)
-- This allows efficient filtering by ticket and ordering by time
CREATE INDEX idx_ticket_events_ticket_id_created_at ON public.ticket_events (ticket_id, created_at DESC);

-- Also create an index for event_type for filtering by event type
CREATE INDEX idx_ticket_events_event_type ON public.ticket_events (event_type);

-- Update existing indexes if needed
-- The individual indexes are still useful for queries that don't filter by both columns
-- CREATE INDEX idx_ticket_events_ticket_id ON public.ticket_events(ticket_id); -- This was already created in the base tables
-- CREATE INDEX idx_ticket_events_created_at ON public.ticket_events(created_at DESC); -- This was already created in the base tables