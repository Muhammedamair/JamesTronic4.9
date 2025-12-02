'use client';

import { useEffect } from 'react';
import { useSupabase } from '@/components/shared/supabase-provider';
import { useRouter } from 'next/navigation';

interface AuthGuardProps {
  children: React.ReactNode;
}

// NOTE: This component is now primarily for client-side navigation protection
// The main auth checks are handled by middleware for initial page loads
export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, isLoading } = useSupabase();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // Show loading while checking auth status
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="w-16 h-16 rounded-full border-4 border-gray-300 border-t-blue-500 animate-spin"></div>
      </div>
    );
  }

  // Show content if user is authenticated
  if (user) {
    return <>{children}</>;
  }

  // For unauthenticated users, the middleware should handle the redirect
  // But we'll return null as fallback
  return null;
}