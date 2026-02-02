'use client';

import { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Copy, Link2, ShieldAlert } from 'lucide-react';

function getAppOrigin() {
    return process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
}

export function ShareQuoteDrawer({
    quoteId,
    open,
    onOpenChange,
}: {
    quoteId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [phone, setPhone] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [ttlMinutes, setTtlMinutes] = useState(120);
    const [maxUses, setMaxUses] = useState(1);
    const [submitting, setSubmitting] = useState(false);

    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);

    const identityOk = phone.trim().length >= 8 || customerId.trim().length >= 8;

    const handleGenerate = async () => {
        if (!identityOk) {
            toast.error('Provide phone or customer id');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`/api/pricing/quotes/${quoteId}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    intended_phone_e164: phone.trim() || undefined,
                    intended_customer_id: customerId.trim() || undefined,
                    ttl_minutes: ttlMinutes,
                    max_uses: maxUses,
                }),
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Share failed');

            const origin = getAppOrigin();
            const url = `${origin}/q/${json.token}`;
            setShareUrl(url);
            setExpiresAt(json.expires_at);

            toast.success('Share link generated', {
                description: 'Single-use, OTP-gated, identity-bound.',
            });
        } catch (e: any) {
            toast.error('Failed to generate link', { description: e.message });
        } finally {
            setSubmitting(false);
        }
    };

    const copy = async () => {
        if (!shareUrl) return;
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied');
    };

    // Security: clear token when closing
    const handleOpenChange = (v: boolean) => {
        onOpenChange(v);
        if (!v) {
            setShareUrl(null);
            setExpiresAt(null);
        }
    };

    return (
        <Drawer open={open} onOpenChange={handleOpenChange}>
            <DrawerContent>
                <div className="mx-auto w-full max-w-2xl">
                    <DrawerHeader>
                        <DrawerTitle className="flex items-center gap-2">
                            <Link2 className="h-5 w-5" />
                            Share Quote
                        </DrawerTitle>
                        <DrawerDescription>
                            Generates a single-use, OTP-gated link. <span className="font-semibold text-red-400">Do not forward.</span>
                        </DrawerDescription>
                    </DrawerHeader>

                    <div className="px-6 pb-4 space-y-4">
                        <div className="rounded-md border p-3 text-sm flex gap-2 bg-amber-950/20 border-amber-900/50">
                            <ShieldAlert className="h-5 w-5 mt-0.5 text-amber-500" />
                            <div>
                                <div className="font-medium text-amber-500">Security Notice</div>
                                <div className="text-muted-foreground">
                                    Single-use • Identity-bound • Expires automatically • OTP required
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Customer Phone (E.164)</Label>
                                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91..." />
                            </div>
                            <div className="space-y-2">
                                <Label>Customer ID (optional)</Label>
                                <Input value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="UUID" />
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>TTL (minutes)</Label>
                                <Input
                                    type="number"
                                    value={ttlMinutes}
                                    onChange={(e) => setTtlMinutes(Number(e.target.value))}
                                    min={5}
                                    max={1440}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Max Uses</Label>
                                <Input
                                    type="number"
                                    value={maxUses}
                                    onChange={(e) => setMaxUses(Number(e.target.value))}
                                    min={1}
                                    max={5}
                                />
                            </div>
                        </div>

                        {shareUrl && (
                            <div className="rounded-md border p-3 space-y-2 bg-slate-900/50">
                                <div className="text-sm font-medium text-emerald-400">Share URL Generated</div>
                                <div className="text-xs break-all text-muted-foreground font-mono bg-black/20 p-2 rounded">{shareUrl}</div>
                                {expiresAt && <div className="text-xs text-muted-foreground">Expires: {expiresAt}</div>}
                                <Button variant="outline" onClick={copy} className="w-full">
                                    <Copy className="h-4 w-4 mr-2" />
                                    Copy Link
                                </Button>
                            </div>
                        )}
                    </div>

                    <DrawerFooter className="px-6 pb-6">
                        <Button onClick={handleGenerate} disabled={!identityOk || submitting} className="w-full">
                            {submitting ? 'Generating…' : shareUrl ? 'Regenerate Link' : 'Generate Link'}
                        </Button>
                        <Button variant="outline" onClick={() => handleOpenChange(false)} className="w-full">
                            Close
                        </Button>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
