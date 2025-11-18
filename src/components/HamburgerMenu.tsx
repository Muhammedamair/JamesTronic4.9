'use client';

import React, { useState, useEffect } from 'react';
import { Menu, X, User, LogOut, Settings, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SettingsPanel from '@/components/SettingsPanel';
import { useSupabase } from '@/components/supabase-provider';

interface HamburgerMenuProps {
  onLogout: () => void;
}

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({ onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, userRole } = useSupabase();
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        // In a real implementation, you would fetch from your users table
        setUserData({
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'Technician',
          email: user.email,
          category: 'Electronics Repair' // This would come from your profiles table
        });
      }
    };

    fetchUserData();
  }, [user]);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden"
        aria-label="Menu"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {isOpen && (
        <div className="absolute top-12 right-0 z-50 w-80 bg-white rounded-lg shadow-lg border p-4 dark:bg-gray-800 dark:border-gray-700">
          {/* User Profile Section */}
          <div className="pb-3 border-b dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-3">
              <div className="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {userData?.name || 'Technician Name'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {userRole || 'Role'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {userData?.category || 'Category'}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500 truncate">
              {userData?.email || user?.email || 'email@example.com'}
            </p>
          </div>

          {/* Settings Panel */}
          <div className="py-3">
            <SettingsPanel onLogout={() => {
              onLogout();
              setIsOpen(false);
            }} />
          </div>

          {/* Coming Soon Feature */}
          <div className="pt-3 border-t dark:border-gray-700">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-2">
                <Settings className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Technician Hub</span>
              </div>
              <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">Coming Soon</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HamburgerMenu;