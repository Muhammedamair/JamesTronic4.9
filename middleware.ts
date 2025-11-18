import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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

  // Get the current user (always fetch fresh from server to avoid stale session)
  const { data: { user } } = await supabase.auth.getUser();
  
  // Get user role from the JWT's user_metadata
  const userRole = user?.user_metadata?.role || null;

  // Define public routes (no authentication required)
  const isPublicRoute = request.nextUrl.pathname === '/' ||
                       request.nextUrl.pathname === '/api/auth/callback';

  // If it's a public route, allow access without authentication
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Define protected routes and their required roles
  const pathname = request.nextUrl.pathname;

  // Handle pending users
  if (user && userRole === 'pending') {
    if (pathname === '/pending-approval' || pathname === '/dashboard') {
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
  if (user && userRole === 'rejected') {
    if (pathname === '/rejected' || pathname === '/dashboard') {
      return NextResponse.next();
    } else {
      // Redirect to rejected page
      const url = request.nextUrl.clone();
      url.pathname = '/rejected';
      return NextResponse.redirect(url);
    }
  }

  // Customer portal routes (for now, these require authentication)
  // Later we'll make booking pages public
  if (pathname.startsWith('/customer')) {
    // Customer portal - currently needs authentication but will be public eventually
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    // Customer role users can access customer routes
    return NextResponse.next();
  }

  // Admin routes
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    if (userRole !== 'admin') {
      // Redirect non-admins to dashboard
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Staff routes
  if (pathname.startsWith('/staff')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    if (userRole !== 'staff' && userRole !== 'admin') {
      // Redirect non-staff to dashboard
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Tech routes
  if (pathname.startsWith('/tech')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    if (userRole !== 'technician' && userRole !== 'admin') {
      // Redirect non-technicians to dashboard
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Transporter routes
  if (pathname.startsWith('/transporter')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    if (userRole !== 'transporter' && userRole !== 'admin') {
      // Redirect non-transporters to dashboard
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Protected app routes (admin/staff functionality)
  if (pathname.startsWith('/app')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    if (userRole !== 'admin' && userRole !== 'staff') {
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