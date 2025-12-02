/**
 * Role Resolver for JamesTronic Enterprise Authentication
 * Determines user roles based on profile data and authentication method
 */

import { createClient } from '@supabase/supabase-js';

// Get Supabase configuration from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type UserRole = 'customer' | 'technician' | 'transporter' | 'staff' | 'admin';

export interface RoleResolution {
  role: UserRole;
  permissions: string[];
  isValid: boolean;
  error?: string;
}

/**
 * Resolves the role for a given user ID
 */
export const roleResolver = async (userId: string): Promise<RoleResolution> => {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch user profile from database
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return {
        role: 'customer', // Default to customer if no profile found
        permissions: getPermissionsForRole('customer'),
        isValid: false,
        error: error?.message || 'User profile not found'
      };
    }

    // Check if user account is active
    if (profile.status !== 'active') {
      return {
        role: profile.role as UserRole,
        permissions: [],
        isValid: false,
        error: `Account is ${profile.status}`
      };
    }

    const role = profile.role as UserRole;

    // Validate that the role is one of our supported roles
    if (!isValidRole(role)) {
      return {
        role: 'customer',
        permissions: getPermissionsForRole('customer'),
        isValid: false,
        error: `Invalid role: ${role}`
      };
    }

    return {
      role,
      permissions: getPermissionsForRole(role),
      isValid: true
    };
  } catch (error) {
    console.error('Error resolving role:', error);
    return {
      role: 'customer',
      permissions: getPermissionsForRole('customer'),
      isValid: false,
      error: (error as Error).message
    };
  }
};

/**
 * Validates if a role string is valid
 */
const isValidRole = (role: string): role is UserRole => {
  const validRoles: UserRole[] = ['customer', 'technician', 'transporter', 'staff', 'admin'];
  return validRoles.includes(role as UserRole);
};

/**
 * Gets permissions for a specific role
 */
const getPermissionsForRole = (role: UserRole): string[] => {
  switch (role) {
    case 'admin':
      return [
        'tickets.read.all',      // Can read all tickets
        'tickets.write.all',     // Can update all tickets
        'users.manage',          // Can manage users
        'reports.view',          // Can view reports
        'settings.manage',       // Can manage settings
        'devices.manage',        // Can manage devices
        'profiles.read.all',     // Can read all profiles
        'profiles.write.all'     // Can update all profiles
      ];

    case 'staff':
      return [
        'tickets.read.all',      // Can read all tickets
        'tickets.write.all',     // Can update all tickets
        'users.manage',          // Can manage users
        'reports.view',          // Can view reports
        'profiles.read.all',     // Can read all profiles
        'profiles.write.all'     // Can update all profiles
      ];

    case 'technician':
      return [
        'tickets.read.own',      // Can read assigned tickets only
        'tickets.write.own',     // Can update assigned tickets only
        'customers.read.own',    // Can read customer info for assigned tickets
        'parts.request',         // Can request parts
        'location.update'        // Can update location
      ];

    case 'transporter':
      return [
        'tickets.read.transport', // Can read transport-related tickets
        'tickets.update.transport', // Can update transport status
        'location.update'        // Can update location
      ];

    case 'customer':
      return [
        'tickets.read.own',      // Can read own tickets
        'tickets.create',        // Can create new tickets
        'profile.read.own',      // Can read own profile
        'profile.update.own'     // Can update own profile
      ];

    default:
      return [
        'tickets.read.own',
        'profile.read.own'
      ];
  }
};

/**
 * Checks if a user has a specific permission based on their role
 */
export const hasPermission = async (userId: string, permission: string): Promise<boolean> => {
  const roleData = await roleResolver(userId);

  if (!roleData.isValid) {
    return false;
  }

  return roleData.permissions.includes(permission);
};

/**
 * Checks if a user has a specific role
 */
export const hasRole = async (userId: string, requiredRole: UserRole): Promise<boolean> => {
  const roleData = await roleResolver(userId);

  if (!roleData.isValid) {
    return false;
  }

  return roleData.role === requiredRole;
};

/**
 * Checks if a user has admin or staff role
 */
export const isAdminOrStaff = async (userId: string): Promise<boolean> => {
  const roleData = await roleResolver(userId);

  if (!roleData.isValid) {
    return false;
  }

  return roleData.role === 'admin' || roleData.role === 'staff';
};

/**
 * Checks if a user has the required role or higher privilege
 */
export const hasRoleOrHigher = async (userId: string, requiredRole: UserRole): Promise<boolean> => {
  const roleData = await roleResolver(userId);

  if (!roleData.isValid) {
    return false;
  }

  // Define role hierarchy (higher index means higher privilege)
  const roleHierarchy: UserRole[] = ['customer', 'transporter', 'technician', 'staff', 'admin'];

  const requiredIndex = roleHierarchy.indexOf(requiredRole);
  const userIndex = roleHierarchy.indexOf(roleData.role);

  return userIndex >= requiredIndex;
};