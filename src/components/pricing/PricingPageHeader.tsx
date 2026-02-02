'use client';

import React from 'react';
import { useSupabase } from '@/components/shared/supabase-provider';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

import { CityScopeIndicator } from '@/components/pricing/CityScopeIndicator';

interface PricingPageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
}

export const PricingPageHeader: React.FC<PricingPageHeaderProps> = ({
    title,
    subtitle,
    actions,
}) => {
    return (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between py-6">
            <div className="space-y-1">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-semibold tracking-tight text-white">
                        {title}
                    </h1>
                    <CityScopeIndicator />
                </div>
                {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
            </div>

            <div className="flex items-center gap-3">
                {actions}

                {/* Audit Deep Link Placeholder - logic to be refined per page */}
                <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-300" asChild>
                    <Link href="/app/manager/pricing/audit">
                        <Shield className="w-4 h-4 mr-2" />
                        Audit Logs
                    </Link>
                </Button>
            </div>
        </div>
    );
};
