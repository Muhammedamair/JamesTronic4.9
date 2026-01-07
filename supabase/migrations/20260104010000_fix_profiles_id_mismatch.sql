-- Migration: Fix profiles ID mismatch
-- Ensures that profiles.id always matches auth.users.id for consistent foreign key referencing

-- 1. Update the handle_new_user function to explicitly set the profile ID
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  requested_role text;
  full_name text;
  profile_exists boolean;
  customer_exists boolean;
BEGIN
  -- 1. Check if a profile already exists to prevent duplicate entries.
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = NEW.id) INTO profile_exists;
  
  -- Even if profile exists, we should ensure the ID mapping is correct if we're in this trigger
  -- but usually we just return NEW to avoid conflicts.
  IF profile_exists THEN
    RETURN NEW;
  END IF;

  -- 2. Safely determine the user's role.
  requested_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  IF requested_role NOT IN ('admin', 'staff', 'technician', 'transporter', 'customer') THEN
    requested_role := 'customer';
  END IF;
  
  -- 3. Set a fallback full_name if not provided.
  full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.phone, NEW.email);

  -- 4. Handle different roles.
  IF requested_role IN ('technician', 'transporter') THEN
    INSERT INTO public.pending_technicians (user_id, full_name, requested_role, status)
    VALUES (NEW.id, full_name, requested_role::app_role, 'pending');
  ELSE
    -- FIX: Explicitly set id to NEW.id so that profiles.id = auth.users.id
    INSERT INTO public.profiles (id, user_id, full_name, role)
    VALUES (NEW.id, NEW.id, full_name, requested_role::app_role);

    -- If the user is a 'customer', also create an entry in the 'customers' table.
    IF requested_role = 'customer' THEN
        SELECT EXISTS(SELECT 1 FROM public.customers WHERE user_id = NEW.id) INTO customer_exists;
        IF NOT customer_exists THEN
            INSERT INTO public.customers (user_id, name, phone_e164)
            VALUES (NEW.id, full_name, NEW.phone);
        END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Audit Note
COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger for new auth users. Ensures profiles.id = auth.users.id for FK consistency.';
