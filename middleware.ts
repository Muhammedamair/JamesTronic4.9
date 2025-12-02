import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { sessionValidator } from '@/lib/auth-system/sessionValidator';
import { deviceFingerprintGenerator } from '@/lib/auth-system/deviceFingerprint';
import { roleResolver } from '@/lib/auth-system/roleResolver';
import { deviceControlService } from '@/lib/auth-system/deviceControlService';

export async function middleware(request: NextRequest) {
  // Create Supabase client for server-side requests
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.delete(name);
        },
      },
    }
  );

  // Get the current user from Supabase auth
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  // If there's an error getting the user, treat as unauthenticated
  if (userError || !user) {
    // Define public routes (no authentication required)
    const isPublicRoute = request.nextUrl.pathname === '/' ||
                         request.nextUrl.pathname === '/api/auth/callback' ||
                         request.nextUrl.pathname.startsWith('/auth/') ||
                         request.nextUrl.pathname.startsWith('/api/otp') ||
                         request.nextUrl.pathname.startsWith('/api/webhook');

    if (isPublicRoute) {
      return NextResponse.next();
    }

    // For protected routes, redirect to login
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Get session token from cookies
  const token = request.cookies.get('sb-access-token')?.value;

  // Generate device fingerprint
  let deviceId = 'unknown';
  try {
    // Attempt to get device ID from headers or generate new one
    deviceId = request.headers.get('x-device-id') || await deviceFingerprintGenerator();
  } catch (error) {
    console.error('Error generating device fingerprint:', error);
  }

  // Validate the session using our enterprise auth system
  let sessionValid = false;
  let deviceValid = false;
  let resolvedRole = 'customer'; // Default role

  if (token) {
    const sessionData = await sessionValidator(token, deviceId);
    sessionValid = sessionData.isValid;
    deviceValid = sessionData.deviceValid;

    if (sessionData.isValid && sessionData.userId === user.id) {
      resolvedRole = sessionData.role;
    } else {
      // If session is invalid, try to resolve role from user profile
      const roleData = await roleResolver(user.id);
      resolvedRole = roleData.role;
    }
  } else {
    // If no token, just resolve role from user profile
    const roleData = await roleResolver(user.id);
    resolvedRole = roleData.role;
  }

  // Check device validity for restricted roles
  if ((resolvedRole === 'technician' || resolvedRole === 'transporter') && !deviceValid) {
    // For technicians and transporters, if device is not valid, force logout
    console.log(`Device validation failed for user ${user.id} with role ${resolvedRole}`);

    // Update device activity
    await deviceControlService.updateDeviceActivity(user.id, deviceId);

    // For multi-device attempts on restricted accounts, log the conflict
    if (resolvedRole === 'technician' || resolvedRole === 'transporter') {
      const activeDevices = await deviceControlService.getActiveDevicesForUser(user.id);
      if (activeDevices.length > 0) {
        // Log the device conflict but don't allow access
        // Use the public registerDeviceForUser method instead of the private registerDevice method
        await deviceControlService.registerDeviceForUser(user.id, resolvedRole as any, {
          userAgent: request.headers.get('user-agent') || undefined,
          platform: request.headers.get('sec-ch-ua-platform')?.replace(/"/g, '') || undefined,
          ip: getRealIP(request),
          location: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
        });
      }
    }

    // Redirect to login for device conflicts
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Define public routes (no authentication required)
  const isPublicRoute = request.nextUrl.pathname === '/' ||
                       request.nextUrl.pathname === '/api/auth/callback' ||
                       request.nextUrl.pathname.startsWith('/auth/') ||
                       request.nextUrl.pathname.startsWith('/api/otp') ||
                       request.nextUrl.pathname.startsWith('/api/webhook');

  // If it's a public route, allow access without authentication
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Handle pending users
  if (user && resolvedRole === 'pending') {
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
  if (user && resolvedRole === 'rejected') {
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
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
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
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
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
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
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
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    if (resolvedRole !== 'technician' && resolvedRole !== 'admin') {
      // Redirect non-technicians to dashboard
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    // For technicians, validate device again just to be sure
    if (resolvedRole === 'technician' && !deviceValid) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Transporter routes
  if (request.nextUrl.pathname.startsWith('/transporter')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    if (resolvedRole !== 'transporter' && resolvedRole !== 'admin') {
      // Redirect non-transporters to dashboard
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    // For transporters, validate device again just to be sure
    if (resolvedRole === 'transporter' && !deviceValid) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Protected app routes (admin/staff functionality)
  if (request.nextUrl.pathname.startsWith('/app')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
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