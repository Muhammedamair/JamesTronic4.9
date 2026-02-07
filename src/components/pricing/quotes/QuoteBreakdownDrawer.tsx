'use client';

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Copy, FileJson, Share2 } from 'lucide-react';
import { Quote } from './types';
import { QuoteStatusBadge } from './QuoteStatusBadge';
import { ShareQuoteDrawer } from './ShareQuoteDrawer';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useState } from 'react';

interface QuoteBreakdownDrawerProps {
    quote: Quote | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
}

function BreakdownRow({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex justify-between py-1">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-mono">{formatCurrency(value)}</span>
        </div>
    );
}

export function QuoteBreakdownDrawer({ quote, open, onOpenChange }: QuoteBreakdownDrawerProps) {
    const [shareOpen, setShareOpen] = useState(false);

    if (!quote) return null;

    const copyToClipboard = (data: unknown, label: string) => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        toast.success(`${label} copied to clipboard`);
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Quote Details</SheetTitle>
                    <SheetDescription className="font-mono text-xs">
                        {quote.id}
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-6 mt-6">
                    {/* Summary */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Status</span>
                            <QuoteStatusBadge status={quote.status} />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Service</span>
                            <span className="font-mono text-sm">{quote.service_code}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Total</span>
                            <span className="text-xl font-bold">{formatCurrency(quote.total_amount)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Expires</span>
                            <span className="text-sm">{format(parseISO(quote.expires_at), 'PPpp')}</span>
                        </div>
                    </div>

                    <Separator />

                    {/* Breakdown */}
                    <div>
                        <h4 className="font-semibold mb-3">Breakdown</h4>
                        <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                            <BreakdownRow label="Labor" value={quote.breakdown?.labor || quote.labor_amount} />
                            <BreakdownRow label="Parts" value={quote.breakdown?.parts || quote.parts_amount} />
                            <BreakdownRow label="Transport" value={quote.breakdown?.transport || quote.transport_amount} />
                            <BreakdownRow label="Diagnostic" value={quote.breakdown?.diagnostic || quote.diagnostic_amount} />
                            <BreakdownRow label="Urgency Surcharge" value={quote.breakdown?.urgency_surcharge || quote.urgency_surcharge} />
                            <BreakdownRow label="Complexity Surcharge" value={quote.breakdown?.complexity_surcharge || quote.complexity_surcharge} />
                            <Separator className="my-2" />
                            <div className="flex justify-between py-1 font-semibold">
                                <span>Total</span>
                                <span className="font-mono">{formatCurrency(quote.total_amount)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Reason Codes */}
                    {quote.reason_codes && quote.reason_codes.length > 0 && (
                        <div>
                            <h4 className="font-semibold mb-3">Reason Codes</h4>
                            <div className="flex flex-wrap gap-2">
                                {quote.reason_codes.map((code) => (
                                    <Badge key={code} variant="outline" className="font-mono text-xs">
                                        {code}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    <Separator />

                    {/* Snapshot References */}
                    <div>
                        <h4 className="font-semibold mb-3">Snapshot References</h4>
                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="text-muted-foreground">Ruleset Version: </span>
                                <span className="font-mono">{quote.ruleset_version}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Base Rate Ref: </span>
                                <code className="text-xs bg-muted px-2 py-1 rounded">
                                    {JSON.stringify(quote.base_rate_ref)}
                                </code>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Guardrail Ref: </span>
                                <code className="text-xs bg-muted px-2 py-1 rounded">
                                    {JSON.stringify(quote.guardrail_ref)}
                                </code>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Actions */}
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(quote.breakdown, 'Breakdown')}
                        >
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Breakdown
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(quote, 'Full Quote')}
                        >
                            <FileJson className="h-4 w-4 mr-2" />
                            Copy Full JSON
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => setShareOpen(true)}
                            className="ml-auto bg-violet-600 hover:bg-violet-700 text-white"
                        >
                            <Share2 className="h-4 w-4 mr-2" />
                            Share Quote
                        </Button>
                    </div>
                </div>
            </SheetContent>

            <ShareQuoteDrawer
                quoteId={quote.id}
                open={shareOpen}
                onOpenChange={setShareOpen}
            />
        </Sheet>
    );
}
