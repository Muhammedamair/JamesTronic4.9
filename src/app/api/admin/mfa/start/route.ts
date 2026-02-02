import { NextRequest } from 'next/server';
import { AdminMFAService } from '@/lib/auth-system/adminMFAService';
import { SessionManager } from '@/lib/auth-system/sessionManager';
import { getSessionId } from '@/lib/auth-system/sessionUtils';

export async function POST(req: NextRequest) {
  try {
    // Get session ID from cookies
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

    // Get the current admin session
    const sessionResponse = await SessionManager.getSessionData();

    if (!sessionResponse) {
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

    // Check if the user is an admin
    if (sessionResponse.role !== 'admin') {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Access denied: MFA challenge only for admin users'
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if MFA is enabled for this user
    const hasMfa = await AdminMFAService.hasMFAEnabled(sessionResponse.userId);

    if (hasMfa) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'MFA challenge required'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    } else {
      // If MFA is not enabled, we might want to prompt setup or allow bypass depends on policy
      // For now, return success but indicate MFA not active
      return new Response(
        JSON.stringify({
          success: true,
          message: 'MFA not enabled for user',
          bypass: true
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error('MFA start error:', error);

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