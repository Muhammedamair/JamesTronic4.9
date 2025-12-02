'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Home, List, User, PlusCircle, Wrench, MapPin, BarChart3, Package, DollarSign } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useSupabase } from '@/components/shared/supabase-provider';

interface AdminNavigationProps {
  className?: string;
  onNavigate?: () => void; // Callback to close mobile menu when navigating
}

const AdminNavigation: React.FC<AdminNavigationProps> = ({ className, onNavigate }) => {
  const pathname = usePathname();
  const { supabase, user } = useSupabase();
  const [userRole, setUserRole] = useState<string | null>(null);

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

  // Define navigation items based on user role
  const navItems = [
    { name: 'Dashboard', href: '/app', icon: Home },
    { name: 'Tickets', href: '/app/tickets', icon: List },
    { name: 'Customers', href: '/app/customers', icon: User },
    { name: 'Create Ticket', href: '/app/create', icon: PlusCircle },
  ];

  // Add technician and transporter management for admin and staff users
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
    <nav className={cn("flex flex-col md:flex-row items-start md:items-center gap-1 md:gap-2", className)}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate} // Close mobile menu when navigating
            suppressHydrationWarning={true}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
              isActive
                ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800",
              "text-sm font-medium"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export { AdminNavigation };