-- Ensure public.customers exists (Dependency for C3 Fix Customer RLS)

CREATE TABLE IF NOT EXISTS public.customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    full_name text,
    phone text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'Customers can view own profile'
    ) THEN
        CREATE POLICY "Customers can view own profile" ON public.customers FOR SELECT USING ( user_id = auth.uid() );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'Customers can update own profile'
    ) THEN
        CREATE POLICY "Customers can update own profile" ON public.customers FOR UPDATE USING ( user_id = auth.uid() );
    END IF;
END $$;
