'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/shared/supabase-provider';
import { SkeletonLoader } from '@/components/admin/shared/SkeletonLoader';

export default function SettlementsPage() {
  const router = useRouter();
  const { user, isLoading } = useSupabase();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-4">
        <SkeletonLoader variant="line" count={5} className="mb-4" />
        <SkeletonLoader variant="rect" count={3} className="mb-6" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="container mx-auto py-6 px-4">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Settlements</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        Manage technician settlements, earnings, and payments.
      </p>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-gray-500 dark:text-gray-400">Settlement management features coming soon.</p>
      </div>
    </div>
  );
}