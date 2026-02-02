'use client';

import React, { useState, useEffect } from 'react';
import { PricingPageHeader } from '@/components/pricing/PricingPageHeader';
import { DenseDataTable, ColumnDef } from '@/components/pricing/DenseDataTable';
import { PricingAPI } from '@/lib/pricing/api'; // Ensure this exports PricingClient methods too or consolidate
import { PricingClient } from '@/lib/pricing/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerDescription, DrawerTrigger } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Shield, AlertTriangle, ArrowRight, Save } from 'lucide-react';
import { useSupabase } from '@/components/shared/supabase-provider';

export default function GuardrailsPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useSupabase();

    // Drawer State (Lifted)
    const [selectedGuardrail, setSelectedGuardrail] = useState<any>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const cityId = user?.app_metadata?.city_id || user?.user_metadata?.city_id;
            if (!cityId && user?.app_metadata?.app_role === 'manager') return;

            // For managers, we typically fetch their city. For admins, we need a selector eventually (P4.3).
            // Defaulting to the user's city if available, or just fetching filtered if admin specifies.
            if (cityId) {
                const res = await PricingClient.getGuardrails(cityId);
                setData(res?.data || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) loadData();
    }, [user]);

    const handleOpenRevision = (item: any) => {
        setSelectedGuardrail(item);
        setIsDrawerOpen(true);
    };

    const handleDrawerSuccess = () => {
        loadData();
        // Optional: Keep drawer open or close? Typically close on success.
        // Drawer component handles close via setIsDrawerOpen(false) if passed, or we assume it closes itself.
        // Actually, the separated component needs control. We'll control open state from here.
        setIsDrawerOpen(false);
    };

    const columns: ColumnDef<any>[] = [
        { header: 'Service Code', accessorKey: 'service_code', className: 'font-mono text-violet-300' },
        {
            header: 'Min Total',
            accessorKey: 'min_total',
            cell: (i) => <span className="text-slate-300 font-mono">₹{i.min_total}</span>
        },
        {
            header: 'Max Total',
            accessorKey: 'max_total',
            cell: (i) => <span className="text-slate-300 font-mono">₹{i.max_total}</span>
        },
        {
            header: 'Max Discount',
            accessorKey: 'max_discount_pct',
            cell: (i) => <span className="text-xs">{i.max_discount_pct}%</span>
        },
        {
            header: 'Max Surge',
            accessorKey: 'max_surge_pct',
            cell: (i) => <span className="text-xs">{i.max_surge_pct}%</span>
        },
        {
            header: 'Status',
            accessorKey: 'is_enabled',
            cell: (i) => (
                <Badge variant="outline" className={i.is_enabled ? 'text-emerald-500 border-emerald-900' : 'text-slate-500 border-slate-800'}>
                    {i.is_enabled ? 'Active' : 'Disabled'}
                </Badge>
            )
        },
        {
            header: 'Updated',
            accessorKey: 'effective_from',
            cell: (i) => <span className="text-[10px] text-slate-500">{format(new Date(i.effective_from), 'MMM d')}</span>
        }
    ];

    return (
        <>
            <PricingPageHeader
                title="Guardrails"
                subtitle="Safety limits for pricing engine. Changes are versioned."
            />

            <DenseDataTable
                data={data}
                columns={columns}
                loading={loading}
                auditEntityBase="guardrails"
                actions={(item) => (
                    <Button
                        variant="ghost"
                        onClick={() => handleOpenRevision(item)}
                        className="w-full justify-start text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/20 h-8 px-2 text-xs"
                    >
                        <Shield className="w-3.5 h-3.5 mr-2" />
                        Revise Limits
                    </Button>
                )}
            />

            {/* Render Drawer Outside Table Context */}
            {selectedGuardrail && (
                <GuardrailRevisionDrawer
                    item={selectedGuardrail}
                    isOpen={isDrawerOpen}
                    onOpenChange={setIsDrawerOpen}
                    onSuccess={handleDrawerSuccess}
                />
            )}
        </>
    );
}

function GuardrailRevisionDrawer({
    item,
    isOpen,
    onOpenChange,
    onSuccess
}: {
    item: any,
    isOpen: boolean,
    onOpenChange: (open: boolean) => void,
    onSuccess: () => void
}) {
    const [reason, setReason] = useState('');
    const [confirmText, setConfirmText] = useState('');
    const [form, setForm] = useState({
        min: item.min_total,
        max: item.max_total,
        discount: item.max_discount_pct,
        surge: item.max_surge_pct,
        margin: item.floor_margin_pct
    });
    const [submitting, setSubmitting] = useState(false);

    // Reset form when item changes
    useEffect(() => {
        if (isOpen && item) {
            setForm({
                min: item.min_total,
                max: item.max_total,
                discount: item.max_discount_pct,
                surge: item.max_surge_pct,
                margin: item.floor_margin_pct
            });
            setReason('');
            setConfirmText('');
        }
    }, [item, isOpen]);

    // Validation
    const isMinTotalValid = Number(form.min) <= Number(form.max);
    const isConfirmed = confirmText.trim() === item.service_code;
    const isValid = reason.length > 5 && isConfirmed && isMinTotalValid;

    // Risk Checks
    const isRiskReduction = Number(form.max) < (Number(item.max_total) * 0.9); // Drop > 10%
    const isRiskHighDiscount = Number(form.discount) > 25;

    const handleSubmit = async () => {
        if (!isValid) return;
        setSubmitting(true);
        try {
            await PricingClient.createGuardrailRevision({
                city_id: item.city_id,
                service_code: item.service_code,
                min_total: Number(form.min),
                max_total: Number(form.max),
                max_discount_pct: Number(form.discount),
                max_surge_pct: Number(form.surge),
                floor_margin_pct: Number(form.margin),
                effective_from: new Date().toISOString(),
                reason,
                confirm_text: confirmText
            });
            onSuccess(); // Parent will close drawer
        } catch (err) {
            alert('Failed: ' + err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Drawer open={isOpen} onOpenChange={onOpenChange}>
            <DrawerContent className="bg-slate-950 border-slate-800 text-slate-200">
                <div className="mx-auto w-full max-w-5xl">
                    <DrawerHeader>
                        <DrawerTitle className="text-xl flex items-center gap-2">
                            <Shield className="w-5 h-5 text-violet-500" />
                            Revise Guardrails: {item.service_code}
                        </DrawerTitle>
                        <DrawerDescription className="text-slate-400">
                            Strict confirmation required. All changes generate an immutable audit log entry.
                        </DrawerDescription>
                    </DrawerHeader>

                    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {/* LEFT: Inputs */}
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Min Total (₹)</Label>
                                    <Input
                                        type="number"
                                        value={form.min}
                                        onChange={e => setForm({ ...form, min: e.target.value })}
                                        className={`bg-slate-900 border-slate-700 font-mono ${!isMinTotalValid ? 'border-red-500' : ''}`}
                                    />
                                    {!isMinTotalValid && <p className="text-[10px] text-red-500">Must be ≤ Max Total</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label>Max Total (₹)</Label>
                                    <Input
                                        type="number"
                                        value={form.max}
                                        onChange={e => setForm({ ...form, max: e.target.value })}
                                        className="bg-slate-900 border-slate-700 font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Max Discount (%)</Label>
                                    <Input
                                        type="number"
                                        value={form.discount}
                                        onChange={e => setForm({ ...form, discount: e.target.value })}
                                        className="bg-slate-900 border-slate-700 font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Max Surge (%)</Label>
                                    <Input
                                        type="number"
                                        value={form.surge}
                                        onChange={e => setForm({ ...form, surge: e.target.value })}
                                        className="bg-slate-900 border-slate-700 font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Floor Margin (%)</Label>
                                    <Input
                                        type="number"
                                        value={form.margin}
                                        onChange={e => setForm({ ...form, margin: e.target.value })}
                                        className="bg-slate-900 border-slate-700 font-mono"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-800">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2 text-amber-500">
                                        <AlertTriangle className="w-4 h-4" />
                                        Reason for Revision (Required)
                                    </Label>
                                    <Textarea
                                        placeholder="Explain why these safety limits are changing..."
                                        value={reason}
                                        onChange={e => setReason(e.target.value)}
                                        className="bg-slate-900 border-slate-700 h-20 resize-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Type <span className="font-mono text-violet-300 mx-1">{item.service_code}</span> to confirm</Label>
                                    <Input
                                        value={confirmText}
                                        onChange={e => setConfirmText(e.target.value)}
                                        placeholder={item.service_code}
                                        className="bg-slate-900 border-slate-700 font-mono text-center tracking-widest uppercase"
                                        onPaste={(e) => e.preventDefault()}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Preview & Risk */}
                        <div className="space-y-6">
                            <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-800">
                                <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Impact Analysis</h4>

                                <div className="grid grid-cols-3 gap-4 text-sm mb-6">
                                    <div className="text-slate-500">Metric</div>
                                    <div className="text-right text-slate-500">Current</div>
                                    <div className="text-right text-violet-400 font-bold">New</div>

                                    <div className="text-slate-400">Max Total</div>
                                    <div className="text-right font-mono">₹{item.max_total}</div>
                                    <div className="text-right font-mono">₹{form.max}</div>

                                    <div className="text-slate-400">Min Total</div>
                                    <div className="text-right font-mono">₹{item.min_total}</div>
                                    <div className="text-right font-mono">₹{form.min}</div>
                                </div>

                                {/* Risk Flags */}
                                {(isRiskReduction || isRiskHighDiscount) && (
                                    <div className="bg-amber-950/20 border border-amber-900/50 rounded p-3 space-y-2">
                                        <div className="flex items-center gap-2 text-amber-500 text-xs font-bold uppercase tracking-wide">
                                            <AlertTriangle className="w-3 h-3" /> Risk Warnings
                                        </div>
                                        {isRiskReduction && (
                                            <p className="text-xs text-amber-400/80">
                                                • Max Total reduced by &gt;10%. Check for blocked quotes.
                                            </p>
                                        )}
                                        {isRiskHighDiscount && (
                                            <p className="text-xs text-amber-400/80">
                                                • Max Discount &gt; 25%. Ensure margins are safe.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DrawerFooter className="border-t border-slate-800 pt-4">
                        <div className="flex justify-end gap-3 w-full max-w-5xl mx-auto">
                            <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-700 hover:bg-slate-800">Cancel</Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={submitting || !isValid}
                                className={`min-w-[150px] ${isValid ? 'bg-violet-600 hover:bg-violet-700' : 'bg-slate-800 text-slate-500'}`}
                            >
                                {submitting ? 'Committing...' : 'Confirm Revision'}
                            </Button>
                        </div>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
