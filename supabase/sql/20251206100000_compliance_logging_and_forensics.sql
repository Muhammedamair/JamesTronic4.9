-- Phase C11: Compliance Logging & Forensic Audit Layer
-- Create append-only, tamper-evident audit trail for security and admin-sensitive events

-- Create audit_log_entries table
CREATE TABLE IF NOT EXISTS public.audit_log_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_user_id UUID, 
    actor_role TEXT, 
    session_id UUID, 
    ip_address TEXT,
    user_agent TEXT,
    event_type TEXT NOT NULL, 
    entity_type TEXT NOT NULL, 
    entity_id TEXT, 
    severity TEXT NOT NULL DEFAULT 'info',
    metadata JSONB NOT NULL DEFAULT '{}',
    prev_hash TEXT,
    hash TEXT NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_audit_log_created_at ON public.audit_log_entries (created_at DESC);
CREATE INDEX idx_audit_log_actor_user ON public.audit_log_entries (actor_user_id);
CREATE INDEX idx_audit_log_entity ON public.audit_log_entries (entity_type, entity_id);
CREATE INDEX idx_audit_log_event_type ON public.audit_log_entries (event_type);

-- Enable Row Level Security
ALTER TABLE public.audit_log_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies for audit_log_entries
-- No UPDATE or DELETE allowed (enforced via triggers as well)
CREATE POLICY "No updates allowed on audit logs" ON public.audit_log_entries
    FOR UPDATE TO authenticated
    USING (false);

CREATE POLICY "No delete allowed on audit logs" ON public.audit_log_entries
    FOR DELETE TO authenticated
    USING (false);

-- Only service role can insert records
CREATE POLICY "Service role can insert audit logs" ON public.audit_log_entries
    FOR INSERT TO service_role
    WITH CHECK (true);

-- Admins can read all audit logs
CREATE POLICY "Admins can read all audit logs" ON public.audit_log_entries
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Staff can read non-critical audit logs
CREATE POLICY "Staff can read non-critical audit logs" ON public.audit_log_entries
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'staff'
        )
        AND severity IN ('info', 'warning')
    );

-- Create a simplified view for admin-focused logs
CREATE VIEW public.admin_action_logs_view AS 
SELECT * FROM public.audit_log_entries 
WHERE actor_role = 'admin';

-- Trigger function to compute hash and prev_hash before insert
CREATE OR REPLACE FUNCTION compute_audit_log_hash()
RETURNS TRIGGER AS $$
DECLARE
    prev_record RECORD;
    input_string TEXT;
BEGIN
    -- Get the previous record to set prev_hash
    SELECT * INTO prev_record 
    FROM public.audit_log_entries 
    ORDER BY created_at DESC 
    LIMIT 1;

    -- Set prev_hash to the hash of the previous record
    NEW.prev_hash := prev_record.hash;

    -- Create input string for hashing
    -- Include all important fields to detect tampering
    input_string := COALESCE(NEW.created_at::TEXT, '') || 
                    COALESCE(NEW.actor_user_id::TEXT, '') || 
                    COALESCE(NEW.actor_role::TEXT, '') || 
                    COALESCE(NEW.session_id::TEXT, '') || 
                    COALESCE(NEW.ip_address, '') || 
                    COALESCE(NEW.user_agent, '') || 
                    COALESCE(NEW.event_type, '') || 
                    COALESCE(NEW.entity_type, '') || 
                    COALESCE(NEW.entity_id, '') || 
                    COALESCE(NEW.severity, '') || 
                    COALESCE(NEW.metadata::TEXT, '') || 
                    COALESCE(NEW.prev_hash, '');

    -- Compute SHA-256 hash
    NEW.hash := ENCODE(DIGEST(input_string, 'sha256'), 'hex');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to compute hash before insert
CREATE TRIGGER audit_log_hash_trigger
    BEFORE INSERT ON public.audit_log_entries
    FOR EACH ROW
    EXECUTE FUNCTION compute_audit_log_hash();

-- Trigger to prevent updates (defense in depth)
CREATE OR REPLACE FUNCTION prevent_audit_log_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries cannot be modified';
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent updates
CREATE TRIGGER audit_log_update_prevention
    BEFORE UPDATE ON public.audit_log_entries
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_update();

-- Trigger to prevent deletion (defense in depth)
CREATE OR REPLACE FUNCTION prevent_audit_log_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries cannot be deleted';
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent deletion
CREATE TRIGGER audit_log_delete_prevention
    BEFORE DELETE ON public.audit_log_entries
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_delete();