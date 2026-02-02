import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(req: NextRequest) {
  // Generate request ID for observability
  const request_id = randomUUID();

  try {
    console.log(`[${request_id}] Starting verify-email-otp request`);

    // Parse request body
    const body = await req.json();
    const { email, otp, device_fingerprint, role_hint } = body;

    // Validate inputs early
    if (!email) {
      return new Response(
        JSON.stringify({
          ok: false,
          request_id,
          code: 'INVALID_INPUT',
          message: 'Email is required'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (!otp) {
      return new Response(
        JSON.stringify({
          ok: false,
          request_id,
          code: 'INVALID_INPUT',
          message: 'OTP is required'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Normalize and validate OTP format (should be 6 digits)
    const normalizedOtp = otp.toString().trim().replace(/\s+/g, '');
    if (normalizedOtp.length !== 6 || !/^\d{6}$/.test(normalizedOtp)) {
      return new Response(
        JSON.stringify({
          ok: false,
          request_id,
          code: 'INVALID_OTP_FORMAT',
          message: 'OTP must be 6 digits'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return new Response(
        JSON.stringify({
          ok: false,
          request_id,
          code: 'INVALID_EMAIL_FORMAT',
          message: 'Invalid email format'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Check for required environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      console.error(`[${request_id}] Missing Supabase environment variables`);
      return new Response(
        JSON.stringify({
          ok: false,
          request_id,
          code: 'SERVER_ERROR',
          message: 'Server configuration error'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client with the service role key for backend operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Normalize email for consistent handling
    const normalizedEmail = email.trim().toLowerCase();

    // Verify the OTP by checking it against the stored OTP in the database
    const { data: otpRecord, error: otpError } = await supabase
      .from('email_otps')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('otp', normalizedOtp)
      .is('verified', false) // Only unverified OTPs
      .gt('expires_at', new Date().toISOString()) // Only non-expired OTPs
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpRecord) {
      console.error(`[${request_id}] Invalid or expired OTP for email ${normalizedEmail}:`, otpError);
      return new Response(
        JSON.stringify({
          ok: false,
          request_id,
          code: 'OTP_INVALID',
          message: 'Invalid or expired OTP'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Mark the OTP as verified
    const { error: updateError } = await supabase
      .from('email_otps')
      .update({ verified: true, verified_at: new Date().toISOString() })
      .eq('id', otpRecord.id);

    if (updateError) {
      console.error(`[${request_id}] Error updating OTP record as verified:`, updateError);
      return new Response(
        JSON.stringify({
          ok: false,
          request_id,
          code: 'OTP_UPDATE_ERROR',
          message: 'Error verifying OTP'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Now that OTP is verified, create or get the user in Supabase Auth
    const anonSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Try to sign in the user (this creates the user if it doesn't exist)
    const { data: signInData, error: signInError } = await anonSupabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: true }
    });

    if (signInError) {
      console.error(`[${request_id}] Error signing in user:`, signInError);
      // If sign in fails, we'll try to get the user by email using the service role client
      // First, let's try to get all users and filter by email
      const { data: { users }, error: userError } = await anonSupabase.auth.admin.listUsers();

      if (userError || !users) {
        console.error(`[${request_id}] Error getting users list:`, userError);
        return new Response(
          JSON.stringify({
            ok: false,
            request_id,
            code: 'USER_ERROR',
            message: 'Error getting user information'
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Find the user with the matching email
      const user = users.find(u => u.email === normalizedEmail);

      if (!user) {
        console.error(`[${request_id}] User not found with email: ${normalizedEmail}`);
        return new Response(
          JSON.stringify({
            ok: false,
            request_id,
            code: 'USER_ERROR',
            message: 'User not found'
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Get user role from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error(`[${request_id}] Error fetching user profile:`, profileError);
        // We can still proceed with a default role, but log the error
      }

      const role = profileData?.role || role_hint || 'customer';
      console.log(`[${request_id}] User role determined as: ${role}`);

      return new Response(
        JSON.stringify({
          ok: true,
          request_id,
          user: {
            id: user.id,
            email: user.email,
          },
          role: role,
          message: "OTP verified successfully"
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // If sign in was successful, we have session data
    if (!signInData.user) {
      console.error(`[${request_id}] No user data returned from sign in`);
      return new Response(
        JSON.stringify({
          ok: false,
          request_id,
          code: 'USER_ERROR',
          message: 'No user data returned'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Extract user data to avoid type inference issues
    const user = signInData.user as any;
    if (!user.id || !user.email) {
      console.error(`[${request_id}] User data is incomplete`);
      return new Response(
        JSON.stringify({
          ok: false,
          request_id,
          code: 'USER_ERROR',
          message: 'User data is incomplete'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get user role from profiles table
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error(`[${request_id}] Error fetching user profile:`, profileError);
      // We can still proceed with a default role, but log the error
    }

    const role = profileData?.role || role_hint || 'customer';
    console.log(`[${request_id}] User role determined as: ${role}`);

    // Extract session data to avoid type inference issues
    const session = signInData.session as any;

    return new Response(
      JSON.stringify({
        ok: true,
        request_id,
        session: {
          access_token: session?.access_token,
          refresh_token: session?.refresh_token,
          expires_in: session?.expires_in,
          token_type: session?.token_type,
        },
        user: {
          id: user.id,
          email: user.email,
        },
        role: role,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    const errorRequestId = request_id;
    console.error(`[${errorRequestId}] Error in verify-email-otp API:`, error);

    // Log full error object for debugging
    console.error(`[${errorRequestId}] Full error object:`, {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      code: error?.code
    });

    // Return 400 JSON response (never throw) with structured error
    return new Response(
      JSON.stringify({
        ok: false,
        request_id: errorRequestId,
        code: error?.code || 'INTERNAL_ERROR',
        message: error?.message || 'Internal server error',
        status: 500
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}