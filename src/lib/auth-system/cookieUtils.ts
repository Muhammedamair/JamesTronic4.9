import { cookies } from 'next/headers';

// Default cookie options for secure sessions
export const DEFAULT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

// Specific options for session cookies
export const SESSION_COOKIE_OPTIONS = {
  ...DEFAULT_COOKIE_OPTIONS,
  maxAge: 60 * 60 * 24 * 7, // 7 days for refresh tokens
};

// Specific options for temporary cookies
export const TEMPORARY_COOKIE_OPTIONS = {
  ...DEFAULT_COOKIE_OPTIONS,
  maxAge: 60 * 60, // 1 hour
};

/**
 * CookieManager - Utility class for secure cookie operations
 */
export class CookieManager {
  /**
   * Set a cookie with secure options
   */
  static setCookie(
    name: string,
    value: string,
    options: any = DEFAULT_COOKIE_OPTIONS
  ): void {
    try {
      // Use type assertion to handle Next.js cookies API
      const cookieStore = cookies() as any; // Next.js cookies store
      cookieStore.set(name, value, {
        ...options,
        httpOnly: options.httpOnly ?? true,
        secure: options.secure ?? (process.env.NODE_ENV === 'production'),
        sameSite: options.sameSite ?? 'strict',
        path: options.path ?? '/',
      });
    } catch (error) {
      console.error(`Error setting cookie ${name}:`, error);
      throw new Error(`Failed to set cookie: ${name}`);
    }
  }

  /**
   * Get a cookie value
   */
  static getCookie(name: string): string | undefined {
    try {
      const cookieStore = cookies() as any; // Next.js cookies store
      const cookie = cookieStore.get(name);
      return cookie?.value;
    } catch (error) {
      console.error(`Error getting cookie ${name}:`, error);
      return undefined;
    }
  }

  /**
   * Delete a cookie
   */
  static deleteCookie(name: string): void {
    try {
      const cookieStore = cookies() as any; // Next.js cookies store
      // Setting maxAge to 0 deletes the cookie
      cookieStore.set(name, '', { maxAge: 0 });
    } catch (error) {
      console.error(`Error deleting cookie ${name}:`, error);
    }
  }

  /**
   * Set session cookie with specific expiry
   */
  static setSessionCookie(name: string, value: string, expiresAt: Date): void {
    this.setCookie(name, value, {
      ...DEFAULT_COOKIE_OPTIONS,
      expires: expiresAt,
    });
  }

  /**
   * Set secure session token
   */
  static setSessionToken(sessionId: string, expiresAt: Date): void {
    this.setSessionCookie('session_id', sessionId, expiresAt);
  }

  /**
   * Set secure refresh token
   */
  static setRefreshToken(refreshToken: string, expiresAt: Date): void {
    this.setSessionCookie('refresh_token', refreshToken, expiresAt);
  }

  /**
   * Get session token
   */
  static getSessionToken(): string | undefined {
    return this.getCookie('session_id');
  }

  /**
   * Get refresh token
   */
  static getRefreshToken(): string | undefined {
    return this.getCookie('refresh_token');
  }

  /**
   * Clear all session cookies
   */
  static clearSessionCookies(): void {
    this.deleteCookie('session_id');
    this.deleteCookie('refresh_token');
  }

  /**
   * Get all session-related cookies as an object
   */
  static getSessionCookies(): Record<string, string> {
    return {
      sessionId: this.getSessionToken() || '',
      refreshToken: this.getRefreshToken() || '',
    };
  }
}

// Export convenience functions
export const setSessionToken = (sessionId: string, expiresAt: Date) =>
  CookieManager.setSessionToken(sessionId, expiresAt);

export const setRefreshToken = (refreshToken: string, expiresAt: Date) =>
  CookieManager.setRefreshToken(refreshToken, expiresAt);

export const getSessionToken = () => CookieManager.getSessionToken();
export const getRefreshToken = () => CookieManager.getRefreshToken();
export const clearSessionCookies = () => CookieManager.clearSessionCookies();