import { NextResponse, type NextRequest } from 'next/server';
import { SessionManager } from '@/lib/auth-system/sessionManager';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Canonical domain for production
const CANONICAL_HOST = 'jamestronic.com';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // === CANONICAL HOST REDIRECT (defense-in-depth) ===
  // Only enforce in Vercel Production environment
  if (process.env.VERCEL_ENV === 'production') {
    const host = request.headers.get('host') || '';

    // Allow canonical apex and www (www redirects at Vercel layer)
    const isCanonical = host === CANONICAL_HOST || host === `www.${CANONICAL_HOST}`;

    // Only redirect non-canonical hosts, skip API routes
    if (!isCanonical && !pathname.startsWith('/api')) {
      const url = request.nextUrl.clone();
      url.hostname = CANONICAL_HOST;
      url.protocol = 'https:';
      url.port = '';
      return NextResponse.redirect(url, 307);
    }
  }

  // Skip remaining checks for API routes
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Validate session using our new session manager
  const validationResponse = await SessionManager.validateSession();

  if (!validationResponse.valid) {
    // If session is invalid, check if we can refresh it
    if (validationResponse.error &&
      (validationResponse.error.includes('expired') || validationResponse.error.includes('Session not found'))) {
      try {
        const refreshResponse = await SessionManager.refreshSession();
        if (!refreshResponse.success) {
          // If refresh failed, clear cookies and redirect to login
          const response = NextResponse.redirect(new URL('/login', request.url));
          response.cookies.set('session_id', '', { maxAge: 0 });
          response.cookies.set('refresh_token', '', { maxAge: 0 });
          return response;
        } else {
          // If refresh succeeded, continue with the request
          // Get the updated session data
          const updatedSessionData = await SessionManager.getSessionData();
        }
      } catch (error) {
        console.error('Session refresh failed:', error);
      }
    }

    // If still not valid after refresh attempt, redirect to login
    if (!validationResponse.valid) {
      // Define public routes (no authentication required)
      const isPublicRoute = request.nextUrl.pathname === '/' ||
        request.nextUrl.pathname === '/api/auth/callback' ||
        request.nextUrl.pathname.startsWith('/auth/') ||
        request.nextUrl.pathname.startsWith('/api/otp') ||
        request.nextUrl.pathname.startsWith('/api/webhook') ||
        request.nextUrl.pathname.startsWith('/login') ||
        request.nextUrl.pathname.startsWith('/admin/login');

      if (isPublicRoute) {
        return NextResponse.next();
      }

      // For protected routes, redirect to appropriate login
      // For admin routes, redirect to admin login
      if (request.nextUrl.pathname.startsWith('/admin') ||
        request.nextUrl.pathname.startsWith('/app')) {
        const url = request.nextUrl.clone();
        url.pathname = '/admin/login';
        return NextResponse.redirect(url);
      }

      // For all other protected routes, redirect to customer login
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  // Validate session again after potential refresh
  const validationResponseAfter = await SessionManager.validateSession();

  // At this point, we have a valid session
  const sessionData = validationResponseAfter.session;
  if (!sessionData) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  const resolvedRole = sessionData.role;

  // Device lock enforcement for technicians and transporters
  if (resolvedRole === 'technician' || resolvedRole === 'transporter') {
    // Get device fingerprint from request headers or cookies
    const deviceFingerprint = request.headers.get('x-device-fingerprint') ||
      request.cookies.get('device_fingerprint')?.value;

    if (!deviceFingerprint) {
      // If no device fingerprint is provided, block access for technicians and transporters
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // Check device lock against database
    try {
      // Use Supabase client with environment variables
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

      const userId = sessionData.userId; // Updated to use userId from session data

      const { data: deviceLock, error: lockError } = await supabase
        .from('device_lock')
        .select('device_fingerprint_hash')
        .eq('user_id', userId)
        .single();

      if (lockError && lockError.code !== 'PGRST116') { // PGRST116 is 'row not found'
        console.error('Error checking device lock:', lockError);
        // For security, block access if there's an error checking device lock
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
      }

      if (deviceLock && deviceLock.device_fingerprint_hash !== deviceFingerprint) {
        // Device mismatch - potential conflict
        // Log the device conflict
        const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
          request.headers.get('x-real-ip') || 'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        const { error: conflictError } = await supabase
          .from('device_lock_conflicts')
          .insert({
            user_id: userId,
            old_device: deviceLock.device_fingerprint_hash,
            new_device: deviceFingerprint,
            ip_address: clientIP,
            user_agent: userAgent,
            detected_at: new Date().toISOString()
          });

        if (conflictError) {
          console.error('Error logging device conflict:', conflictError);
        }

        // Block access and redirect to login
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
      }
    } catch (error) {
      console.error('Error checking device fingerprint:', error);
      // For security, block access if there's an error checking device fingerprint
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  // Handle pending users - need to check from profiles table
  if (resolvedRole === 'pending') {
    if (request.nextUrl.pathname === '/pending-approval' || request.nextUrl.pathname === '/dashboard') {
      // Allow access to pending approval page and dashboard
      return NextResponse.next();
    } else {
      // Redirect to pending approval page
      const url = request.nextUrl.clone();
      url.pathname = '/pending-approval';
      return NextResponse.redirect(url);
    }
  }

  // Handle rejected users
  if (resolvedRole === 'rejected') {
    if (request.nextUrl.pathname === '/rejected' || request.nextUrl.pathname === '/dashboard') {
      return NextResponse.next();
    } else {
      // Redirect to rejected page
      const url = request.nextUrl.clone();
      url.pathname = '/rejected';
      return NextResponse.redirect(url);
    }
  }

  // Customer portal routes
  if (request.nextUrl.pathname.startsWith('/customer')) {
    // Customer role users can access customer routes
    // Also allow admin/staff to access customer routes for management
    if (resolvedRole === 'customer' || resolvedRole === 'admin' || resolvedRole === 'staff') {
      return NextResponse.next();
    } else {
      // Redirect unauthorized users to dashboard
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  // Admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (resolvedRole !== 'admin') {
      // Redirect non-admins to dashboard
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Staff routes
  if (request.nextUrl.pathname.startsWith('/staff')) {
    if (resolvedRole !== 'staff' && resolvedRole !== 'admin') {
      // Redirect non-staff to dashboard
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Tech routes
  if (request.nextUrl.pathname.startsWith('/tech')) {
    if (resolvedRole !== 'technician' && resolvedRole !== 'admin') {
      // Redirect non-technicians to dashboard
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Transporter routes
  if (request.nextUrl.pathname.startsWith('/transporter')) {
    if (resolvedRole !== 'transporter' && resolvedRole !== 'admin') {
      // Redirect non-transporters to dashboard
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Protected app routes (admin/staff functionality)
  if (request.nextUrl.pathname.startsWith('/app')) {
    if (resolvedRole !== 'admin' && resolvedRole !== 'staff') {
      // Redirect non-admin/staff to dashboard
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // If no specific route protection applies, continue
  return NextResponse.next();
}

// Helper function to get real IP address (accounting for proxies)
function getRealIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return request.headers.get('x-real-ip') || '127.0.0.1';
}

// Get pathname for route matching
const pathname = (request: NextRequest) => request.nextUrl.pathname;

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};