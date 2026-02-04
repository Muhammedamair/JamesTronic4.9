-- C16: Transporter Engine V0 - Transporter Location Pings Table
-- Creates the append-only table for GPS tracking to support geolock verification

-- Create transporter_location_pings table (append-only, GPS tracking)
CREATE TABLE IF NOT EXISTS public.transporter_location_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transporter_id UUID NOT NULL REFERENCES public.profiles(id), -- Which transporter
  lat DOUBLE PRECISION NOT NULL, -- Latitude
  lng DOUBLE PRECISION NOT NULL, -- Longitude
  accuracy_meters DOUBLE PRECISION, -- GPS accuracy in meters
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_transporter_location_pings_transporter_id ON public.transporter_location_pings(transporter_id);
CREATE INDEX idx_transporter_location_pings_recorded_at ON public.transporter_location_pings(recorded_at DESC);
-- Index for geolock queries (most recent ping per transporter)
CREATE INDEX idx_transporter_location_pings_latest ON public.transporter_location_pings(transporter_id, recorded_at DESC);

-- Enable Row Level Security
ALTER TABLE public.transporter_location_pings ENABLE ROW LEVEL SECURITY;

-- RLS policies for transporter_location_pings
-- Admins and staff have read access to last ping only
CREATE POLICY "transporter_location_pings_admin_read" ON public.transporter_location_pings
  FOR SELECT USING (
    get_my_role() IN ('admin', 'staff', 'manager')
  );

-- Transporters can only see and insert their own pings
CREATE POLICY "transporter_location_pings_transporter_own" ON public.transporter_location_pings
  FOR ALL USING (
    get_my_role() = 'transporter' 
    AND transporter_id = get_my_profile_id()
  );

-- Customers cannot access location pings (privacy protection)