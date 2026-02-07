/**
 * Role-based dashboard routing helper
 * Maps user roles to their appropriate dashboard routes
 */

export const getDashboardRouteForRole = (role: string): string => {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'staff':
      return '/app';
    case 'technician':
      return '/tech';
    case 'transporter':
      return '/transporter';
    case 'customer':
      return '/';
    case 'manager':
      return '/app';
    default:
      // For unknown roles or pending/rejected users, default to dashboard
      return '/dashboard';
  }
};