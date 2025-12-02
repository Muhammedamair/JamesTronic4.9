-- Add all enterprise auth roles to the app_role enum if it exists
-- This handles the case where the app_role enum is expected but not fully populated

-- Check if app_role enum exists and add missing values
DO $$
BEGIN
   -- Add 'customer' role if app_role enum exists and 'customer' is not present
   IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
      IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role') AND enumlabel = 'customer') THEN
         ALTER TYPE app_role ADD VALUE 'customer';
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role') AND enumlabel = 'transporter') THEN
         ALTER TYPE app_role ADD VALUE 'transporter';
      END IF;
   END IF;
END$$;