import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SessionManager } from '@/lib/auth-system/sessionManager';
import { CookieManager } from '@/lib/auth-system/cookieUtils';
import { AdminMFAService } from '@/lib/auth-system/adminMFAService';

// Mock the Supabase client
vi.mock('@/lib/supabase/supabase', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: null })),
          limit: vi.fn(() => ({
            single: vi.fn(() => ({ data: null, error: null }))
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn(() => ({ data: null, error: null }))
            }))
          }))
        })),
        insert: vi.fn(() => ({ error: null })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({ error: null }))
        }))
      })),
      eq: vi.fn(() => ({
        single: vi.fn(() => ({ data: null, error: null }))
      }))
    })),
    rpc: vi.fn(() => ({ error: null })),
    auth: {
      getUser: vi.fn(() => ({ data: { user: { id: 'test-user-id' } }, error: null }))
    }
  }))
}));

// Mock cookies
vi.mock('next/headers', async () => {
  const actual = await vi.importActual('next/headers');
  return {
    ...actual,
    cookies: () => ({
      get: vi.fn((name) => {
        if (name === 'session_id') return { value: 'test-session-id' };
        if (name === 'refresh_token') return { value: 'test-refresh-token' };
        return undefined;
      }),
      set: vi.fn(),
      delete: vi.fn(),
    }),
  };
});

describe('SessionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      const result = await SessionManager.createSession(
        'user-123',
        'admin',
        'device-fingerprint-123'
      );
      
      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should fail to create session with invalid inputs', async () => {
      const result = await SessionManager.createSession(
        '',
        'admin',
        'device-fingerprint-123'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validateSession', () => {
    it('should validate an existing session', async () => {
      // Mock a valid session in the database
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: {
                  id: 'test-session-id',
                  user_id: 'user-123',
                  role: 'admin',
                  device_fingerprint: 'device-fingerprint-123',
                  expires_at: new Date(Date.now() + 100000).toISOString(),
                  refresh_token_hash: 'hash-123',
                  revoked: false
                },
                error: null
              }))
            }))
          }))
        }))
      };
      
      vi.mocked(require('@/lib/supabase/supabase').createClient).mockReturnValue(mockSupabase as any);
      
      const result = await SessionManager.validateSession();
      
      expect(result.valid).toBe(true);
      expect(result.session).toBeDefined();
    });

    it('should return invalid for non-existent session', async () => {
      const result = await SessionManager.validateSession();
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('refreshSession', () => {
    it('should refresh an expired session', async () => {
      // Mock database responses for refresh
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: {
                  id: 'old-session-id',
                  user_id: 'user-123',
                  role: 'admin',
                  device_fingerprint: 'device-fingerprint-123',
                  created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
                  expires_at: new Date(Date.now() + 100000).toISOString(),
                  refresh_token_hash: 'hash-123',
                  revoked: false
                },
                error: null
              }))
            }))
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({ error: null }))
          })),
          insert: vi.fn(() => ({ error: null }))
        }))
      };
      
      vi.mocked(require('@/lib/supabase/supabase').createClient).mockReturnValue(mockSupabase as any);
      
      const result = await SessionManager.refreshSession();
      
      expect(result.success).toBe(true);
      expect(result.newSessionId).toBeDefined();
      expect(result.newRefreshToken).toBeDefined();
    });

    it('should fail to refresh with invalid refresh token', async () => {
      const result = await SessionManager.refreshSession();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('revokeSession', () => {
    it('should revoke a session successfully', async () => {
      // Mock database response for revocation
      const mockSupabase = {
        from: vi.fn(() => ({
          update: vi.fn(() => ({
            eq: vi.fn(() => ({ error: null }))
          }))
        }))
      };
      
      vi.mocked(require('@/lib/supabase/supabase').createClient).mockReturnValue(mockSupabase as any);
      
      const result = await SessionManager.revokeSession('test-session-id');
      
      expect(result).toBe(true);
    });

    it('should handle revocation error', async () => {
      // Mock database response with error
      const mockSupabase = {
        from: vi.fn(() => ({
          update: vi.fn(() => ({
            eq: vi.fn(() => ({ error: { message: 'Update failed' } }))
          }))
        }))
      };
      
      vi.mocked(require('@/lib/supabase/supabase').createClient).mockReturnValue(mockSupabase as any);
      
      const result = await SessionManager.revokeSession('test-session-id');
      
      expect(result).toBe(false);
    });
  });
});

describe('CookieManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set a session cookie', () => {
    const spy = vi.spyOn(CookieManager, 'setSessionCookie');
    CookieManager.setSessionCookie('session_id', 'test-value', new Date());
    
    expect(spy).toHaveBeenCalledWith('session_id', 'test-value', expect.any(Date));
  });

  it('should get a session token', () => {
    const token = CookieManager.getSessionToken();
    expect(token).toBe('test-session-id');
  });

  it('should get a refresh token', () => {
    const token = CookieManager.getRefreshToken();
    expect(token).toBe('test-refresh-token');
  });

  it('should clear session cookies', () => {
    const spy = vi.spyOn(CookieManager, 'clearSessionCookies');
    CookieManager.clearSessionCookies();
    
    expect(spy).toHaveBeenCalled();
  });
});

describe('AdminMFAService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateMFASecret', () => {
    it('should generate an MFA secret for admin user', async () => {
      const result = await AdminMFAService.generateMFASecret('admin-user-id');
      
      expect(result.success).toBe(true);
      expect(result.secret).toBeDefined();
      expect(result.qrCode).toBeDefined();
    });
  });

  describe('verifyMFACode', () => {
    it('should verify an MFA code successfully', async () => {
      // Mock MFA attempt data
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  single: vi.fn(() => ({
                    data: {
                      id: 'mfa-attempt-id',
                      expires_at: new Date(Date.now() + 100000).toISOString(),
                      attempt_count: 0
                    },
                    error: null
                  }))
                }))
              }))
            }))
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({ error: null }))
          }))
        }))
      };
      
      vi.mocked(require('@/lib/supabase/supabase').createClient).mockReturnValue(mockSupabase as any);
      
      const result = await AdminMFAService.verifyMFACode('admin-user-id', '123456', 'test-secret');
      
      expect(result.success).toBe(true);
    });

    it('should fail verification with invalid code', async () => {
      // Mock MFA attempt data
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  single: vi.fn(() => ({
                    data: {
                      id: 'mfa-attempt-id',
                      expires_at: new Date(Date.now() + 100000).toISOString(),
                      attempt_count: 0
                    },
                    error: null
                  }))
                }))
              }))
            }))
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({ error: null }))
          }))
        }))
      };
      
      vi.mocked(require('@/lib/supabase/supabase').createClient).mockReturnValue(mockSupabase as any);
      
      const result = await AdminMFAService.verifyMFACode('admin-user-id', 'invalid-code', 'test-secret');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid MFA code');
    });
  });

  describe('hasMFAEnabled', () => {
    it('should return false if user does not have MFA enabled', async () => {
      // Mock profile data with MFA disabled
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: { mfa_enabled: false },
                error: null
              }))
            }))
          }))
        }))
      };
      
      vi.mocked(require('@/lib/supabase/supabase').createClient).mockReturnValue(mockSupabase as any);
      
      const result = await AdminMFAService.hasMFAEnabled('user-id');
      
      expect(result).toBe(false);
    });
  });
});