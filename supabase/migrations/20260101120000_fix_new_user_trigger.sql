-- SECURE trigger to handle new user creation in Supabase Auth.
-- FIX: Ensures new users from email sign-ups default to 'customer' role.
-- Also ensures a corresponding 'customer' record is created for customer roles.
-- CORRECTED: Handles phone-only signups by using the phone number as a fallback name.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested_role text;
  full_name text;
  profile_exists boolean;
  customer_exists boolean;
begin
  -- 1. Check if a profile already exists to prevent duplicate entries.
  select exists(select 1 from public.profiles where user_id = new.id) into profile_exists;
  if profile_exists then
    return new;
  end if;

  -- 2. Safely determine the user's role.
  --    - Default to 'customer' if no role is specified in metadata.
  --    - Force to 'customer' if an invalid role is provided.
  requested_role := coalesce(new.raw_user_meta_data->>'role', 'customer');
  if requested_role not in ('admin', 'staff', 'technician', 'transporter', 'customer') then
    requested_role := 'customer';
  end if;
  
  -- 3. Set a fallback full_name if not provided. Use phone as fallback for phone-only signups.
  full_name := coalesce(new.raw_user_meta_data->>'full_name', new.phone, new.email);

  -- 4. Handle different roles with clear, distinct logic.
  
  -- Roles requiring admin approval go into a pending table.
  if requested_role in ('technician', 'transporter') then
    insert into public.pending_technicians (user_id, full_name, requested_role, status)
    values (new.id, full_name, requested_role::app_role, 'pending');
  
  -- All other valid roles ('customer', 'admin', 'staff') get a profile immediately.
  else
    insert into public.profiles (user_id, full_name, role)
    values (new.id, full_name, requested_role::app_role);

    -- If the user is a 'customer', also create an entry in the 'customers' table.
    if requested_role = 'customer' then
        select exists(select 1 from public.customers where user_id = new.id) into customer_exists;
        if not customer_exists then
            insert into public.customers (user_id, name, phone_e164)
            values (new.id, full_name, new.phone);
        end if;
    end if;

  end if;

  return new;
end;
$$;

-- Ensure the trigger is active by dropping the old one and creating a new one.
-- This makes the change idempotent.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
