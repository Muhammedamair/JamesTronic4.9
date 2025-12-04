// /src/app/api/auth/session/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth-system/sessionManager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, role, deviceFingerprint, ipAddress, userAgent } = body;

    // Validate required fields
    if (!userId || !role || !deviceFingerprint) {
      return NextResponse.json({ 
        error: 'Missing required fields: userId, role, or deviceFingerprint' 
      }, { status: 400 });
    }

    // Create the session
    const result = await SessionManager.createSession(
      userId,
      role,
      deviceFingerprint,
      ipAddress,
      userAgent
    );

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ 
        error: result.error || 'Failed to create session' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}