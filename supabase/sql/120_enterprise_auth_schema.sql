-- Session Records Table
-- Stores active and historical session information for all users

CREATE TABLE IF NOT EXISTS session_records (
    id TEXT PRIMARY KEY,                    -- Unique session identifier
    user_id UUID NOT NULL,                  -- Reference to auth.users or profiles
    device_id TEXT NOT NULL,                -- Device identifier
    role TEXT NOT NULL,                     -- User role at time of session creation
    token_hash TEXT NOT NULL,               -- Hash of the JWT token for security
    status TEXT NOT NULL DEFAULT 'active',  -- active, inactive, expired, revoked
    ip_address INET,                        -- IP address of the session
    user_agent TEXT,                        -- User agent string
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  -- Session creation time
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,       -- Session expiration time
    logged_out_at TIMESTAMP WITH TIME ZONE, -- Time when session was logged out
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- Last activity timestamp
);

-- Index for quick lookup by user_id and status
CREATE INDEX idx_session_records_user_status ON session_records (user_id, status);

-- Index for quick lookup by device_id
CREATE INDEX idx_session_records_device ON session_records (device_id);

-- Index for expiration cleanup
CREATE INDEX idx_session_records_expires ON session_records (expires_at);

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM session_records 
    WHERE expires_at < NOW() 
    AND status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Devices Table
-- Stores information about devices used by users

CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,                    -- Unique device identifier
    user_id UUID NOT NULL,                  -- Reference to auth.users or profiles
    role TEXT,                              -- Primary role associated with this device
    user_agent TEXT,                        -- Browser/device user agent
    platform TEXT,                          -- Operating system platform
    ip_address INET,                        -- Last known IP address
    location TEXT,                          -- Last known location (city, country)
    is_active BOOLEAN DEFAULT TRUE,         -- Whether this device is currently active
    first_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  -- When device was first registered
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Last activity timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()   -- Record creation time
);

-- Index for user-device lookups
CREATE INDEX idx_devices_user ON devices (user_id);

-- Index for active devices per user
CREATE INDEX idx_devices_user_active ON devices (user_id, is_active);

-- Login Attempts Table
-- Tracks authentication attempts for security monitoring

CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,  -- Unique attempt identifier
    identifier TEXT NOT NULL,                       -- Phone number, email, or other identifier
    user_id UUID,                                 -- User ID if known (NULL for failed attempts)
    device_id TEXT,                               -- Device used for the attempt
    ip_address INET NOT NULL,                     -- IP address of the attempt
    success BOOLEAN NOT NULL,                     -- Whether the attempt was successful
    method TEXT NOT NULL,                         -- 'otp', 'magic_link', 'password', etc.
    role TEXT,                                    -- Role being requested
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- Time of the attempt
);

-- Index for identifier-based lookups
CREATE INDEX idx_login_attempts_identifier ON login_attempts (identifier, created_at);

-- Index for IP-based lookups
CREATE INDEX idx_login_attempts_ip ON login_attempts (ip_address, created_at);

-- Index for user-based lookups
CREATE INDEX idx_login_attempts_user ON login_attempts (user_id, created_at);

-- Device Conflicts Table
-- Tracks when multiple devices attempt to access restricted accounts

CREATE TABLE IF NOT EXISTS device_conflicts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,  -- Unique conflict identifier
    user_id UUID NOT NULL,                          -- User involved in conflict
    new_device_id TEXT NOT NULL,                    -- Device that initiated the conflict
    old_device_ids TEXT[] NOT NULL,                 -- Array of devices that were active
    role TEXT NOT NULL,                             -- Role of the user during conflict
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- When conflict occurred
    resolved BOOLEAN DEFAULT FALSE,                 -- Whether conflict was resolved
    resolution_notes TEXT,                          -- Notes about how conflict was resolved
    admin_resolved_by UUID,                         -- Admin who resolved the conflict
    admin_resolved_at TIMESTAMP WITH TIME ZONE      -- When conflict was resolved
);

-- Index for user-based conflict lookups
CREATE INDEX idx_device_conflicts_user ON device_conflicts (user_id, timestamp);

-- Role Claims Table
-- Stores role assignments and permissions for users

CREATE TABLE IF NOT EXISTS role_claims (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,  -- Unique claim identifier
    user_id UUID NOT NULL,                          -- User the role is assigned to
    role TEXT NOT NULL,                             -- Role name (customer, technician, etc.)
    granted_by UUID,                                -- User who granted the role
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- When role was granted
    expires_at TIMESTAMP WITH TIME ZONE,            -- When role expires (NULL = never)
    active BOOLEAN DEFAULT TRUE,                    -- Whether role is currently active
    notes TEXT,                                     -- Additional notes about role assignment
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Record creation time
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()  -- Last update time
);

-- Index for user-role lookups
CREATE INDEX idx_role_claims_user_active ON role_claims (user_id, active);

-- Index for role-based queries
CREATE INDEX idx_role_claims_role ON role_claims (role, active);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at for role_claims
CREATE TRIGGER update_role_claims_updated_at
    BEFORE UPDATE ON role_claims
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON session_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON devices TO authenticated;
GRANT SELECT, INSERT ON login_attempts TO authenticated;
GRANT SELECT ON device_conflicts TO authenticated;
GRANT SELECT ON role_claims TO authenticated;

-- RLS Policies will be set up separately as they require specific application logic
-- These are the base tables for the enterprise authentication system