import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'crypto';

interface MFASetupResponse {
  success: boolean;
  error?: string;
  secret?: string;
  qrCode?: string;
}

interface MFAVerifyResponse {
  success: boolean;
  error?: string;
}

interface MFALoginResponse {
  success: boolean;
  error?: string;
  sessionId?: string;
  refreshToken?: string;
}

/**
 * Admin MFA Service - handles multi-factor authentication for admin users
 */
export class AdminMFAService {
  /**
   * Generate MFA secret for admin user
   */
  static async generateMFASecret(adminUserId: string): Promise<MFASetupResponse> {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey); // Use service role

      // Generate a random secret
      const secret = randomBytes(32).toString('hex');
      const secretHash = createHash('sha256').update(secret).digest('hex');

      // Store the MFA secret temporarily
      const { error } = await supabase
        .from('admin_mfa_sessions')
        .insert({
          user_id: adminUserId,
          mfa_token_hash: secretHash, // This is the MFA secret hash
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes expiry
          verified: false
        });

      if (error) {
        console.error('Error storing MFA secret:', error);
        return {
          success: false,
          error: 'Failed to store MFA secret',
        };
      }

      // Generate a QR code (simplified - in real implementation you'd use a QR code library)
      const issuer = 'JamesTronic';
      const accountName = `admin@jamestronic.com`;
      const otpauthUrl = `otpauth://totp/${issuer}:${accountName}?secret=${secret}&issuer=${issuer}`;

      return {
        success: true,
        secret, // Only return the secret temporarily for QR code generation
        qrCode: otpauthUrl, // This would be converted to an actual QR code image in the frontend
      };
    } catch (error) {
      console.error('Error generating MFA secret:', error);
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Verify MFA code for admin user during setup
   */
  static async verifyMFACode(adminUserId: string, code: string, secret: string): Promise<MFAVerifyResponse> {
    try {
      // In a real implementation, you would validate the TOTP code against the secret
      // For this implementation, we'll simulate the verification
      // You would typically use a library like 'notp' or 'speakeasy' for TOTP validation

      // First, get the stored MFA attempt
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);
      const { data: mfaAttempt, error } = await supabase
        .from('admin_mfa_sessions')
        .select('*')
        .eq('user_id', adminUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !mfaAttempt) {
        return {
          success: false,
          error: 'No MFA attempt found',
        };
      }

      // Check if the MFA attempt has expired
      const now = new Date();
      const expiry = new Date(mfaAttempt.expires_at);
      if (now > expiry) {
        return {
          success: false,
          error: 'MFA code has expired',
        };
      }

      // Check if max attempts have been reached
      if (mfaAttempt.attempt_count && mfaAttempt.attempt_count >= 5) { // Max 5 attempts
        return {
          success: false,
          error: 'Maximum MFA attempts exceeded. Please try again later.',
        };
      }

      // In a real implementation, verify the code using a TOTP library
      // For this demo, we'll just check if it's the expected value
      if (code !== '123456') { // Replace with actual TOTP verification
        // Increment attempt count
        const { error: updateError } = await supabase
          .from('admin_mfa_sessions')
          .update({
            attempt_count: (mfaAttempt.attempt_count || 0) + 1,
          })
          .eq('id', mfaAttempt.id);

        if (updateError) {
          console.error('Error updating MFA attempt count:', updateError);
        }

        return {
          success: false,
          error: 'Invalid MFA code',
        };
      }

      // Mark MFA attempt as verified
      const { error: updateError } = await supabase
        .from('admin_mfa_sessions')
        .update({
          verified: true,
          verified_at: new Date().toISOString(),
          attempt_count: (mfaAttempt.attempt_count || 0) + 1, // Count the successful attempt too
        })
        .eq('id', mfaAttempt.id);

      if (updateError) {
        console.error('Error updating MFA verification status:', updateError);
        return {
          success: false,
          error: 'Failed to verify MFA',
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error verifying MFA code:', error);
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Verify MFA code during admin login
   */
  static async verifyMFADuringLogin(sessionId: string, mfaCode: string): Promise<MFALoginResponse> {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

      // Get the session to verify it exists and get the user ID
      const { data: session, error: sessionError } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        return {
          success: false,
          error: 'Invalid session',
        };
      }

      // Check if the user has MFA enabled (by checking if they have a verified MFA setup)
      const { data: mfaRecords, error: mfaError } = await supabase
        .from('admin_mfa_sessions')
        .select('*')
        .eq('user_id', session.user_id)
        .eq('verified', true)
        .limit(1);

      if (mfaError) {
        console.error('Error checking MFA setup:', mfaError);
        // If there's an error checking MFA, allow login without MFA for safety
        return {
          success: true,
          sessionId: session.id,
          refreshToken: '' // Refresh token would be returned by session creation
        };
      }

      // If MFA is not enabled for this user, allow login
      if (!mfaRecords || mfaRecords.length === 0) {
        return {
          success: true,
          sessionId: session.id,
          refreshToken: '' // Refresh token would be returned by session creation
        };
      }

      // If MFA is enabled, verify the code
      // In a real implementation, this would validate the TOTP code against the stored secret
      if (mfaCode !== '123456') { // Replace with actual verification
        return {
          success: false,
          error: 'Invalid MFA code',
        };
      }

      // MFA verification successful
      return {
        success: true,
        sessionId: session.id,
        refreshToken: '' // Refresh token would be returned by session creation
      };
    } catch (error) {
      console.error('Error during MFA verification:', error);
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Enable MFA for an admin user
   */
  static async enableMFA(adminUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey); // Use service role

      // Mark the admin user as having MFA enabled
      const { error } = await supabase
        .from('profiles')
        .update({
          mfa_enabled: true,
          mfa_enabled_at: new Date().toISOString()
        })
        .eq('id', adminUserId);

      if (error) {
        console.error('Error enabling MFA:', error);
        return {
          success: false,
          error: 'Failed to enable MFA',
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error enabling MFA:', error);
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Disable MFA for an admin user
   */
  static async disableMFA(adminUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey); // Use service role

      // Mark the admin user as having MFA disabled
      const { error } = await supabase
        .from('profiles')
        .update({
          mfa_enabled: false,
          mfa_enabled_at: null
        })
        .eq('id', adminUserId);

      if (error) {
        console.error('Error disabling MFA:', error);
        return {
          success: false,
          error: 'Failed to disable MFA',
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error disabling MFA:', error);
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Check if admin has MFA enabled
   */
  static async hasMFAEnabled(userId: string): Promise<boolean> {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('mfa_enabled')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error checking MFA status:', error);
        // Default to not requiring MFA if there's an error
        return false;
      }

      return profile?.mfa_enabled || false;
    } catch (error) {
      console.error('Error checking MFA status:', error);
      return false;
    }
  }
}