'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, CheckCircle } from 'lucide-react';
import { Quote } from './types';
import { QuoteStatusBadge } from './QuoteStatusBadge';
import { formatDistanceToNow, isPast, parseISO } from 'date-fns';

interface QuotesTableProps {
    data: Quote[];
    loading?: boolean;
    onView: (quote: Quote) => void;
    onAccept: (quote: Quote) => void;
    onRowClick?: (quote: Quote) => void;
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
}

function getExpiryDisplay(expiresAt: string, status: Quote['status']): string {
    if (status !== 'pending') return '-';
    const date = parseISO(expiresAt);
    if (isPast(date)) return 'Expired';
    return formatDistanceToNow(date, { addSuffix: true });
}

export function QuotesTable({ data, loading, onView, onAccept, onRowClick }: QuotesTableProps) {
    if (loading) {
        return (
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead>Service</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Expires</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[...Array(5)].map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="rounded-md border p-8 text-center text-muted-foreground">
                No quotes found
            </div>
        );
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((quote) => {
                        const canAccept = quote.status === 'pending' && !isPast(parseISO(quote.expires_at));

                        return (
                            <TableRow
                                key={quote.id}
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => onRowClick?.(quote)}
                            >
                                <TableCell>
                                    <QuoteStatusBadge status={quote.status} />
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                    {quote.service_code}
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                    {formatCurrency(quote.total_amount)}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {formatDistanceToNow(parseISO(quote.created_at), { addSuffix: true })}
                                </TableCell>
                                <TableCell className="text-sm">
                                    <span className={canAccept ? 'text-amber-600' : 'text-muted-foreground'}>
                                        {getExpiryDisplay(quote.expires_at, quote.status)}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onView(quote)}
                                        >
                                            <Eye className="h-4 w-4 mr-1" />
                                            View
                                        </Button>
                                        {canAccept && (
                                            <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => onAccept(quote)}
                                            >
                                                <CheckCircle className="h-4 w-4 mr-1" />
                                                Accept
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
