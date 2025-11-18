'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/supabase-provider';

export default function AdminPortalPage() {
  const router = useRouter();
  const { user, userRole, isLoading } = useSupabase();

  useEffect(() => {
    if (!isLoading && user && userRole) {
      // Admin users should be directed to the management portal
      // where all management functionality resides
      router.push('/app');
    } else if (!user) {
      router.push('/login');
    }
  }, [user, userRole, isLoading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full border-4 border-gray-300 border-t-blue-500 animate-spin mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Redirecting...</p>
      </div>
    </div>
  );
}