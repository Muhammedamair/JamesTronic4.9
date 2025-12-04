import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Ensures a Supabase auth user and customer profile exist for a given phone number.
 * Links them appropriately based on existing records.
 *
 * @param phone_e164 The phone number in E.164 format (+91XXXXXXXXXX)
 * @param role_hint Optional hint for user role (customer, technician, admin, transporter)
 * @returns Object with userId and role
 */
export async function ensureUserForPhone(phone_e164: string, role_hint?: string | null) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // First, check if there's already a customer record for this phone
  const { data: existingCustomer, error: customerError } = await supabase
    .from('customers')
    .select('*')
    .eq('phone_e164', phone_e164)
    .single();

  if (customerError && customerError.code !== 'PGRST116') { // PGRST116 = Row not found
    console.error('Error querying customer:', customerError);
    throw new Error('Database error while fetching customer');
  }

  let userId: string | null = null;

  if (existingCustomer) {
    // Customer exists
    if (existingCustomer.user_id) {
      // Customer is already linked to an auth user
      userId = existingCustomer.user_id;
    } else {
      // Customer exists but no user_id - need to create auth user and link
      // Create a new auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: `${phone_e164.replace(/\+/g, '').replace(/\D/g, '')}@jamestronic-temp.com`,
        phone: phone_e164,
        email_confirm: true,
        phone_confirm: true,
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        throw new Error('Error creating user account');
      }

      userId = authUser.user.id;

      // Update customer with the new user_id
      const { error: updateError } = await supabase
        .from('customers')
        .update({ user_id: userId })
        .eq('id', existingCustomer.id);

      if (updateError) {
        console.error('Error updating customer with user_id:', updateError);
        throw new Error('Error linking user to customer');
      }
    }
  } else {
    // No customer exists, create both auth user and customer
    // Create a new auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: `${phone_e164.replace(/\+/g, '').replace(/\D/g, '')}@jamestronic-temp.com`,
      phone: phone_e164,
      email_confirm: true,
      phone_confirm: true,
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      throw new Error('Error creating user account');
    }

    userId = authUser.user.id;

    // Create customer record
    const { error: insertError } = await supabase
      .from('customers')
      .insert({
        user_id: userId,
        phone_e164: phone_e164,
        name: null, // Will be updated later if needed
        area: null,
      });

    if (insertError) {
      console.error('Error creating customer:', insertError);
      throw new Error('Error creating customer profile');
    }
  }

  // Ensure profile exists for the user
  const { data: existingProfile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = Row not found
    console.error('Error querying profile:', profileError);
    throw new Error('Database error while checking profile');
  }

  let finalRole = 'customer'; // Default role

  if (!existingProfile) {
    // Set role based on hint if provided and valid, otherwise default to customer
    if (role_hint && typeof role_hint === 'string' && ['customer', 'technician', 'admin', 'transporter'].includes(role_hint)) {
      finalRole = role_hint;
    } else {
      finalRole = 'customer'; // Default to customer
    }

    // Create profile record
    const { error: profileInsertError } = await supabase
      .from('profiles')
      .insert({
        user_id: userId,
        role: finalRole,
      });

    if (profileInsertError) {
      console.error('Error creating profile:', profileInsertError);
      throw new Error('Error creating user profile');
    }
  } else {
    // Profile exists, just use its role
    finalRole = existingProfile.role;
  }

  return { userId, role: finalRole };
}

/**
 * Verifies an OTP against the stored hash
 * @param otp The OTP provided by the user
 * @param hashedOTP The stored hash to verify against
 * @returns Boolean indicating if the OTP matches
 */
export async function verifyOTP(otp: string, hashedOTP: string): Promise<boolean> {
  return await bcrypt.compare(otp, hashedOTP);
}