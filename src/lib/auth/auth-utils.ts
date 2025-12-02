// lib/auth-utils.ts
// Utility functions for authentication

import { supabase } from '@/lib/supabase/supabase';

/**
 * Get the access token for authenticated requests
 */
export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token || null;
}

/**
 * Get the current user's role
 */
export async function getUserRole(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  // Get user profile to determine role
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', session.user.id)
    .single();

  if (error) {
    console.error('Error fetching user role:', error);
    return null;
  }

  return profile?.role || null;
}

/**
 * Check if the current user has admin privileges
 */
export async function isAdmin(): Promise<boolean> {
  const role = await getUserRole();
  return role === 'admin';
}

/**
 * Check if the current user has staff privileges
 */
export async function isStaff(): Promise<boolean> {
  const role = await getUserRole();
  return role === 'staff';
}

/**
 * Check if the current user has admin or staff privileges
 */
export async function isAdminOrStaff(): Promise<boolean> {
  const role = await getUserRole();
  return role === 'admin' || role === 'staff';
}