'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/shared/supabase-provider';
import { Loader2 } from 'lucide-react';
import { CityScopeIndicator } from '@/components/pricing/CityScopeIndicator';

/*
  PricingLayout
  - Wraps all /manager/pricing/ pages
  - Enforces "Manager" or "Admin" role (though middleware/RLS does too)
  - Provides shared context (like Theme enforcement)
*/

export default function PricingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { userRole, isLoading } = useSupabase();
    const router = useRouter();

    // Route Guard
    React.useEffect(() => {
        if (!isLoading && userRole && !['admin', 'manager'].includes(userRole)) {
            router.replace('/app'); // Kick unauthorized out
        }
    }, [userRole, isLoading, router]);

    if (isLoading) {
        return (
            <div className="h-[50vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200">
            {/* Persistent Top Bar for Context */}
            <div className="border-b border-slate-800 bg-slate-950/50 backdrop-blur sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-400 hidden sm:block">Dynamic Pricing Console</span>
                    <div className="ml-auto">
                        <CityScopeIndicator />
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 pt-6">
                {children}
            </div>
        </div>
    );
}
