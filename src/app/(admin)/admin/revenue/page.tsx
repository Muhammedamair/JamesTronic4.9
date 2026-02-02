'use client';

import { useState, useEffect } from 'react';
import { revenueApi } from '@/lib/api/revenue';
import { LeakageAlert } from '@/lib/types/revenue';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ShieldAlert, CheckCircle, Search, AlertOctagon, TrendingDown, IndianRupee
} from 'lucide-react';
import { useSupabase } from '@/components/shared/supabase-provider';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

export default function RevenueDashboard() {
    const { toast } = useToast();
    const { user } = useSupabase();
    const [alerts, setAlerts] = useState<LeakageAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [simulating, setSimulating] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await revenueApi.getAlerts();
            setAlerts(data);
        } catch (err) {
            console.error('Error fetching revenue alerts:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    const handleSimulateLeakage = async () => {
        setSimulating(true);
        try {
            // Use a valid V4 UUID for simulation.
            const dummyTicketId = '00000000-0000-4000-8000-000000000001';

            const result = await revenueApi.runSimulation(dummyTicketId);

            toast({
                title: 'Leakage Detected!',
                description: 'The Shield has blocked a potential loss.',
            });

            fetchData();
        } catch (err) {
            console.error(err);
            toast({ title: 'Simulation Error', description: 'Failed to run simulation.', variant: 'destructive' });
        } finally {
            setSimulating(false);
        }
    };

    const handleResolve = async (id: string) => {
        try {
            await revenueApi.resolveAlert(id, 'Resolved by Admin via Dashboard');
            toast({ title: 'Resolved', description: 'Alert marked as handled.' });
            fetchData();
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to resolve.', variant: 'destructive' });
        }
    };

    const getSeverityBadge = (severity: string) => {
        switch (severity) {
            case 'critical': return <Badge variant="destructive" className="bg-red-600">CRITICAL</Badge>;
            case 'high': return <Badge variant="destructive" className="bg-orange-600">HIGH</Badge>;
            case 'medium': return <Badge className="bg-yellow-500 text-black">MEDIUM</Badge>;
            case 'low': return <Badge variant="secondary">LOW</Badge>;
            default: return <Badge variant="outline">{severity}</Badge>;
        }
    };

    const totalLoss = alerts.filter(a => a.status !== 'resolved').reduce((acc, curr) => acc + curr.estimated_loss_amount, 0);

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Revenue Shield</h1>
                    <p className="text-muted-foreground">Leakage detection & financial integrity</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="destructive" onClick={handleSimulateLeakage} disabled={simulating}>
                        <AlertOctagon className="w-4 h-4 mr-2" />
                        {simulating ? 'Scanning...' : 'Simulate Leakage'}
                    </Button>
                    <Button variant="outline" onClick={fetchData}>
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-red-600">Potential Loss Detected</p>
                            <h3 className="text-2xl font-bold text-red-900 flex items-center">
                                <IndianRupee className="w-5 h-5 mr-1" />
                                {totalLoss.toLocaleString()}
                            </h3>
                        </div>
                        <TrendingDown className="h-8 w-8 text-red-500" />
                    </CardContent>
                </Card>
            </div>

            {loading ? (
                <div>Loading alerts...</div>
            ) : (
                <div className="grid gap-4">
                    <h2 className="text-lg font-semibold">Active Alerts</h2>
                    {alerts.length === 0 ? (
                        <div className="text-center p-12 border rounded-lg bg-slate-50 text-muted-foreground">
                            <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-green-500" />
                            <h3 className="text-lg font-medium text-slate-900">System Secure</h3>
                            <p>No revenue leakage detected.</p>
                        </div>
                    ) : (
                        alerts.map(alert => (
                            <Card key={alert.id} className={alert.status === 'resolved' ? 'opacity-60 bg-slate-50' : ''}>
                                <CardContent className="p-6 flex flex-col md:flex-row gap-4 items-start md:items-center">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            {getSeverityBadge(alert.severity)}
                                            <span className="text-xs text-muted-foreground uppercase tracking-wider">{alert.status}</span>
                                            <span className="text-xs text-muted-foreground">• {format(new Date(alert.detected_at), 'MMM d, h:mm a')}</span>
                                        </div>
                                        <h3 className="font-semibold text-lg flex items-center gap-2">
                                            {alert.rule?.name || 'Unknown Anomaly'}
                                            <Badge variant="outline" className="font-mono text-red-600 border-red-200 bg-red-50">
                                                -₹{alert.estimated_loss_amount}
                                            </Badge>
                                        </h3>
                                        <p className="text-sm text-muted-foreground">{alert.rule?.description}</p>
                                    </div>

                                    {alert.status !== 'resolved' && (
                                        <Button size="sm" onClick={() => handleResolve(alert.id)} className="bg-green-600 hover:bg-green-700">
                                            <CheckCircle className="w-4 h-4 mr-2" />
                                            Resolve
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
