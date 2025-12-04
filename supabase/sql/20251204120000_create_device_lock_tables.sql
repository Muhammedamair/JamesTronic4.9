-- Phase C9.3: Device Lock Enforcement & Conflict Handling
-- Create device_lock and device_lock_conflicts tables

-- Create device_lock table
CREATE TABLE IF NOT EXISTS public.device_lock (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    device_fingerprint_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    override_allowed BOOLEAN DEFAULT FALSE
);

-- Create device_lock_conflicts table
CREATE TABLE IF NOT EXISTS public.device_lock_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    old_device TEXT,
    new_device TEXT,
    ip_address INET,
    user_agent TEXT
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_device_lock_updated_at 
    BEFORE UPDATE ON public.device_lock 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_device_lock_user_id ON public.device_lock(user_id);
CREATE INDEX IF NOT EXISTS idx_device_lock_conflicts_user_id ON public.device_lock_conflicts(user_id);
CREATE INDEX IF NOT EXISTS idx_device_lock_conflicts_detected_at ON public.device_lock_conflicts(detected_at);