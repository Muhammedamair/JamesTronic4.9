'use client';

import React from 'react';
import Link from 'next/link';
import { Menu, X, LogOut } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { useSupabase } from '@/components/supabase-provider';
import { useRouter } from 'next/navigation';
import { Navigation } from './navigation';

interface HeaderProps {
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ className }) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const { supabase } = useSupabase();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // Close mobile menu when navigating
  const handleNavigate = () => {
    setIsMenuOpen(false);
  };

  return (
    <header className={cn("sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 dark:bg-gray-900/95 backdrop-blur", className)}>
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <Link className="flex items-center gap-2" href="/app" onClick={handleNavigate} suppressHydrationWarning={true}>
          <span className="text-xl font-bold">JamesTronic</span>
        </Link>
        
        {/* Desktop Navigation - now using Navigation component */}
        <nav className="hidden md:flex items-center gap-4 text-sm font-medium">
          <Navigation onNavigate={handleNavigate} />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleLogout}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </nav>
        
        {/* Mobile menu button */}
        <button 
          className="md:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      
      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white dark:bg-gray-900">
          <div className="container py-4 flex flex-col gap-3">
            <Navigation onNavigate={handleNavigate} />
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

export { Header };