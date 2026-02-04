-- Ensure public.profiles exists (Dependency for multiple modules)
-- V5: Add 'security' and 'hr' to app_role ENUM (Required for C22)

-- Define App Role Enum early
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM (
            'super_admin',
            'admin',
            'manager',
            'staff',
            'customer',
            'technician',
            'transporter',
            'dealer',
            'security',
            'hr'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    role public.app_role DEFAULT 'customer'::public.app_role, -- Typed column
    full_name text,
    avatar_url text,
    phone text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Basic RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Public profiles are viewable by everyone.'
    ) THEN
        CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING ( true );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert their own profile.'
    ) THEN
        CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK ( auth.uid() = user_id );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile.'
    ) THEN
        CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING ( auth.uid() = user_id );
    END IF;
END $$;
