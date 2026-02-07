import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { SessionManager, SessionData } from '@/lib/auth-system/sessionManager';
import { getSessionId } from '@/lib/auth-system/sessionUtils';

export interface RequestContext {
  actorUserId?: string;
  actorRole?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * ContextExtractor - Utility to extract actor and request context
 * Used by API routes and middleware to pass consistent context to auditLogger
 */
export class ContextExtractor {
  /**
   * Extract context from Next.js request
   */
  static async extractContextFromRequest(request: NextRequest): Promise<RequestContext> {
    try {
      // Extract IP address (considering X-Forwarded-For header in case of proxy/load balancer)
      let ipAddress = request.headers.get('x-forwarded-for');
      if (!ipAddress) {
        // In a real production environment, you might need to handle this differently
        // depending on your deployment (Vercel, etc.)
        ipAddress = request.headers.get('x-real-ip') || 'unknown';
      } else {
        // X-Forwarded-For can contain multiple IPs, take the first one
        ipAddress = ipAddress.split(',')[0].trim();
      }

      // Extract user agent
      const userAgent = request.headers.get('user-agent') || 'unknown';

      // Extract session ID from cookies
      const sessionId = await getSessionId();

      if (!sessionId) {
        return {
          ipAddress,
          userAgent
        };
      }

      // Validate the session to get user info
      const sessionValidation = await SessionManager.validateSession();

      if (!sessionValidation.valid || !sessionValidation.session) {
        return {
          sessionId,
          ipAddress,
          userAgent
        };
      }

      // Return complete context
      const session: SessionData = sessionValidation.session;
      return {
        actorUserId: session.userId,
        actorRole: session.role,
        sessionId: session.id,
        ipAddress,
        userAgent
      };
    } catch (error) {
      console.error('Error extracting context from request:', error);
      // Return minimal context in case of error
      return {
        ipAddress: 'unknown',
        userAgent: 'unknown'
      };
    }
  }

  /**
   * Extract context from session ID (when request object is not available)
   */
  static async extractContextFromSession(sessionId: string): Promise<RequestContext> {
    try {
      // Validate the session to get user info
      const sessionValidation = await SessionManager.validateSession();

      if (!sessionValidation.valid || !sessionValidation.session) {
        return {
          sessionId
        };
      }

      const session: SessionData = sessionValidation.session;
      return {
        actorUserId: session.userId,
        actorRole: session.role,
        sessionId: session.id
      };
    } catch (error) {
      console.error('Error extracting context from session:', error);
      return {
        sessionId
      };
    }
  }

  /**
   * Get actor information from current session (for server components)
   */
  static async getActorInfo(): Promise<{ userId?: string; role?: string; sessionId?: string }> {
    try {
      // Extract session ID from cookies
      const sessionId = await getSessionId();

      if (!sessionId) {
        return {};
      }

      // Validate the session to get user info
      const sessionValidation = await SessionManager.validateSession();

      if (!sessionValidation.valid || !sessionValidation.session) {
        return { sessionId };
      }

      const session: SessionData = sessionValidation.session;
      return {
        userId: session.userId,
        role: session.role,
        sessionId: session.id
      };
    } catch (error) {
      console.error('Error getting actor info:', error);
      return {};
    }
  }

  /**
   * Extract IP address from request (helper method)
   */
  static extractIpAddress(request: NextRequest): string {
    let ipAddress = request.headers.get('x-forwarded-for');
    if (!ipAddress) {
      ipAddress = request.headers.get('x-real-ip') || 'unknown';
    } else {
      ipAddress = ipAddress.split(',')[0].trim();
    }
    return ipAddress;
  }

  /**
   * Extract user agent from request (helper method)
   */
  static extractUserAgent(request: NextRequest): string {
    return request.headers.get('user-agent') || 'unknown';
  }
}