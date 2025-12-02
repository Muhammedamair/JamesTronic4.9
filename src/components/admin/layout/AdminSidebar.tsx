'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Home, List, User, PlusCircle, Wrench, MapPin, BarChart3, Package, DollarSign, X, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSupabase } from '@/components/shared/supabase-provider';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';

interface AdminSidebarProps {
  className?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({
  className,
  isOpen = true,
  onToggle
}) => {
  const [userRole, setUserRole] = useState<string | null>(null);
  const { supabase, user } = useSupabase();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!error && profile) {
        setUserRole(profile.role);
      } else {
        setUserRole(null);
      }
    };

    fetchUserRole();
  }, [user, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // Define navigation items based on user role
  const navItems = [
    { name: 'Dashboard', href: '/app', icon: Home },
    { name: 'Tickets', href: '/app/tickets', icon: List },
    { name: 'Customers', href: '/app/customers', icon: User },
    { name: 'Create Ticket', href: '/app/create', icon: PlusCircle },
  ];

  // Add additional items for admin and staff users
  if (userRole === 'admin' || userRole === 'staff') {
    navItems.push(
      { name: 'Technicians', href: '/app/technicians', icon: Wrench },
      { name: 'Transporters', href: '/app/transporters', icon: Wrench },
      { name: 'Zones', href: '/app/zones', icon: MapPin },
      { name: 'Performance', href: '/app/performance', icon: BarChart3 },
      { name: 'Parts Requests', href: '/app/parts', icon: Package },
      { name: 'Settlements', href: '/app/settlements', icon: DollarSign }
    );
  }

  return (
    <aside
      className={cn(
        "fixed md:sticky top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 z-40",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:w-20",
        className
      )}
    >
      <div className="h-full overflow-y-auto py-4">
        {/* Close button for mobile */}
        <div className="px-4 flex justify-between items-center mb-6 md:hidden">
          <div className="text-lg font-semibold">Menu</div>
          <button onClick={onToggle} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800",
                  isOpen ? "justify-start" : "justify-center"
                )}
                suppressHydrationWarning={true}
              >
                <Icon className={cn("h-5 w-5", isOpen ? "" : "h-6 w-6 mx-auto")} />
                {isOpen && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout button at the bottom */}
        <div className="mt-auto pt-8 px-2 absolute bottom-0 w-60 md:w-[calc(16rem-16px)]">
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start",
              !isOpen && "justify-center px-2"
            )}
            onClick={handleLogout}
          >
            <LogOut className={cn("h-5 w-5", isOpen ? "mr-3" : "mx-auto")} />
            {isOpen && <span>Logout</span>}
          </Button>
        </div>
      </div>
    </aside>
  );
};

export { AdminSidebar };