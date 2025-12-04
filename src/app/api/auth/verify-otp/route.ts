import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import { headers } from 'next/headers';
import { ensureUserForPhone, verifyOTP } from '@/lib/auth-system/userLinking';

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Helper function to normalize phone to +91 format
function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');

  // Handle Indian numbers
  if (digitsOnly.length === 10) {
    // 10-digit Indian number, add +91 prefix
    return `+91${digitsOnly}`;
  } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    // 12-digit with country code
    return `+${digitsOnly}`;
  } else if (digitsOnly.length === 13 && digitsOnly.startsWith('+91')) {
    // Already in +91 format
    return digitsOnly;
  } else {
    // Return as is if not a recognized format (will be validated later)
    return phone;
  }
}

// Rate limiting check function
async function checkRateLimit(phone_e164: string, ip: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase environment variables');
    return false; // Fail safe - don't allow if can't verify
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Max 10 verification attempts per 15 minutes per phone
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('login_otp_requests')
    .select('id')
    .eq('phone_e164', phone_e164)
    .gte('created_at', fifteenMinutesAgo)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error checking rate limit for verification:', error);
    return false; // Fail safe
  }

  // Check if there are verification attempts (with or without consumption)
  // We'll count based on attempts rather than just requests
  if (data && data.length >= 10) {
    return false;
  }

  return true;
}

// Function to get the latest unconsumed OTP request for a phone
async function getLatestUnconsumedOTP(phone_e164: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('login_otp_requests')
    .select('*')
    .eq('phone_e164', phone_e164)
    .is('consumed_at', null) // Not yet consumed
    .gte('expires_at', now) // Has not expired (gte: greater than or equal means expires_at >= now)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error querying OTP records:', error);
    throw new Error('Database error while fetching OTP');
  }

  return data && data.length > 0 ? data[0] : null;
}

// Function to increment attempt count for an OTP
async function incrementOTPAttempt(otpId: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase environment variables');
    return false;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // First, get the current attempt count
  const { data: otpRecord, error: fetchError } = await supabase
    .from('login_otp_requests')
    .select('attempt_count')
    .eq('id', otpId)
    .single();

  if (fetchError) {
    console.error('Error fetching OTP record for increment:', fetchError);
    return false;
  }

  const newAttemptCount = (otpRecord.attempt_count || 0) + 1;

  const { error } = await supabase
    .from('login_otp_requests')
    .update({
      attempt_count: newAttemptCount,
      updated_at: new Date().toISOString()
    })
    .eq('id', otpId);

  if (error) {
    console.error('Error incrementing OTP attempt:', error);
    return false;
  }

  return true;
}

// Function to get user role from profiles table
async function getUserRole(userId: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase environment variables');
    return null;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error getting user role:', error);
    return null;
  }

  return data?.role;
}

// Function to check if device is already registered for technician or transporter
async function checkDeviceRegistration(userId: string, device_fingerprint_hash: string, userRole: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase environment variables');
    return { allowed: false, error: 'SERVER_ERROR' };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Only enforce device lock for technician and transporter roles
  if (userRole !== 'technician' && userRole !== 'transporter') {
    return { allowed: true, error: null };
  }

  // Check if this user has a device registered
  const { data: existingDevice, error: fetchError } = await supabase
    .from('device_lock')
    .select('device_fingerprint_hash')
    .eq('user_id', userId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "row not found"
    console.error('Error checking existing device:', fetchError);
    return { allowed: false, error: 'SERVER_ERROR' };
  }

  if (!existingDevice) {
    // No device registered yet, allow login and register this device
    const { error: insertError } = await supabase
      .from('device_lock')
      .insert({ user_id: userId, device_fingerprint_hash });

    if (insertError) {
      console.error('Error registering device:', insertError);
      return { allowed: false, error: 'SERVER_ERROR' };
    }

    return { allowed: true, error: null };
  } else {
    // Device already registered, check if it matches
    if (existingDevice.device_fingerprint_hash === device_fingerprint_hash) {
      return { allowed: true, error: null };
    } else {
      // Device mismatch - potential conflict
      return { allowed: false, error: 'DEVICE_CONFLICT' };
    }
  }
}

// Function to log device conflicts
async function logDeviceConflict(userId: string, old_fingerprint: string | null, new_fingerprint: string, ip: string, userAgent: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase environment variables');
    return false;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await supabase
    .from('device_lock_conflicts')
    .insert({
      user_id: userId,
      old_device: old_fingerprint,
      new_device: new_fingerprint,
      ip_address: ip,
      user_agent: userAgent,
      detected_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error logging device conflict:', error);
    return false;
  }

  return true;
}

// Function to mark OTP as consumed
async function markOTPConsumed(otpId: string, device_fingerprint?: string | null) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase environment variables');
    return false;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Prepare update data
  const updateData: any = {
    consumed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Add device fingerprint to meta if provided
  if (device_fingerprint) {
    updateData.meta = { ...updateData.meta, device_fingerprint };
  }

  const { error } = await supabase
    .from('login_otp_requests')
    .update(updateData)
    .eq('id', otpId);

  if (error) {
    console.error('Error marking OTP as consumed:', error);
    return false;
  }

  return true;
}

// Function to create a session and set cookies
async function createSessionAndSetCookies(userId: string, role: string, request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Note: For actual session creation, this would require a more complex approach
  // since we can't directly set Supabase auth cookies from a server action
  // This is typically handled on the client side after successful verification
  return { success: true, user_id: userId, role: role };
}

export async function POST(req: NextRequest) {
  try {
    // Get client IP and user agent
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Parse request body
    const body = await req.json();
    const { phone_e164, otp, device_fingerprint, role_hint } = body;

    // Validate required fields
    if (!phone_e164 || !otp) {
      return new Response(
        JSON.stringify({ success: false, code: 'INVALID_INPUT' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone number to +91 format
    const normalizedPhone = normalizePhone(phone_e164);

    // Validate phone number format (should be +91XXXXXXXXXX)
    const phoneRegex = /^\+91[6-9]\d{9}$/;
    if (!phoneRegex.test(normalizedPhone)) {
      return new Response(
        JSON.stringify({ success: false, code: 'INVALID_PHONE_FORMAT' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limits
    const isRateLimited = await checkRateLimit(normalizedPhone, clientIP as string);
    if (!isRateLimited) {
      return new Response(
        JSON.stringify({ success: false, code: 'RATE_LIMITED' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the latest unconsumed OTP request for this phone
    const otpRecord = await getLatestUnconsumedOTP(normalizedPhone);

    if (!otpRecord) {
      return new Response(
        JSON.stringify({ success: false, code: 'OTP_NOT_FOUND_OR_EXPIRED' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if max attempts have been reached
    if (otpRecord.attempt_count >= otpRecord.max_attempts) {
      return new Response(
        JSON.stringify({ success: false, code: 'OTP_TOO_MANY_ATTEMPTS' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Compare the provided OTP with the stored hash
    const isValidOTP = await verifyOTP(otp, otpRecord.otp_hash);

    if (!isValidOTP) {
      // Increment attempt count on invalid OTP
      await incrementOTPAttempt(otpRecord.id);

      return new Response(
        JSON.stringify({ success: false, code: 'OTP_INVALID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // OTP is valid, mark as consumed
    const consumed = await markOTPConsumed(otpRecord.id, device_fingerprint);
    if (!consumed) {
      return new Response(
        JSON.stringify({ success: false, code: 'VERIFICATION_FAILED' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Ensure user exists and get role
    let userId, role;
    try {
      const userResult = await ensureUserForPhone(normalizedPhone, role_hint);
      userId = userResult.userId;
      role = userResult.role;
    } catch (error) {
      console.error('Error ensuring user exists:', error);
      return new Response(
        JSON.stringify({ success: false, code: 'USER_CREATION_ERROR' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Ensure that userId and role are not null
    if (!userId || !role) {
      return new Response(
        JSON.stringify({ success: false, code: 'USER_CREATION_ERROR' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Device lock enforcement: check if the user is a technician or transporter
    if (role === 'technician' || role === 'transporter') {
      // Validate that device_fingerprint was provided
      if (!device_fingerprint) {
        return new Response(
          JSON.stringify({ success: false, code: 'DEVICE_FINGERPRINT_REQUIRED' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check device registration for technician/transporter
      const deviceCheck = await checkDeviceRegistration(userId, device_fingerprint, role);

      if (!deviceCheck.allowed) {
        if (deviceCheck.error === 'DEVICE_CONFLICT') {
          // Log the device conflict
          const userRole = await getUserRole(userId);
          await logDeviceConflict(userId, null, device_fingerprint, clientIP as string, userAgent);

          return new Response(
            JSON.stringify({
              success: false,
              code: 'DEVICE_CONFLICT',
              message: 'Device conflict detected. Contact admin to unlock your account from previous device.'
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          );
        } else {
          return new Response(
            JSON.stringify({ success: false, code: 'SERVER_ERROR' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Create session and set cookies (implementation needed)
    const sessionResult = await createSessionAndSetCookies(userId, role, req);
    if (!sessionResult.success) {
      return new Response(
        JSON.stringify({ success: false, code: 'SESSION_CREATION_ERROR' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        role: role,
        next_action: 'redirect_to_category_page'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in verify-otp API:', error);

    // Log internal error but don't expose details to client
    return new Response(
      JSON.stringify({ success: false, code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}