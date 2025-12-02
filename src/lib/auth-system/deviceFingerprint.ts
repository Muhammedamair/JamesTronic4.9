/**
 * Device Fingerprint Generator for JamesTronic Enterprise Authentication
 * Creates unique device identifiers for tracking and security
 */

import { createClient } from '@supabase/supabase-js';

// Get Supabase configuration from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Generates a unique device fingerprint based on multiple browser/client properties
 */
export const deviceFingerprintGenerator = async (): Promise<string> => {
  try {
    // For server-side generation, we could use user-agent, IP, etc.
    // For client-side generation, we can use browser properties

    // In a real implementation, we would gather multiple data points:
    // - User Agent
    // - Screen resolution
    // - Timezone
    // - Language
    // - Canvas fingerprint
    // - WebGL fingerprint
    // - etc.

    // For this implementation, we'll create a hash based on available information
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'server';
    const platform = typeof navigator !== 'undefined' ? navigator.platform || 'server' : 'server';
    const language = typeof navigator !== 'undefined' ? navigator.language || 'en' : 'en';
    const timestamp = Date.now().toString();

    // Create a composite string
    const compositeString = `${userAgent}-${platform}-${language}-${timestamp}-${Math.random()}`;

    // Create a hash of the composite string
    if (typeof window !== 'undefined') {
      // Client-side - use Web Crypto API
      const encoder = new TextEncoder();
      const data = encoder.encode(compositeString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      // Server-side - use Node.js crypto
      const crypto = await import('crypto');
      return crypto.createHash('sha256').update(compositeString).digest('hex');
    }
  } catch (error) {
    console.error('Error generating device fingerprint:', error);
    // Fallback to a random identifier
    return `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
};

/**
 * Creates or updates device record in the database
 */
export const registerDevice = async (
  userId: string,
  deviceId: string,
  deviceInfo: {
    userAgent?: string;
    platform?: string;
    ip?: string;
    location?: string;
  }
): Promise<boolean> => {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { error } = await supabase
      .from('devices')
      .insert([{
        id: deviceId,
        user_id: userId,
        user_agent: deviceInfo.userAgent,
        platform: deviceInfo.platform,
        ip_address: deviceInfo.ip,
        location: deviceInfo.location,
        last_active: new Date().toISOString(),
        created_at: new Date().toISOString(),
        is_active: true
      }]);

    if (error) {
      console.error('Error registering device:', error);
      // If insert fails due to duplicate key, try updating
      if (error.code === '23505') { // Unique violation
        return updateDevice(userId, deviceId, deviceInfo);
      }
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error registering device:', error);
    return false;
  }
};

/**
 * Updates an existing device record
 */
export const updateDevice = async (
  userId: string,
  deviceId: string,
  deviceInfo: {
    userAgent?: string;
    platform?: string;
    ip?: string;
    location?: string;
  }
): Promise<boolean> => {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { error } = await supabase
      .from('devices')
      .update({
        user_agent: deviceInfo.userAgent,
        platform: deviceInfo.platform,
        ip_address: deviceInfo.ip,
        location: deviceInfo.location,
        last_active: new Date().toISOString(),
        is_active: true
      })
      .eq('id', deviceId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating device:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating device:', error);
    return false;
  }
};

/**
 * Checks if a device is registered and active for a user
 */
export const isDeviceRegistered = async (userId: string, deviceId: string): Promise<boolean> => {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase
      .from('devices')
      .select('id')
      .eq('id', deviceId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    return !error && !!data;
  } catch (error) {
    console.error('Error checking device registration:', error);
    return false;
  }
};

/**
 * Gets all active devices for a user
 */
export const getUserActiveDevices = async (userId: string): Promise<{ id: string; user_agent?: string; platform?: string; last_active: string; }[]> => {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase
      .from('devices')
      .select('id, user_agent, platform, last_active')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Error getting user active devices:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting user active devices:', error);
    return [];
  }
};