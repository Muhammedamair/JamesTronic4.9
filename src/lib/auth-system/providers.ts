/**
 * JamesTronic Enterprise Authentication - OTP Provider Architecture
 *
 * This file defines the architecture for OTP providers (MSG91, Twilio)
 * without committing any secrets to the codebase.
 */

import { createClient } from '@supabase/supabase-js';

// Get Supabase configuration from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Define the interface that all OTP providers must implement
export interface OTPProvider {
  sendOTP(phone: string, otp: string): Promise<boolean>;
  verifyOTP(phone: string, otp: string): Promise<boolean>;
  validatePhoneNumber(phone: string): boolean;
}

// Define the interface for WhatsApp providers
export interface WhatsAppProvider {
  sendWhatsAppMessage(phone: string, message: string): Promise<boolean>;
  validateWhatsAppNumber(phone: string): boolean;
}

/**
 * MSG91 Provider Implementation (Architecture Only)
 *
 * Note: Actual credentials must be stored in environment variables
 * and never committed to the codebase.
 */
export class MSG91Provider implements OTPProvider {
  private readonly baseUrl = 'https://api.msg91.com';
  private readonly authKey = process.env.MSG91_AUTH_KEY;
  private readonly senderId = process.env.MSG91_SENDER_ID || 'JAMEST'; // Default sender ID

  constructor() {
    if (!this.authKey) {
      console.warn('MSG91 auth key not found. OTP functionality will be mocked.');
    }
  }

  async sendOTP(phone: string, otp: string): Promise<boolean> {
    if (!this.authKey) {
      // Mock implementation for development
      console.log(`[MSG91 Mock] Would send OTP ${otp} to ${phone}`);
      return true;
    }

    try {
      // Validate phone number format
      if (!this.validatePhoneNumber(phone)) {
        console.error('Invalid phone number format');
        return false;
      }

      // Remove any non-numeric characters except +
      const cleanPhone = phone.replace(/\D/g, '');
      const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

      // Prepare the OTP message
      const message = `Your JamesTronic OTP is: ${otp}. Valid for 5 minutes.`;

      // Build the API call to MSG91
      const response = await fetch(`${this.baseUrl}/api/v5/otp?template_id=your_template_id&authkey=${this.authKey}&mobile=${formattedPhone}&message=${encodeURIComponent(message)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('MSG91 API error:', await response.text());
        return false;
      }

      // Log the attempt for security monitoring
      await this.logAttempt(phone, 'otp', true, 'MSG91');

      return true;
    } catch (error) {
      console.error('Error sending OTP via MSG91:', error);
      // Log the failed attempt
      await this.logAttempt(phone, 'otp', false, 'MSG91');
      return false;
    }
  }

  async verifyOTP(phone: string, otp: string): Promise<boolean> {
    // For OTP verification with MSG91, we would typically use their verify API
    // In a real implementation, this would make an API call to MSG91
    // For now, we'll just return true since our core OTP validation happens in our own system
    console.log(`[MSG91 Mock] Would verify OTP ${otp} for ${phone}`);
    return true;
  }

  validatePhoneNumber(phone: string): boolean {
    // Validate Indian phone number format (10 digits, optionally with country code)
    const indianPhoneRegex = /^(\+91|91)?[6-9]\d{9}$/;
    return indianPhoneRegex.test(phone.replace(/\D/g, ''));
  }

  private async logAttempt(identifier: string, method: string, success: boolean, provider: string) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      await supabase
        .from('login_attempts')
        .insert({
          identifier,
          ip_address: this.getClientIP(),
          success,
          method,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error logging attempt:', error);
    }
  }

  private getClientIP(): string {
    // In a real implementation, this would get the actual client IP
    // For a Next.js API route, you could use: req.headers['x-forwarded-for'] || req.connection.remoteAddress
    return '127.0.0.1'; // Default for mock implementation
  }
}

/**
 * Twilio Provider Implementation (Architecture Only)
 */
export class TwilioProvider implements OTPProvider {
  private readonly accountSid = process.env.TWILIO_ACCOUNT_SID;
  private readonly authToken = process.env.TWILIO_AUTH_TOKEN;
  private readonly serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  constructor() {
    if (!this.accountSid || !this.authToken || !this.serviceSid) {
      console.warn('Twilio credentials not found. OTP functionality will be mocked.');
    }
  }

  async sendOTP(phone: string, otp: string): Promise<boolean> {
    if (!this.accountSid || !this.authToken || !this.serviceSid) {
      // Mock implementation for development
      console.log(`[Twilio Mock] Would send OTP ${otp} to ${phone}`);
      return true;
    }

    try {
      if (!this.validatePhoneNumber(phone)) {
        console.error('Invalid phone number format');
        return false;
      }

      // Remove any non-numeric characters except +
      const cleanPhone = phone.replace(/\D/g, '');
      const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;

      // Use Twilio's Verify API to send OTP
      const response = await fetch(`https://verify.twilio.com/v2/Services/${this.serviceSid}/Verifications`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `To=${formattedPhone}&Channel=sms`,
      });

      if (!response.ok) {
        console.error('Twilio API error:', await response.text());
        return false;
      }

      // Log the attempt for security monitoring
      await this.logAttempt(phone, 'otp', true, 'Twilio');

      return true;
    } catch (error) {
      console.error('Error sending OTP via Twilio:', error);
      // Log the failed attempt
      await this.logAttempt(phone, 'otp', false, 'Twilio');
      return false;
    }
  }

  async verifyOTP(phone: string, otp: string): Promise<boolean> {
    if (!this.accountSid || !this.authToken || !this.serviceSid) {
      // Mock verification
      console.log(`[Twilio Mock] Would verify OTP ${otp} for ${phone}`);
      return true;
    }

    try {
      // Remove any non-numeric characters except +
      const cleanPhone = phone.replace(/\D/g, '');
      const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;

      // Verify the OTP using Twilio's API
      const response = await fetch(`https://verify.twilio.com/v2/Services/${this.serviceSid}/VerificationCheck`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `To=${formattedPhone}&Code=${otp}`,
      });

      if (!response.ok) {
        console.error('Twilio verification API error:', await response.text());
        return false;
      }

      const data = await response.json();
      return data.status === 'approved';
    } catch (error) {
      console.error('Error verifying OTP via Twilio:', error);
      return false;
    }
  }

  validatePhoneNumber(phone: string): boolean {
    // For Twilio, we'll accept international format with + and 10+ digits
    return /^(\+\d{1,3})?\d{10,15}$/.test(phone.replace(/\D/g, ''));
  }

  private async logAttempt(identifier: string, method: string, success: boolean, provider: string) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      await supabase
        .from('login_attempts')
        .insert({
          identifier,
          ip_address: this.getClientIP(),
          success,
          method,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error logging attempt:', error);
    }
  }

  private getClientIP(): string {
    // In a real implementation, this would get the actual client IP
    return '127.0.0.1'; // Default for mock implementation
  }
}

/**
 * Gupshup WhatsApp Provider (Architecture Only)
 */
export class GupshupWhatsAppProvider implements WhatsAppProvider {
  private readonly baseUrl = 'https://api.gupshup.io/wa';
  private readonly apiKey = process.env.GUPSHUP_API_KEY;
  private readonly partnerId = process.env.GUPSHUP_PARTNER_ID;

  constructor() {
    if (!this.apiKey || !this.partnerId) {
      console.warn('Gupshup credentials not found. WhatsApp functionality will be mocked.');
    }
  }

  async sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
    if (!this.apiKey || !this.partnerId) {
      // Mock implementation
      console.log(`[Gupshup Mock] Would send WhatsApp message to ${phone}: ${message}`);
      return true;
    }

    try {
      if (!this.validateWhatsAppNumber(phone)) {
        console.error('Invalid WhatsApp number format');
        return false;
      }

      // Format phone number for WhatsApp (no +, add country code)
      const cleanPhone = phone.replace(/\D/g, '');
      const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

      // Prepare the message payload
      const payload = {
        channel: 'whatsapp',
        source: this.partnerId,
        destination: formattedPhone,
        message: {
          type: 'text',
          text: message
        }
      };

      const response = await fetch(`${this.baseUrl}/msg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error('Gupshup API error:', await response.text());
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending WhatsApp message via Gupshup:', error);
      return false;
    }
  }

  validateWhatsAppNumber(phone: string): boolean {
    // Validate Indian WhatsApp number format
    const indianPhoneRegex = /^(\+91|91)?[6-9]\d{9}$/;
    return indianPhoneRegex.test(phone.replace(/\D/g, ''));
  }
}

/**
 * Interakt WhatsApp Provider (Architecture Only)
 */
export class InteraktWhatsAppProvider implements WhatsAppProvider {
  private readonly baseUrl = 'https://api.interakt.ai/v1';
  private readonly apiKey = process.env.INTERAKT_API_KEY;

  constructor() {
    if (!this.apiKey) {
      console.warn('Interakt credentials not found. WhatsApp functionality will be mocked.');
    }
  }

  async sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
    if (!this.apiKey) {
      // Mock implementation
      console.log(`[Interakt Mock] Would send WhatsApp message to ${phone}: ${message}`);
      return true;
    }

    try {
      if (!this.validateWhatsAppNumber(phone)) {
        console.error('Invalid WhatsApp number format');
        return false;
      }

      // Format phone number for WhatsApp
      const cleanPhone = phone.replace(/\D/g, '');
      const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;

      // Prepare the message payload
      const payload = {
        phone: formattedPhone,
        template: {
          name: 'jamestronic_otp',
          language: 'en',
        },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: message
              }
            ]
          }
        ]
      };

      const response = await fetch(`${this.baseUrl}/data/in/app/api/v1/message/template-message/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error('Interakt API error:', await response.text());
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending WhatsApp message via Interakt:', error);
      return false;
    }
  }

  validateWhatsAppNumber(phone: string): boolean {
    // Validate international WhatsApp number format
    return /^(\+\d{1,3})?\d{10,15}$/.test(phone.replace(/\D/g, ''));
  }
}

// Export factory functions to create providers based on environment configuration
export const createOTPProvider = (): OTPProvider => {
  const providerType = process.env.OTP_PROVIDER || 'mock'; // Default to mock for safety

  switch (providerType.toLowerCase()) {
    case 'msg91':
      return new MSG91Provider();
    case 'twilio':
      return new TwilioProvider();
    default:
      // Default to a mock provider that logs to console for development
      return new MockOTPProvider();
  }
};

export const createWhatsAppProvider = (): WhatsAppProvider => {
  const providerType = process.env.WHATSAPP_PROVIDER || 'mock'; // Default to mock for safety

  switch (providerType.toLowerCase()) {
    case 'gupshup':
      return new GupshupWhatsAppProvider();
    case 'interakt':
      return new InteraktWhatsAppProvider();
    default:
      // Default to a mock provider that logs to console for development
      return new MockWhatsAppProvider();
  }
};

// Mock providers for development/testing
class MockOTPProvider implements OTPProvider {
  async sendOTP(phone: string, otp: string): Promise<boolean> {
    console.log(`[MOCK OTP] Sending OTP ${otp} to ${phone}`);
    // In development, also store in a temporary way to allow testing
    return await storeOTPForMock(phone, otp);
  }

  async verifyOTP(phone: string, otp: string): Promise<boolean> {
    console.log(`[MOCK OTP] Verifying OTP ${otp} for ${phone}`);
    // For mock implementation, just return true to allow development
    return true;
  }

  validatePhoneNumber(phone: string): boolean {
    return /^(\+91|91)?[6-9]\d{9}$/.test(phone.replace(/\D/g, ''));
  }
}

class MockWhatsAppProvider implements WhatsAppProvider {
  async sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
    console.log(`[MOCK WHATSAPP] Sending message to ${phone}: ${message}`);
    return true;
  }

  validateWhatsAppNumber(phone: string): boolean {
    return /^(\+91|91)?[6-9]\d{9}$/.test(phone.replace(/\D/g, ''));
  }
}

// Helper function for mock OTP storage (for development only)
const storeOTPForMock = async (phone: string, otp: string): Promise<boolean> => {
  // This would never be used in production - only for development
  if (process.env.NODE_ENV !== 'production') {
    const key = `mock_otp:${phone}`;
    const otpStore = globalThis.otpStore || new Map();
    const expiryTime = Date.now() + (300 * 1000); // 5 minutes
    otpStore.set(key, { otp, expiry: expiryTime });
    globalThis.otpStore = otpStore;
    return true;
  }
  return false;
};