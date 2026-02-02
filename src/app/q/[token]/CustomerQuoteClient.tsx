'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AcceptQuoteDialog } from '@/components/pricing/quotes/AcceptQuoteDialog';
import { Loader2, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

type RedeemResponse = {
    quote: {
        id: string;
        service_code: string;
        status: string;
        total_amount: number;
        expires_at: string;
        breakdown: any;
        reason_codes: string[];
    };
    can_accept: boolean;
};

export default function CustomerQuoteClient({ token }: { token: string }) {
    const [data, setData] = useState<RedeemResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [acceptOpen, setAcceptOpen] = useState(false);

    const redeem = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/pricing/quotes/share/redeem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Redeem failed');
            setData(json);
        } catch (e: any) {
            setError(e.message);
            toast.error('Unable to open quote', { description: e.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // do not log token
        redeem();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const accept = async (reason?: string) => {
        if (!data?.quote?.id) return;
        try {
            const res = await fetch(`/api/pricing/quotes/${data.quote.id}/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Accept failed');
            toast.success('Quote accepted');
            setAcceptOpen(false);
            await redeem(); // refresh status
        } catch (e: any) {
            toast.error('Failed to accept', { description: e.message });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                    <p className="text-slate-400">Verifying secure link...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
                <Card className="max-w-md w-full border-red-900/50 bg-red-950/10">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-500">
                            <AlertCircle className="h-5 w-5" />
                            Link Invalid or Expired
                        </CardTitle>
                        <CardDescription className="text-red-400/80">
                            {error || 'This secure link is no longer valid. It may have expired or been used already.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-500">Please contact support or request a new link.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const q = data.quote;

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">
            <div className="max-w-3xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-100">Service Quote</h1>
                        <p className="text-slate-400 text-sm font-mono">{q.id}</p>
                    </div>
                    <Badge variant="outline" className={`w-fit px-3 py-1 ${q.status === 'accepted' ? 'border-emerald-500 text-emerald-500 bg-emerald-950/30' :
                            q.status === 'pending' ? 'border-blue-500 text-blue-500 bg-blue-950/30' :
                                'border-slate-700 text-slate-400'
                        }`}>
                        {q.status.toUpperCase()}
                    </Badge>
                </div>

                {/* Main Content */}
                <div className="grid gap-6 md:grid-cols-3">

                    {/* Left: Details */}
                    <div className="md:col-span-2 space-y-6">
                        <Card className="border-slate-800 bg-slate-900/50">
                            <CardHeader>
                                <CardTitle>Service Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between items-center p-3 bg-slate-950/50 rounded-lg">
                                    <span className="text-sm text-slate-400">Service Code</span>
                                    <span className="font-mono text-slate-200">{q.service_code}</span>
                                </div>

                                <Separator className="bg-slate-800" />

                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-slate-300">Cost Breakdown</h4>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Labor</span>
                                            <span className="font-mono text-slate-300">
                                                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(q.breakdown?.labor || 0)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Parts</span>
                                            <span className="font-mono text-slate-300">
                                                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(q.breakdown?.parts || 0)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Transport</span>
                                            <span className="font-mono text-slate-300">
                                                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(q.breakdown?.transport || 0)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <Separator className="bg-slate-800" />

                                <div className="flex justify-between items-center pt-2">
                                    <span className="font-semibold text-slate-200">Total Amount</span>
                                    <span className="text-2xl font-bold text-emerald-400">
                                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(q.total_amount)}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right: Actions */}
                    <div className="space-y-6">
                        <Card className="border-slate-800 bg-slate-900/50">
                            <CardContent className="p-6 space-y-4">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm text-slate-400">
                                        <Clock className="h-4 w-4" />
                                        <span>Expires</span>
                                    </div>
                                    <div className="text-sm font-medium text-slate-200">
                                        {new Date(q.expires_at).toLocaleString()}
                                    </div>
                                </div>

                                <Separator className="bg-slate-800" />

                                {q.status === 'accepted' ? (
                                    <div className="flex flex-col items-center gap-2 py-4 text-emerald-500">
                                        <CheckCircle className="h-8 w-8" />
                                        <span className="font-medium">Offer Accepted</span>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <Button
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                            size="lg"
                                            onClick={() => setAcceptOpen(true)}
                                            disabled={!data.can_accept}
                                        >
                                            Accept Quote
                                        </Button>
                                        {!data.can_accept && (
                                            <p className="text-xs text-center text-slate-500">
                                                This quote cannot be accepted currently (expired or incorrect status).
                                            </p>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="flex justify-center">
                    <Button variant="ghost" size="sm" onClick={redeem} className="text-slate-600 hover:text-slate-400">
                        Refresh Status
                    </Button>
                </div>

                <AcceptQuoteDialog
                    quote={q as any}
                    open={acceptOpen}
                    onOpenChange={setAcceptOpen}
                    onConfirm={accept}
                    isSubmitting={false}
                />
            </div>
        </div>
    );
}
