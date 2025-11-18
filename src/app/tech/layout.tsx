'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/supabase-provider';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, Settings, Bell, Menu, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import WebPushToggle from '@/components/WebPushToggle';

// Role-based access for technician view
export default function TechLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const { supabase, user, isLoading: isAuthLoading } = useSupabase();
  const [role, setRole] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);

  // Get technician profile details
  const { data: profile } = useQuery({
    queryKey: ['layout-profile', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, created_at, category_id')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: category } = useQuery({
    queryKey: ['category', profile?.category_id],
    queryFn: async () => {
      if (!profile?.category_id) return null;

      const { data, error } = await supabase
        .from('categories')
        .select('name')
        .eq('id', profile.category_id)
        .single();

      if (error) return null;
      return data;
    },
    enabled: !!profile?.category_id,
  });

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh(); // Clear any cached state
    } catch (error) {
      console.error('Error logging out:', error);
      setIsLoggingOut(false);
    }
  };

  useEffect(() => {
    const checkRole = async () => {
      if (user) {
        // Fetch user profile to check role
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error || !profile) {
          router.push('/login');
          return;
        }

        setRole(profile.role);

        if (profile.role !== 'technician' && profile.role !== 'admin') {
          // Redirect to dashboard if not a technician or admin
          router.push('/app');
        } else {
          setVerified(true);
        }
      } else if (!isAuthLoading) {
        // Redirect to login if not authenticated and not loading
        router.push('/login');
      }
    };

    if (!verified) {
      checkRole();
    }
  }, [user, isAuthLoading, supabase, router, verified]);

  if (!verified) {
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

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 dark:bg-gray-900/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-[#5B3FFF]">JamesTronic</span>
            <span className="text-sm text-gray-500 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
              Technician
            </span>
          </div>

          <div className="hidden md:flex items-center gap-4">
            {profile && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <User className="h-4 w-4 text-[#5B3FFF]" />
                <span>Hello, {profile.full_name}</span>
                {category && (
                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                    {category.name}
                  </span>
                )}
              </div>
            )}
            {role === 'admin' && (
              <a
                href="/app"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Admin Dashboard
              </a>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-2 text-sm border-[#5B3FFF] text-[#5B3FFF] hover:bg-[#5B3FFF] hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMobileMenu}
              className="text-gray-500 dark:text-gray-400"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-gray-200 bg-white dark:bg-gray-800"
            >
              <div className="container py-4 px-4 flex flex-col items-start gap-6">
                {/* Profile Section */}
                <div className="w-full pb-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-gray-200 border-2 border-dashed rounded-xl w-12 h-12" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {profile?.full_name || 'Technician Name'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {role || 'Role'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {category?.name || 'Category'}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 truncate pl-15">
                    {user?.email || 'email@example.com'}
                  </p>
                </div>

                {/* Notifications Section */}
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-3">
                    <Bell className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Notifications</span>
                  </div>

                  <div className="py-2">
                    <WebPushToggle
                      userId={user?.id}
                      role={role || 'technician'}
                      checked={false}
                      onCheckedChange={() => {}}
                    />
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="email-notifications" className="text-sm">Email Notifications</Label>
                      <p className="text-xs text-gray-500">Receive email updates</p>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                    />
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="sms-notifications" className="text-sm">SMS Notifications</Label>
                      <p className="text-xs text-gray-500">Receive SMS alerts</p>
                    </div>
                    <Switch
                      id="sms-notifications"
                      checked={smsNotifications}
                      onCheckedChange={setSmsNotifications}
                    />
                  </div>
                </div>

                {/* Account Settings */}
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Account</span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="dark-mode" className="text-sm">Dark Mode</Label>
                      <p className="text-xs text-gray-500">Toggle dark/light theme</p>
                    </div>
                    <Switch
                      id="dark-mode"
                      checked={darkMode}
                      onCheckedChange={setDarkMode}
                    />
                  </div>
                </div>

                {/* Coming Soon Feature */}
                <div className="w-full pt-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Settings className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium">Technician Hub</span>
                    </div>
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">Coming Soon</span>
                  </div>
                </div>

                {/* Logout Button */}
                <div className="w-full pt-2">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    disabled={isLoggingOut}
                    className="w-full flex items-center justify-center"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {isLoggingOut ? 'Logging out...' : 'Logout'}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
      <main className="flex-grow container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}