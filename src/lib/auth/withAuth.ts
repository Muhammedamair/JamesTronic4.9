import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SessionManager } from '@/lib/auth-system/sessionManager';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface User {
  id: string;
  email?: string;
  role?: string;
}

interface UserWithSession extends User {
  sessionId?: string;
}

export function withAuth(
  handler: (user: UserWithSession, request: NextRequest) => Promise<Response>,
  allowedRoles: string[] = []
) {
  return async (request: NextRequest): Promise<Response> => {
    try {
      // Get the token from the Authorization header
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // Try to get session ID from cookies as alternative
        const sessionId = request.cookies.get('session_id')?.value;

        if (!sessionId) {
          return new NextResponse(
            JSON.stringify({ error: 'Missing or invalid authorization header' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Validate session from cookie
        const sessionValidation = await SessionManager.validateSession();
        if (!sessionValidation.valid || !sessionValidation.session) {
          return new NextResponse(
            JSON.stringify({ error: 'Invalid or expired session' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Check if user has required role
        if (allowedRoles.length > 0 && !allowedRoles.includes(sessionValidation.session.role)) {
          return new NextResponse(
            JSON.stringify({ error: 'Insufficient permissions' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Call the original handler with user context from session
        return handler({
          id: sessionValidation.session.userId,
          role: sessionValidation.session.role,
          sessionId: sessionValidation.session.id
        }, request);
      }

      const token = authHeader.substring(7);

      // Verify the token with Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return new NextResponse(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Get user role from the profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile) {
        return new NextResponse(
          JSON.stringify({ error: 'User profile not found' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check if user has required role
      if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
        return new NextResponse(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Call the original handler with user context
      return handler({ id: user.id, email: user.email, role: profile.role, sessionId: undefined }, request);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return new NextResponse(
        JSON.stringify({ error: 'Authentication error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
}