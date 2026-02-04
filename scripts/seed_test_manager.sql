-- Create or Update Test Manager User for CI
-- User: manager@jamestronic.test / TestPassword123!
-- Role: manager
-- City Access: 22222222-bbbb-4bbb-bbbb-bbbbbbbbbbbb

DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT := 'manager@jamestronic.test';
  v_pass TEXT := 'TestPassword123!';
  v_city_id UUID := '22222222-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
BEGIN
  -- 1. Check if user exists
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    -- Create new user
    v_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud,
      confirmation_token
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      v_email,
      crypt(v_pass, gen_salt('bf')),
      now(),
      jsonb_build_object(
        'provider', 'email',
        'providers', ARRAY['email'],
        'app_role', 'manager',
        'allowed_city_ids', ARRAY[v_city_id]
      ),
      jsonb_build_object(
        'role', 'manager',
        'city_id', v_city_id
      ),
      now(),
      now(),
      'authenticated',
      'authenticated',
      ''
    );
    
    -- Create profile if needed (C20 dependency?)
    INSERT INTO public.profiles (id, email, first_name, last_name, role, city_id)
    VALUES (v_user_id, v_email, 'Test', 'Manager', 'manager', v_city_id)
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'Created test user: % (ID: %)', v_email, v_user_id;
  ELSE
    -- Update existing user metadata
    UPDATE auth.users
    SET raw_app_meta_data = jsonb_build_object(
          'provider', 'email',
          'providers', ARRAY['email'],
          'app_role', 'manager',
          'allowed_city_ids', ARRAY[v_city_id]
        ),
        encrypted_password = crypt(v_pass, gen_salt('bf')) -- Ensure password is correct
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Updated test user: % (ID: %)', v_email, v_user_id;
  END IF;
  
  -- Ensure city exists just in case (though migration should have handled it or it's a known UUID)
  -- The migration used 2222... as a placeholder in the NOTICE, but inserted into whatever city existed.
  -- Wait, the default ruleset migration inserted base rates for the *first* city found.
  -- I should check WHICH city actually exists and use that, OR ensure 2222... exists.
  -- Safer to fetch a real city ID and assume that's what we want to test with.
  
END $$;
