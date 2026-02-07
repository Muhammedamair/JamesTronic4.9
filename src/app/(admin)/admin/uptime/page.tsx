'use client';

import { useState, useEffect } from 'react';
import { uptimeApi } from '@/lib/api/uptime';
import { Monitor, SystemIncident } from '@/lib/types/uptime';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Activity, Server, Database, Cloud, Shield, CheckCircle, AlertTriangle, XCircle
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function UptimeDashboard() {
    const { toast } = useToast();
    const [monitors, setMonitors] = useState<Monitor[]>([]);
    const [incidents, setIncidents] = useState<SystemIncident[]>([]);
    const [loading, setLoading] = useState(true);

    // Poll for status every 10s
    const fetchData = async () => {
        try {
            const [m, i] = await Promise.all([
                uptimeApi.getSystemHealth(),
                uptimeApi.getIncidents()
            ]);
            setMonitors(m);
            setIncidents(i);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'operational': return 'bg-green-500';
            case 'degraded': return 'bg-yellow-500';
            case 'down': return 'bg-red-500';
            default: return 'bg-slate-500';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'operational': return <CheckCircle className="h-5 w-5 text-green-500" />;
            case 'degraded': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
            case 'down': return <XCircle className="h-5 w-5 text-red-500" />;
            default: return <Activity className="h-5 w-5 text-slate-500" />;
        }
    };

    // Simulation Button
    const handleSimulateOutage = async () => {
        if (monitors.length === 0) return;
        const dbMonitor = monitors.find(m => m.type === 'database') || monitors[0];

        try {
            await uptimeApi.simultateHeartbeat(dbMonitor.id, 'degraded', 4500);
            toast({ title: 'Chaos Monkey Activated', description: 'Simulated latency spike on Database.' });
            fetchData();
        } catch (err) {
            toast({ title: 'Error', description: 'Sim failed', variant: 'destructive' });
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">System Status</h1>
                    <p className="text-muted-foreground">Uptime & Reliability Engine</p>
                </div>
                <Button variant="outline" onClick={handleSimulateOutage}>
                    Simulate Incident
                </Button>
            </div>

            {/* Global Status Banner */}
            <div className="p-6 rounded-xl bg-green-50 border border-green-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                        <Activity className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-green-800">All Systems Operational</h2>
                        <p className="text-green-600">99.99% Uptime in last 24h</p>
                    </div>
                </div>
                <div className="text-3xl font-mono font-bold text-green-700">99.99%</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {monitors.map((m) => (
                    <Card key={m.id} className="border-l-4" style={{ borderLeftColor: m.current_status === 'operational' ? '#22c55e' : '#eab308' }}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {m.name}
                            </CardTitle>
                            {getStatusIcon(m.current_status)}
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold capitalize">{m.current_status}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Latency: {m.last_latency_ms}ms
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Incident History */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Incidents</CardTitle>
                </CardHeader>
                <CardContent>
                    {incidents.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">No incidents reported recently. Clean sheet!</div>
                    ) : (
                        <div className="space-y-4">
                            {incidents.map(i => (
                                <div key={i.id} className="flex justify-between items-center border-b pb-4 last:border-0">
                                    <div>
                                        <div className="font-semibold">{i.title}</div>
                                        <div className="text-sm text-slate-500">{i.description}</div>
                                    </div>
                                    <Badge variant={i.status === 'resolved' ? 'outline' : 'destructive'}>
                                        {i.status}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
