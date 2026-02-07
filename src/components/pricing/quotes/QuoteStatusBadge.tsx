'use client';

import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, XCircle, Ban, AlertTriangle } from 'lucide-react';
import { Quote } from './types';

interface QuoteStatusBadgeProps {
    status: Quote['status'];
}

const statusConfig: Record<Quote['status'], {
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    className: string;
    icon: React.ElementType;
    label: string;
}> = {
    pending: {
        variant: 'outline',
        className: 'border-amber-500 text-amber-600 bg-amber-50',
        icon: Clock,
        label: 'Pending',
    },
    accepted: {
        variant: 'default',
        className: 'bg-green-500 text-white hover:bg-green-600',
        icon: CheckCircle,
        label: 'Accepted',
    },
    expired: {
        variant: 'secondary',
        className: 'bg-gray-200 text-gray-600',
        icon: XCircle,
        label: 'Expired',
    },
    blocked: {
        variant: 'destructive',
        className: 'bg-red-500 text-white',
        icon: Ban,
        label: 'Blocked',
    },
    anomaly: {
        variant: 'outline',
        className: 'border-purple-500 text-purple-600 bg-purple-50',
        icon: AlertTriangle,
        label: 'Anomaly',
    },
};

export function QuoteStatusBadge({ status }: QuoteStatusBadgeProps) {
    const config = statusConfig[status];
    const Icon = config.icon;

    return (
        <Badge
            variant={config.variant}
            className={`gap-1 ${config.className}`}
        >
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    );
}
