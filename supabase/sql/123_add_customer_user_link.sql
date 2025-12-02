-- 123_add_customer_user_link.sql
-- Link customers to Supabase auth.users via user_id
-- This enables Enterprise Auth RLS to safely use customers.user_id = auth.uid()

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id);

-- Optional but recommended: index for faster RLS checks
CREATE INDEX IF NOT EXISTS customers_user_id_idx
  ON customers (user_id);
