/**
 * Device Validator for JamesTronic Enterprise Authentication
 * Validates device access based on role and device restrictions
 */

import { createClient } from '@supabase/supabase-js';
import { UserRole } from './roleResolver';

// Get Supabase configuration from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Validates if a device is allowed to access the system for a specific user and role
 */
export const validateDeviceAccess = async (
  userId: string,
  deviceId: string,
  role: UserRole
): Promise<boolean> => {
  try {
    // For customer role, allow multiple devices
    if (role === 'customer') {
      return true;
    }

    // For technician and transporter roles, enforce single device policy
    if (role === 'technician' || role === 'transporter') {
      return await enforceSingleDevicePolicy(userId, deviceId, role);
    }

    // For admin and staff roles, check if device is registered (more permissive)
    return await isDeviceRegistered(userId, deviceId);
  } catch (error) {
    console.error('Error validating device access:', error);
    return false;
  }
};

/**
 * Enforces single device policy for technician and transporter roles
 */
const enforceSingleDevicePolicy = async (
  userId: string,
  newDeviceId: string,
  role: 'technician' | 'transporter'
): Promise<boolean> => {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Get currently active sessions for this user
    const { data: activeSessions, error: sessionError } = await supabase
      .from('session_records')
      .select('id, device_id, role, created_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .neq('device_id', newDeviceId); // Exclude the new device

    if (sessionError) {
      console.error('Error fetching active sessions:', sessionError);
      return false;
    }

    // If there are active sessions from other devices, invalidate them
    if (activeSessions && activeSessions.length > 0) {
      // Log the device conflict for audit purposes
      await logDeviceConflict(userId, newDeviceId, activeSessions.map(s => s.device_id), role);

      // Invalidate all other active sessions for this user
      const sessionIds = activeSessions.map(s => s.id);
      await supabase
        .from('session_records')
        .update({ status: 'inactive', logged_out_at: new Date().toISOString() })
        .in('id', sessionIds);

      // Update devices to mark as inactive
      const deviceIds = activeSessions.map(s => s.device_id);
      await supabase
        .from('devices')
        .update({ is_active: false, last_active: new Date().toISOString() })
        .in('id', deviceIds);
    }

    // Allow the new device to proceed
    return true;
  } catch (error) {
    console.error('Error enforcing single device policy:', error);
    return false;
  }
};

/**
 * Checks if a device is registered for a specific user
 */
const isDeviceRegistered = async (userId: string, deviceId: string): Promise<boolean> => {
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
 * Logs device conflicts for audit purposes
 */
const logDeviceConflict = async (
  userId: string,
  newDeviceId: string,
  oldDeviceIds: string[],
  role: 'technician' | 'transporter'
): Promise<void> => {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    await supabase
      .from('device_conflicts')
      .insert({
        user_id: userId,
        new_device_id: newDeviceId,
        old_device_ids: oldDeviceIds,
        role,
        timestamp: new Date().toISOString(),
        resolved: false
      });
  } catch (error) {
    console.error('Error logging device conflict:', error);
  }
};

/**
 * Updates the active device for a user (for technician/transporter roles)
 */
export const updateActiveDevice = async (
  userId: string,
  newDeviceId: string,
  role: 'technician' | 'transporter'
): Promise<boolean> => {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // First, ensure single device policy is enforced
    await enforceSingleDevicePolicy(userId, newDeviceId, role);

    // Register the new device as active
    const { error: deviceError } = await supabase
      .from('devices')
      .upsert({
        id: newDeviceId,
        user_id: userId,
        role,
        last_active: new Date().toISOString(),
        is_active: true,
        created_at: new Date().toISOString()
      });

    if (deviceError) {
      console.error('Error updating active device:', deviceError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating active device:', error);
    return false;
  }
};

/**
 * Checks if a user has been locked out of all devices and needs admin approval
 */
export const isUserDeviceLocked = async (userId: string): Promise<boolean> => {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Check if user has any active sessions or devices
    const { count: activeSessionCount, error: sessionError } = await supabase
      .from('session_records')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('status', 'active');

    if (sessionError) {
      console.error('Error checking active sessions:', sessionError);
      return false;
    }

    const { count: activeDeviceCount, error: deviceError } = await supabase
      .from('devices')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (deviceError) {
      console.error('Error checking active devices:', deviceError);
      return false;
    }

    return (activeSessionCount || 0) === 0 && (activeDeviceCount || 0) === 0;
  } catch (error) {
    console.error('Error checking if user is device locked:', error);
    return false;
  }
};