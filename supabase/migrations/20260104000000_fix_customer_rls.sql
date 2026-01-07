-- 20260104000000_fix_customer_rls.sql
-- Fix RLS policies for the customers table to allow authenticated customers to create/update their own records

-- Drop existing policies if they conflict (enterprise auth RLS might have some)
DROP POLICY IF EXISTS "Customers can view own profile" ON public.customers;
DROP POLICY IF EXISTS "Customers can insert own profile" ON public.customers;
DROP POLICY IF EXISTS "Customers can update own profile" ON public.customers;

-- Enable RLS (should already be enabled, but just in case)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Customers can only see their own record
CREATE POLICY "Customers can view own profile" ON public.customers
    FOR SELECT USING (
        user_id = auth.uid()
    );

-- 2. INSERT: Customers can create their own record
-- This is critical for the booking flow
CREATE POLICY "Customers can insert own profile" ON public.customers
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
    );

-- 3. UPDATE: Customers can update their own record
CREATE POLICY "Customers can update own profile" ON public.customers
    FOR UPDATE USING (
        user_id = auth.uid()
    ) WITH CHECK (
        user_id = auth.uid()
    );

-- 4. Admins and staff can manage everything (already exists in some files, but ensuring consistency)
DROP POLICY IF EXISTS "Admins and staff can manage customers" ON public.customers;
CREATE POLICY "Admins and staff can manage customers" ON public.customers
    FOR ALL USING (
        (get_my_role() = 'admin' OR get_my_role() = 'staff')
    );

-- Grant permissions to authenticated users
GRANT ALL ON public.customers TO authenticated;
