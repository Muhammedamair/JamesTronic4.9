'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Home, Wrench, CreditCard, Star, HelpCircle, Users, MapPin } from 'lucide-react';
import { useSupabase } from '@/components/shared/supabase-provider';
import { Button } from '@/components/ui/button';

interface PublicNavigationProps {
  className?: string;
  onNavigate?: () => void; // Callback to close mobile menu when navigating
}

const PublicNavigation: React.FC<PublicNavigationProps> = ({ className, onNavigate }) => {
  const { user } = useSupabase();

  const publicNavItems = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Services', href: '/services', icon: Wrench },
    { name: 'Pricing', href: '/pricing', icon: CreditCard },
    { name: 'Reviews', href: '/reviews', icon: Star },
    { name: 'FAQ', href: '/faq', icon: HelpCircle },
    { name: 'Stores', href: '/stores', icon: MapPin },
    { name: 'About', href: '/about', icon: Users },
  ];

  return (
    <nav className={cn("flex flex-col md:flex-row items-center md:items-center gap-1 md:gap-6", className)}>
      {publicNavItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          (item.href === '/' && typeof window !== 'undefined' && window.location.pathname === '/') ||
          (item.href !== '/' && typeof window !== 'undefined' && window.location.pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate} // Close mobile menu when navigating
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
              isActive
                ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800",
              "text-sm font-medium"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.name}</span>
          </Link>
        );
      })}

      {/* User-specific button - Login if not logged in, Dashboard if logged in */}
      {user ? (
        <Button asChild className="ml-2">
          <Link href="/app" onClick={onNavigate}>
            Dashboard
          </Link>
        </Button>
      ) : (
        <Button variant="outline" asChild className="ml-2">
          <Link href="/login" onClick={onNavigate}>
            Sign In
          </Link>
        </Button>
      )}
    </nav>
  );
};

export { PublicNavigation };