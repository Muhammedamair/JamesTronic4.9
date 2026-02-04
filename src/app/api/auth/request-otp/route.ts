import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';

// ============================================================================
// DEV TEST MODE CONFIGURATION
// ============================================================================
// These test phone numbers are ONLY allowed in development mode on localhost.
// In production/staging, they behave like normal numbers (random OTP, rate limited).
// ============================================================================
const DEV_TEST_PHONES_DEFAULT = [
  '+919999999990', // ADMIN
  '+919999999991', // MANAGER
  '+919999999992', // TECHNICIAN
  '+919999999993', // TRANSPORTER
  '+919999999994', // DEALER
];

/**
 * P0 SECURITY: Check if dev test mode is allowed for this phone/request.
 * 
 * Test mode (fixed OTP 123456, Interakt bypass) is ONLY allowed when ALL conditions are met:
 * 1. NODE_ENV === "development"
 * 2. Request is from localhost (127.0.0.1 or localhost)
 * 3. Phone is in DEV_TEST_PHONES env var (or default list)
 * 
 * In production/staging: test numbers behave like normal numbers.
 */
function isDevTestModeAllowed(phone: string, req: NextRequest): boolean {
  // Gate 1: Must be development environment
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }

  // Gate 2: Must be localhost
  const host = req.headers.get('host') || '';
  const isLocal = host.includes('localhost') || host.startsWith('127.0.0.1');
  if (!isLocal) {
    return false;
  }

  // Gate 3: Phone must be in allowlist
  const envPhones = process.env.DEV_TEST_PHONES;
  const allowedPhones = envPhones
    ? envPhones.split(',').map(s => s.trim()).filter(Boolean)
    : DEV_TEST_PHONES_DEFAULT;

  return allowedPhones.includes(phone);
}

// Environment variables for Interakt API
const INTERAKT_API_BASE_URL = process.env.INTERAKT_API_BASE_URL;
const INTERAKT_API_KEY = process.env.INTERAKT_API_KEY;
const INTERAKT_WHATSAPP_OTP_TEMPLATE_NAME = process.env.INTERAKT_WHATSAPP_OTP_TEMPLATE_NAME;
const INTERAKT_WHATSAPP_SENDER_PHONE = process.env.INTERAKT_WHATSAPP_SENDER_PHONE;

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
  // Max 5 OTPs per 15 minutes per phone
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  const { data, error } = await supabase
    .from('login_otp_requests')
    .select('id')
    .eq('phone_e164', phone_e164)
    .gte('created_at', fifteenMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error checking rate limit:', error);
    return false; // Fail safe - don't allow if can't verify
  }

  // If we have 5 or more requests in the last 15 minutes, rate limit
  if (data && data.length >= 5) {
    return false;
  }

  return true;
}

// Function to send OTP via Interakt
async function sendOtpViaInterakt(phone_e164: string, otp: string, channel: 'whatsapp' | 'sms' = 'whatsapp') {
  if (!INTERAKT_API_BASE_URL || !INTERAKT_API_KEY) {
    throw new Error('Interakt API configuration is missing');
  }

  // For WhatsApp, use the template message API
  if (channel === 'whatsapp') {
    if (!INTERAKT_WHATSAPP_OTP_TEMPLATE_NAME || !INTERAKT_WHATSAPP_SENDER_PHONE) {
      throw new Error('Interakt WhatsApp configuration is missing');
    }

    const payload = {
      channel: 'whatsapp',
      sender: INTERAKT_WHATSAPP_SENDER_PHONE,
      route: 'template',
      message: {
        template_name: INTERAKT_WHATSAPP_OTP_TEMPLATE_NAME,
        broadcast: false,
        params: [
          { key: 'code', value: otp },
          { key: 'brand', value: 'JamesTronic' },
          { key: 'ttl_minutes', value: '5' }
        ],
        data: {
          phone: phone_e164,
        }
      }
    };

    const response = await fetch(`${INTERAKT_API_BASE_URL}/send/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${INTERAKT_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Interakt API error: ${response.status} - ${errorText}`);
      throw new Error(`Interakt API error: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } else {
    throw new Error('SMS channel not yet implemented');
  }
}

export async function POST(req: NextRequest) {
  try {
    // Get client IP and user agent
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Parse request body
    const body = await req.json();
    let { phone_e164, channel = 'whatsapp' } = body;

    // Validate required fields
    if (!phone_e164) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone number to +91 format
    phone_e164 = normalizePhone(phone_e164);

    // Validate phone number format (should be +91XXXXXXXXXX)
    const phoneRegex = /^\+91[6-9]\d{9}$/;
    if (!phoneRegex.test(phone_e164)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format. Use Indian number starting with +91.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate channel
    if (channel !== 'whatsapp' && channel !== 'sms') {
      channel = 'whatsapp';
    }

    // P0 SECURITY: Check if dev test mode is allowed
    const isDevTestMode = isDevTestModeAllowed(phone_e164, req);

    // ALWAYS check rate limits - no bypass even for dev test mode
    // (Dev mode gets higher threshold but still rate limited)
    const isRateLimitPassed = await checkRateLimit(phone_e164, clientIP as string);
    if (!isRateLimitPassed) {
      return new Response(
        JSON.stringify({ error: 'Too many OTP requests. Please try again later.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate OTP
    // Dev test mode: fixed OTP for easier testing
    // Production: random 6-digit OTP
    const otp = isDevTestMode
      ? '123456'
      : Math.floor(100000 + Math.random() * 900000).toString();

    // Hash the OTP for secure storage
    const otp_hash = await bcrypt.hash(otp, 10);

    // Calculate expiry time (5 minutes from now)
    const expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Initialize Supabase client with service role for backend operations
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Invalidate any existing unconsumed OTPs
    await supabase
      .from('login_otp_requests')
      .update({ consumed_at: new Date().toISOString(), meta: { reason: 'invalidated_by_new_request' } })
      .eq('phone_e164', phone_e164)
      .is('consumed_at', null);

    // Insert OTP record into database
    const { error: insertError } = await supabase
      .from('login_otp_requests')
      .insert([
        {
          phone_e164,
          otp_hash,
          channel,
          created_at: new Date().toISOString(),
          expires_at,
          ip_address: clientIP as string,
          user_agent: userAgent,
          attempt_count: 0,
          max_attempts: 5,
          meta: { isDevTestMode },
        }
      ]);

    if (insertError) {
      console.error('Error inserting OTP record:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate OTP. Please try again.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Send OTP
    try {
      if (isDevTestMode) {
        // Dev test mode: skip Interakt, log to console only
        console.log(`[DEV TEST MODE] OTP for ${phone_e164} is ${otp} (Interakt bypassed, localhost only)`);
      } else {
        // Production: send via Interakt
        await sendOtpViaInterakt(phone_e164, otp, channel);
      }
    } catch (interaktError) {
      console.error('Error sending OTP via Interakt:', interaktError);

      // Clean up the OTP record since sending failed
      await supabase
        .from('login_otp_requests')
        .delete()
        .eq('phone_e164', phone_e164)
        .eq('otp_hash', otp_hash)
        .is('consumed_at', null);

      return new Response(
        JSON.stringify({ error: 'Failed to send OTP. Please try again.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Return success response (NEVER expose OTP in response)
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in request-otp API:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}