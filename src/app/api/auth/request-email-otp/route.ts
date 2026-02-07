import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { sendOtpEmail } from '@/lib/utils/smtp-client';

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Use the service role key for backend operations
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
  // Generate request ID for observability
  const request_id = randomUUID();

  try {
    // Get client IP and user agent
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error(`[${request_id}] Error parsing request body:`, parseError);
      return new Response(
        JSON.stringify({ request_id, ok: false, code: 'INVALID_JSON', message: 'Invalid JSON in request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { email } = body;

    // Validate required fields
    if (!email) {
      return new Response(
        JSON.stringify({ request_id, ok: false, code: 'INVALID_INPUT', message: 'Email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ request_id, ok: false, code: 'INVALID_EMAIL_FORMAT', message: 'Invalid email format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check for required environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`[${request_id}] Missing Supabase environment variables (URL or Service Role Key)`);
      return new Response(
        JSON.stringify({ request_id, ok: false, code: 'SERVER_ERROR', message: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with the service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Normalize email for consistent handling
    const normalizedEmail = email.trim().toLowerCase();

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store the OTP in the database
    const { error: otpInsertError } = await supabase
      .from('email_otps')
      .insert({
        email: normalizedEmail,
        otp: otp,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes from now
      });

    if (otpInsertError) {
      console.error(`[${request_id}] Error storing OTP in database:`, otpInsertError);
      return new Response(
        JSON.stringify({
          request_id,
          ok: false,
          code: 'OTP_STORAGE_ERROR',
          message: 'Failed to store OTP. Please try again later.'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Send OTP via our email service - this is the primary method
    // We're not relying on Supabase OTP functionality since it's disabled
    const emailSent = await sendOtpEmail(normalizedEmail, otp, request_id);

    if (!emailSent) {
      console.error(`[${request_id}] Failed to send OTP via external email service to ${normalizedEmail}`);
      // Return an error since we can't send the OTP
      return new Response(
        JSON.stringify({
          request_id,
          ok: false,
          code: 'EMAIL_SEND_ERROR',
          message: 'Failed to send OTP via email. Please check your email configuration.'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${request_id}] OTP successfully sent to ${normalizedEmail}`);

    // Return success response without exposing the OTP
    return new Response(
      JSON.stringify({ request_id, ok: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error(`[${request_id}] Error in request-email-otp API:`, error);

    // Log full error object for debugging
    console.error(`[${request_id}] Full error object:`, {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      code: error?.code
    });

    // Return structured error response
    return new Response(
      JSON.stringify({
        request_id,
        ok: false,
        code: error?.code || 'INTERNAL_ERROR',
        message: error?.message || 'Internal server error',
        status: 500
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}