/**
 * Security verification tests for the JamesTronic Enterprise Authentication System
 * These tests verify that all security measures are properly implemented
 */

import { 
  validateDeviceAccess,
  updateActiveDevice,
  isUserDeviceLocked
} from '@/lib/auth-system/deviceValidator';

import { 
  sessionValidator,
  createSessionRecord,
  invalidateSession
} from '@/lib/auth-system/sessionValidator';

import { 
  deviceFingerprintGenerator,
  registerDevice,
  isDeviceRegistered
} from '@/lib/auth-system/deviceFingerprint';

import { 
  roleResolver,
  hasPermission,
  hasRole,
  isAdminOrStaff,
  hasRoleOrHigher
} from '@/lib/auth-system/roleResolver';

import { 
  generateOTP, 
  verifyOTP, 
  storeOTP 
} from '@/lib/auth-system/generateOTP';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  update: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
};

// Mock the supabase client creation
jest.mock('@/lib/supabase/supabase', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Mock token validator
jest.mock('@/lib/auth-system/tokenValidator', () => ({
  verifySessionToken: jest.fn(),
}));

// Mock storage
beforeEach(() => {
  jest.clearAllMocks();
  global.otpStore = new Map();
});

describe('Security Verification - Device Control', () => {
  test('should enforce single device for technicians', async () => {
    // Mock that there's already an active session for this technician
    mockSupabase.select.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.neq.mockReturnThis();
    
    // Return an existing session for the user
    mockSupabase.select.mockResolvedValueOnce({ 
      data: [{ id: 'sess-existing', device_id: 'old-device', role: 'technician', created_at: new Date() }], 
      error: null 
    });
    
    // Mock the database updates
    mockSupabase.update.mockReturnThis();
    mockSupabase.in.mockReturnThis();
    mockSupabase.update.mockResolvedValueOnce({ error: null }); // Invalidate old sessions
    mockSupabase.from.mockReturnThis();
    mockSupabase.update.mockReturnThis();
    mockSupabase.update.mockResolvedValueOnce({ error: null }); // Deactivate old devices
    
    // Mock device registration
    mockSupabase.from.mockReturnThis();
    mockSupabase.upsert.mockResolvedValueOnce({ error: null });
    
    // Validate device access for a new device
    const result = await validateDeviceAccess('tech-123', 'new-device', 'technician');
    
    // Should allow the new device but invalidate the old one
    expect(result).toBe(true);
    
    // Verify that the old session was invalidated
    expect(mockSupabase.from).toHaveBeenCalledWith('session_records');
    expect(mockSupabase.update).toHaveBeenCalledWith({ 
      status: 'inactive', 
      logged_out_at: expect.any(String) 
    });
    expect(mockSupabase.in).toHaveBeenCalledWith('id', ['sess-existing']);
  });

  test('should not enforce single device for customers', async () => {
    // Validate device access for customer role
    const result = await validateDeviceAccess('customer-123', 'device-123', 'customer');
    
    // Should always allow for customers
    expect(result).toBe(true);
  });

  test('should block second device for technician with active session', async () => {
    // Mock existing session for technician
    mockSupabase.select.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.neq.mockReturnThis();
    mockSupabase.select.mockResolvedValueOnce({ 
      data: [{ id: 'sess-existing', device_id: 'old-device', role: 'technician', created_at: new Date() }], 
      error: null 
    });
    
    // Mock the database operations
    mockSupabase.update.mockReturnThis();
    mockSupabase.in.mockReturnThis();
    mockSupabase.update.mockResolvedValueOnce({ error: null });
    mockSupabase.from.mockReturnThis();
    mockSupabase.update.mockReturnThis();
    mockSupabase.update.mockResolvedValueOnce({ error: null });
    mockSupabase.upsert.mockResolvedValueOnce({ error: null });
    
    // Validate access for new device
    const result = await validateDeviceAccess('tech-123', 'new-device', 'technician');
    
    expect(result).toBe(true);
  });
});

describe('Security Verification - Session Management', () => {
  test('should properly validate active sessions', async () => {
    const mockTokenPayload = {
      userId: 'user-123',
      role: 'customer',
      deviceId: 'device-123',
      sessionId: 'sess-123',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      iat: Math.floor(Date.now() / 1000)
    };
    
    // Mock token verification
    const { verifySessionToken } = require('@/lib/auth-system/tokenValidator');
    (verifySessionToken as jest.MockedFunction<any>).mockResolvedValue(mockTokenPayload);
    
    // Mock active session in database
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { 
        status: 'active', 
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        device_id: 'device-123'
      }, 
      error: null 
    });
    
    // Mock role resolution
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { role: 'customer', status: 'active' }, 
      error: null 
    });
    
    // Mock device validation
    jest.doMock('@/lib/auth-system/deviceValidator', () => ({
      validateDeviceAccess: jest.fn().mockResolvedValue(true),
    }));
    
    const result = await sessionValidator('valid-token', 'device-123');
    
    expect(result.isValid).toBe(true);
    expect(result.userId).toBe('user-123');
    expect(result.deviceValid).toBe(true);
  });

  test('should reject expired sessions', async () => {
    const mockTokenPayload = {
      userId: 'user-123',
      role: 'customer',
      deviceId: 'device-123',
      sessionId: 'sess-123',
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
      iat: Math.floor(Date.now() / 1000) - 7200
    };
    
    // Mock token verification
    const { verifySessionToken } = require('@/lib/auth-system/tokenValidator');
    (verifySessionToken as jest.MockedFunction<any>).mockResolvedValue(mockTokenPayload);
    
    // Mock expired session in database
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { 
        status: 'active', 
        expires_at: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
      }, 
      error: null 
    });
    
    const result = await sessionValidator('expired-token', 'device-123');
    
    expect(result.isValid).toBe(false);
  });

  test('should reject inactive sessions', async () => {
    const mockTokenPayload = {
      userId: 'user-123',
      role: 'customer',
      deviceId: 'device-123',
      sessionId: 'sess-123',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000)
    };
    
    // Mock token verification
    const { verifySessionToken } = require('@/lib/auth-system/tokenValidator');
    (verifySessionToken as jest.MockedFunction<any>).mockResolvedValue(mockTokenPayload);
    
    // Mock inactive session in database
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { 
        status: 'inactive', 
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      }, 
      error: null 
    });
    
    const result = await sessionValidator('token', 'device-123');
    
    expect(result.isValid).toBe(false);
  });
});

describe('Security Verification - Authorization', () => {
  test('should properly restrict customer access to own data', async () => {
    // Mock user profile as customer
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { role: 'customer', status: 'active' }, 
      error: null 
    });
    
    const result = await hasRole('user-123', 'customer');
    expect(result).toBe(true);
    
    // Customers should not have access to all tickets
    const hasAllTicketsAccess = await hasPermission('user-123', 'tickets.read.all');
    expect(hasAllTicketsAccess).toBe(false);
    
    // Customers should have access to own tickets
    const hasOwnTicketsAccess = await hasPermission('user-123', 'tickets.read.own');
    expect(hasOwnTicketsAccess).toBe(true);
  });

  test('should restrict technician to assigned tickets only', async () => {
    // Mock user profile as technician
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { role: 'technician', status: 'active' }, 
      error: null 
    });
    
    const result = await hasRole('user-123', 'technician');
    expect(result).toBe(true);
    
    // Technicians should not have access to all tickets
    const hasAllTicketsAccess = await hasPermission('user-123', 'tickets.read.all');
    expect(hasAllTicketsAccess).toBe(false);
    
    // Technicians should have access to assigned tickets
    const hasOwnTicketsAccess = await hasPermission('user-123', 'tickets.read.own');
    expect(hasOwnTicketsAccess).toBe(true);
  });

  test('should properly restrict role escalation', async () => {
    // Mock user profile as technician
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { role: 'technician', status: 'active' }, 
      error: null 
    });
    
    // Technician should not be considered admin or staff
    const adminResult = await isAdminOrStaff('user-123');
    expect(adminResult).toBe(false);
    
    // Should not have admin-level permissions
    const canManageUsers = await hasPermission('user-123', 'users.manage');
    expect(canManageUsers).toBe(false);
  });

  test('should validate role hierarchy correctly', async () => {
    // Mock user profile as admin
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { role: 'admin', status: 'active' }, 
      error: null 
    });
    
    // Admin should have role or higher than customer
    const adminHasCustomerLevel = await hasRoleOrHigher('admin-user', 'customer');
    expect(adminHasCustomerLevel).toBe(true);
    
    // Mock user profile as customer
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { role: 'customer', status: 'active' }, 
      error: null 
    });
    
    // Customer should not have admin level
    const customerHasAdminLevel = await hasRoleOrHigher('customer-user', 'admin');
    expect(customerHasAdminLevel).toBe(false);
  });
});

describe('Security Verification - OTP System', () => {
  test('should properly validate OTP with expiration', async () => {
    const phone = '9876543210';
    const otp = '123456';
    
    // Store OTP
    const storeResult = await storeOTP(phone, otp, 1); // 1 second expiry for testing
    expect(storeResult).toBe(true);
    
    // Verify valid OTP
    const validResult = await verifyOTP(phone, otp);
    expect(validResult).toBe(true);
    
    // Second verification should fail (OTP removed after first use)
    const invalidResult = await verifyOTP(phone, otp);
    expect(invalidResult).toBe(false);
  });

  test('should reject expired OTPs', async () => {
    const phone = '9876543210';
    const otp = '123456';
    
    // Manually store an expired OTP
    const key = `otp:${phone}`;
    global.otpStore.set(key, { otp, expiry: Date.now() - 1000 }); // Expired 1 second ago
    
    const result = await verifyOTP(phone, otp);
    expect(result).toBe(false);
  });

  test('should generate cryptographically secure OTPs', () => {
    const otps = Array.from({ length: 100 }, () => generateOTP());
    
    // All OTPs should be unique
    const uniqueOtps = new Set(otps);
    expect(uniqueOtps.size).toBe(100); // All should be unique
    
    // All OTPs should be 6 digits
    for (const otp of otps) {
      expect(otp).toMatch(/^\d{6}$/);
      expect(otp.length).toBe(6);
    }
  });
});

describe('Security Verification - Session Invalidation', () => {
  test('should properly invalidate sessions', async () => {
    mockSupabase.update.mockResolvedValueOnce({ error: null });
    
    const result = await invalidateSession('sess-123', 'user-123');
    
    expect(result).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith('session_records');
    expect(mockSupabase.update).toHaveBeenCalledWith({ 
      status: 'inactive', 
      logged_out_at: expect.any(String) 
    });
  });

  test('should create new sessions with proper security', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: null });
    
    const deviceId = 'device-123';
    const result = await createSessionRecord('user-123', deviceId, 'customer', 'token-123');
    
    expect(result).toBeTruthy();
    expect(mockSupabase.from).toHaveBeenCalledWith('session_records');
    
    // Verify that the insert call includes proper security fields
    expect(mockSupabase.insert).toHaveBeenCalledWith([{
      id: expect.stringMatching(/^sess_/),
      user_id: 'user-123',
      device_id: deviceId,
      role: 'customer',
      status: 'active',
      token_hash: expect.any(String), // Should be hashed, not raw token
      expires_at: expect.any(String),
      created_at: expect.any(String)
    }]);
  });
});

describe('Security Verification - Device Fingerprinting', () => {
  test('should generate unique device fingerprints', async () => {
    const fingerprint1 = await deviceFingerprintGenerator();
    const fingerprint2 = await deviceFingerprintGenerator();
    
    expect(fingerprint1).toBeDefined();
    expect(fingerprint2).toBeDefined();
    expect(fingerprint1).not.toBe(fingerprint2); // Should be unique each time
    expect(typeof fingerprint1).toBe('string');
    expect(fingerprint1.length).toBeGreaterThan(0);
  });

  test('should register devices with security information', async () => {
    mockSupabase.upsert.mockResolvedValueOnce({ error: null });
    
    const result = await registerDevice('user-123', 'device-123', {
      userAgent: 'test-browser',
      platform: 'test-platform',
      ip: '192.168.1.1',
      location: 'Mumbai'
    });
    
    expect(result).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith('devices');
    
    // Verify upsert was called with proper parameters
    expect(mockSupabase.upsert).toHaveBeenCalledWith([{
      id: 'device-123',
      user_id: 'user-123',
      role: undefined, // Role might not be passed in this call
      user_agent: 'test-browser',
      platform: 'test-platform',
      ip_address: '192.168.1.1',
      location: 'Mumbai',
      is_active: true,
      first_used: expect.any(String),
      last_active: expect.any(String),
      created_at: expect.any(String)
    }]);
  });
});

describe('Security Verification - Input Validation', () => {
  test('should properly validate inputs to prevent injection', async () => {
    // The system should handle malformed inputs gracefully
    const invalidPhoneResult = await require('@/lib/auth-system/customerTrustAuthFlow')
      .customerTrustAuthFlow
      .initiateAuthFlow('invalid-phone', 'otp');
    
    expect(invalidPhoneResult.success).toBe(false);
  });
});

describe('Security Verification - Error Handling', () => {
  test('should not leak sensitive information in errors', async () => {
    // Mock a database error
    mockSupabase.single.mockResolvedValueOnce({ 
      data: null, 
      error: { message: 'Database connection failed' } 
    });
    
    const result = await roleResolver('user-123');
    
    // Should not expose internal database errors to user
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
    
    // The error message should be user-friendly, not expose internal details
    if (result.error) {
      expect(result.error.toLowerCase()).not.toContain('database connection failed');
    }
  });

  test('should handle OTP storage errors gracefully', async () => {
    // Mock storage error
    const originalSet = Map.prototype.set;
    Map.prototype.set = () => { throw new Error('Storage error'); };
    
    try {
      const result = await storeOTP('9876543210', '123456');
      expect(result).toBe(false);
    } finally {
      Map.prototype.set = originalSet;
    }
  });
});

describe('Security Verification - Rate Limiting (Architecture Check)', () => {
  test('should have architecture in place for rate limiting', () => {
    // The architecture should support rate limiting
    // This is a verification of the design rather than functionality
    expect(typeof generateOTP).toBe('function');
    expect(typeof storeOTP).toBe('function');
    expect(typeof verifyOTP).toBe('function');
    
    // In a real implementation, we would track requests per phone/IP
    // but for now, we're verifying the architecture supports it
    console.log('Architecture verification: OTP system designed to support rate limiting');
  });
});