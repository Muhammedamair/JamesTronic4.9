/**
 * Unit tests for Role Resolution functions
 */

import { 
  roleResolver,
  hasPermission,
  hasRole,
  isAdminOrStaff,
  hasRoleOrHigher
} from '@/lib/auth-system/roleResolver';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

// Mock the supabase client creation
jest.mock('@/lib/supabase/supabase', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

describe('Role Resolution Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should resolve admin role correctly', async () => {
    const mockProfile = {
      role: 'admin',
      status: 'active'
    };
    
    mockSupabase.single.mockResolvedValueOnce({ data: mockProfile, error: null });
    
    const result = await roleResolver('user-123');
    
    expect(result).toEqual({
      role: 'admin',
      permissions: expect.arrayContaining(['tickets.read.all', 'users.manage']),
      isValid: true
    });
  });

  test('should resolve technician role correctly', async () => {
    const mockProfile = {
      role: 'technician',
      status: 'active'
    };
    
    mockSupabase.single.mockResolvedValueOnce({ data: mockProfile, error: null });
    
    const result = await roleResolver('user-123');
    
    expect(result).toEqual({
      role: 'technician',
      permissions: expect.arrayContaining(['tickets.read.own', 'tickets.write.own']),
      isValid: true
    });
  });

  test('should handle non-existent user profile', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });
    
    const result = await roleResolver('user-123');
    
    expect(result).toEqual({
      role: 'customer',
      permissions: expect.arrayContaining(['tickets.read.own']),
      isValid: false,
      error: 'Not found'
    });
  });

  test('should handle inactive user account', async () => {
    const mockProfile = {
      role: 'technician',
      status: 'suspended'
    };
    
    mockSupabase.single.mockResolvedValueOnce({ data: mockProfile, error: null });
    
    const result = await roleResolver('user-123');
    
    expect(result).toEqual({
      role: 'technician',
      permissions: [],
      isValid: false,
      error: 'Account is suspended'
    });
  });

  test('should handle invalid role', async () => {
    const mockProfile = {
      role: 'invalid_role',
      status: 'active'
    };
    
    mockSupabase.single.mockResolvedValueOnce({ data: mockProfile, error: null });
    
    const result = await roleResolver('user-123');
    
    expect(result).toEqual({
      role: 'customer',
      permissions: expect.arrayContaining(['tickets.read.own']),
      isValid: false,
      error: 'Invalid role: invalid_role'
    });
  });
});

describe('Role-Based Permission Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should check permissions correctly', async () => {
    // Mock profile with admin role
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { role: 'admin', status: 'active' }, 
      error: null 
    });
    
    const result = await hasPermission('user-123', 'tickets.read.all');
    
    expect(result).toBe(true);
  });

  test('should return false for invalid permissions', async () => {
    // Mock profile with customer role
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { role: 'customer', status: 'active' }, 
      error: null 
    });
    
    const result = await hasPermission('user-123', 'tickets.read.all');
    
    expect(result).toBe(false);
  });

  test('should return false when role resolution fails', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Error' } });
    
    const result = await hasPermission('user-123', 'tickets.read.all');
    
    expect(result).toBe(false);
  });
});

describe('Role Checking Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should check specific role correctly', async () => {
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { role: 'technician', status: 'active' }, 
      error: null 
    });
    
    const result = await hasRole('user-123', 'technician');
    
    expect(result).toBe(true);
  });

  test('should return false for wrong role', async () => {
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { role: 'customer', status: 'active' }, 
      error: null 
    });
    
    const result = await hasRole('user-123', 'technician');
    
    expect(result).toBe(false);
  });
});

describe('Admin/Staff Role Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should identify admin user', async () => {
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { role: 'admin', status: 'active' }, 
      error: null 
    });
    
    const result = await isAdminOrStaff('user-123');
    
    expect(result).toBe(true);
  });

  test('should identify staff user', async () => {
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { role: 'staff', status: 'active' }, 
      error: null 
    });
    
    const result = await isAdminOrStaff('user-123');
    
    expect(result).toBe(true);
  });

  test('should return false for technician', async () => {
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { role: 'technician', status: 'active' }, 
      error: null 
    });
    
    const result = await isAdminOrStaff('user-123');
    
    expect(result).toBe(false);
  });
});

describe('Role Hierarchy Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should confirm admin has role or higher than customer', async () => {
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { role: 'admin', status: 'active' }, 
      error: null 
    });
    
    const result = await hasRoleOrHigher('user-123', 'customer');
    
    expect(result).toBe(true);
  });

  test('should confirm technician does not have role or higher than admin', async () => {
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { role: 'technician', status: 'active' }, 
      error: null 
    });
    
    const result = await hasRoleOrHigher('user-123', 'admin');
    
    expect(result).toBe(false);
  });

  test('should confirm staff has role or higher than technician', async () => {
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { role: 'staff', status: 'active' }, 
      error: null 
    });
    
    const result = await hasRoleOrHigher('user-123', 'technician');
    
    expect(result).toBe(true);
  });

  test('should confirm equal roles return true', async () => {
    mockSupabase.single.mockResolvedValueOnce({ 
      data: { role: 'technician', status: 'active' }, 
      error: null 
    });
    
    const result = await hasRoleOrHigher('user-123', 'technician');
    
    expect(result).toBe(true);
  });
});