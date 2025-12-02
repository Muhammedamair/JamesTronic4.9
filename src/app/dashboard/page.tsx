'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/shared/supabase-provider';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardRedirectPage() {
  const router = useRouter();
  const { supabase, user, isLoading } = useSupabase();
  const [checkingRole, setCheckingRole] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return; // Wait for loading to complete

    if (!user) {
      // If not logged in, redirect to login
      router.push('/login');
      return;
    }

    // Fetch user status (profile or pending)
    const checkUserStatus = async () => {
      try {
        // First check if user is in pending_technicians table
        const { data: pendingData, error: pendingError } = await supabase
          .from('pending_technicians')
          .select('requested_role, status')
          .eq('user_id', user.id)
          .single();

        if (pendingData && !pendingError) {
          // User is in pending status
          if (pendingData.status === 'approved') {
            // User was approved, check their profile
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('role')
              .eq('user_id', user.id)
              .single();

            if (profile && !profileError) {
              // Redirect based on approved role
              switch (profile.role) {
                case 'admin':
                  router.push('/admin');
                  break;
                case 'staff':
                  router.push('/staff');
                  break;
                case 'technician':
                  router.push('/tech');
                  break;
                case 'transporter':
                  router.push('/transporter');
                  break;
                default:
                  router.push('/app');
              }
            } else {
              // Profile should exist after approval - this shouldn't happen normally
              setError('Approved user missing profile. Contact admin.');
            }
          } else if (pendingData.status === 'pending') {
            // User is pending, redirect to pending approval page
            router.push('/pending-approval');
          } else if (pendingData.status === 'rejected') {
            // User was rejected
            router.push('/rejected');
          }
          return; // Exit early since we handled pending cases
        }

        // If not in pending status, check if they have a profile
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          // If there's an error fetching profile and no pending record,
          // they might be a new user without a profile yet, or there's an issue
          setError('Failed to determine user role');
          setCheckingRole(false);
          return;
        }

        if (profile) {
          // Redirect based on user role
          switch (profile.role) {
            case 'admin':
              router.push('/admin');
              break;
            case 'staff':
              router.push('/staff');
              break;
            case 'technician':
              router.push('/tech');
              break;
            case 'transporter':
              router.push('/transporter');
              break;
            default:
              // For any other role or if role is not set, redirect to main app
              router.push('/app');
          }
        } else {
          // No profile and not pending - this shouldn't happen normally
          setError('No role found. Please contact admin.');
        }
      } catch (err) {
        console.error('Error in user status check:', err);
        setError('Error determining user status');
      } finally {
        setCheckingRole(false);
      }
    };

    checkUserStatus();
  }, [user, isLoading, supabase, router]);

  if (isLoading || checkingRole) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="bg-gray-100 dark:bg-gray-800 h-16 flex items-center px-4 md:px-6">
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="flex-grow container mx-auto px-4 py-6">
          <Skeleton className="h-12 w-64 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, index) => (
              <Skeleton key={index} className="h-40 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error! </strong>
          <span className="block sm:inline">{error}</span>
        </div>
        <button
          onClick={() => router.push('/login')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return null;
}