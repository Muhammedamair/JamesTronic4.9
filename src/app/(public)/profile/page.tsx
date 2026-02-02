'use client';

import React, { useState } from 'react';
import { useSupabase } from '@/components/shared/supabase-provider';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
    User,
    MapPin,
    ClipboardList,
    Settings,
    LogOut,
    Plus,
    Edit2,
    Phone,
    Mail,
    ChevronRight,
    Package
} from 'lucide-react';
import Link from 'next/link';
import MyRepairsPanel from '@/components/customer/my-repairs-panel';
import { TicketTimelineDrawer } from '@/components/shared/ticket-timeline-drawer';

export default function ProfilePage() {
    const { supabase, user, userRole, isLoading } = useSupabase();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'orders' | 'addresses' | 'settings'>('orders');
    const [showTicketDetails, setShowTicketDetails] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<any>(null);

    // Fetch customer data
    const { data: customerData } = useQuery({
        queryKey: ['customer-profile', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;

            const { data } = await supabase
                .from('customers')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            return data;
        },
        enabled: !!user?.id
    });

    // Handle logout
    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
            </div>
        );
    }

    // Redirect if not logged in
    if (!user) {
        router.push('/login');
        return null;
    }

    // Get initials for avatar
    const getInitials = () => {
        if (customerData?.name) {
            return customerData.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
        }
        if (user.email) {
            return user.email.charAt(0).toUpperCase();
        }
        return 'U';
    };

    const tabs = [
        { id: 'orders', label: 'My Repairs', icon: Package },
        { id: 'addresses', label: 'Addresses', icon: MapPin },
        { id: 'settings', label: 'Settings', icon: Settings },
    ] as const;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto">
                    {/* Profile Header */}
                    <Card className="mb-6">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                {/* Avatar */}
                                <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl">
                                    {getInitials()}
                                </div>

                                {/* Info */}
                                <div className="flex-1">
                                    <h1 className="text-xl font-bold text-gray-900">
                                        {customerData?.name || 'Welcome!'}
                                    </h1>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-500 mt-1">
                                        {user.email && (
                                            <div className="flex items-center gap-1">
                                                <Mail className="w-4 h-4" />
                                                <span>{user.email}</span>
                                            </div>
                                        )}
                                        {customerData?.phone_e164 && (
                                            <div className="flex items-center gap-1">
                                                <Phone className="w-4 h-4" />
                                                <span>{customerData.phone_e164}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Edit Button */}
                                <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-2">
                                    <Edit2 className="w-4 h-4" />
                                    Edit Profile
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tab Navigation */}
                    <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors",
                                        activeTab === tab.id
                                            ? "bg-indigo-600 text-white"
                                            : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'orders' && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-gray-900">Your Repairs</h2>
                                <Button asChild>
                                    <Link href="/book">
                                        <Plus className="w-4 h-4 mr-2" />
                                        Book New Repair
                                    </Link>
                                </Button>
                            </div>
                            <MyRepairsPanel
                                onTicketSelect={(ticket: any) => {
                                    setSelectedTicket(ticket);
                                    setShowTicketDetails(true);
                                }}
                            />
                        </div>
                    )}

                    {activeTab === 'addresses' && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg">Saved Addresses</CardTitle>
                                    <Button variant="outline" size="sm">
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Address
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {customerData?.area ? (
                                    <div className="p-4 border border-gray-200 rounded-lg">
                                        <div className="flex items-start gap-3">
                                            <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-900">Home</p>
                                                <p className="text-sm text-gray-500 mt-1">
                                                    {customerData.area}
                                                    {customerData.city && `, ${customerData.city}`}
                                                </p>
                                            </div>
                                            <Button variant="ghost" size="sm">
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500 mb-4">No addresses saved yet</p>
                                        <Button variant="outline">
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add Your First Address
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'settings' && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Account Settings</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Account Info */}
                                <div className="p-4 border border-gray-200 rounded-lg">
                                    <h3 className="font-medium text-gray-900 mb-3">Account Information</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Email</span>
                                            <span className="text-gray-900">{user.email}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Phone</span>
                                            <span className="text-gray-900">{customerData?.phone_e164 || 'Not set'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Account Type</span>
                                            <span className="text-gray-900 capitalize">{userRole || 'Customer'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Notifications */}
                                <div className="p-4 border border-gray-200 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-medium text-gray-900">Notifications</h3>
                                            <p className="text-sm text-gray-500 mt-1">Manage your notification preferences</p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-400" />
                                    </div>
                                </div>

                                {/* Sign Out */}
                                <Button
                                    variant="outline"
                                    className="w-full text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={handleLogout}
                                >
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Sign Out
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Ticket Timeline Drawer */}
            {selectedTicket && (
                <TicketTimelineDrawer
                    ticket={selectedTicket}
                    open={showTicketDetails}
                    onOpenChange={setShowTicketDetails}
                />
            )}
        </div>
    );
}
