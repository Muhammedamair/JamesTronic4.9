/**
 * Integration tests for the Enterprise Authentication System
 * Testing the integration between various auth components
 */

import { 
  generateOTP, 
  verifyOTP, 
  storeOTP 
} from '@/lib/auth-system/generateOTP';

import { 
  sessionValidator, 
  createSessionRecord 
} from '@/lib/auth-system/sessionValidator';

import { 
  deviceFingerprintGenerator 
} from '@/lib/auth-system/deviceFingerprint';

import { 
  validateDeviceAccess 
} from '@/lib/auth-system/deviceValidator';

import { 
  roleResolver 
} from '@/lib/auth-system/roleResolver';

import { 
  CustomerTrustAuthFlow 
} from '@/lib/auth-system/customerTrustAuthFlow';

// Mock Supabase client for all tests
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  update: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  auth: {
    getUser: jest.fn(),
  }
};

// Mock the supabase client creation
jest.mock('@/lib/supabase/supabase', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Mock token validation
jest.mock('@/lib/auth-system/tokenValidator', () => ({
  verifySessionToken: jest.fn(),
}));

// Reset mock storage before each test
beforeEach(() => {
  jest.clearAllMocks();
  global.otpStore = new Map();
  global.magicLinkStore = new Map();
});

describe('Enterprise Authentication Integration Tests', () => {
  
  test('complete customer authentication flow integration', async () => {
    // Mock all necessary components for the flow
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } }); // Customer doesn't exist
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
    mockSupabase.insert.mockResolvedValueOnce({ error: null }); // Insert customer
    mockSupabase.upsert.mockResolvedValueOnce({ error: null }); // Insert profile
    
    // Create auth flow instance
    const authFlow = new CustomerTrustAuthFlow();
    
    // Step 1: Initiate auth flow (send OTP)
    const initiateResult = await authFlow.initiateAuthFlow('9876543210', 'otp');
    expect(initiateResult.success).toBe(true);
    
    // Step 2: Verify OTP
    const otp = '123456';
    await storeOTP('9876543210', otp); // Store OTP that was "sent"
    
    // Mock the auth controller's authenticateWithOTP method
    const mockAuthController: any = {
      authenticateWithOTP: jest.fn().mockResolvedValue({ success: true, token: 'mock-session-token' }),
      authenticateWithMagicLink: jest.fn(),
      generateMagicLinkToken: jest.fn(),
      generateMagicLink: jest.fn(),
    };
    (authFlow as any).authController = mockAuthController;
    
    const verifyResult = await authFlow.completeAuthWithOTP('9876543210', otp);
    expect(verifyResult.success).toBe(true);
    expect(verifyResult.token).toBe('mock-session-token');
  });

  test('session validation with device and role integration', async () => {
    // Mock session data
    const mockTokenPayload = {
      userId: 'user-123',
      role: 'technician',
      deviceId: 'device-123',
      sessionId: 'sess-123',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      iat: Math.floor(Date.now() / 1000)
    };
    
    // Mock token verification
    const { verifySessionToken } = require('@/lib/auth-system/tokenValidator');
    (verifySessionToken as jest.MockedFunction<any>).mockResolvedValue(mockTokenPayload);
    
    // Mock session record in database
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
      data: { role: 'technician', status: 'active' }, 
      error: null 
    });
    
    // Mock device validation
    jest.doMock('@/lib/auth-system/deviceValidator', () => ({
      validateDeviceAccess: jest.fn().mockResolvedValue(true),
    }));
    
    // Validate the complete session
    const result = await sessionValidator('mock-token', 'device-123');
    
    expect(result.isValid).toBe(true);
    expect(result.userId).toBe('user-123');
    expect(result.role).toBe('technician');
    expect(result.deviceValid).toBe(true);
  });

  test('technician single-device enforcement integration', async () => {
    // Mock that there's already an active session for the technician
    mockSupabase.select.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.neq.mockReturnThis();
    
    // First call is for checking existing sessions (return an active one)
    mockSupabase.select.mockResolvedValueOnce({ 
      data: [{ id: 'sess-old', device_id: 'old-device-123', role: 'technician', created_at: new Date() }], 
      error: null 
    });
    
    // Second call is for user profile (role check)
    mockSupabase.select.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { role: 'technician', status: 'active' }, 
      error: null 
    });
    
    // Mock session/device update operations
    mockSupabase.update.mockReturnThis();
    mockSupabase.in.mockReturnThis();
    mockSupabase.update.mockResolvedValueOnce({ error: null }); // Update old sessions
    
    mockSupabase.from.mockReturnThis();
    mockSupabase.update.mockReturnThis();
    mockSupabase.in.mockReturnThis();
    mockSupabase.update.mockResolvedValueOnce({ error: null }); // Update old devices
    
    // Mock device registration for new device
    mockSupabase.from.mockReturnThis();
    mockSupabase.upsert.mockResolvedValueOnce({ error: null });
    
    // Validate device access (this should trigger single-device enforcement)
    const result = await validateDeviceAccess('user-123', 'new-device-123', 'technician');
    
    expect(result).toBe(true);
    
    // Verify that old sessions were invalidated
    expect(mockSupabase.from).toHaveBeenCalledWith('session_records');
    expect(mockSupabase.update).toHaveBeenCalledWith({ 
      status: 'inactive', 
      logged_out_at: expect.any(String) 
    });
  });

  test('role-based access control integration', async () => {
    // Mock user profile
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { role: 'admin', status: 'active' }, 
      error: null 
    });
    
    // Test role resolution
    const roleResult = await roleResolver('user-123');
    expect(roleResult.role).toBe('admin');
    expect(roleResult.isValid).toBe(true);
    
    // Test if user is admin or staff
    const isAdminResult = await require('@/lib/auth-system/roleResolver').isAdminOrStaff('user-123');
    expect(isAdminResult).toBe(true);
    
    // Test specific permission
    const hasPermissionResult = await require('@/lib/auth-system/roleResolver').hasPermission('user-123', 'tickets.read.all');
    expect(hasPermissionResult).toBe(true);
  });

  test('customer OTP flow with device fingerprint integration', async () => {
    // Mock customer not found
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
    
    const authFlow = new CustomerTrustAuthFlow();
    
    // Generate a device fingerprint
    const deviceId = await deviceFingerprintGenerator();
    expect(deviceId).toBeDefined();
    expect(deviceId.length).toBeGreaterThan(0);
    
    // Initiate auth flow
    const result = await authFlow.initiateAuthFlow('9876543210', 'otp');
    expect(result.success).toBe(true);
    
    // Verify the OTP flow uses the correct device
    const otp = '123456';
    await storeOTP('9876543210', otp);
    
    // Mock auth controller
    const mockAuthController: any = {
      authenticateWithOTP: jest.fn().mockResolvedValue({ success: true, token: 'mock-token' }),
      authenticateWithMagicLink: jest.fn(),
      generateMagicLinkToken: jest.fn(),
      generateMagicLink: jest.fn(),
    };
    (authFlow as any).authController = mockAuthController;
    
    // Complete the flow
    mockSupabase.insert.mockResolvedValueOnce({ error: null }); // Customer insert
    mockSupabase.upsert.mockResolvedValueOnce({ error: null }); // Profile upsert
    
    const verifyResult = await authFlow.completeAuthWithOTP('9876543210', otp);
    expect(verifyResult.success).toBe(true);
  });

  test('session creation and validation lifecycle', async () => {
    // Create a session record
    mockSupabase.insert.mockResolvedValueOnce({ error: null });
    const sessionId = await createSessionRecord('user-123', 'device-123', 'customer', 'mock-token');
    expect(sessionId).toBeDefined();
    
    // Mock token validation for session validation
    const mockTokenPayload = {
      userId: 'user-123',
      role: 'customer',
      deviceId: 'device-123',
      sessionId: sessionId || 'sess-test',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000)
    };
    
    const { verifySessionToken } = require('@/lib/auth-system/tokenValidator');
    (verifySessionToken as jest.MockedFunction<any>).mockResolvedValue(mockTokenPayload);
    
    // Mock session record lookup
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { 
        status: 'active', 
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        device_id: 'device-123'
      }, 
      error: null 
    });
    
    // Mock role lookup
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { role: 'customer', status: 'active' }, 
      error: null 
    });
    
    // Mock device validation
    jest.doMock('@/lib/auth-system/deviceValidator', () => ({
      validateDeviceAccess: jest.fn().mockResolvedValue(true),
    }));
    
    // Validate the session
    const validationResult = await sessionValidator('mock-token', 'device-123');
    expect(validationResult.isValid).toBe(true);
    expect(validationResult.userId).toBe('user-123');
  });
});

describe('Error Handling Integration Tests', () => {
  test('graceful degradation when OTP service fails', async () => {
    // Mock storage failure
    const originalSet = Map.prototype.set;
    Map.prototype.set = () => { throw new Error('Storage error'); };
    
    try {
      const result = await storeOTP('9876543210', '123456');
      expect(result).toBe(false);
    } finally {
      Map.prototype.set = originalSet;
    }
  });

  test('proper error handling in auth flow', async () => {
    // Mock database error
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });
    
    const authFlow = new CustomerTrustAuthFlow();
    const result = await authFlow.initiateAuthFlow('invalid-phone', 'otp');
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('session validation with token verification failure', async () => {
    // Mock token verification failure
    const { verifySessionToken } = require('@/lib/auth-system/tokenValidator');
    (verifySessionToken as jest.MockedFunction<any>).mockResolvedValue(null);
    
    const result = await sessionValidator('invalid-token', 'device-123');
    
    expect(result.isValid).toBe(false);
    expect(result.userId).toBe('');
  });
});