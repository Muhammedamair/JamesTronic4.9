-- Migration: Grant SELECT on branches to all roles
-- This ensures that the public booking flow and customer dashboard can resolve branch IDs

-- 1. Grant SELECT permission to authenticated and anon roles
GRANT SELECT ON public.branches TO authenticated, anon;

-- 2. Enable Row Level Security (if not already enabled)
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- 3. Create a public SELECT policy
-- Branch information (name, address, location) is considered non-sensitive public data
DROP POLICY IF EXISTS "Allow public read access to branches" ON public.branches;
CREATE POLICY "Allow public read access to branches" ON public.branches
    FOR SELECT
    USING (true);

-- 4. Audit Note
COMMENT ON TABLE public.branches IS 'Stores store locations. Policies allow public read access for booking flow.';
