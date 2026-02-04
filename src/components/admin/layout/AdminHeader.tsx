'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu, X, LogOut, Bell, Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
// import { useSupabase } from '@/components/shared/supabase-provider'; // Removed Supabase dependency
import { useLogout } from '@/lib/auth-system/sessionHooks';
import { useRouter } from 'next/navigation';
import { AdminNavigation } from './AdminNavigation';

interface AdminHeaderProps {
  className?: string;
  onMenuToggle?: () => void;
  sidebarOpen?: boolean;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({
  className,
  onMenuToggle,
  sidebarOpen = false
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // const { supabase, user } = useSupabase(); // Unused
  const { logout } = useLogout();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    // Router push is handled inside useLogout / logout function usually, but safe to keep here or rely on hook
    // usage in hook: router.push('/login');
  };

  // Close mobile menu when navigating
  const handleNavigate = () => {
    setIsMenuOpen(false);
    if (onMenuToggle) onMenuToggle();
  };

  return (
    <header className={cn("sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 dark:bg-gray-900/95 backdrop-blur", className)}>
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        {/* Mobile menu button - only for mobile view when not using sidebar */}
        <div className="flex items-center">
          <button
            className="md:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 mr-2"
            onClick={() => {
              if (onMenuToggle) {
                onMenuToggle();
              } else {
                setIsMenuOpen(!isMenuOpen);
              }
            }}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link
            className="flex items-center gap-2"
            href="/app"
            onClick={handleNavigate}
            suppressHydrationWarning={true}
          >
            <span className="text-xl font-bold">JamesTronic Admin</span>
          </Link>
        </div>

        {/* Desktop Navigation - now using AdminNavigation component */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium ml-4">
          <AdminNavigation onNavigate={handleNavigate} />
        </nav>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="hidden md:flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2">
            <Search className="h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search..."
              className="ml-2 bg-transparent outline-none text-sm w-32 lg:w-48"
            />
          </div>

          {/* Notification Bell */}
          <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* Settings */}
          <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <Settings className="h-5 w-5" />
          </button>

          {/* Logout Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="hidden md:flex items-center gap-2 text-xs"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden lg:block">Logout</span>
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {(isMenuOpen || (!sidebarOpen && isMenuOpen)) && (
        <div className="md:hidden border-t border-gray-200 bg-white dark:bg-gray-900">
          <div className="container py-4 flex flex-col gap-3">
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 mb-3">
              <Search className="h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search..."
                className="ml-2 bg-transparent outline-none w-full"
              />
            </div>
            <AdminNavigation onNavigate={handleNavigate} />
            <button
              className="block py-2 text-left transition-colors hover:text-foreground/80 text-red-600"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export { AdminHeader };