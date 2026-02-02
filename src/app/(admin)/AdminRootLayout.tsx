'use client';

import React, { ReactNode, useState } from 'react';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminSidebar } from '@/components/admin/layout/AdminSidebar';
import { useSupabase } from '@/components/shared/supabase-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

export default function AdminRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, userRole, isLoading } = useSupabase();
  const router = useRouter();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Role Guard: Redirect non-staff users away from admin area
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else if (userRole && !['admin', 'staff', 'manager', 'owner'].includes(userRole)) {
        // If logged in but not a staff member, redirect to home
        console.warn('Unauthorized access to admin area. Redirecting to home.');
        router.push('/');
      }
    }
  }, [user, userRole, isLoading, router]);

  // If loading or unauthorized, show a loading/redirecting state
  const isAuthorized = !isLoading && user && ['admin', 'staff', 'manager', 'owner'].includes(userRole || '');

  if (isLoading || !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900" suppressHydrationWarning>
        <div className="w-16 h-16 rounded-full border-4 border-gray-300 border-t-blue-500 animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Global Header */}
      <AdminHeader sidebarOpen={sidebarOpen} onMenuToggle={toggleSidebar} className="fixed top-0 left-0 right-0 z-50" />

      {/* Sidebar (Fixed independently) */}
      <AdminSidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out pt-16", // Added pt-16 for header
        sidebarOpen ? "md:pl-64" : "md:pl-20"
      )}>
        <main className="flex-grow container mx-auto px-4 py-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}