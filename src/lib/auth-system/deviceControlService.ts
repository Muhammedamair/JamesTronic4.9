/**
 * Device Control Service for JamesTronic Enterprise Authentication
 *
 * Implements single-device enforcement for technicians and transporters,
 * with admin override capabilities and comprehensive device management.
 */

import { supabase } from '@/lib/supabase/supabase';
import { UserRole } from './roleResolver';
import { deviceFingerprintGenerator } from './deviceFingerprint';

export interface DeviceControlResult {
  success: boolean;
  message: string;
  previousDeviceId?: string;
  newDeviceId: string;
}

export interface DeviceConflictResolution {
  conflictId: string;
  resolved: boolean;
  resolutionNotes?: string;
}

/**
 * Service class for handling device control and enforcement
 */
export class DeviceControlService {
  /**
   * Registers a new device for a user, enforcing single-device policy where applicable
   */
  async registerDeviceForUser(
    userId: string,
    role: UserRole,
    deviceInfo?: {
      userAgent?: string;
      platform?: string;
      ip?: string;
      location?: string;
    }
  ): Promise<DeviceControlResult> {
    try {
      // Generate a new device fingerprint
      const newDeviceId = await deviceFingerprintGenerator();

      // Check if single-device policy applies to this role
      if (role === 'technician' || role === 'transporter') {
        // First, check for existing active devices for this user
        const existingDevices = await this.getActiveDevicesForUser(userId);

        if (existingDevices.length > 0) {
          // For technician and transporter roles, enforce single-device policy
          const previousDeviceId = existingDevices[0].id;

          // Log the device conflict for audit purposes
          await this.logDeviceConflict(userId, newDeviceId, [previousDeviceId], role);

          // Invalidate all existing sessions for this user
          await this.invalidateAllUserSessions(userId, previousDeviceId);

          // Mark all existing devices as inactive
          await this.deactivateAllUserDevices(userId, newDeviceId);

          // Return success with information about the previous device
          return {
            success: true,
            message: `New device registered. Previous device ${previousDeviceId} has been logged out.`,
            previousDeviceId,
            newDeviceId
          };
        }
      }

      // Register the new device
      const registrationSuccess = await this.registerDevice(userId, newDeviceId, role, deviceInfo);

      if (!registrationSuccess) {
        return {
          success: false,
          message: 'Failed to register new device',
          newDeviceId
        };
      }

      return {
        success: true,
        message: 'Device registered successfully',
        newDeviceId
      };
    } catch (error) {
      console.error('Error registering device:', error);
      return {
        success: false,
        message: 'Error registering device',
        newDeviceId: await deviceFingerprintGenerator()
      };
    }
  }

  /**
   * Gets all active devices for a user
   */
  async getActiveDevicesForUser(userId: string): Promise<{ id: string; user_agent?: string; platform?: string; last_active: string; }[]> {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('id, user_agent, platform, last_active')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        console.error('Error getting active devices:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting active devices:', error);
      return [];
    }
  }

  /**
   * Invalidates all sessions for a user except for the current device (if specified)
   */
  async invalidateAllUserSessions(userId: string, keepDeviceId?: string): Promise<boolean> {
    try {
      // Get all active sessions for the user
      const { data: sessions, error: sessionError } = await supabase
        .from('session_records')
        .select('id, device_id')
        .eq('user_id', userId)
        .eq('status', 'active');

      if (sessionError) {
        console.error('Error getting user sessions:', sessionError);
        return false;
      }

      if (!sessions || sessions.length === 0) {
        return true; // No sessions to invalidate
      }

      // Filter out the session to keep (if specified)
      const sessionIdsToInvalidate = keepDeviceId
        ? sessions.filter(s => s.device_id !== keepDeviceId).map(s => s.id)
        : sessions.map(s => s.id);

      if (sessionIdsToInvalidate.length > 0) {
        // Update sessions to mark as inactive
        const { error: updateError } = await supabase
          .from('session_records')
          .update({
            status: 'inactive',
            logged_out_at: new Date().toISOString()
          })
          .in('id', sessionIdsToInvalidate);

        if (updateError) {
          console.error('Error invalidating sessions:', updateError);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error invalidating user sessions:', error);
      return false;
    }
  }

  /**
   * Deactivates all devices for a user except for the current device (if specified)
   */
  async deactivateAllUserDevices(userId: string, keepDeviceId?: string): Promise<boolean> {
    try {
      // Update all devices to be inactive, except the one to keep
      const updatePayload: { is_active: boolean; last_active: string } = {
        is_active: false,
        last_active: new Date().toISOString()
      };

      if (keepDeviceId) {
        const { error } = await supabase
          .from('devices')
          .update(updatePayload)
          .eq('user_id', userId)
          .neq('id', keepDeviceId);

        if (error) {
          console.error('Error deactivating user devices:', error);
          return false;
        }
      } else {
        // Deactivate all devices for this user
        const { error } = await supabase
          .from('devices')
          .update(updatePayload)
          .eq('user_id', userId);

        if (error) {
          console.error('Error deactivating user devices:', error);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error deactivating user devices:', error);
      return false;
    }
  }

  /**
   * Registers a device in the database
   */
  private async registerDevice(
    userId: string,
    deviceId: string,
    role: UserRole,
    deviceInfo?: {
      userAgent?: string;
      platform?: string;
      ip?: string;
      location?: string;
    }
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('devices')
        .insert([{
          id: deviceId,
          user_id: userId,
          role,
          user_agent: deviceInfo?.userAgent,
          platform: deviceInfo?.platform,
          ip_address: deviceInfo?.ip,
          location: deviceInfo?.location,
          is_active: true,
          first_used: new Date().toISOString(),
          last_active: new Date().toISOString(),
          created_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('Error registering device:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error registering device:', error);
      return false;
    }
  }

  /**
   * Logs a device conflict for audit purposes
   */
  private async logDeviceConflict(
    userId: string,
    newDeviceId: string,
    oldDeviceIds: string[],
    role: UserRole
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('device_conflicts')
        .insert({
          user_id: userId,
          new_device_id: newDeviceId,
          old_device_ids: oldDeviceIds,
          role,
          timestamp: new Date().toISOString()
        });

      if (error) {
        console.error('Error logging device conflict:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error logging device conflict:', error);
      return false;
    }
  }

  /**
   * Checks if a device is authorized for a specific user and role
   */
  async isDeviceAuthorized(userId: string, deviceId: string, role: UserRole): Promise<boolean> {
    try {
      // For customer role, allow multiple devices
      if (role === 'customer') {
        return true;
      }

      // For technician and transporter roles, ensure only one device is active
      if (role === 'technician' || role === 'transporter') {
        const activeDevices = await this.getActiveDevicesForUser(userId);

        // Check if the requested device is the only active one
        if (activeDevices.length === 1 && activeDevices[0].id === deviceId) {
          return true;
        }

        // If there are multiple active devices or this device is not active, deny access
        return false;
      }

      // For admin and staff roles, check if device is registered
      return await this.isDeviceRegistered(userId, deviceId);
    } catch (error) {
      console.error('Error checking device authorization:', error);
      return false;
    }
  }

  /**
   * Checks if a device is registered for a user
   */
  private async isDeviceRegistered(userId: string, deviceId: string): Promise<boolean> {
    try {
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
  }

  /**
   * Admin function to force logout a user from all devices
   */
  async forceLogoutUser(userId: string, adminId: string, reason: string = 'Admin action'): Promise<boolean> {
    try {
      // Invalidate all sessions for the user
      const sessionsInvalidated = await this.invalidateAllUserSessions(userId);

      // Deactivate all devices for the user
      const devicesDeactivated = await this.deactivateAllUserDevices(userId);

      if (!sessionsInvalidated || !devicesDeactivated) {
        return false;
      }

      // Log this admin action
      await supabase
        .from('action_logs')
        .insert({
          user_id: adminId,
          action: 'force_logout_user',
          details: {
            target_user_id: userId,
            reason
          },
          timestamp: new Date().toISOString()
        });

      return true;
    } catch (error) {
      console.error('Error forcing logout user:', error);
      return false;
    }
  }

  /**
   * Admin function to resolve a device conflict
   */
  async resolveDeviceConflict(
    conflictId: string,
    adminId: string,
    resolutionNotes: string
  ): Promise<DeviceConflictResolution> {
    try {
      // Update the conflict record to mark as resolved
      const { error } = await supabase
        .from('device_conflicts')
        .update({
          resolved: true,
          resolution_notes: resolutionNotes,
          admin_resolved_by: adminId,
          admin_resolved_at: new Date().toISOString()
        })
        .eq('id', conflictId);

      if (error) {
        console.error('Error resolving device conflict:', error);
        return {
          conflictId,
          resolved: false,
          resolutionNotes: 'Error resolving conflict'
        };
      }

      return {
        conflictId,
        resolved: true,
        resolutionNotes
      };
    } catch (error) {
      console.error('Error resolving device conflict:', error);
      return {
        conflictId,
        resolved: false,
        resolutionNotes: 'Error resolving conflict'
      };
    }
  }

  /**
   * Gets pending device conflicts that need admin attention
   */
  async getPendingDeviceConflicts(): Promise<Array<{
    id: string;
    userId: string;
    newDeviceId: string;
    oldDeviceIds: string[];
    role: string;
    timestamp: string;
  }>> {
    try {
      const { data, error } = await supabase
        .from('device_conflicts')
        .select('id, user_id, new_device_id, old_device_ids, role, timestamp')
        .eq('resolved', false);

      if (error) {
        console.error('Error getting pending device conflicts:', error);
        return [];
      }

      return data?.map(conflict => ({
        id: conflict.id,
        userId: conflict.user_id,
        newDeviceId: conflict.new_device_id,
        oldDeviceIds: conflict.old_device_ids,
        role: conflict.role,
        timestamp: conflict.timestamp
      })) || [];
    } catch (error) {
      console.error('Error getting pending device conflicts:', error);
      return [];
    }
  }

  /**
   * Updates the last active time for a device
   */
  async updateDeviceActivity(userId: string, deviceId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('devices')
        .update({ last_active: new Date().toISOString() })
        .eq('id', deviceId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating device activity:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating device activity:', error);
      return false;
    }
  }
}

// Export a singleton instance of the device control service
export const deviceControlService = new DeviceControlService();