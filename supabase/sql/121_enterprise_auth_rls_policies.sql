-- Row Level Security Policies for JamesTronic Enterprise Authentication
-- Implements role-based access control for all tables in the system
-- Uses get_my_role() helper function consistent with existing architecture

-- Enable RLS on all new tables
ALTER TABLE session_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_claims ENABLE ROW LEVEL SECURITY;

-- Session Records RLS Policies
-- Only allow users to view their own sessions
CREATE POLICY "Users can view own sessions" ON session_records
  FOR SELECT USING (
    auth.uid() = user_id OR
    (get_my_role() = 'admin' OR get_my_role() = 'staff')
  );

-- Only allow authenticated users to create sessions (handled by application)
CREATE POLICY "Users can create own sessions" ON session_records
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR
    (get_my_role() = 'admin' OR get_my_role() = 'staff')
  );

-- Only allow users to update their own sessions (status changes)
CREATE POLICY "Users can update own sessions" ON session_records
  FOR UPDATE USING (
    auth.uid() = user_id OR
    (get_my_role() = 'admin' OR get_my_role() = 'staff')
  ) WITH CHECK (
    auth.uid() = user_id OR
    (get_my_role() = 'admin' OR get_my_role() = 'staff')
  );

-- Devices RLS Policies
-- Only allow users to view their own devices
CREATE POLICY "Users can view own devices" ON devices
  FOR SELECT USING (
    auth.uid() = user_id OR
    (get_my_role() = 'admin' OR get_my_role() = 'staff')
  );

-- Only allow authenticated users to register/update their own devices
CREATE POLICY "Users can manage own devices" ON devices
  FOR ALL USING (
    auth.uid() = user_id OR
    (get_my_role() = 'admin' OR get_my_role() = 'staff')
  );

-- Login Attempts RLS Policies (read-only for regular users, can insert new records)
CREATE POLICY "Users can insert login attempts" ON login_attempts
  FOR INSERT WITH CHECK (true); -- Allow all users to insert (application handles verification)

CREATE POLICY "Users can view own login attempts" ON login_attempts
  FOR SELECT USING (
    auth.uid() = user_id OR
    (get_my_role() = 'admin' OR get_my_role() = 'staff')
  );

-- Device Conflicts RLS Policies (admin/staff only)
CREATE POLICY "Admins can manage device conflicts" ON device_conflicts
  FOR ALL USING (
    (get_my_role() = 'admin' OR get_my_role() = 'staff')
  );

-- Users can view conflicts related to their account
CREATE POLICY "Users can view own device conflicts" ON device_conflicts
  FOR SELECT USING (auth.uid() = user_id);

-- Role Claims RLS Policies
CREATE POLICY "Users can view own role claims" ON role_claims
  FOR SELECT USING (
    auth.uid() = user_id OR
    (get_my_role() = 'admin' OR get_my_role() = 'staff')
  );

-- Only admins can modify roles
CREATE POLICY "Admins can manage role claims" ON role_claims
  FOR ALL USING (
    get_my_role() = 'admin'
  );

-- Apply RLS policies to existing tables (tickets, customers, etc.)
-- This builds on existing RLS for the tickets table
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Policy for technicians: can only see their assigned tickets
CREATE POLICY "Technicians can view assigned tickets" ON tickets
  FOR SELECT USING (
    get_my_role() = 'technician' AND
    assigned_technician_id = get_my_profile_id()
  );

-- Policy for staff/admin: can see all tickets
CREATE POLICY "Admins and staff can view all tickets" ON tickets
  FOR SELECT USING (
    (get_my_role() = 'admin' OR get_my_role() = 'staff')
  );

-- Policy for customers: can only see their own tickets
CREATE POLICY "Customers can view own tickets" ON tickets
  FOR SELECT USING (
    get_my_role() = 'customer' AND
    customer_id = (
      SELECT id FROM customers WHERE user_id = auth.uid()
    )
  );

-- Allow admin/staff to insert/update tickets
CREATE POLICY "Admins and staff can manage tickets" ON tickets
  FOR ALL USING (
    (get_my_role() = 'admin' OR get_my_role() = 'staff')
  );

-- For technicians: can update assigned tickets
CREATE POLICY "Technicians can update assigned tickets" ON tickets
  FOR UPDATE USING (
    get_my_role() = 'technician' AND
    assigned_technician_id = get_my_profile_id()
  );

-- Apply RLS to customers table
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policy for customers: can only see their own record
CREATE POLICY "Customers can view own profile" ON customers
  FOR SELECT USING (
    get_my_role() = 'customer' AND
    user_id = auth.uid()
  );

-- Policy for admin/staff: can view all customer records
CREATE POLICY "Admins and staff can view all customers" ON customers
  FOR SELECT USING (
    (get_my_role() = 'admin' OR get_my_role() = 'staff')
  );

-- Allow admin/staff to manage customers
CREATE POLICY "Admins and staff can manage customers" ON customers
  FOR ALL USING (
    (get_my_role() = 'admin' OR get_my_role() = 'staff')
  );

-- Policy for profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    get_my_role() = 'admin'
  );

-- Admins can manage all profiles
CREATE POLICY "Admins can manage profiles" ON profiles
  FOR ALL USING (
    get_my_role() = 'admin'
  );

-- Apply RLS to ticket_status_history table
ALTER TABLE ticket_status_history ENABLE ROW LEVEL SECURITY;

-- Policy for technicians: can see history for their assigned tickets
CREATE POLICY "Technicians can view status history for assigned tickets" ON ticket_status_history
  FOR SELECT USING (
    get_my_role() = 'technician' AND
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_id
      AND t.assigned_technician_id = get_my_profile_id()
    )
  );

-- Policy for admin/staff: can see all status history
CREATE POLICY "Admins and staff can view all status history" ON ticket_status_history
  FOR SELECT USING (
    (get_my_role() = 'admin' OR get_my_role() = 'staff')
  );

-- Policy for customers: can see history for their tickets
CREATE POLICY "Customers can view status history for own tickets" ON ticket_status_history
  FOR SELECT USING (
    get_my_role() = 'customer' AND
    EXISTS (
      SELECT 1 FROM tickets t, customers c
      WHERE t.id = ticket_id
      AND t.customer_id = c.id
      AND c.user_id = auth.uid()
    )
  );

-- Apply RLS to action_logs table
ALTER TABLE action_logs ENABLE ROW LEVEL SECURITY;

-- Policy for admin/staff: can see all action logs
CREATE POLICY "Admins and staff can view all action logs" ON action_logs
  FOR SELECT USING (
    (get_my_role() = 'admin' OR get_my_role() = 'staff')
  );

-- Policy for technicians: can see logs for their tickets
CREATE POLICY "Technicians can view action logs for assigned tickets" ON action_logs
  FOR SELECT USING (
    get_my_role() = 'technician' AND
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_id
      AND t.assigned_technician_id = get_my_profile_id()
    )
  );

-- Policy for customers: can see logs for their tickets
CREATE POLICY "Customers can view action logs for own tickets" ON action_logs
  FOR SELECT USING (
    get_my_role() = 'customer' AND
    EXISTS (
      SELECT 1 FROM tickets t, customers c
      WHERE t.id = ticket_id
      AND t.customer_id = c.id
      AND c.user_id = auth.uid()
    )
  );