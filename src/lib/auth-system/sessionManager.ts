import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { randomBytes, createHash } from 'crypto';

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

// Session data type
export interface SessionData {
  id: string;
  userId: string;
  role: string;
  deviceId: string;
  expiresAt: Date;
  refreshTokenHash: string;
  revoked: boolean;
}

// Response types
export interface CreateSessionResponse {
  sessionId: string;
  refreshToken: string;
  success: boolean;
  error?: string;
}

export interface ValidateSessionResponse {
  valid: boolean;
  session?: SessionData;
  error?: string;
}

export interface RefreshSessionResponse {
  newSessionId: string;
  newRefreshToken: string;
  success: boolean;
  error?: string;
}

/**
 * SessionManager - Core session management engine for JamesTronic
 * Handles session creation, validation, and refresh logic
 */
export class SessionManager {
  /**
   * Create a new session after successful OTP verification
   */
  static async createSession(
    userId: string,
    role: string,
    deviceFingerprint: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<CreateSessionResponse> {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

      // Generate session and refresh tokens
      const sessionId = randomBytes(32).toString('hex');
      const refreshToken = randomBytes(32).toString('hex');
      const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');

      // Calculate expiry based on role
      let sessionExpiryHours: number = SESSION_CONFIG.CUSTOMER_EXPIRY;
      if (role === 'admin' || role === 'staff') {
        sessionExpiryHours = role === 'admin' ? SESSION_CONFIG.ADMIN_EXPIRY : SESSION_CONFIG.STAFF_EXPIRY;
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + sessionExpiryHours);

      const refreshExpiresAt = new Date();
      refreshExpiresAt.setDate(refreshExpiresAt.getDate() + SESSION_CONFIG.REFRESH_EXPIRY);

      // Insert session into database using service role
      const { error } = await supabase.rpc('get_my_profile_id'); // Check if we have valid auth context first

      // Use service role to insert session - bypass RLS
      const serviceRoleUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const serviceRoleSupabase = createSupabaseClient(serviceRoleUrl, serviceRoleKey); // service role client

      const { error: insertError } = await serviceRoleSupabase
        .from('user_sessions')
        .insert({
          id: sessionId,
          user_id: userId,
          role,
          device_fingerprint: deviceFingerprint,
          ip_address: ipAddress,
          user_agent: userAgent,
          expires_at: expiresAt.toISOString(),
          refresh_token_hash: refreshTokenHash,
        });

      if (insertError) {
        console.error('Error creating session:', insertError);
        return {
          sessionId: '',
          refreshToken: '',
          success: false,
          error: 'Failed to create session'
        };
      }

      // Set cookies
      const cookieStore = cookies() as any; // Handle type issue in build
      cookieStore.set('session_id', sessionId, {
        ...SESSION_CONFIG.COOKIE_OPTIONS,
        expires: expiresAt,
      });
      cookieStore.set('refresh_token', refreshToken, {
        ...SESSION_CONFIG.COOKIE_OPTIONS,
        expires: refreshExpiresAt,
      });

      return {
        sessionId,
        refreshToken,
        success: true,
      };
    } catch (error) {
      console.error('Error in createSession:', error);
      return {
        sessionId: '',
        refreshToken: '',
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Validate an existing session using the session cookie
   */
  static async validateSession(): Promise<ValidateSessionResponse> {
    try {
      const cookieStore = cookies() as any; // Handle type issue
      const sessionId = cookieStore.get('session_id')?.value;

      if (!sessionId) {
        return { valid: false, error: 'No session cookie found' };
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

      // Get session from database
      const { data: session, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        return { valid: false, error: 'Session not found' };
      }

      // Check if session is revoked
      if (session.revoked) {
        // Clear cookies
        (cookieStore as any).delete('session_id');
        (cookieStore as any).delete('refresh_token');
        return { valid: false, error: 'Session revoked' };
      }

      // Check if session is expired
      const now = new Date();
      const expiresAt = new Date(session.expires_at);

      if (expiresAt < now) {
        // Session expired, clear cookies
        (cookieStore as any).delete('session_id');
        (cookieStore as any).delete('refresh_token');
        return { valid: false, error: 'Session expired' };
      }

      // Return valid session data
      const sessionData: SessionData = {
        id: session.id,
        userId: session.user_id,
        role: session.role,
        deviceId: session.device_fingerprint || '',
        expiresAt,
        refreshTokenHash: session.refresh_token_hash,
        revoked: session.revoked,
      };

      return { valid: true, session: sessionData };
    } catch (error) {
      console.error('Error in validateSession:', error);
      return { valid: false, error: 'Internal server error' };
    }
  }

  /**
   * Refresh an expired session using the refresh token
   */
  static async refreshSession(): Promise<RefreshSessionResponse> {
    try {
      const cookieStore = cookies() as any; // Handle type issue
      const refreshTokenCookie = cookieStore.get('refresh_token')?.value;

      if (!refreshTokenCookie) {
        return { newSessionId: '', newRefreshToken: '', success: false, error: 'No refresh token found' };
      }

      const refreshTokenHash = createHash('sha256').update(refreshTokenCookie).digest('hex');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

      // Find active session by refresh token hash
      const { data: session, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('refresh_token_hash', refreshTokenHash)
        .eq('revoked', false) // Only look for non-revoked sessions
        .single();

      if (error || !session) {
        // Invalid refresh token, clear cookies
        (cookieStore as any).delete('session_id');
        (cookieStore as any).delete('refresh_token');
        return { newSessionId: '', newRefreshToken: '', success: false, error: 'Invalid refresh token' };
      }

      // Check if refresh token is expired (session created more than 7 days ago)
      const sessionCreatedAt = new Date(session.created_at);
      const maxRefreshAge = new Date(sessionCreatedAt);
      maxRefreshAge.setDate(maxRefreshAge.getDate() + SESSION_CONFIG.REFRESH_EXPIRY);

      const now = new Date();
      if (maxRefreshAge < now) {
        // Refresh token expired, clear cookies
        (cookieStore as any).delete('session_id');
        (cookieStore as any).delete('refresh_token');
        return { newSessionId: '', newRefreshToken: '', success: false, error: 'Refresh token expired' };
      }

      // Generate new tokens
      const newSessionId = randomBytes(32).toString('hex');
      const newRefreshToken = randomBytes(32).toString('hex');
      const newRefreshTokenHash = createHash('sha256').update(newRefreshToken).digest('hex');

      // Calculate new expiry based on role
      let sessionExpiryHours: number = SESSION_CONFIG.CUSTOMER_EXPIRY;
      if (session.role === 'admin' || session.role === 'staff') {
        sessionExpiryHours = session.role === 'admin' ? SESSION_CONFIG.ADMIN_EXPIRY : SESSION_CONFIG.STAFF_EXPIRY;
      }

      const newExpiresAt = new Date();
      newExpiresAt.setHours(newExpiresAt.getHours() + sessionExpiryHours);

      // Use service role to update the database with the new session
      const serviceRoleUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const serviceRoleSupabase = createSupabaseClient(serviceRoleUrl, serviceRoleKey); // service role client

      // Update the old session to mark it as revoked and update the refresh token hash
      const { error: updateError } = await serviceRoleSupabase
        .from('user_sessions')
        .update({
          revoked: true,
        })
        .eq('id', session.id);

      if (updateError) {
        console.error('Error revoking old session:', updateError);
        return { newSessionId: '', newRefreshToken: '', success: false, error: 'Failed to update session' };
      }

      // Insert the new session
      const { error: insertError } = await serviceRoleSupabase
        .from('user_sessions')
        .insert({
          id: newSessionId,
          user_id: session.user_id,
          role: session.role,
          device_fingerprint: session.device_fingerprint,
          ip_address: session.ip_address,
          user_agent: session.user_agent,
          expires_at: newExpiresAt.toISOString(),
          refresh_token_hash: newRefreshTokenHash,
        });

      if (insertError) {
        console.error('Error creating new session:', insertError);
        return { newSessionId: '', newRefreshToken: '', success: false, error: 'Failed to create new session' };
      }

      // Set new cookies
      const refreshExpiresAtNew = new Date();
      refreshExpiresAtNew.setDate(refreshExpiresAtNew.getDate() + SESSION_CONFIG.REFRESH_EXPIRY);

      (cookieStore as any).set('session_id', newSessionId, {
        ...SESSION_CONFIG.COOKIE_OPTIONS,
        expires: newExpiresAt,
      });
      (cookieStore as any).set('refresh_token', newRefreshToken, {
        ...SESSION_CONFIG.COOKIE_OPTIONS,
        expires: refreshExpiresAtNew,
      });

      return {
        newSessionId,
        newRefreshToken,
        success: true,
      };
    } catch (error) {
      console.error('Error in refreshSession:', error);
      return { newSessionId: '', newRefreshToken: '', success: false, error: 'Internal server error' };
    }
  }

  /**
   * Revoke a session (logout)
   */
  static async revokeSession(sessionId?: string): Promise<boolean> {
    try {
      const cookieStore = cookies() as any; // Handle type issue

      if (!sessionId) {
        sessionId = cookieStore.get('session_id')?.value;
      }

      if (!sessionId) {
        // Clear cookies even if no session ID
        (cookieStore as any).delete('session_id');
        (cookieStore as any).delete('refresh_token');
        return true;
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

      // Use service role to update the database
      const serviceRoleUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const serviceRoleSupabase = createSupabaseClient(serviceRoleUrl, serviceRoleKey); // service role client

      // Revoke session in database
      const { error } = await serviceRoleSupabase
        .from('user_sessions')
        .update({ revoked: true })
        .eq('id', sessionId);

      if (error) {
        console.error('Error revoking session:', error);
        return false;
      }

      // Clear cookies
      cookieStore.delete('session_id');
      cookieStore.delete('refresh_token');

      return true;
    } catch (error) {
      console.error('Error in revokeSession:', error);
      return false;
    }
  }

  /**
   * Get session data without validation (internal use only)
   */
  static async getSessionData(): Promise<SessionData | null> {
    try {
      const cookieStore = cookies() as any; // Handle type issue
      const sessionId = cookieStore.get('session_id')?.value;

      if (!sessionId) {
        return null;
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

      const { data: session, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        return null;
      }

      return {
        id: session.id,
        userId: session.user_id,
        role: session.role,
        deviceId: session.device_fingerprint || '',
        expiresAt: new Date(session.expires_at),
        refreshTokenHash: session.refresh_token_hash,
        revoked: session.revoked,
      };
    } catch (error) {
      console.error('Error in getSessionData:', error);
      return null;
    }
  }

  /**
   * Create a session via API call from client-side
   */
  static async createSessionClientSide(
    userId: string,
    role: string,
    deviceFingerprint: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<CreateSessionResponse> {
    try {
      const response = await fetch('/api/auth/session/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          role,
          deviceFingerprint,
          ipAddress,
          userAgent
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          sessionId: '',
          refreshToken: '',
          success: false,
          error: errorData.error || 'Failed to create session'
        };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating session via API:', error);
      return {
        sessionId: '',
        refreshToken: '',
        success: false,
        error: 'Network error occurred'
      };
    }
  }
}