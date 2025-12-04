// /src/app/api/auth/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth-system/sessionManager';

export async function GET(request: NextRequest) {
  try {
    // Validate the current session
    const validationResponse = await SessionManager.validateSession();
    
    if (validationResponse.valid && validationResponse.session) {
      return NextResponse.json({
        valid: true,
        session: validationResponse.session,
        role: validationResponse.session.role
      });
    } else {
      // Attempt to refresh the session if it's expired
      if (validationResponse.error && 
          (validationResponse.error.includes('expired') || validationResponse.error.includes('Session not found'))) {
        
        const refreshResponse = await SessionManager.refreshSession();
        
        if (refreshResponse.success) {
          // Get the updated session data
          const updatedSessionData = await SessionManager.getSessionData();
          
          if (updatedSessionData) {
            return NextResponse.json({
              valid: true,
              session: updatedSessionData,
              role: updatedSessionData.role
            });
          }
        }
      }
      
      // If validation failed and refresh didn't work
      return NextResponse.json({ 
        valid: false,
        error: validationResponse.error 
      }, { status: 401 });
    }
  } catch (error) {
    console.error('Session validation error:', error);
    return NextResponse.json({ 
      valid: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Logout - revoke the current session
    const cookieString = request.headers.get('cookie');
    let sessionId: string | undefined = undefined;

    if (cookieString) {
      const cookies = cookieString.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'session_id') {
          sessionId = value;
          break;
        }
      }
    }

    const success = await SessionManager.revokeSession(sessionId);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: 'Failed to revoke session' }, { status: 500 });
    }
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}