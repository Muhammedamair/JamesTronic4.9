'use client';

import { useState, useEffect } from 'react';
import { darkStoreApi } from '@/lib/api/dark-store';
import { Bin, StoreMetrics, TechnicianQueue } from '@/lib/types/dark-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Package, Users, Activity, Layers, ArrowRight } from 'lucide-react';
import { useSupabase } from '@/components/shared/supabase-provider';

export default function DarkStorePage() {
    const { toast } = useToast();
    const { supabase } = useSupabase(); // For quick branch fetch
    const [branches, setBranches] = useState<{ id: string, name: string }[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string>('');

    const [bins, setBins] = useState<Bin[]>([]);
    const [metrics, setMetrics] = useState<StoreMetrics | null>(null);
    const [queues, setQueues] = useState<TechnicianQueue[]>([]);
    const [loading, setLoading] = useState(false);

    // Load Branches
    useEffect(() => {
        const loadBranches = async () => {
            const { data } = await supabase.from('branches').select('id, name').limit(10);
            if (data && data.length > 0) {
                setBranches(data);
                setSelectedBranchId(data[0].id);
            }
        };
        loadBranches();
    }, [supabase]);

    // Load Store Data
    useEffect(() => {
        if (!selectedBranchId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const [b, m, q] = await Promise.all([
                    darkStoreApi.getBins(selectedBranchId),
                    darkStoreApi.getStoreMetrics(selectedBranchId),
                    darkStoreApi.getQueues(selectedBranchId)
                ]);
                setBins(b);
                setMetrics(m);
                setQueues(q);
            } catch (err) {
                console.error(err);
                toast({ title: 'Error', description: 'Failed to load store data', variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedBranchId, toast]);

    const handleAutoAssign = async () => {
        if (!selectedBranchId) return;
        try {
            const bin = await darkStoreApi.autoAssignBin(selectedBranchId, 'standard');
            if (bin) {
                toast({ title: 'Bin Assigned', description: `Item routed to ${bin.bin_code}` });
            } else {
                toast({ title: 'Store Full', description: 'No suitable bins available.', variant: 'destructive' });
            }
        } catch (err) {
            toast({ title: 'Error', description: 'Assignment failed', variant: 'destructive' });
        }
    };

    const getBinColor = (status: string) => {
        switch (status) {
            case 'full': return 'bg-red-500';
            case 'partial': return 'bg-yellow-500';
            case 'empty': return 'bg-green-500';
            default: return 'bg-slate-300';
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dark Store Operations</h1>
                    <p className="text-muted-foreground">Warehouse Automation V2</p>
                </div>

                <div className="w-[200px]">
                    <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Store" />
                        </SelectTrigger>
                        <SelectContent>
                            {branches.map(b => (
                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {metrics && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-6 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Bins</p>
                                <h2 className="text-2xl font-bold">{metrics.total_bins}</h2>
                            </div>
                            <Layers className="h-8 w-8 text-slate-400" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Utilization</p>
                                <h2 className="text-2xl font-bold">{metrics.utilization}%</h2>
                            </div>
                            <Activity className="h-8 w-8 text-blue-500" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Active Techs</p>
                                <h2 className="text-2xl font-bold">{metrics.active_techs}</h2>
                            </div>
                            <Users className="h-8 w-8 text-purple-500" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Queue Depth</p>
                                <h2 className="text-2xl font-bold">{metrics.queue_depth}</h2>
                            </div>
                            <Package className="h-8 w-8 text-orange-500" />
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Bin Grid */}
                <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Storage Matrix</CardTitle>
                        <div className="flex gap-2">
                            <Badge variant="outline" className="bg-green-500 text-white border-0">Empty</Badge>
                            <Badge variant="outline" className="bg-yellow-500 text-white border-0">Partial</Badge>
                            <Badge variant="outline" className="bg-red-500 text-white border-0">Full</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {bins.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">No bins configured. Run migrations/seed.</div>
                        ) : (
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                                {bins.map(bin => (
                                    <div key={bin.id} className={`
                                  aspect-square rounded-lg flex flex-col items-center justify-center text-white font-bold text-xs p-1 shadow-sm
                                  ${getBinColor(bin.status)}
                              `}>
                                        <span>{bin.bin_code}</span>
                                        <span className="text-[10px] font-normal opacity-80">{bin.current_load_units}/{bin.capacity_units}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mt-6 flex justify-end">
                            <Button onClick={handleAutoAssign}>
                                <Package className="mr-2 h-4 w-4" /> Simulate Inflow (Auto-Assign)
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Technician Queues */}
                <Card>
                    <CardHeader>
                        <CardTitle>Technician Queues</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {queues.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground">No active technicians in this store.</div>
                        ) : (
                            <div className="space-y-4">
                                {queues.map(q => (
                                    <div key={q.id} className="flex flex-col space-y-2 border-b pb-3 last:border-0">
                                        <div className="flex justify-between font-medium">
                                            <span>{q.technician_name}</span>
                                            <Badge variant="secondary">{q.status}</Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Package className="h-4 w-4" />
                                            <span>{q.current_ticket_count} items in queue</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500"
                                                style={{ width: `${Math.min(q.current_ticket_count * 10, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
