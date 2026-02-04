// With middleware handling auth, this layout is for authenticated admin/staff users only
'use client';

import { ReactNode, useState } from 'react';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminSidebar } from '@/components/admin/layout/AdminSidebar';
import { SessionProvider } from '@/lib/auth-system/sessionHooks';

export default function AppShell({
  children,
}: {
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <AdminSidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      <div className="flex-1 md:ml-0">
        <AdminHeader sidebarOpen={sidebarOpen} onMenuToggle={toggleSidebar} />
        <main className="flex-grow container mx-auto px-4 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}