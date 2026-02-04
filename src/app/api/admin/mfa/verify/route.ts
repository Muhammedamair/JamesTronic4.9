import { NextRequest } from 'next/server';
import { AdminMFAService } from '@/lib/auth-system/adminMFAService';
import { SessionManager } from '@/lib/auth-system/sessionManager';
import { getSessionId } from '@/lib/auth-system/sessionUtils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mfaCode } = body;

    if (!mfaCode || mfaCode.length !== 6 || !/^\d{6}$/.test(mfaCode)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid MFA code format'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get the current session ID from cookies
    const sessionId = await getSessionId();

    if (!sessionId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No active session found'
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get session data using SessionManager
    const sessionData = await SessionManager.getSessionData();

    if (!sessionData) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Session not found in database'
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Only allow admin users to verify MFA
    if (sessionData.role !== 'admin') {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Access denied: MFA verification only for admin users'
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Use the admin MFA service to verify the code
    // We reuse verifyMFADuringLogin since it encapsulates the verification logic against the user's secret
    // It returns a login response, but we just check success
    const result = await AdminMFAService.verifyMFADuringLogin(sessionId, mfaCode);

    if (result.success) {
      // Return success
      // Note: We are not explicitly marking the session as 'MFA verified' here because SessionManager doesn't support it yet
      // The client should take this success as authorization to proceed with the sensitive action

      return new Response(
        JSON.stringify({
          success: true,
          message: 'MFA verified successfully'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          message: result.error || 'MFA verification failed'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error('MFA verification error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Internal server error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}