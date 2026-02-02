'use client';

import React from 'react';
import { useSupabase } from '@/components/shared/supabase-provider';
import { Lock, MapPin, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

export const CityScopeIndicator: React.FC = () => {
    const { user } = useSupabase();

    // Logic: 
    // Admin -> Global (regardless of specific city_id, usually)
    // Manager -> Specific City ID
    const role = user?.app_metadata?.app_role || 'user';
    const cityId = user?.app_metadata?.city_id || user?.user_metadata?.city_id;

    const isAdmin = ['admin', 'super_admin'].includes(role);
    const isManager = role === 'manager';

    if (!user) return null;

    let badgeVariant: "outline" | "default" | "secondary" | "destructive" | null | undefined = 'outline';
    let badgeClass = 'bg-slate-900 border-slate-700 text-slate-400';
    let icon = <MapPin className="w-3 h-3" />;
    let label = 'Global / Multi-City';
    let tooltipTitle = 'Global Access';
    let tooltipDesc = 'You have administrative access to all cities.';
    let showCityIdInTooltip = false;

    if (isAdmin) {
        // Defaults apply
    } else if (isManager) {
        if (cityId) {
            badgeClass = 'bg-slate-900 border-violet-500/50 text-violet-400 hover:bg-slate-800';
            icon = <Lock className="w-3 h-3" />;
            label = cityId;
            tooltipTitle = 'RLS Enforced';
            tooltipDesc = 'You are restricted to viewing data for this city.';
            showCityIdInTooltip = true;
        } else {
            // Warning state for manager without city
            badgeClass = 'bg-amber-950/10 border-amber-900/50 text-amber-500';
            icon = <AlertTriangle className="w-3 h-3" />;
            label = 'City Not Set';
            tooltipTitle = 'Configuration Error';
            tooltipDesc = 'Your manager account has no assigned city. Contact Admin.';
        }
    }

    return (
        <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Scope:</span>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge variant={badgeVariant} className={`gap-1.5 px-3 py-1 cursor-help transition-colors ${badgeClass}`}>
                            {icon}
                            <span className="font-mono text-xs max-w-[150px] truncate">
                                {label}
                            </span>
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 border-slate-700 text-slate-300">
                        <p className="font-semibold text-violet-400 mb-1">{tooltipTitle}</p>
                        <p className="text-xs">{tooltipDesc}</p>
                        {showCityIdInTooltip && <p className="text-[10px] text-slate-500 mt-1 font-mono">ID: {cityId}</p>}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
};
