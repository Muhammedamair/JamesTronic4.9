'use client';

import React from 'react';
import { MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CityContextChipProps {
    cityName: string;
    isLocked?: boolean;
    className?: string;
}

export function CityContextChip({ cityName, isLocked = true, className }: CityContextChipProps) {
    return (
        <div className={cn(
            "flex items-center gap-2 bg-white/50 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm",
            className
        )}>
            <MapPin className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-slate-800">{cityName}</span>
            {isLocked && (
                <Badge variant="outline" className="text-[9px] h-4 uppercase bg-slate-100/50 border-slate-200 text-slate-500">
                    Locked
                </Badge>
            )}
        </div>
    );
}
