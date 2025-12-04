import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SessionData } from '@/lib/auth-system/sessionManager';

// JWT claim types
export interface JWTClaims {
  sub: string; // user ID
  role: string;
  session_id: string;
  device_fingerprint?: string;
  exp: number; // expiration timestamp
  iat: number; // issued at timestamp
  jti?: string; // JWT ID
  [key: string]: any; // Allow for additional claims
}

/**
 * JWT Claim Injector - utility to create and inject custom claims into JWTs
 * Used for enhancing JWTs with role, device, and session information
 */
export class JWTClaimInjector {
  /**
   * Create a JWT with enhanced claims including role, device, and session data
   */
  static async createEnhancedJWT(sessionData: SessionData, additionalClaims: Record<string, any> = {}): Promise<string | null> {
    try {
      // Calculate expiration (use session expiry or default to 1 hour if not provided)
      const exp = Math.floor(sessionData.expiresAt.getTime() / 1000);
      const iat = Math.floor(Date.now() / 1000);
      
      // Create the JWT payload with enhanced claims
      const payload: JWTClaims = {
        sub: sessionData.userId, // subject = user ID
        role: sessionData.role,
        session_id: sessionData.id,
        device_fingerprint: sessionData.deviceId,
        exp, // expiration timestamp
        iat, // issued at timestamp
        ...additionalClaims // merge additional claims
      };

      // Note: In a real implementation, we would use a proper JWT library to sign the token
      // For now, we'll return a stringified version of the payload for demonstration
      // In production, use a library like jose or jsonwebtoken to properly sign JWTs
      
      // This is a simplified representation - in production, use proper JWT signing
      const token = JSON.stringify(payload);
      
      // In a real implementation, we would sign this using a JWT library with a secret
      // Example with jose library:
      /*
      import { SignJWT } from 'jose';
      
      const secret = new TextEncoder().encode(
        process.env.JWT_SECRET || 'fallback_secret'
      );
      
      const jwt = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
      
      return jwt;
      */
      
      // For now, return the payload as a base64 encoded string (not a real JWT)
      return btoa(token);
    } catch (error) {
      console.error('Error creating enhanced JWT:', error);
      return null;
    }
  }

  /**
   * Inject session data into JWT claims and return a complete JWT
   */
  static async injectClaimsFromSession(sessionId: string): Promise<string | null> {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

      // Get session data from the database
      const { data: session, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        console.error('Error fetching session for JWT injection:', error);
        return null;
      }

      // Create session data object
      const sessionData: SessionData = {
        id: session.id,
        userId: session.user_id,
        role: session.role,
        deviceId: session.device_fingerprint || '',
        expiresAt: new Date(session.expires_at),
        refreshTokenHash: session.refresh_token_hash,
        revoked: session.revoked,
      };

      // Create the enhanced JWT with session data
      return await this.createEnhancedJWT(sessionData);
    } catch (error) {
      console.error('Error injecting claims from session:', error);
      return null;
    }
  }

  /**
   * Parse and validate JWT claims
   */
  static async validateAndParseClaims(jwt: string): Promise<JWTClaims | null> {
    try {
      // In a real implementation, we would verify the JWT signature first
      // For now, we'll just decode the base64 string we created earlier
      
      // This is a simplified version - in production, use a proper JWT library to verify
      const decoded = atob(jwt);
      const claims: JWTClaims = JSON.parse(decoded);
      
      // Verify expiration
      const now = Math.floor(Date.now() / 1000);
      if (claims.exp < now) {
        console.error('JWT has expired');
        return null;
      }
      
      return claims;
    } catch (error) {
      console.error('Error parsing JWT claims:', error);
      return null;
    }
  }

  /**
   * Extract user role from JWT claims
   */
  static extractRole(claims: JWTClaims): string | null {
    return claims.role || null;
  }

  /**
   * Extract user ID from JWT claims
   */
  static extractUserId(claims: JWTClaims): string | null {
    return claims.sub || null;
  }

  /**
   * Extract session ID from JWT claims
   */
  static extractSessionId(claims: JWTClaims): string | null {
    return claims.session_id || null;
  }

  /**
   * Extract device fingerprint from JWT claims
   */
  static extractDeviceFingerprint(claims: JWTClaims): string | null {
    return claims.device_fingerprint || null;
  }

  /**
   * Check if JWT claims are still valid against database session
   */
  static async validateClaimsAgainstSession(claims: JWTClaims): Promise<boolean> {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

      // Get session from database
      const { data: session, error } = await supabase
        .from('user_sessions')
        .select('revoked, expires_at')
        .eq('id', claims.session_id)
        .single();

      if (error || !session) {
        console.error('Session not found in database for validation:', error);
        return false;
      }

      // Check if session is revoked
      if (session.revoked) {
        console.error('Session has been revoked');
        return false;
      }

      // Check if session has expired
      const sessionExpiry = new Date(session.expires_at).getTime();
      const now = Date.now();
      if (sessionExpiry < now) {
        console.error('Session has expired in database');
        return false;
      }

      // All validations passed
      return true;
    } catch (error) {
      console.error('Error validating claims against session:', error);
      return false;
    }
  }
}

// Export convenience functions
export const createEnhancedJWT = (sessionData: SessionData, additionalClaims: Record<string, any> = {}) => 
  JWTClaimInjector.createEnhancedJWT(sessionData, additionalClaims);

export const injectClaimsFromSession = (sessionId: string) => 
  JWTClaimInjector.injectClaimsFromSession(sessionId);

export const validateAndParseClaims = (jwt: string) => 
  JWTClaimInjector.validateAndParseClaims(jwt);