'use client';

import { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

// Session context type
interface SessionContextType {
  session: any | null;
  role: string | null;
  loading: boolean;
  authenticated: boolean;
  checkSession: () => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (requiredRole: string) => boolean;
  canAccess: (requiredRoles: string[]) => boolean;
}

// Create session context
const SessionContext = createContext<SessionContextType | undefined>(undefined);

// Custom hook to use session context
export const useSession = (): SessionContextType => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

// Custom hook for logout functionality
export const useLogout = (): { logout: () => Promise<void>; loggingOut: boolean } => {
  const { logout } = useSession();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  return { logout: handleLogout, loggingOut };
};

// Custom hook for role-based access control
export const useRole = (): { role: string | null; hasRole: (requiredRole: string) => boolean; canAccess: (requiredRoles: string[]) => boolean } => {
  const { role, hasRole, canAccess } = useSession();
  return { role, hasRole, canAccess };
};

// Session provider component
interface SessionProviderProps {
  children: ReactNode;
  initialSession?: any | null;
  initialRole?: string | null;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children, initialSession = null, initialRole = null }) => {
  const [session, setSession] = useState<any | null>(initialSession);
  const [role, setRole] = useState<string | null>(initialRole);
  const [loading, setLoading] = useState(!initialSession); // If we have an initial session, we are not loading. If it's null, we might be loading (checking if valid) or just unauthenticated. Actually if initialSession is explicitly passed (even null), we can trust it? No, usually initialSession is only passed if valid.
  // Better logic: if initialSession is undefined, loading=true. If passed (null or object), loading=false.
  // But for now, let's assume if initialSession is provided, it's valid. If not, we fetch.
  // Wait, if server says "no session", it passes null.
  // So we should check if initialSession !== undefined?
  // But props defaults to null.

  // Let's rely on the fact that if we use the prop, we pass it.
  // If we pass null, it means unauthenticated.

  const [authenticated, setAuthenticated] = useState(!!initialSession);
  const router = useRouter();

  // Check session status
  const checkSession = async () => {
    try {
      setLoading(true);

      // Make API call to validate session
      // 'credentials: include' is REQUIRED for same-origin requests to send HttpOnly cookies in some environments
      const response = await fetch('/api/auth/session', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Force cookies to be sent
        cache: 'no-store'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          setSession(data.session);
          setRole(data.role);
          setAuthenticated(true);
        } else {
          setSession(null);
          setRole(null);
          setAuthenticated(false);
        }
      } else {
        setSession(null);
        setRole(null);
        setAuthenticated(false);
      }
    } catch (error) {
      console.error('Error checking session:', error);
      setSession(null);
      setRole(null);
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      // Make API call to revoke session
      await fetch('/api/auth/logout', { method: 'POST' });

      // Clear session state
      setSession(null);
      setRole(null);
      setAuthenticated(false);

      // Redirect to login
      router.push('/login');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  // Check if user has a specific role
  const hasRole = (requiredRole: string): boolean => {
    if (!role) return false;
    return role === requiredRole;
  };

  // Check if user can access with required roles
  const canAccess = (requiredRoles: string[]): boolean => {
    if (!role) return false;
    return requiredRoles.includes(role);
  };

  // Check session on mount only if initialSession was NOT provided (or logic dictates re-check)
  useEffect(() => {
    if (initialSession === undefined && initialRole === undefined) {
      checkSession();
    } else {
      // If initial session provided, we trust it for now.
      // We could perform a background re-validation if deemed necessary,
      // but preventing the redirect loop is priority.
      setLoading(false);
    }
  }, [initialSession, initialRole]);

  const value: SessionContextType = {
    session,
    role,
    loading,
    authenticated,
    checkSession,
    logout,
    hasRole,
    canAccess,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

// Export the context for direct access if needed
export { SessionContext };