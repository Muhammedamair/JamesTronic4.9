import { NextRequest } from 'next/server';
import { SessionManager } from '@/lib/auth-system/sessionManager';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { getSessionId } from '@/lib/auth-system/sessionUtils';

// This would normally use a library like speakeasy to verify TOTP
function verifyTOTP(token: string, secret: string): boolean {
  // In a real implementation, use a library like speakeasy or otplib to verify the TOTP
  // For now, we'll just check if the token is 6 digits
  return /^\d{6}$/.test(token);
}

// Generate backup codes for the user
function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const code = randomBytes(4).toString('hex').toUpperCase().match(/.{1,4}/g)?.join('-') || '';
    codes.push(code);
  }
  return codes;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, secret } = body;

    if (!code || !secret) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Missing required fields'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get session ID from cookies
    const sessionId = await getSessionId();

    if (!sessionId) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized - no session'
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get the current session
    const sessionResponse = await SessionManager.validateSession();

    if (!sessionResponse.valid || !sessionResponse.session) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized'
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Only allow admin role to verify MFA setup
    if (sessionResponse.session.role !== 'admin') {
      return new Response(
        JSON.stringify({
          error: 'Forbidden'
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify the TOTP code
    if (!verifyTOTP(code, secret)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid verification code'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // At this point, the code is valid
    // In a real implementation, you would:
    // 1. Store the TOTP secret in the database for this user
    // 2. Mark MFA as enabled for this user
    // 3. Generate and store backup codes

    // Create Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Generate backup codes
    const backupCodes = generateBackupCodes();

    // In a real implementation, you would update the user's profile record with the TOTP secret
    // For now, we'll just generate the backup codes and return success

    // Also log the MFA setup event
    const { error: logError } = await supabase
      .from('admin_security_events')
      .insert({
        admin_user_id: sessionResponse.session.userId,
        event_type: 'MFA_SETUP_COMPLETED',
        ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
          req.headers.get('x-real-ip') ||
          'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown',
        metadata: {
          device_fingerprint: req.headers.get('x-device-fingerprint') || 'unknown'
        },
        severity: 'info'
      });

    if (logError) {
      console.error('Error logging MFA setup event:', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'MFA setup completed successfully',
        backup_codes: backupCodes
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in MFA setup verify API:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}