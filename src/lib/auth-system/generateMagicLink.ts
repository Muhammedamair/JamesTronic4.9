/**
 * Magic Link Generator for JamesTronic Enterprise Authentication
 * Creates secure, time-limited magic links for customer authentication
 */

import { randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Get Supabase configuration from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Define type for the magic link store
declare global {
  var magicLinkStore: Map<string, { userId: string; identifier: string; expiry: number; createdAt: number }> | undefined;
}

/**
 * Generates a cryptographically secure magic link token
 */
export const generateMagicLinkToken = (): string => {
  // Generate a 32-byte random token (256 bits of entropy)
  const token = randomBytes(32).toString('hex');
  return token;
};

/**
 * Stores magic link token with expiry and user information
 */
export const storeMagicLinkToken = async (
  token: string,
  userId: string,
  identifier: string,
  expiry: number = 900 // 15 minutes in seconds
): Promise<boolean> => {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // In a real system, we'd store the token in a dedicated table
    // For now, we'll use a mock implementation for development
    if (typeof globalThis !== 'undefined' && !globalThis.magicLinkStore) {
      globalThis.magicLinkStore = new Map();
    }

    const magicLinkStore = globalThis.magicLinkStore || new Map();
    const expiryTime = Date.now() + (expiry * 1000); // Convert to milliseconds

    magicLinkStore.set(token, {
      userId,
      identifier,
      expiry: expiryTime,
      createdAt: Date.now()
    });

    // Only set the global if it doesn't exist yet in the global context
    if (typeof globalThis !== 'undefined') {
      globalThis.magicLinkStore = magicLinkStore;
    }

    return true;
  } catch (error) {
    console.error('Error storing magic link token:', error);
    return false;
  }
};

/**
 * Generates a complete magic link URL
 */
export const generateMagicLink = async (
  token: string,
  identifier: string,
  redirectPath: string = '/app'
): Promise<string> => {
  try {
    // Store the token with default 15-minute expiry
    const stored = await storeMagicLinkToken(token, identifier, identifier);

    if (!stored) {
      throw new Error('Failed to store magic link token');
    }

    // Build the magic link with the token
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://jamestronic.com';
    const magicLink = `${baseUrl}/auth/magic-link?token=${token}&redirect=${encodeURIComponent(redirectPath)}`;

    return magicLink;
  } catch (error) {
    console.error('Error generating magic link:', error);
    throw error;
  }
};

/**
 * Verifies magic link token and returns user information if valid
 */
export const verifyMagicLinkToken = async (token: string): Promise<{ userId: string; identifier: string } | null> => {
  try {
    if (typeof globalThis === 'undefined' || !globalThis.magicLinkStore) {
      return null;
    }

    const magicLinkStore = globalThis.magicLinkStore;
    const tokenData = magicLinkStore.get(token);

    if (!tokenData) {
      return null;
    }

    // Check if token has expired
    if (Date.now() > tokenData.expiry) {
      // Clean up expired token
      magicLinkStore.delete(token);
      return null;
    }

    // Return user information and remove token (one-time use)
    const result = { userId: tokenData.userId, identifier: tokenData.identifier };
    magicLinkStore.delete(token);

    return result;
  } catch (error) {
    console.error('Error verifying magic link token:', error);
    return null;
  }
};