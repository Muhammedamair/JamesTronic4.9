/**
 * Unit tests for OTP generation and verification functions
 */

import { generateOTP, storeOTP, verifyOTP } from '@/lib/auth-system/generateOTP';

// Mock global storage for testing
global.otpStore = new Map();

describe('OTP Generation Tests', () => {
  beforeEach(() => {
    // Clear the mock storage before each test
    global.otpStore = new Map();
  });

  test('should generate a 6-digit OTP by default', () => {
    const otp = generateOTP();
    expect(otp).toMatch(/^\d{6}$/);
    expect(otp.length).toBe(6);
  });

  test('should generate OTP with custom length', () => {
    const otp = generateOTP(4);
    expect(otp).toMatch(/^\d{4}$/);
    expect(otp.length).toBe(4);
  });

  test('should generate OTP with 8-digit length', () => {
    const otp = generateOTP(8);
    expect(otp).toMatch(/^\d{8}$/);
    expect(otp.length).toBe(8);
  });

  test('should pad OTP with leading zeros when necessary', () => {
    // Mock randomInt to return a small number to test padding
    jest.spyOn(global.Math, 'random').mockReturnValue(0.0001);
    
    const otp = generateOTP(6);
    expect(otp).toMatch(/^\d{6}$/);
    expect(otp.length).toBe(6);
    expect(otp).toMatch(/^0/); // Should start with zero due to padding
    
    // Restore random function
    jest.spyOn(global.Math, 'random').mockRestore();
  });
});

describe('OTP Storage and Verification Tests', () => {
  beforeEach(() => {
    // Clear the mock storage before each test
    global.otpStore = new Map();
  });

  test('should store OTP successfully', async () => {
    const phone = '9876543210';
    const otp = '123456';
    const result = await storeOTP(phone, otp);
    
    expect(result).toBe(true);
    const storedData = global.otpStore.get(`otp:${phone}`);
    expect(storedData).toBeDefined();
    expect(storedData.otp).toBe(otp);
    expect(storedData.expiry).toBeGreaterThan(Date.now());
  });

  test('should verify valid OTP successfully', async () => {
    const phone = '9876543210';
    const otp = '123456';
    
    await storeOTP(phone, otp);
    const isValid = await verifyOTP(phone, otp);
    
    expect(isValid).toBe(true);
  });

  test('should fail verification for invalid OTP', async () => {
    const phone = '9876543210';
    const otp = '123456';
    const invalidOtp = '654321';
    
    await storeOTP(phone, otp);
    const isValid = await verifyOTP(phone, invalidOtp);
    
    expect(isValid).toBe(false);
  });

  test('should fail verification for non-existent OTP', async () => {
    const phone = '9876543210';
    const otp = '123456';
    
    const isValid = await verifyOTP(phone, otp);
    
    expect(isValid).toBe(false);
  });

  test('should fail verification for expired OTP', async () => {
    const phone = '9876543210';
    const otp = '123456';
    
    // Manually set an expired OTP
    const key = `otp:${phone}`;
    global.otpStore.set(key, { otp, expiry: Date.now() - 1000 }); // Expired 1 second ago
    
    const isValid = await verifyOTP(phone, otp);
    
    expect(isValid).toBe(false);
    expect(global.otpStore.get(key)).toBeUndefined(); // Should be cleaned up
  });

  test('should remove OTP after successful verification (one-time use)', async () => {
    const phone = '9876543210';
    const otp = '123456';
    
    await storeOTP(phone, otp);
    
    // First verification should succeed
    const firstResult = await verifyOTP(phone, otp);
    expect(firstResult).toBe(true);
    
    // Second verification should fail as OTP is removed
    const secondResult = await verifyOTP(phone, otp);
    expect(secondResult).toBe(false);
  });

  test('should handle storage errors gracefully', async () => {
    // Mock an error scenario by temporarily breaking the storage mechanism
    const originalSet = Map.prototype.set;
    Map.prototype.set = () => { throw new Error('Storage error'); };
    
    const phone = '9876543210';
    const otp = '123456';
    
    try {
      const result = await storeOTP(phone, otp);
      expect(result).toBe(false);
    } finally {
      Map.prototype.set = originalSet;
    }
  });

  test('should handle verification errors gracefully', async () => {
    // Mock an error scenario
    const originalGet = Map.prototype.get;
    Map.prototype.get = () => { throw new Error('Retrieval error'); };
    
    const phone = '9876543210';
    const otp = '123456';
    
    try {
      const result = await verifyOTP(phone, otp);
      expect(result).toBe(false);
    } finally {
      Map.prototype.get = originalGet;
    }
  });
});