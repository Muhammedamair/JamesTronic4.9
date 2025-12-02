/**
 * Unit tests for Customer Trust Authentication Flow
 */

import { 
  CustomerTrustAuthFlow,
  customerTrustAuthFlow,
  CustomerAuthResult
} from '@/lib/auth-system/customerTrustAuthFlow';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  auth: {
    getUser: jest.fn(),
  }
};

// Mock the supabase client creation
jest.mock('@/lib/supabase/supabase', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Mock auth system functions
jest.mock('@/lib/auth-system', () => ({
  EnterpriseAuthController: jest.fn(() => ({
    authenticateWithOTP: jest.fn(),
    authenticateWithMagicLink: jest.fn(),
    generateMagicLinkToken: jest.fn(),
    generateMagicLink: jest.fn(),
  }))
}));

// Mock OTP functions
jest.mock('@/lib/auth-system/generateOTP', () => ({
  generateOTP: jest.fn(() => '123456'),
  storeOTP: jest.fn(() => Promise.resolve(true)),
}));

// Mock magic link functions
jest.mock('@/lib/auth-system/generateMagicLink', () => ({
  generateMagicLinkToken: jest.fn(() => 'mock-magic-token'),
  generateMagicLink: jest.fn(() => Promise.resolve('https://jamestronic.com/auth/link')),
}));

// Mock session validator
jest.mock('@/lib/auth-system/sessionValidator', () => ({
  createSessionRecord: jest.fn(() => Promise.resolve('sess-123')),
}));

// Mock device fingerprint
jest.mock('@/lib/auth-system/deviceFingerprint', () => ({
  deviceFingerprintGenerator: jest.fn(() => Promise.resolve('device-123')),
}));

describe('Customer Trust Authentication Flow Tests', () => {
  let authFlow: CustomerTrustAuthFlow;

  beforeEach(() => {
    jest.clearAllMocks();
    authFlow = new CustomerTrustAuthFlow();
    
    // Default mock for auth.getUser
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
  });

  test('should initiate auth flow with OTP for new customer', async () => {
    // Mock customer not found (new customer)
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });
    
    // Mock auth controller
    const mockAuthController: any = {
      authenticateWithOTP: jest.fn(),
      authenticateWithMagicLink: jest.fn(),
      generateMagicLinkToken: jest.fn(),
      generateMagicLink: jest.fn(),
    };
    (authFlow as any).authController = mockAuthController;
    
    const result = await authFlow.initiateAuthFlow('9876543210', 'otp');
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('We\'ve sent a 6-digit OTP');
    expect(result.redirectUrl).toContain('/auth/verify-otp');
  });

  test('should initiate auth flow with magic link', async () => {
    // Mock customer not found (new customer)
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });
    
    // Mock auth controller
    const mockAuthController: any = {
      authenticateWithOTP: jest.fn(),
      authenticateWithMagicLink: jest.fn(),
      generateMagicLinkToken: jest.fn().mockReturnValue('mock-token'),
      generateMagicLink: jest.fn().mockResolvedValue('https://jamestronic.com/auth/link'),
    };
    (authFlow as any).authController = mockAuthController;
    
    const result = await authFlow.initiateAuthFlow('9876543210', 'magic_link');
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('We\'ve sent a secure login link');
  });

  test('should validate phone number format correctly', async () => {
    const invalidResult = await authFlow.initiateAuthFlow('123', 'otp');
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.error).toContain('Invalid phone number format');
    
    // Test valid Indian number
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
    
    const validResult = await authFlow.initiateAuthFlow('9876543210', 'otp');
    expect(validResult.success).toBe(true);
  });

  test('should complete auth with valid OTP', async () => {
    const mockAuthController: any = {
      authenticateWithOTP: jest.fn().mockResolvedValue({ success: true, token: 'mock-token' }),
      authenticateWithMagicLink: jest.fn(),
      generateMagicLinkToken: jest.fn(),
      generateMagicLink: jest.fn(),
    };
    (authFlow as any).authController = mockAuthController;
    
    // Mock customer table operations
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } }); // Customer doesn't exist
    mockSupabase.insert.mockResolvedValueOnce({ error: null }); // Insert customer
    mockSupabase.from.mockReturnThis();
    mockSupabase.upsert.mockResolvedValueOnce({ error: null }); // Insert profile
    
    const result = await authFlow.completeAuthWithOTP('9876543210', '123456');
    
    expect(result.success).toBe(true);
    expect(result.token).toBe('mock-token');
  });

  test('should fail auth with invalid OTP', async () => {
    const mockAuthController: any = {
      authenticateWithOTP: jest.fn().mockResolvedValue({ success: false, error: 'Invalid OTP' }),
      authenticateWithMagicLink: jest.fn(),
      generateMagicLinkToken: jest.fn(),
      generateMagicLink: jest.fn(),
    };
    (authFlow as any).authController = mockAuthController;
    
    const result = await authFlow.completeAuthWithOTP('9876543210', '123456');
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid OTP');
  });

  test('should process valid magic link', async () => {
    const mockAuthController: any = {
      authenticateWithOTP: jest.fn(),
      authenticateWithMagicLink: jest.fn().mockResolvedValue({ success: true, token: 'mock-token' }),
      generateMagicLinkToken: jest.fn(),
      generateMagicLink: jest.fn(),
    };
    (authFlow as any).authController = mockAuthController;
    
    const result = await authFlow.processMagicLink('valid-token');
    
    expect(result.success).toBe(true);
    expect(result.token).toBe('mock-token');
  });

  test('should fail with invalid magic link', async () => {
    const mockAuthController: any = {
      authenticateWithOTP: jest.fn(),
      authenticateWithMagicLink: jest.fn().mockResolvedValue({ success: false, error: 'Invalid token' }),
      generateMagicLinkToken: jest.fn(),
      generateMagicLink: jest.fn(),
    };
    (authFlow as any).authController = mockAuthController;
    
    const result = await authFlow.processMagicLink('invalid-token');
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid token');
  });

  test('should create customer profile if it does not exist', async () => {
    const mockAuthController: any = {
      authenticateWithOTP: jest.fn().mockResolvedValue({ success: true }),
      authenticateWithMagicLink: jest.fn(),
      generateMagicLinkToken: jest.fn(),
      generateMagicLink: jest.fn(),
    };
    (authFlow as any).authController = mockAuthController;
    
    // Mock customer not found initially
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });
    // Mock successful insert
    mockSupabase.insert.mockResolvedValueOnce({ error: null });
    mockSupabase.upsert.mockResolvedValueOnce({ error: null });
    
    const result = await (authFlow as any).createOrUpdateCustomerProfile('9876543210');
    
    expect(result).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith('customers');
  });

  test('should update customer profile if it exists', async () => {
    const mockAuthController: any = {
      authenticateWithOTP: jest.fn().mockResolvedValue({ success: true }),
      authenticateWithMagicLink: jest.fn(),
      generateMagicLinkToken: jest.fn(),
      generateMagicLink: jest.fn(),
    };
    (authFlow as any).authController = mockAuthController;
    
    // Mock customer found
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'cust-123' }, error: null });
    // Mock successful update
    mockSupabase.update.mockResolvedValueOnce({ error: null });
    
    const result = await (authFlow as any).createOrUpdateCustomerProfile('9876543210');
    
    expect(result).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith('customers');
  });

  test('should check if customer is returning', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'cust-123' }, error: null });
    
    const result = await (authFlow as any).isReturningCustomer('9876543210');
    
    expect(result).toBe(true);
  });

  test('should handle error when checking returning customer', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Error' } });
    
    const result = await (authFlow as any).isReturningCustomer('9876543210');
    
    expect(result).toBe(false);
  });

  test('should validate Indian phone numbers correctly', () => {
    const validateSpy = jest.spyOn(authFlow as any, 'validatePhoneNumber');
    
    // Valid numbers
    expect(validateSpy('9876543210')).toBe(true); // 10 digits starting with 9
    expect(validateSpy('+919876543210')).toBe(true); // With country code
    expect(validateSpy('919876543210')).toBe(true); // With country code without +
    
    // Invalid numbers
    expect(validateSpy('1234567890')).toBe(false); // Starts with 1
    expect(validateSpy('987654321')).toBe(false); // Only 9 digits
    expect(validateSpy('98765432101')).toBe(false); // 11 digits
    
    validateSpy.mockRestore();
  });

  test('should sanitize phone numbers correctly', () => {
    const sanitizeSpy = jest.spyOn(authFlow as any, 'sanitizePhoneNumber');
    
    expect(sanitizeSpy('987-654-3210')).toBe('9876543210');
    expect(sanitizeSpy('+91 987 654 3210')).toBe('+919876543210');
    expect(sanitizeSpy('(987) 654-3210')).toBe('9876543210');
    
    sanitizeSpy.mockRestore();
  });
});

describe('Singleton Instance Tests', () => {
  test('should be a singleton instance', () => {
    const instance1 = customerTrustAuthFlow;
    const instance2 = customerTrustAuthFlow;
    
    expect(instance1).toBe(instance2);
  });
});