/**
 * Enterprise OTP Generation System
 * Implements secure, random OTP generation for JamesTronic authentication
 */

import { randomInt } from 'crypto';

// Define type for the OTP store
declare global {
  var otpStore: Map<string, { otp: string; expiry: number }> | undefined;
}

/**
 * Generates a secure 6-digit OTP with configurable length and expiry
 */
export const generateOTP = (length: number = 6): string => {
  // Generate random number within the required digit range
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  const otp = randomInt(min, max + 1).toString();

  // Ensure OTP has correct length by padding with leading zeros if necessary
  return otp.padStart(length, '0');
};

/**
 * Stores OTP in temporary storage with expiry
 */
export const storeOTP = async (identifier: string, otp: string, expiry: number = 300): Promise<boolean> => {
  // This would typically store in Redis or database with expiry
  // For now, using a mock implementation
  try {
    const key = `otp:${identifier}`;
    const expiryTime = Date.now() + (expiry * 1000); // Convert to milliseconds

    // In a real implementation, this would store in Redis with expiry
    // await redis.setex(key, expiry, JSON.stringify({ otp, expiry: expiryTime }));

    // For mock implementation, we'll use a temporary map for development
    if (typeof globalThis !== 'undefined' && !globalThis.otpStore) {
      globalThis.otpStore = new Map();
    }

    const otpStore = globalThis.otpStore || new Map();
    otpStore.set(key, { otp, expiry: expiryTime });

    // Only set the global if it doesn't exist yet in the global context
    if (typeof globalThis !== 'undefined') {
      globalThis.otpStore = otpStore;
    }

    return true;
  } catch (error) {
    console.error('Error storing OTP:', error);
    return false;
  }
};

/**
 * Verifies OTP against stored value
 */
export const verifyOTP = async (identifier: string, otp: string): Promise<boolean> => {
  try {
    const key = `otp:${identifier}`;

    if (typeof globalThis === 'undefined' || !globalThis.otpStore) {
      return false;
    }

    const otpStore = globalThis.otpStore;
    const storedData = otpStore.get(key);

    if (!storedData) {
      return false;
    }

    // Check if OTP has expired
    if (Date.now() > storedData.expiry) {
      // Clean up expired OTP
      otpStore.delete(key);
      return false;
    }

    // Verify OTP matches and hasn't been used
    const isValid = storedData.otp === otp;

    if (isValid) {
      // Remove OTP after successful verification (one-time use)
      otpStore.delete(key);
    }

    return isValid;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return false;
  }
};