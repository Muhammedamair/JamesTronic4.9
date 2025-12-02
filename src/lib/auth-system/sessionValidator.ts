/**
 * Session Validation System for JamesTronic Enterprise Authentication
 * Validates JWT tokens, session records, and device associations
 */

import { createClient } from '@supabase/supabase-js';
import { verifySessionToken } from './tokenValidator';
import { validateDeviceAccess } from './deviceValidator';
import { UserRole } from './roleResolver';

// Get Supabase configuration from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface SessionData {
  userId: string;
  role: UserRole;
  deviceId: string;
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
  isValid: boolean;
  deviceValid: boolean;
}

/**
 * Validates complete session including JWT, database record, and device access
 */
export const sessionValidator = async (
  token: string,
  deviceId: string
): Promise<SessionData> => {
  try {
    // First verify the JWT token
    const tokenPayload = await verifySessionToken(token);

    if (!tokenPayload) {
      return {
        userId: '',
        role: 'customer',
        deviceId: '',
        sessionId: '',
        issuedAt: 0,
        expiresAt: 0,
        isValid: false,
        deviceValid: false
      };
    }

    const { userId, role, sessionId, exp, iat } = tokenPayload;

    // Validate session record exists in database
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: sessionRecord, error } = await supabase
      .from('session_records')
      .select('status, expires_at, device_id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (error || !sessionRecord) {
      return {
        userId,
        role: role as UserRole,
        deviceId: '',
        sessionId,
        issuedAt: iat,
        expiresAt: exp,
        isValid: false,
        deviceValid: false
      };
    }

    // Check if session is expired
    const now = Math.floor(Date.now() / 1000); // Current timestamp in seconds
    if (exp < now || new Date(sessionRecord.expires_at).getTime() < Date.now()) {
      // Mark session as expired in database
      await supabase
        .from('session_records')
        .update({ status: 'expired' })
        .eq('id', sessionId);

      return {
        userId,
        role: role as UserRole,
        deviceId: sessionRecord.device_id,
        sessionId,
        issuedAt: iat,
        expiresAt: exp,
        isValid: false,
        deviceValid: false
      };
    }

    // Check if session status is active
    if (sessionRecord.status !== 'active') {
      return {
        userId,
        role: role as UserRole,
        deviceId: sessionRecord.device_id,
        sessionId,
        issuedAt: iat,
        expiresAt: exp,
        isValid: false,
        deviceValid: false
      };
    }

    // Validate device access
    const deviceValid = await validateDeviceAccess(userId, deviceId, role as UserRole);

    return {
      userId,
      role: role as UserRole,
      deviceId: sessionRecord.device_id,
      sessionId,
      issuedAt: iat,
      expiresAt: exp,
      isValid: true,
      deviceValid
    };
  } catch (error) {
    console.error('Error validating session:', error);
    return {
      userId: '',
      role: 'customer',
      deviceId: '',
      sessionId: '',
      issuedAt: 0,
      expiresAt: 0,
      isValid: false,
      deviceValid: false
    };
  }
};

/**
 * Invalidates a session (logout)
 */
export const invalidateSession = async (sessionId: string, userId: string): Promise<boolean> => {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { error } = await supabase
      .from('session_records')
      .update({
        status: 'inactive',
        logged_out_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error invalidating session:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error invalidating session:', error);
    return false;
  }
};

/**
 * Creates a new session record
 */
export const createSessionRecord = async (
  userId: string,
  deviceId: string,
  role: string,
  token: string
): Promise<string | null> => {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Generate a unique session ID
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const { error } = await supabase
      .from('session_records')
      .insert([{
        id: sessionId,
        user_id: userId,
        device_id: deviceId,
        role,
        status: 'active',
        token_hash: await hashToken(token), // Store hash for security
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
        created_at: new Date().toISOString()
      }]);

    if (error) {
      console.error('Error creating session record:', error);
      return null;
    }

    return sessionId;
  } catch (error) {
    console.error('Error creating session record:', error);
    return null;
  }
};

/**
 * Hashes token for secure storage
 */
const hashToken = async (token: string): Promise<string> => {
  // In a real implementation, we'd use a proper hashing algorithm
  // For now, using a simple approach
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};