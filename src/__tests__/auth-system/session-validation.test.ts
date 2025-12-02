/**
 * Unit tests for Session Validation functions
 */

import { 
  sessionValidator, 
  invalidateSession, 
  createSessionRecord 
} from '@/lib/auth-system/sessionValidator';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  update: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
};

// Mock the supabase client creation
jest.mock('@/lib/supabase/supabase', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Mock token validator functions
jest.mock('@/lib/auth-system/tokenValidator', () => ({
  verifySessionToken: jest.fn(),
}));

import { verifySessionToken } from '@/lib/auth-system/tokenValidator';

describe('Session Validation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return invalid session data when token verification fails', async () => {
    (verifySessionToken as jest.MockedFunction<any>).mockResolvedValue(null);
    
    const result = await sessionValidator('invalid-token', 'device-123');
    
    expect(result).toEqual({
      userId: '',
      role: '',
      deviceId: '',
      sessionId: '',
      issuedAt: 0,
      expiresAt: 0,
      isValid: false,
      deviceValid: false
    });
  });

  test('should return invalid session when database query fails', async () => {
    const tokenPayload = {
      userId: 'user-123',
      role: 'customer',
      sessionId: 'sess-123',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      iat: Math.floor(Date.now() / 1000)
    };
    
    (verifySessionToken as jest.MockedFunction<any>).mockResolvedValue(tokenPayload);
    
    // Mock database error
    mockSupabase.single.mockResolvedValueOnce({ error: { message: 'Database error' } });
    
    const result = await sessionValidator('valid-token', 'device-123');
    
    expect(result.isValid).toBe(false);
    expect(result.userId).toBe('user-123');
  });

  test('should return invalid session when session is expired', async () => {
    const tokenPayload = {
      userId: 'user-123',
      role: 'customer',
      sessionId: 'sess-123',
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
      iat: Math.floor(Date.now() / 1000) - 7200  // 2 hours ago
    };
    
    (verifySessionToken as jest.MockedFunction<any>).mockResolvedValue(tokenPayload);
    
    // Mock valid session record but expired in database
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { 
        status: 'active', 
        expires_at: new Date(Date.now() - 1000).toISOString() // Expired 1 second ago
      }, 
      error: null 
    });
    
    const result = await sessionValidator('valid-token', 'device-123');
    
    expect(result.isValid).toBe(false);
    expect(result.userId).toBe('user-123');
  });

  test('should return invalid session when status is not active', async () => {
    const tokenPayload = {
      userId: 'user-123',
      role: 'customer',
      sessionId: 'sess-123',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      iat: Math.floor(Date.now() / 1000)
    };
    
    (verifySessionToken as jest.MockedFunction<any>).mockResolvedValue(tokenPayload);
    
    // Mock session record with inactive status
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { 
        status: 'inactive', 
        expires_at: new Date(Date.now() + 3600000).toISOString() // Expires in 1 hour
      }, 
      error: null 
    });
    
    const result = await sessionValidator('valid-token', 'device-123');
    
    expect(result.isValid).toBe(false);
    expect(result.userId).toBe('user-123');
  });

  test('should return valid session when all checks pass', async () => {
    const tokenPayload = {
      userId: 'user-123',
      role: 'customer',
      sessionId: 'sess-123',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      iat: Math.floor(Date.now() / 1000)
    };
    
    (verifySessionToken as jest.MockedFunction<any>).mockResolvedValue(tokenPayload);
    
    // Mock valid session record
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { 
        status: 'active', 
        expires_at: new Date(Date.now() + 3600000).toISOString(), // Expires in 1 hour
        device_id: 'device-123'
      }, 
      error: null 
    });
    
    // Mock device validation (assuming it's valid)
    jest.doMock('@/lib/auth-system/deviceValidator', () => ({
      validateDeviceAccess: jest.fn().mockResolvedValue(true),
    }));
    
    const result = await sessionValidator('valid-token', 'device-123');
    
    expect(result.isValid).toBe(true);
    expect(result.userId).toBe('user-123');
    expect(result.role).toBe('customer');
  });
});

describe('Session Invalidation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should invalidate session successfully', async () => {
    mockSupabase.update.mockResolvedValueOnce({ error: null });
    
    const result = await invalidateSession('sess-123', 'user-123');
    
    expect(result).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith('session_records');
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'sess-123');
    expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-123');
  });

  test('should return false if session invalidation fails', async () => {
    mockSupabase.update.mockResolvedValueOnce({ error: { message: 'Update error' } });
    
    const result = await invalidateSession('sess-123', 'user-123');
    
    expect(result).toBe(false);
  });

  test('should handle session invalidation errors gracefully', async () => {
    mockSupabase.update.mockRejectedValueOnce(new Error('Network error'));
    
    const result = await invalidateSession('sess-123', 'user-123');
    
    expect(result).toBe(false);
  });
});

describe('Session Creation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the hashToken function
    jest.doMock('@/lib/auth-system/sessionValidator', () => {
      const originalModule = jest.requireActual('@/lib/auth-system/sessionValidator');
      return {
        ...originalModule,
        hashToken: jest.fn().mockResolvedValue('hashed-token'),
      };
    });
  });

  test('should create session record successfully', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: null });
    
    const result = await createSessionRecord('user-123', 'device-123', 'customer', 'token-123');
    
    expect(result).toBeTruthy();
    expect(mockSupabase.from).toHaveBeenCalledWith('session_records');
    expect(mockSupabase.insert).toHaveBeenCalledWith([{
      id: expect.stringContaining('sess_'),
      user_id: 'user-123',
      device_id: 'device-123',
      role: 'customer',
      status: 'active',
      token_hash: 'hashed-token',
      expires_at: expect.any(String),
      created_at: expect.any(String)
    }]);
  });

  test('should return null if session creation fails', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: { message: 'Insert error' } });
    
    const result = await createSessionRecord('user-123', 'device-123', 'customer', 'token-123');
    
    expect(result).toBeNull();
  });
});