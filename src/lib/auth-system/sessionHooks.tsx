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
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const [session, setSession] = useState<any | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const router = useRouter();

  // Check session status
  const checkSession = async () => {
    try {
      setLoading(true);
      
      // Make API call to validate session
      const response = await fetch('/api/auth/session');
      
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

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, []);

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