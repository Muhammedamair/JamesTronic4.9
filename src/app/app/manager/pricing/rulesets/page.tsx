'use client';

import React, { useState, useEffect } from 'react';
import { PricingPageHeader } from '@/components/pricing/PricingPageHeader';
import { DenseDataTable, ColumnDef } from '@/components/pricing/DenseDataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { FileJson, Power, Shield, AlertTriangle } from 'lucide-react';
import { useSupabase } from '@/components/shared/supabase-provider';
import { RulesetViewer } from '@/components/pricing/RulesetViewer';
import { toast } from 'sonner';

export default function RulesetsPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { user, userRole } = useSupabase();

    // Drawer State
    const [selectedRuleset, setSelectedRuleset] = useState<any>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Activation Form State
    const [showActivationForm, setShowActivationForm] = useState(false);

    const isAdmin = ['admin', 'super_admin'].includes(userRole || '');

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/pricing/rulesets');
            const json = await res.json();
            if (json.data) {
                setData(json.data);
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

    const handleOpenViewer = (item: any) => {
        setSelectedRuleset(item);
        setShowActivationForm(false);
        setIsDrawerOpen(true);
    };

    const handleOpenActivate = (item: any) => {
        setSelectedRuleset(item);
        setShowActivationForm(true);
        setIsDrawerOpen(true);
    };

    const handleSuccess = () => {
        setIsDrawerOpen(false);
        loadData();
    };

    const columns: ColumnDef<any>[] = [
        {
            header: 'Version',
            accessorKey: 'version',
            className: 'font-mono text-violet-300',
            cell: (i) => (
                <div className="flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-slate-500" />
                    <span>{i.version}</span>
                </div>
            )
        },
        {
            header: 'Status',
            accessorKey: 'is_active',
            cell: (i) => (
                <Badge variant="outline" className={i.is_active ? 'text-emerald-500 border-emerald-900 bg-emerald-950/20' : 'text-slate-500 border-slate-800'}>
                    {i.is_active ? 'Active' : 'Archived'}
                </Badge>
            )
        },
        {
            header: 'Created',
            accessorKey: 'created_at',
            cell: (i) => <span className="text-[10px] text-slate-500">{format(new Date(i.created_at), 'MMM d, yyyy')}</span>
        },
        {
            header: 'Activated At',
            accessorKey: 'activated_at',
            cell: (i) => i.activated_at ? (
                <span className="text-[10px] text-slate-500">{format(new Date(i.activated_at), 'MMM d HH:mm')}</span>
            ) : <span className="text-[10px] text-slate-700">-</span>
        }
    ];

    return (
        <>
            <PricingPageHeader
                title="Rulesets"
                subtitle="Global pricing logic versions. Only Admins can activate."
            />

            <DenseDataTable
                data={data}
                columns={columns}
                loading={loading}
                auditEntityBase="rulesets"
                actions={(item) => [
                    {
                        label: 'View JSON',
                        icon: FileJson,
                        onClick: (i) => handleOpenViewer(i),
                        className: 'text-slate-400 focus:text-white'
                    },
                    {
                        label: 'Activate',
                        icon: Power,
                        onClick: (i) => handleOpenActivate(i),
                        className: 'text-amber-500 focus:text-amber-400 focus:bg-amber-950/20',
                        show: (i) => isAdmin && !i.is_active
                    }
                ]}
            />

            {/* Ruleset Detail Drawer */}
            {selectedRuleset && (
                <RulesetDrawer
                    item={selectedRuleset}
                    isOpen={isDrawerOpen}
                    onOpenChange={setIsDrawerOpen}
                    isActivationMode={showActivationForm}
                    onSuccess={handleSuccess}
                />
            )}
        </>
    );
}

function RulesetDrawer({
    item,
    isOpen,
    onOpenChange,
    isActivationMode,
    onSuccess
}: {
    item: any,
    isOpen: boolean,
    onOpenChange: (open: boolean) => void,
    isActivationMode: boolean,
    onSuccess: () => void
}) {
    const [reason, setReason] = useState('');
    const [confirmText, setConfirmText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Reset
    useEffect(() => {
        if (isOpen) {
            setReason('');
            setConfirmText('');
        }
    }, [isOpen]);

    const isValid = reason.length >= 5 && confirmText.trim() === 'ACTIVATE';

    const handleActivate = async () => {
        if (!isValid) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/pricing/rulesets/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: item.id,
                    version: item.version,
                    confirm_text: confirmText,
                    reason
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Activation failed');
            }

            toast.success(`Ruleset ${item.version} Activated`);
            onSuccess();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Drawer open={isOpen} onOpenChange={onOpenChange}>
            <DrawerContent className="bg-slate-950 border-slate-800 text-slate-200">
                <div className="mx-auto w-full max-w-5xl h-[80vh] flex flex-col">
                    <DrawerHeader>
                        <DrawerTitle className="text-xl flex items-center gap-2">
                            {isActivationMode ? (
                                <><Power className="w-5 h-5 text-amber-500" /> Activate Ruleset {item.version}</>
                            ) : (
                                <><FileJson className="w-5 h-5 text-violet-500" /> View Ruleset {item.version}</>
                            )}
                        </DrawerTitle>
                        <DrawerDescription className="text-slate-400">
                            {isActivationMode
                                ? "WARNING: Activating this ruleset will immediately affect all pricing calculations."
                                : "Read-only view of ruleset logic."}
                        </DrawerDescription>
                    </DrawerHeader>

                    <div className="p-6 flex-1 overflow-hidden flex flex-col lg:flex-row gap-8">
                        {/* JSON Viewer (Always Visible) */}
                        <div className="flex-1 overflow-auto">
                            <Label className="mb-2 block text-slate-400">Rules Definition</Label>
                            <RulesetViewer rules={item.rules} className="h-full max-h-[500px]" />
                        </div>

                        {/* Activation Form (Conditional) */}
                        {isActivationMode && (
                            <div className="w-full lg:w-1/3 space-y-6 bg-slate-900/50 p-6 rounded-lg border border-slate-800 h-fit">
                                <div className="space-y-4">
                                    <div className="bg-amber-950/20 border border-amber-900/50 rounded p-3 text-amber-500 text-xs">
                                        <AlertTriangle className="w-4 h-4 mb-1" />
                                        This action is irreversible via UI (must activate another to switch back).
                                        Audit log will be generated.
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Reason for Activation</Label>
                                        <Textarea
                                            placeholder="Why are we switching to this version?"
                                            value={reason}
                                            onChange={e => setReason(e.target.value)}
                                            className="bg-slate-900 border-slate-700 h-24 resize-none"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Type <span className="font-mono text-amber-500 mx-1">ACTIVATE</span> to confirm</Label>
                                        <Input
                                            value={confirmText}
                                            onChange={e => setConfirmText(e.target.value)}
                                            placeholder="ACTIVATE"
                                            className="bg-slate-900 border-slate-700 font-mono text-center tracking-widest focus:border-amber-500"
                                            onPaste={(e) => e.preventDefault()}
                                        />
                                    </div>

                                    <Button
                                        onClick={handleActivate}
                                        disabled={submitting || !isValid}
                                        className={`w-full ${isValid ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-800 text-slate-500'}`}
                                    >
                                        {submitting ? 'Activating...' : 'Confirm Activation'}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <DrawerFooter className="border-t border-slate-800 pt-4">
                        <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full md:w-auto ml-auto border-slate-700 hover:bg-slate-800">
                            Close
                        </Button>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
