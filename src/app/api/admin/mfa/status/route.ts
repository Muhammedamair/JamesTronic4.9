import { NextRequest } from 'next/server';
import { SessionManager } from '@/lib/auth-system/sessionManager';
import { getSessionId } from '@/lib/auth-system/sessionUtils';

export async function GET(req: NextRequest) {
  try {
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

    // Only allow admin role to access MFA status
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

    // In a real implementation, you would fetch MFA status from the database
    // For now, we'll return mock data
    const mfaStatus = {
      enabled: true, // This would come from the database
      last_verified_at: undefined, // TODO: Implement lastMfaAt tracking in SessionData
      trusted_devices_count: 1, // This would come from the database
    };

    return new Response(
      JSON.stringify({
        success: true,
        status: mfaStatus
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in MFA status API:', error);

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