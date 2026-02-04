import { usePathname } from 'next/navigation';
import { useSupabase } from '@/components/shared/supabase-provider';

// Define route categories
const ROUTE_CATEGORIES = {
  PUBLIC: 'public',
  INTERNAL: 'internal',
  CUSTOMER: 'customer', 
  ADMIN: 'admin',
  STAFF: 'staff',
  TECHNICIAN: 'technician',
  TRANSPORTER: 'transporter',
} as const;

type RouteCategory = typeof ROUTE_CATEGORIES[keyof typeof ROUTE_CATEGORIES];

// Determine the category of the current route
function getRouteCategory(pathname: string): RouteCategory {
  // Public routes - always public regardless of auth status
  const publicRoutes = [
    '/',
    '/services',
    '/services/',
    '/pricing', 
    '/pricing/',
    '/reviews',
    '/reviews/',
    '/faq',
    '/faq/',
    '/stores',
    '/stores/',
    '/about',
    '/about/',
    '/login',
    '/login/',
  ];

  if (
    pathname === '/' ||
    pathname.startsWith('/services') ||
    pathname.startsWith('/pricing') ||
    pathname.startsWith('/reviews') ||
    pathname.startsWith('/faq') ||
    pathname.startsWith('/stores') ||
    pathname.startsWith('/about') ||
    pathname.startsWith('/login') ||
    publicRoutes.some(route => pathname.startsWith(route))
  ) {
    return ROUTE_CATEGORIES.PUBLIC;
  }

  // Customer routes
  if (pathname.startsWith('/customer')) {
    return ROUTE_CATEGORIES.CUSTOMER;
  }

  // Admin routes
  if (pathname.startsWith('/admin')) {
    return ROUTE_CATEGORIES.ADMIN;
  }

  // Staff routes
  if (pathname.startsWith('/staff')) {
    return ROUTE_CATEGORIES.STAFF;
  }

  // Technician routes
  if (pathname.startsWith('/tech')) {
    return ROUTE_CATEGORIES.TECHNICIAN;
  }

  // Transporter routes
  if (pathname.startsWith('/transporter')) {
    return ROUTE_CATEGORIES.TRANSPORTER;
  }

  // App routes (generally internal)
  if (pathname.startsWith('/app')) {
    return ROUTE_CATEGORIES.INTERNAL;
  }

  // Default to internal for any other route
  return ROUTE_CATEGORIES.INTERNAL;
}

// Determine what navigation to show based on route and role
export function useNavResolver(): {
  headerType: 'public' | 'authenticated';
  routeCategory: RouteCategory;
  showInternalNav: boolean;
  showCustomerNav: boolean;
  showAdminNav: boolean;
  showStaffNav: boolean;
  showTechNav: boolean;
  showTransporterNav: boolean;
} {
  const pathname = usePathname();
  const { user, userRole } = useSupabase();

  const routeCategory = getRouteCategory(pathname);
  const isAuthenticated = !!user;
  
  // Determine navigation based on route category and user role
  if (routeCategory === ROUTE_CATEGORIES.PUBLIC) {
    return {
      headerType: 'public',
      routeCategory,
      showInternalNav: false,
      showCustomerNav: false,
      showAdminNav: false,
      showStaffNav: false,
      showTechNav: false,
      showTransporterNav: false,
    };
  }

  // For authenticated users, determine navigation based on their role
  if (isAuthenticated && userRole) {
    return {
      headerType: 'authenticated',
      routeCategory,
      showInternalNav: userRole === 'admin' || userRole === 'staff',
      showCustomerNav: userRole === 'customer',
      showAdminNav: userRole === 'admin',
      showStaffNav: userRole === 'staff',
      showTechNav: userRole === 'technician',
      showTransporterNav: userRole === 'transporter',
    };
  }

  // If user is not authenticated but on internal routes, show public header as safe default
  return {
    headerType: 'public',
    routeCategory: ROUTE_CATEGORIES.PUBLIC, // Show public routes as safe default
    showInternalNav: false,
    showCustomerNav: false,
    showAdminNav: false,
    showStaffNav: false,
    showTechNav: false,
    showTransporterNav: false,
  };
}