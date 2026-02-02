import { cookies } from 'next/headers';
import { randomBytes, createHash } from 'crypto';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Session configuration
const SESSION_CONFIG = {
  // Session expiry times (in hours)
  CUSTOMER_EXPIRY: 6,
  STAFF_EXPIRY: 12,
  ADMIN_EXPIRY: 24,

  // Refresh token expiry (in days)
  REFRESH_EXPIRY: 7,

  // Cookie settings
  COOKIE_OPTIONS: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
  },
} as const;

// Helper functions that need cookies access (server components only)
export async function getSessionId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get('session_id');
  return cookie?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get('refresh_token');
  return cookie?.value;
}

export async function setSessionCookies(sessionId: string, refreshToken: string): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + SESSION_CONFIG.ADMIN_EXPIRY); // Using admin expiry as max

  const refreshExpiresAt = new Date();
  refreshExpiresAt.setDate(refreshExpiresAt.getDate() + SESSION_CONFIG.REFRESH_EXPIRY);

  const cookieStore = await cookies();
  cookieStore.set('session_id', sessionId, {
    ...SESSION_CONFIG.COOKIE_OPTIONS,
    expires: expiresAt,
  });
  cookieStore.set('refresh_token', refreshToken, {
    ...SESSION_CONFIG.COOKIE_OPTIONS,
    expires: refreshExpiresAt,
  });
}

export async function clearSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('session_id');
  cookieStore.delete('refresh_token');
}