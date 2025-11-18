'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/supabase-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function StaffPortalPage() {
  const router = useRouter();
  const { user, userRole, isLoading } = useSupabase();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Mark as client-side after hydration
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Handle redirects only after initial setup
    if (isClient && !isLoading) {
      if (!user) {
        // Redirect to login if not authenticated
        router.push('/login');
      } else if (userRole && userRole !== 'staff' && userRole !== 'admin') {
        // Redirect non-staff to appropriate portal
        router.push('/dashboard');
      }
    }
  }, [user, userRole, isLoading, isClient, router]);

  // Show loading state during hydration to prevent mismatch
  if (!isClient || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-6xl mx-auto py-8">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-gray-800 dark:text-white">
                Staff Dashboard
              </CardTitle>
              <CardDescription className="text-lg text-gray-600 dark:text-gray-300">
                Manage service tickets and customers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full border-4 border-gray-300 border-t-blue-500 animate-spin mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show unauthorized message if user doesn't have proper role
  if (user && userRole && userRole !== 'staff' && userRole !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Access Denied</CardTitle>
            <CardDescription>
              You don't have staff privileges to access this page
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-600 dark:text-gray-400">
              Redirecting...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show authentication required if user is not authenticated
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Authentication Required</CardTitle>
            <CardDescription>
              You need to be logged in to access this page
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-600 dark:text-gray-400">
              Redirecting...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-6xl mx-auto py-8">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-gray-800 dark:text-white">
              Staff Dashboard
            </CardTitle>
            <CardDescription className="text-lg text-gray-600 dark:text-gray-300">
              Manage service tickets and customers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-8">
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Welcome to the staff panel. Access tickets, customers, and create new services.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Tickets</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">View and manage service tickets</p>
                  <a 
                    href="/app/tickets" 
                    className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    View Tickets
                  </a>
                </div>
                
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Customers</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">Manage customer records</p>
                  <a 
                    href="/app/customers" 
                    className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Manage Customers
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}