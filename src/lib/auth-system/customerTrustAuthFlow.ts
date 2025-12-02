/**
 * Customer Authentication Trust Flow for JamesTronic Enterprise Authentication
 *
 * Implements the customer journey from phone number entry to authenticated booking flow,
 * with trust-building elements and seamless OTP/magic link authentication.
 */

import { createClient } from '@/lib/supabase/supabase';
import { EnterpriseAuthController, generateMagicLinkToken } from './index';
import { generateOTP, storeOTP } from './generateOTP';
import { generateMagicLink } from './generateMagicLink';
import { createSessionRecord } from './sessionValidator';
import { deviceFingerprintGenerator } from './deviceFingerprint';

export interface CustomerAuthResult {
  success: boolean;
  token?: string;
  redirectUrl?: string;
  message?: string;
  error?: string;
}

export interface TrustElements {
  securityGuarantee: boolean;
  noSpamPromise: boolean;
  privacyAssurance: boolean;
}

export class CustomerTrustAuthFlow {
  private authController: EnterpriseAuthController;

  constructor() {
    this.authController = new EnterpriseAuthController();
  }

  /**
   * Initiates the customer authentication flow
   */
  async initiateAuthFlow(
    phoneNumber: string,
    authMethod: 'otp' | 'magic_link' = 'otp',
    redirectPath: string = '/customer/dashboard'
  ): Promise<CustomerAuthResult> {
    try {
      // Sanitize phone number
      const sanitizedPhone = this.sanitizePhoneNumber(phoneNumber);

      if (!this.validatePhoneNumber(sanitizedPhone)) {
        return {
          success: false,
          error: 'Invalid phone number format. Please enter a valid phone number.'
        };
      }

      // Check if this is a returning customer
      const isReturningCustomer = await this.isReturningCustomer(sanitizedPhone);

      // Create trust elements to display during auth process
      const trustElements = this.getTrustElements(isReturningCustomer);

      if (authMethod === 'otp') {
        // Send OTP to customer
        return await this.sendOTP(sanitizedPhone, redirectPath, trustElements);
      } else {
        // Send magic link to customer
        return await this.sendMagicLink(sanitizedPhone, redirectPath, trustElements);
      }
    } catch (error) {
      console.error('Error initiating customer auth flow:', error);
      return {
        success: false,
        error: 'An error occurred while initiating authentication. Please try again.'
      };
    }
  }

  /**
   * Completes the customer authentication with OTP verification
   */
  async completeAuthWithOTP(
    phoneNumber: string,
    otp: string,
    redirectPath: string = '/customer/dashboard'
  ): Promise<CustomerAuthResult> {
    try {
      // Sanitize phone number
      const sanitizedPhone = this.sanitizePhoneNumber(phoneNumber);

      if (!this.validatePhoneNumber(sanitizedPhone)) {
        return {
          success: false,
          error: 'Invalid phone number format.'
        };
      }

      // Verify OTP using the auth controller
      const authResult = await this.authController.authenticateWithOTP(
        sanitizedPhone,
        otp,
        'customer'
      );

      if (!authResult.success) {
        return {
          success: false,
          error: authResult.error || 'Invalid OTP. Please try again.'
        };
      }

      // Create customer profile if it doesn't exist
      await this.createOrUpdateCustomerProfile(sanitizedPhone);

      return {
        success: true,
        token: authResult.token,
        redirectUrl: redirectPath,
        message: 'Authentication successful! Welcome back.'
      };
    } catch (error) {
      console.error('Error completing customer auth with OTP:', error);
      return {
        success: false,
        error: 'An error occurred during authentication. Please try again.'
      };
    }
  }

  /**
   * Processes magic link authentication
   */
  async processMagicLink(token: string): Promise<CustomerAuthResult> {
    try {
      // Verify magic link token using the auth controller
      const authResult = await this.authController.authenticateWithMagicLink(token);

      if (!authResult.success) {
        return {
          success: false,
          error: authResult.error || 'Invalid or expired magic link.'
        };
      }

      // Create customer profile if it doesn't exist
      // Note: We can't get phone from the token here, so we'll skip profile creation
      // Profile creation would happen in a different flow

      return {
        success: true,
        token: authResult.token,
        redirectUrl: '/customer/dashboard',
        message: 'Magic link authentication successful!'
      };
    } catch (error) {
      console.error('Error processing magic link:', error);
      return {
        success: false,
        error: 'An error occurred while processing the magic link. Please try again.'
      };
    }
  }

  /**
   * Sends OTP to customer with trust elements displayed
   */
  private async sendOTP(
    phoneNumber: string,
    redirectPath: string,
    trustElements: TrustElements
  ): Promise<CustomerAuthResult> {
    try {
      // Generate OTP
      const otp = generateOTP();

      // Store OTP for verification
      const stored = await storeOTP(phoneNumber, otp);
      if (!stored) {
        return {
          success: false,
          error: 'Failed to generate OTP. Please try again.'
        };
      }

      // Send OTP via configured provider (would be implemented in real system)
      // Here we'll simulate sending the OTP
      console.log(`[TRUST FLOW] Sending OTP ${otp} to ${phoneNumber}`);
      console.log(`[TRUST ELEMENTS] Security: ${trustElements.securityGuarantee}, No Spam: ${trustElements.noSpamPromise}, Privacy: ${trustElements.privacyAssurance}`);

      // In a real implementation, we would call this.authController.otpProvider.sendOTP(phoneNumber, otp)

      return {
        success: true,
        redirectUrl: `/auth/verify-otp?phone=${encodeURIComponent(phoneNumber)}&redirect=${encodeURIComponent(redirectPath)}`,
        message: `We've sent a 6-digit OTP to ${phoneNumber}. Please check your messages.`
      };
    } catch (error) {
      console.error('Error sending OTP:', error);
      return {
        success: false,
        error: 'Failed to send OTP. Please try again.'
      };
    }
  }

  /**
   * Sends magic link to customer with trust elements
   */
  private async sendMagicLink(
    phoneNumber: string,
    redirectPath: string,
    trustElements: TrustElements
  ): Promise<CustomerAuthResult> {
    try {
      // Generate a magic link token
      const token = await generateMagicLinkToken();

      // Generate the complete magic link
      const magicLink = await generateMagicLink(
        token,
        phoneNumber,
        redirectPath
      );

      // Log trust elements for this action
      console.log(`[TRUST FLOW] Sending magic link to ${phoneNumber}`);
      console.log(`[TRUST ELEMENTS] Security: ${trustElements.securityGuarantee}, No Spam: ${trustElements.noSpamPromise}, Privacy: ${trustElements.privacyAssurance}`);
      console.log(`[MAGIC LINK] ${magicLink}`);

      // In a real implementation, we would send the magic link via email/WhatsApp
      // this.authController.whatsappProvider.sendWhatsAppMessage(phoneNumber, `Click to login: ${magicLink}`)

      return {
        success: true,
        message: `We've sent a secure login link to ${phoneNumber}. Click the link to continue.`
      };
    } catch (error) {
      console.error('Error sending magic link:', error);
      return {
        success: false,
        error: 'Failed to generate magic link. Please try OTP instead.'
      };
    }
  }

  /**
   * Creates or updates customer profile in the database
   */
  private async createOrUpdateCustomerProfile(phoneNumber: string): Promise<boolean> {
    try {
      const { supabase } = await import('@/lib/supabase/supabase');

      // First, check if customer already exists
      const { data: existingCustomer, error: fetchError } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', phoneNumber)
        .single();

      if (!fetchError && existingCustomer) {
        // Customer already exists, update last login
        const { error: updateError } = await supabase
          .from('customers')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', existingCustomer.id);

        if (updateError) {
          console.error('Error updating customer last login:', updateError);
        }
        return true;
      }

      // Customer doesn't exist, create new profile
      // We need to get the user ID from Supabase auth
      // This would typically happen after successful auth
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.error('No authenticated user found for customer profile creation');
        return false;
      }

      const { error: insertError } = await supabase
        .from('customers')
        .insert([{
          user_id: user.id,
          phone: phoneNumber,
          name: `Customer ${phoneNumber}`, // Default name
          created_at: new Date().toISOString(),
          last_login_at: new Date().toISOString()
        }]);

      if (insertError) {
        console.error('Error creating customer profile:', insertError);
        return false;
      }

      // Also ensure profile exists in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          role: 'customer',
          created_at: new Date().toISOString()
        });

      if (profileError) {
        console.error('Error creating/updating profile:', profileError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in createOrUpdateCustomerProfile:', error);
      return false;
    }
  }

  /**
   * Checks if a phone number belongs to a returning customer
   */
  private async isReturningCustomer(phoneNumber: string): Promise<boolean> {
    try {
      const { supabase } = await import('@/lib/supabase/supabase');

      const { data, error } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', phoneNumber)
        .single();

      return !error && !!data;
    } catch (error) {
      console.error('Error checking if returning customer:', error);
      return false; // Default to treating as new customer if error occurs
    }
  }

  /**
   * Gets trust elements based on customer status
   */
  private getTrustElements(isReturningCustomer: boolean): TrustElements {
    return {
      securityGuarantee: true,
      noSpamPromise: true,
      privacyAssurance: true
    };
  }

  /**
   * Sanitizes phone number by removing non-numeric characters
   */
  private sanitizePhoneNumber(phoneNumber: string): string {
    // Remove all non-numeric characters except +
    return phoneNumber.replace(/[^\d+]/g, '');
  }

  /**
   * Validates phone number format
   */
  private validatePhoneNumber(phoneNumber: string): boolean {
    // For India: 10 digits starting with 6-9
    const indiaPhoneRegex = /^(\+91|91)?[6-9]\d{9}$/;
    return indiaPhoneRegex.test(phoneNumber);
  }

  /**
   * Starts the customer authentication flow from the homepage
   */
  async startCustomerAuthFlow(
    phoneNumber: string,
    preferredAuthMethod: 'otp' | 'magic_link' = 'otp',
    bookingCategory?: string
  ): Promise<CustomerAuthResult> {
    try {
      // Determine redirect path based on context
      let redirectPath = '/customer/dashboard';
      if (bookingCategory) {
        redirectPath = `/customer/book?category=${bookingCategory}`;
      }

      // Initiate the auth flow
      return await this.initiateAuthFlow(phoneNumber, preferredAuthMethod, redirectPath);
    } catch (error) {
      console.error('Error starting customer auth flow:', error);
      return {
        success: false,
        error: 'An error occurred while starting the authentication flow. Please try again.'
      };
    }
  }
}

// Export a singleton instance of the customer trust auth flow
export const customerTrustAuthFlow = new CustomerTrustAuthFlow();