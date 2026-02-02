'use client';

import React, { useState, useEffect } from 'react';
import { PricingPageHeader } from '@/components/pricing/PricingPageHeader';
import { DenseDataTable, ColumnDef } from '@/components/pricing/DenseDataTable';
import { PricingAPI } from '@/lib/pricing/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerDescription, DrawerTrigger } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { ArrowRight, History, AlertTriangle } from 'lucide-react';
import { useSupabase } from '@/components/shared/supabase-provider';

export default function BaseRatesPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useSupabase(); // Get context for City ID (Manager) or Filter (Admin)
    const router = useRouter();

    const loadRates = async () => {
        setLoading(true);
        try {
            // If manager, we pull from user context. If admin, we ideally default to a city selector (P4.3).
            // For now, P4.2 Wave 2, we assume we fetch for the user's implicit scope or a test city.
            const cityId = user?.app_metadata?.city_id || user?.user_metadata?.city_id;
            if (!cityId && user?.app_metadata?.app_role === 'manager') {
                // Blocked state handled by layout usually, but here we show empty
                return;
            }

            // If admin and no city selected, we might fetch all (but that's huge).
            // We'll stub with a valid city_id if admin, or url param.
            const params = new URLSearchParams();
            if (cityId) params.set('city_id', cityId);

            const res = await PricingAPI.getBaseRates(params);
            setData(res?.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) loadRates();
    }, [user]);

    const columns: ColumnDef<any>[] = [
        { header: 'Service Code', accessorKey: 'service_code', className: 'font-mono text-violet-300' },
        { header: 'Category', accessorKey: 'category' },
        {
            header: 'Labor',
            accessorKey: 'labor_base',
            cell: (i) => <span className="font-medium">₹{i.labor_base}</span>
        },
        {
            header: 'Transport',
            accessorKey: 'transport_base',
            cell: (i) => <span className="text-slate-400">₹{i.transport_base}</span>
        },
        {
            header: 'Diagnostic',
            accessorKey: 'diagnostic_fee',
            cell: (i) => <span className="text-slate-400">₹{i.diagnostic_fee}</span>
        },
        {
            header: 'Markup',
            accessorKey: 'parts_markup_pct',
            cell: (i) => <span className="text-xs">{i.parts_markup_pct}%</span>
        },
        {
            header: 'Effective Since',
            accessorKey: 'effective_from',
            cell: (i) => <span className="text-[10px] text-slate-500">{format(new Date(i.effective_from), 'MMM d, yyyy')}</span>
        }
    ];

    return (
        <>
            <PricingPageHeader
                title="Base Rates"
                subtitle="Manage service-level pricing for your city scope."
            />

            <DenseDataTable
                data={data}
                columns={columns}
                loading={loading}
                auditEntityBase="base_rates"
                actions={(item) => (
                    <RevisionDrawerTrigger item={item} onSuccess={loadRates} />
                )}
            />
        </>
    );
}

function RevisionDrawerTrigger({ item, onSuccess }: { item: any, onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [form, setForm] = useState({
        labor: item.labor_base,
        diagnostic: item.diagnostic_fee,
        transport: item.transport_base,
        markup: item.parts_markup_pct
    });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await PricingAPI.createBaseRateRevision({
                city_id: item.city_id,
                service_code: item.service_code,
                labor_base: Number(form.labor),
                diagnostic_fee: Number(form.diagnostic),
                transport_base: Number(form.transport),
                parts_markup_pct: Number(form.markup),
                effective_from: new Date().toISOString(), // Immediate
                reason
            });
            setOpen(false);
            onSuccess();
        } catch (err) {
            alert('Failed to create revision: ' + err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                <Button variant="ghost" className="w-full justify-start text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/20 h-8 px-2 text-xs">
                    <History className="w-3.5 h-3.5 mr-2" />
                    Create Revision
                </Button>
            </DrawerTrigger>
            <DrawerContent className="bg-slate-950 border-slate-800 text-slate-200">
                <div className="mx-auto w-full max-w-4xl">
                    <DrawerHeader>
                        <DrawerTitle className="text-xl">Create Revision: {item.service_code}</DrawerTitle>
                        <DrawerDescription className="text-slate-400">
                            Updates are append-only. The current rate will be end-dated and a new rate effective immediately will be created.
                        </DrawerDescription>
                    </DrawerHeader>

                    <div className="p-6 grid grid-cols-2 gap-12">
                        {/* LEFT: Inputs */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">New Rate Card</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Labor Base (₹)</Label>
                                    <Input
                                        type="number"
                                        value={form.labor}
                                        onChange={e => setForm({ ...form, labor: e.target.value })}
                                        className="bg-slate-900 border-slate-700 font-mono text-lg"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Diagnostic Fee (₹)</Label>
                                    <Input
                                        type="number"
                                        value={form.diagnostic}
                                        onChange={e => setForm({ ...form, diagnostic: e.target.value })}
                                        className="bg-slate-900 border-slate-700 font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Transport (₹)</Label>
                                    <Input
                                        type="number"
                                        value={form.transport}
                                        onChange={e => setForm({ ...form, transport: e.target.value })}
                                        className="bg-slate-900 border-slate-700 font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Parts Markup (%)</Label>
                                    <Input
                                        type="number"
                                        value={form.markup}
                                        onChange={e => setForm({ ...form, markup: e.target.value })}
                                        className="bg-slate-900 border-slate-700 font-mono"
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <Label className="text-amber-500 mb-1.5 block flex items-center gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    Reason for Change (Required)
                                </Label>
                                <Textarea
                                    placeholder="e.g. Annual inflation adjustment..."
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    className="bg-slate-900 border-slate-700 resize-none h-24"
                                />
                            </div>
                        </div>

                        {/* RIGHT: Impact Preview */}
                        <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-800">
                            <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Impact Preview</h4>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">Labor Delta</span>
                                    <Badge variant="outline" className={Number(form.labor) > item.labor_base ? 'text-amber-400 border-amber-900' : 'text-slate-400 border-slate-800'}>
                                        {Number(form.labor) > item.labor_base ? '+' : ''}{Number(form.labor) - item.labor_base}
                                    </Badge>
                                </div>
                                {/* Simple totals for preview */}
                                <div className="mt-8 pt-4 border-t border-slate-700/50">
                                    <div className="flex justify-between items-center">
                                        <div className="text-right">
                                            <div className="text-xs text-slate-500 uppercase">Current Base</div>
                                            <div className="text-lg font-mono text-slate-400">
                                                ₹{Number(item.labor_base) + Number(item.transport_base)}
                                            </div>
                                        </div>
                                        <ArrowRight className="text-slate-600" />
                                        <div className="text-right">
                                            <div className="text-xs text-emerald-500 uppercase">Proposed Base</div>
                                            <div className={`text-2xl font-mono font-bold ${Number(form.labor) + Number(form.transport) > (Number(item.labor_base) + Number(item.transport_base)) ? 'text-emerald-400' : 'text-slate-200'}`}>
                                                ₹{Number(form.labor) + Number(form.transport)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-4 text-center">
                                    * Base calculation only. Does not include urgency, complexity, or parts costs.
                                </p>
                            </div>
                        </div>
                    </div>

                    <DrawerFooter className="border-t border-slate-800 pt-4">
                        <div className="flex justify-end gap-3 w-full max-w-4xl mx-auto">
                            <Button variant="outline" onClick={() => setOpen(false)} className="border-slate-700 hover:bg-slate-800">Cancel</Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={submitting || !reason}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[150px]"
                            >
                                {submitting ? 'Committing...' : 'Create Revision'}
                            </Button>
                        </div>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
