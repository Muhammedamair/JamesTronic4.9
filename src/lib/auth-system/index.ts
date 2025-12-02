/**
 * JamesTronic Enterprise Authentication System - Main Export
 *
 * This module provides the complete authentication system for JamesTronic,
 * including OTP generation, session management, device validation,
 * and role-based access control.
 */

// Core Authentication Functions
export { generateOTP, storeOTP, verifyOTP } from './generateOTP';
export {
  generateMagicLinkToken,
  generateMagicLink,
  verifyMagicLinkToken,
  storeMagicLinkToken
} from './generateMagicLink';

// Session Management
export {
  sessionValidator,
  invalidateSession,
  createSessionRecord,
  type SessionData
} from './sessionValidator';

// Token Management
export {
  verifySessionToken,
  createSessionToken,
  isTokenExpired,
  type TokenPayload
} from './tokenValidator';

// Device Management
export {
  deviceFingerprintGenerator,
  registerDevice,
  updateDevice,
  isDeviceRegistered,
  getUserActiveDevices
} from './deviceFingerprint';

export {
  validateDeviceAccess,
  updateActiveDevice,
  isUserDeviceLocked
} from './deviceValidator';

// Role Management
export {
  roleResolver,
  hasPermission,
  hasRole,
  isAdminOrStaff,
  hasRoleOrHigher,
  type UserRole,
  type RoleResolution
} from './roleResolver';

// Provider Interfaces (to be implemented with actual services)
export interface OTPProvider {
  sendOTP(phone: string, otp: string): Promise<boolean>;
  verifyOTP(phone: string, otp: string): Promise<boolean>;
}

export interface WhatsAppProvider {
  sendWhatsAppMessage(phone: string, message: string): Promise<boolean>;
}

// Import types at the top level
type UserRole = 'customer' | 'technician' | 'transporter' | 'admin' | 'staff';

// Authentication Flow Controller
export class EnterpriseAuthController {
  private otpProvider: OTPProvider | null = null;
  private whatsappProvider: WhatsAppProvider | null = null;

  setOTPProvider(provider: OTPProvider) {
    this.otpProvider = provider;
  }

  setWhatsAppProvider(provider: WhatsAppProvider) {
    this.whatsappProvider = provider;
  }

  async authenticateCustomer(phone: string): Promise<{ success: boolean; message: string; }> {
    if (!this.otpProvider) {
      return { success: false, message: 'OTP provider not configured' };
    }

    try {
      const { generateOTP, storeOTP } = await import('./generateOTP');
      const otp = generateOTP();
      const stored = await storeOTP(phone, otp);

      if (!stored) {
        return { success: false, message: 'Failed to store OTP' };
      }

      const sent = await this.otpProvider.sendOTP(phone, otp);
      if (!sent) {
        return { success: false, message: 'Failed to send OTP' };
      }

      return { success: true, message: 'OTP sent successfully' };
    } catch (error) {
      console.error('Error authenticating customer:', error);
      return { success: false, message: 'Authentication failed' };
    }
  }

  async authenticateWithOTP(identifier: string, otp: string, role: UserRole = 'customer'): Promise<{ success: boolean; token?: string; error?: string; }> {
    try {
      const { verifyOTP } = await import('./generateOTP');
      const isValid = await verifyOTP(identifier, otp);
      if (!isValid) {
        return { success: false, error: 'Invalid OTP' };
      }

      // Generate device fingerprint
      const { deviceFingerprintGenerator } = await import('./deviceFingerprint');
      const deviceId = await deviceFingerprintGenerator();

      // In a real implementation, we would retrieve the user ID from a database
      // For now, we'll simulate this
      const userId = `user_${identifier}_${Date.now()}`;

      // Validate device access based on role
      const { validateDeviceAccess } = await import('./deviceValidator');
      const deviceValid = await validateDeviceAccess(userId, deviceId, role);
      if (!deviceValid) {
        return { success: false, error: 'Device access denied' };
      }

      // Update active device for technician/transporter roles
      const { updateActiveDevice } = await import('./deviceValidator');
      if (role === 'technician' || role === 'transporter') {
        await updateActiveDevice(userId, deviceId, role);
      }

      // Create session record
      const { createSessionRecord } = await import('./sessionValidator');
      const sessionId = await createSessionRecord(userId, deviceId, role, 'temp_token');
      if (!sessionId) {
        return { success: false, error: 'Failed to create session' };
      }

      // Create session token
      const { createSessionToken } = await import('./tokenValidator');
      const sessionToken = await createSessionToken(userId, role, deviceId, sessionId);
      if (!sessionToken) {
        return { success: false, error: 'Failed to create session token' };
      }

      // Register device
      const { registerDevice } = await import('./deviceFingerprint');
      await registerDevice(userId, deviceId, {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'server'
      });

      return { success: true, token: sessionToken };
    } catch (error) {
      console.error('Error authenticating with OTP:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  async authenticateWithMagicLink(token: string): Promise<{ success: boolean; token?: string; error?: string; }> {
    try {
      const { verifyMagicLinkToken } = await import('./generateMagicLink');
      const magicLinkData = await verifyMagicLinkToken(token);
      if (!magicLinkData) {
        return { success: false, error: 'Invalid or expired magic link' };
      }

      // Generate device fingerprint
      const { deviceFingerprintGenerator } = await import('./deviceFingerprint');
      const deviceId = await deviceFingerprintGenerator();

      // Validate device access
      const { validateDeviceAccess } = await import('./deviceValidator');
      const deviceValid = await validateDeviceAccess(magicLinkData.userId, deviceId, 'customer');
      if (!deviceValid) {
        return { success: false, error: 'Device access denied' };
      }

      // Create session record
      const { createSessionRecord } = await import('./sessionValidator');
      const sessionId = await createSessionRecord(magicLinkData.userId, deviceId, 'customer', 'temp_token');
      if (!sessionId) {
        return { success: false, error: 'Failed to create session' };
      }

      // Create session token
      const { createSessionToken } = await import('./tokenValidator');
      const sessionToken = await createSessionToken(magicLinkData.userId, 'customer', deviceId, sessionId);
      if (!sessionToken) {
        return { success: false, error: 'Failed to create session token' };
      }

      // Register device
      const { registerDevice } = await import('./deviceFingerprint');
      await registerDevice(magicLinkData.userId, deviceId, {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'server'
      });

      return { success: true, token: sessionToken };
    } catch (error) {
      console.error('Error authenticating with magic link:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }
}

// Default export of the controller
export default new EnterpriseAuthController();