-- Phase C9.3: Device Lock Enforcement & Conflict Handling
-- RLS policies for device_lock and device_lock_conflicts tables

-- RLS for device_lock table
ALTER TABLE public.device_lock ENABLE ROW LEVEL SECURITY;

-- Technicians and transporters cannot read or modify device_lock table
DROP POLICY IF EXISTS "Technicians and transporters cannot access device_lock" ON public.device_lock;
CREATE POLICY "Technicians and transporters cannot access device_lock" ON public.device_lock
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('technician', 'transporter')
  );

-- Staff can read device_lock table
DROP POLICY IF EXISTS "Staff can read device_lock" ON public.device_lock;
CREATE POLICY "Staff can read device_lock" ON public.device_lock
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('staff', 'admin')
  );

-- Admins can modify device_lock table
DROP POLICY IF EXISTS "Admins can manage device_lock" ON public.device_lock;
CREATE POLICY "Admins can manage device_lock" ON public.device_lock
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- RLS for device_lock_conflicts table
ALTER TABLE public.device_lock_conflicts ENABLE ROW LEVEL SECURITY;

-- Technicians and transporters cannot read or modify device_lock_conflicts table
DROP POLICY IF EXISTS "Technicians and transporters cannot access device_lock_conflicts" ON public.device_lock_conflicts;
CREATE POLICY "Technicians and transporters cannot access device_lock_conflicts" ON public.device_lock_conflicts
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('technician', 'transporter')
  );

-- Staff can read device_lock_conflicts table
DROP POLICY IF EXISTS "Staff can read device_lock_conflicts" ON public.device_lock_conflicts;
CREATE POLICY "Staff can read device_lock_conflicts" ON public.device_lock_conflicts
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('staff', 'admin')
  );

-- Admins can manage device_lock_conflicts table
DROP POLICY IF EXISTS "Admins can manage device_lock_conflicts" ON public.device_lock_conflicts;
CREATE POLICY "Admins can manage device_lock_conflicts" ON public.device_lock_conflicts
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );