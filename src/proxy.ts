import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAppRoute = req.nextUrl.pathname.startsWith('/app');
  const isTechRoute = req.nextUrl.pathname.startsWith('/tech');

  if ((isAppRoute || isTechRoute) && !session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (req.nextUrl.pathname === '/login' && session) {
    // Get user profile to determine role
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (!error && profile) {
      if (profile.role === 'technician') {
        return NextResponse.redirect(new URL('/tech', req.url));
      } else {
        // For admin/staff, redirect to main app
        return NextResponse.redirect(new URL('/app', req.url));
      }
    } else {
      // If profile doesn't exist, redirect to main app by default
      return NextResponse.redirect(new URL('/app', req.url));
    }
  }

  // Role-based routing: if technician tries to access main app, redirect to tech section
  if (isAppRoute && session) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (!error && profile && profile.role === 'technician') {
      // Technicians should go to the tech section, not main app
      return NextResponse.redirect(new URL('/tech', req.url));
    }
  }

  // If technician tries to access tech route but doesn't have technician role
  if (isTechRoute && session) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (error || !profile || (profile.role !== 'technician' && profile.role !== 'admin')) {
      // Non-technicians and non-admins should not access tech section
      return NextResponse.redirect(new URL('/app', req.url));
    }
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.json (PWA manifest)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|vercel.svg|globe.svg|sw.js|api|assets).*)',
  ],
};