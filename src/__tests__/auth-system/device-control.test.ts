/**
 * Unit tests for Device Control and Validation functions
 */

import { 
  validateDeviceAccess,
  updateActiveDevice,
  isUserDeviceLocked
} from '@/lib/auth-system/deviceValidator';

import { 
  deviceFingerprintGenerator,
  registerDevice,
  updateDevice,
  isDeviceRegistered,
  getUserActiveDevices
} from '@/lib/auth-system/deviceFingerprint';

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
};

// Mock the supabase client creation
jest.mock('@/lib/supabase/supabase', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Mock crypto for device fingerprinting
const originalCrypto = global.crypto;
Object.defineProperty(global, 'crypto', {
  value: {
    ...originalCrypto,
    subtle: {
      digest: jest.fn().mockResolvedValue(new Uint8Array(32)),
    }
  },
  writable: true
});

describe('Device Fingerprint Tests', () => {
  test('should generate a device fingerprint', async () => {
    const fingerprint = await deviceFingerprintGenerator();
    
    expect(fingerprint).toBeDefined();
    expect(typeof fingerprint).toBe('string');
    expect(fingerprint.length).toBeGreaterThan(0);
  });

  test('should register a device successfully', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: null });
    
    const result = await registerDevice('user-123', 'device-123', {
      userAgent: 'test-agent',
      platform: 'test-platform'
    });
    
    expect(result).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith('devices');
  });

  test('should update an existing device', async () => {
    mockSupabase.update.mockResolvedValueOnce({ error: null });
    
    const result = await updateDevice('user-123', 'device-123', {
      userAgent: 'updated-agent'
    });
    
    expect(result).toBe(true);
  });

  test('should check if device is registered', async () => {
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { id: 'device-123' }, 
      error: null 
    });
    
    const result = await isDeviceRegistered('user-123', 'device-123');
    
    expect(result).toBe(true);
  });

  test('should get user active devices', async () => {
    const mockDevices = [
      { id: 'device-1', user_agent: 'agent1', last_active: '2023-01-01' },
      { id: 'device-2', user_agent: 'agent2', last_active: '2023-01-02' }
    ];
    
    mockSupabase.select.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    
    mockSupabase.select.mockResolvedValueOnce({ data: mockDevices, error: null });
    
    const result = await getUserActiveDevices('user-123');
    
    expect(result).toEqual(mockDevices);
  });
});

describe('Device Validation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should allow customer device access', async () => {
    const result = await validateDeviceAccess('user-123', 'device-123', 'customer');
    
    expect(result).toBe(true);
  });

  test('should enforce single device for technician', async () => {
    // Mock a situation where there's already an active session for this user
    mockSupabase.select.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.neq.mockReturnThis();
    mockSupabase.select.mockResolvedValueOnce({ 
      data: [{ id: 'sess-456', device_id: 'old-device', role: 'technician', created_at: new Date() }], 
      error: null 
    });
    
    // Mock the update operations
    mockSupabase.update.mockReturnThis();
    mockSupabase.in.mockReturnThis();
    mockSupabase.update.mockResolvedValueOnce({ error: null }); // For session update
    
    // Mock device update to return successfully
    mockSupabase.from.mockReturnThis();
    mockSupabase.update.mockReturnThis();
    mockSupabase.in.mockReturnThis();
    mockSupabase.update.mockResolvedValueOnce({ error: null }); // For device update
    
    // Mock the device registration
    mockSupabase.from.mockReturnThis();
    mockSupabase.upsert.mockResolvedValueOnce({ error: null });
    
    const result = await validateDeviceAccess('user-123', 'new-device', 'technician');
    
    expect(result).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith('session_records');
    expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-123');
  });

  test('should update active device for technician', async () => {
    mockSupabase.upsert.mockResolvedValueOnce({ error: null });
    
    const result = await updateActiveDevice('user-123', 'device-456', 'technician');
    
    expect(result).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith('devices');
  });

  test('should check if user is device locked', async () => {
    // Mock no active sessions and no active devices
    mockSupabase.select.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.select.mockResolvedValueOnce({ count: 0, error: null }); // No active sessions
    mockSupabase.select.mockResolvedValueOnce({ count: 0, error: null }); // No active devices
    
    const result = await isUserDeviceLocked('user-123');
    
    expect(result).toBe(true);
  });

  test('should return false if user has active sessions or devices', async () => {
    // Mock having active sessions
    mockSupabase.select.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.select.mockResolvedValueOnce({ count: 1, error: null }); // Has active sessions
    mockSupabase.select.mockResolvedValueOnce({ count: 0, error: null }); // No active devices
    
    const result = await isUserDeviceLocked('user-123');
    
    expect(result).toBe(false);
  });
});

// Test the device fingerprint generation with client-side environment
describe('Device Fingerprint Client-Side Tests', () => {
  let originalNavigator: any;
  
  beforeAll(() => {
    originalNavigator = global.navigator;
  });
  
  afterAll(() => {
    global.navigator = originalNavigator;
  });

  test('should generate fingerprint with navigator properties', async () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        userAgent: 'Test Browser 1.0',
        platform: 'Test Platform',
        language: 'en-US',
      },
      writable: true
    });
    
    const fingerprint = await deviceFingerprintGenerator();
    
    expect(fingerprint).toBeDefined();
    expect(typeof fingerprint).toBe('string');
    expect(fingerprint.length).toBeGreaterThan(0);
  });
});