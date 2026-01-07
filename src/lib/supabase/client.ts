/**
 * Unified Supabase Client Module for JamesTronic
 * Provides consistent client creation for both authenticated and unauthenticated requests
 */

import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Environment variable checks moved to client creation time to allow build without secrets

// Create a singleton browser client that relies on cookies for session management
let supabaseSingleton: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Creates or returns the singleton Supabase browser client
 * This client relies on cookies for session management (SSR/middleware compatibility)
 */
export const createClient = () => {
  if (!supabaseSingleton) {
    if (!supabaseUrl) throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseAnonKey) throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');

    supabaseSingleton = createBrowserClient(
      supabaseUrl,
      supabaseAnonKey
    );
  }
  return supabaseSingleton;
};

/**
 * Creates a Supabase client with optional authentication token
 * If token is provided, creates an authenticated client with user context
 * If no token is provided, creates an unauthenticated client using anon key only
 * @deprecated Use createClient() instead for browser components to ensure cookie-based session management
 */
export const createClientWithToken = (token?: string) => {
  if (token) {
    // Create client with authenticated user context
    return createBrowserClient(
      supabaseUrl!,
      supabaseAnonKey!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );
  } else {
    // Create client with anon key only (for unauthenticated requests)
    return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
  }
};

/**
 * Creates an authenticated Supabase client
 * Throws an error if no token is provided
 * @deprecated Use createClient() instead for browser components to ensure cookie-based session management
 */
export const createAuthenticatedClient = (token: string) => {
  if (!token) {
    throw new Error('Token is required for authenticated client');
  }

  return createBrowserClient(
    supabaseUrl!,
    supabaseAnonKey!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
};

/**
 * Creates an unauthenticated Supabase client using anon key only
 */
export const createAnonClient = () => {
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
};