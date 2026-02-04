-- C14: Create branches table

-- Create the branches table to support multi-location operations
CREATE TABLE IF NOT EXISTS public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  city text,
  state text,
  pincode text,
  phone text,
  email text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add updated_at trigger for branches table
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER branches_updated_at
    BEFORE UPDATE ON public.branches
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Create indexes for branches table
CREATE INDEX IF NOT EXISTS idx_branches_city ON public.branches(city);
CREATE INDEX IF NOT EXISTS idx_branches_state ON public.branches(state);
CREATE INDEX IF NOT EXISTS idx_branches_active ON public.branches(is_active);