'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSupabase } from '@/components/shared/supabase-provider';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { User, LogOut, ClipboardList, Settings, ChevronDown } from 'lucide-react';

interface ProfileDropdownProps {
    className?: string;
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { supabase, user, userRole } = useSupabase();
    const router = useRouter();

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setIsOpen(false);
        router.push('/');
        router.refresh();
    };

    // If not logged in, show Sign In button
    if (!user) {
        return (
            <Link
                href="/login"
                className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg",
                    "bg-indigo-600 text-white hover:bg-indigo-700 transition-colors",
                    "text-sm font-medium",
                    className
                )}
            >
                <User className="w-4 h-4" />
                <span>Sign In</span>
            </Link>
        );
    }

    // Get user initials for avatar
    const getInitials = () => {
        if (user.email) {
            return user.email.charAt(0).toUpperCase();
        }
        return 'U';
    };

    // Determine dashboard link based on role
    const getDashboardLink = () => {
        if (userRole === 'admin' || userRole === 'staff' || userRole === 'manager') {
            return '/app';
        }
        return '/profile';
    };

    return (
        <div ref={dropdownRef} className={cn("relative", className)}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-2 p-2 rounded-full",
                    "hover:bg-gray-100 transition-colors",
                    isOpen && "bg-gray-100"
                )}
            >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-sm">
                    {getInitials()}
                </div>
                <ChevronDown className={cn(
                    "w-4 h-4 text-gray-500 transition-transform",
                    isOpen && "rotate-180"
                )} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                    {/* User Info Header */}
                    <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900 truncate">
                            {user.email}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">
                            {userRole || 'Customer'}
                        </p>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                        {/* My Repairs */}
                        <Link
                            href="/"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <ClipboardList className="w-4 h-4 text-gray-400" />
                            <span>My Repairs</span>
                        </Link>

                        {/* Profile / Dashboard */}
                        <Link
                            href={getDashboardLink()}
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <User className="w-4 h-4 text-gray-400" />
                            <span>{userRole === 'admin' || userRole === 'staff' ? 'Dashboard' : 'Profile'}</span>
                        </Link>

                        {/* Settings (if admin/staff) */}
                        {(userRole === 'admin' || userRole === 'staff' || userRole === 'manager') && (
                            <Link
                                href="/app/settings"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <Settings className="w-4 h-4 text-gray-400" />
                                <span>Settings</span>
                            </Link>
                        )}
                    </div>

                    {/* Logout */}
                    <div className="border-t border-gray-100 py-1">
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                        >
                            <LogOut className="w-4 h-4" />
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfileDropdown;
