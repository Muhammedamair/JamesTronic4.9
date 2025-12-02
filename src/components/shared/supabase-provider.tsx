'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';

type SupabaseContext = {
  supabase: ReturnType<typeof createBrowserClient>;
  user: User | null;
  userRole: string | null;
  isLoading: boolean;
};

const Context = createContext<SupabaseContext | undefined>(undefined);

export default function SupabaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setIsLoading(true);
        try {
          const currentUser = session?.user ?? null;
          setUser(currentUser);
          
          // Get role from JWT metadata
          const role = currentUser?.user_metadata?.role || null;
          setUserRole(role);

        } catch (error) {
          console.error('Error in auth state change:', error);
          setUser(null);
          setUserRole(null);
        } finally {
          setIsLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Add session refresh on page visibility change to handle PWA session restoration
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.refreshSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [supabase]);

  return (
    <Context.Provider value={{ supabase, user, userRole, isLoading }}>
      {children}
    </Context.Provider>
  );
}

export const useSupabase = () => {
  const context = useContext(Context);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};