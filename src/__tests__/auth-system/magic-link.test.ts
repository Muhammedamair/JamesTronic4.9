/**
 * Unit tests for Magic Link generation and verification functions
 */

import { 
  generateMagicLinkToken, 
  generateMagicLink, 
  verifyMagicLinkToken,
  storeMagicLinkToken 
} from '@/lib/auth-system/generateMagicLink';

// Mock global storage for testing
global.magicLinkStore = new Map();

describe('Magic Link Token Generation Tests', () => {
  test('should generate a 64-character hex token', () => {
    const token = generateMagicLinkToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/); // 32 bytes = 64 hex chars
    expect(token.length).toBe(64);
  });

  test('should generate different tokens on each call', () => {
    const token1 = generateMagicLinkToken();
    const token2 = generateMagicLinkToken();
    expect(token1).not.toBe(token2);
  });
});

describe('Magic Link Storage and Verification Tests', () => {
  beforeEach(() => {
    // Clear the mock storage before each test
    global.magicLinkStore = new Map();
  });

  test('should store magic link token successfully', async () => {
    const token = generateMagicLinkToken();
    const userId = 'user-123';
    const identifier = 'test@example.com';
    
    const result = await storeMagicLinkToken(token, userId, identifier);
    
    expect(result).toBe(true);
    const storedData = global.magicLinkStore.get(token);
    expect(storedData).toBeDefined();
    expect(storedData.userId).toBe(userId);
    expect(storedData.identifier).toBe(identifier);
    expect(storedData.expiry).toBeGreaterThan(Date.now());
  });

  test('should store with custom expiry', async () => {
    const token = generateMagicLinkToken();
    const userId = 'user-123';
    const identifier = 'test@example.com';
    const customExpiry = 600; // 10 minutes
    
    const result = await storeMagicLinkToken(token, userId, identifier, customExpiry);
    
    expect(result).toBe(true);
    const storedData = global.magicLinkStore.get(token);
    expect(storedData).toBeDefined();
    // Check that expiry is approximately 10 minutes from now
    const expectedExpiry = Date.now() + (customExpiry * 1000);
    expect(storedData.expiry).toBeGreaterThan(expectedExpiry - 1000); // Allow 1s variance
    expect(storedData.expiry).toBeLessThan(expectedExpiry + 1000);   // Allow 1s variance
  });
});

describe('Magic Link Generation Tests', () => {
  beforeEach(() => {
    // Clear the mock storage before each test
    global.magicLinkStore = new Map();
    // Mock the environment variable
    process.env.NEXT_PUBLIC_BASE_URL = 'https://jamestronic.com';
  });

  test('should generate a complete magic link URL', async () => {
    const token = generateMagicLinkToken();
    const identifier = 'test@example.com';
    const redirectPath = '/customer/dashboard';
    
    const magicLink = await generateMagicLink(token, identifier, redirectPath);
    
    expect(magicLink).toContain('https://jamestronic.com');
    expect(magicLink).toContain('/auth/magic-link');
    expect(magicLink).toContain(`token=${token}`);
    expect(magicLink).toContain(`redirect=${encodeURIComponent(redirectPath)}`);
    
    // Verify that token was stored
    const storedData = global.magicLinkStore.get(token);
    expect(storedData).toBeDefined();
    expect(storedData.identifier).toBe(identifier);
  });

  test('should use default redirect path if not provided', async () => {
    const token = generateMagicLinkToken();
    const identifier = 'test@example.com';
    
    const magicLink = await generateMagicLink(token, identifier);
    
    expect(magicLink).toContain('redirect=%2Fapp'); // /app URL encoded
  });

  test('should handle storage failure gracefully', async () => {
    // Mock an error scenario
    const originalSet = Map.prototype.set;
    Map.prototype.set = () => { throw new Error('Storage error'); };
    
    const token = generateMagicLinkToken();
    const identifier = 'test@example.com';
    
    try {
      await expect(generateMagicLink(token, identifier)).rejects.toThrow();
    } finally {
      Map.prototype.set = originalSet;
    }
  });
});

describe('Magic Link Verification Tests', () => {
  beforeEach(() => {
    // Clear the mock storage before each test
    global.magicLinkStore = new Map();
  });

  test('should verify valid magic link token', async () => {
    const token = generateMagicLinkToken();
    const userId = 'user-123';
    const identifier = 'test@example.com';
    
    // Store the token first
    await storeMagicLinkToken(token, userId, identifier);
    
    const result = await verifyMagicLinkToken(token);
    
    expect(result).toEqual({ userId, identifier });
    // Token should be removed after successful verification
    expect(global.magicLinkStore.get(token)).toBeUndefined();
  });

  test('should return null for non-existent token', async () => {
    const token = generateMagicLinkToken();
    
    const result = await verifyMagicLinkToken(token);
    
    expect(result).toBeNull();
  });

  test('should return null for expired token', async () => {
    const token = generateMagicLinkToken();
    const userId = 'user-123';
    const identifier = 'test@example.com';
    
    // Manually set an expired token
    const expiryTime = Date.now() - 1000; // Expired 1 second ago
    global.magicLinkStore.set(token, { userId, identifier, expiry: expiryTime });
    
    const result = await verifyMagicLinkToken(token);
    
    expect(result).toBeNull();
    // Expired token should be cleaned up
    expect(global.magicLinkStore.get(token)).toBeUndefined();
  });

  test('should handle verification errors gracefully', async () => {
    // Mock an error scenario
    const originalGet = Map.prototype.get;
    Map.prototype.get = () => { throw new Error('Retrieval error'); };
    
    const token = generateMagicLinkToken();
    
    try {
      const result = await verifyMagicLinkToken(token);
      expect(result).toBeNull();
    } finally {
      Map.prototype.get = originalGet;
    }
  });
});