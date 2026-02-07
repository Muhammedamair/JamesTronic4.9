'use client';

import { useState, useEffect } from 'react';
import { fraudApi } from '@/lib/api/fraud';
import { FraudAlert, ActorRiskScore, SuspensionRecord } from '@/lib/types/fraud';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell
} from '@/components/ui/table';
import { AlertTriangle, Shield, Eye, UserX, Activity, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export default function FraudDashboard() {
    const { toast } = useToast();
    const [alerts, setAlerts] = useState<FraudAlert[]>([]);
    const [riskScores, setRiskScores] = useState<ActorRiskScore[]>([]);
    const [suspensions, setSuspensions] = useState<SuspensionRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const [alertData, riskData, suspensionData] = await Promise.all([
                    fraudApi.getFraudAlerts(),
                    fraudApi.getHighRiskActors(),
                    fraudApi.getActiveSuspensions()
                ]);
                setAlerts(alertData);
                setRiskScores(riskData);
                setSuspensions(suspensionData);
            } catch (err) {
                console.error('Error fetching fraud data:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const handleAcknowledge = async (id: string) => {
        try {
            await fraudApi.acknowledgeAlert(id);
            setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_acknowledged: true } : a));
            toast({ title: 'Alert Acknowledged' });
        } catch (err) {
            console.error(err);
        }
    };

    const handleResolve = async (id: string) => {
        try {
            await fraudApi.resolveAlert(id, 'Manually resolved');
            setAlerts(prev => prev.filter(a => a.id !== id));
            toast({ title: 'Alert Resolved' });
        } catch (err) {
            console.error(err);
        }
    };

    const getSeverityBadge = (severity: string) => {
        switch (severity) {
            case 'critical':
                return <Badge variant="destructive">CRITICAL</Badge>;
            case 'high':
                return <Badge className="bg-orange-500">HIGH</Badge>;
            case 'medium':
                return <Badge className="bg-yellow-500">MEDIUM</Badge>;
            default:
                return <Badge variant="secondary">LOW</Badge>;
        }
    };

    const getRiskTierBadge = (tier: string) => {
        switch (tier) {
            case 'critical':
                return <Badge variant="destructive">Critical</Badge>;
            case 'high':
                return <Badge className="bg-orange-500">High</Badge>;
            case 'medium':
                return <Badge className="bg-yellow-500">Medium</Badge>;
            default:
                return <Badge className="bg-green-600">Low</Badge>;
        }
    };

    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    const highAlerts = alerts.filter(a => a.severity === 'high').length;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Fraud Intelligence</h1>
                    <p className="text-muted-foreground">AI-powered fraud detection & risk monitoring</p>
                </div>
                <Button variant="outline">
                    <Activity className="w-4 h-4 mr-2" /> Run Full Scan
                </Button>
            </div>

            {/* Critical Alert Banner */}
            {criticalAlerts > 0 && (
                <Card className="border-red-300 bg-red-50/50">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                            <div>
                                <div className="font-bold text-red-900">
                                    {criticalAlerts} Critical Alert{criticalAlerts > 1 ? 's' : ''} Require Immediate Attention
                                </div>
                                <div className="text-sm text-red-700">Review and take action on high-priority fraud indicators</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{alerts.length}</div>
                        <p className="text-xs text-muted-foreground">{criticalAlerts} critical, {highAlerts} high</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">High-Risk Actors</CardTitle>
                        <Shield className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{riskScores.length}</div>
                        <p className="text-xs text-muted-foreground">require monitoring</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Suspensions</CardTitle>
                        <UserX className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{suspensions.length}</div>
                        <p className="text-xs text-muted-foreground">pending review</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Detection Rate</CardTitle>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">97%</div>
                        <p className="text-xs text-muted-foreground">model accuracy</p>
                    </CardContent>
                </Card>
            </div>

            {/* Fraud Alerts Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Active Fraud Alerts</CardTitle>
                    <CardDescription>Unresolved alerts requiring investigation</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Severity</TableHead>
                                <TableHead>Alert Type</TableHead>
                                <TableHead>Actor</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Risk Score</TableHead>
                                <TableHead>Detected</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                                </TableRow>
                            ) : alerts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <CheckCircle className="w-8 h-8 text-green-500" />
                                            No active fraud alerts. System is clean.
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                alerts.slice(0, 10).map((alert) => (
                                    <TableRow key={alert.id}>
                                        <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                                        <TableCell className="capitalize">{alert.alert_type.replace(/_/g, ' ')}</TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                <div>{alert.actor_name || 'Unknown'}</div>
                                                <div className="text-muted-foreground capitalize">{alert.actor_type}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate">{alert.title}</TableCell>
                                        <TableCell>
                                            <Badge variant={alert.risk_score >= 70 ? 'destructive' : 'secondary'}>
                                                {alert.risk_score}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{format(new Date(alert.detected_at), 'MMM d, HH:mm')}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                {!alert.is_acknowledged && (
                                                    <Button size="sm" variant="outline" onClick={() => handleAcknowledge(alert.id)}>
                                                        Acknowledge
                                                    </Button>
                                                )}
                                                <Button size="sm" variant="ghost" onClick={() => handleResolve(alert.id)}>
                                                    Resolve
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* High Risk Actors */}
            {riskScores.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>High-Risk Actors</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {riskScores.slice(0, 6).map((actor) => (
                                <div key={actor.id} className="border rounded-lg p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="font-medium">{actor.actor_name || 'Unknown Actor'}</div>
                                            <div className="text-sm text-muted-foreground capitalize">{actor.actor_type}</div>
                                        </div>
                                        {getRiskTierBadge(actor.risk_tier)}
                                    </div>
                                    <div className="text-3xl font-bold mb-2">{actor.composite_risk_score}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {actor.unresolved_alerts} unresolved alerts
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
