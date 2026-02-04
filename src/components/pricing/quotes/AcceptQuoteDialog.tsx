'use client';

import { useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { Quote } from './types';
import { QuoteStatusBadge } from './QuoteStatusBadge';
import { format, parseISO } from 'date-fns';

interface AcceptQuoteDialogProps {
    quote: Quote | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (reason?: string) => void;
    isSubmitting?: boolean;
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
}

export function AcceptQuoteDialog({
    quote,
    open,
    onOpenChange,
    onConfirm,
    isSubmitting,
}: AcceptQuoteDialogProps) {
    const [confirmText, setConfirmText] = useState('');
    const [reason, setReason] = useState('');

    const isConfirmValid = confirmText.trim().toUpperCase() === 'ACCEPT';

    const handleConfirm = () => {
        if (!isConfirmValid) return;
        onConfirm(reason.trim() || undefined);
        setConfirmText('');
        setReason('');
    };

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            setConfirmText('');
            setReason('');
        }
        onOpenChange(isOpen);
    };

    if (!quote) return null;

    return (
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Accept Quote</AlertDialogTitle>
                    <AlertDialogDescription>
                        Review the quote details before accepting. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {/* Quote Summary */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-2 my-4">
                    <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Service</span>
                        <span className="font-mono text-sm">{quote.service_code}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Amount</span>
                        <span className="font-bold text-lg">{formatCurrency(quote.total_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <QuoteStatusBadge status={quote.status} />
                    </div>
                    <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Expires</span>
                        <span className="text-sm">{format(parseISO(quote.expires_at), 'PPpp')}</span>
                    </div>
                </div>

                {/* Confirmation Input */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="confirm-text">
                            Type <span className="font-mono font-bold">ACCEPT</span> to confirm
                        </Label>
                        <Input
                            id="confirm-text"
                            placeholder="ACCEPT"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            autoComplete="off"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reason">Reason (Optional)</Label>
                        <Textarea
                            id="reason"
                            placeholder="Add a note for the audit trail..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={2}
                        />
                    </div>
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        disabled={!isConfirmValid || isSubmitting}
                    >
                        {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Accept Quote
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
