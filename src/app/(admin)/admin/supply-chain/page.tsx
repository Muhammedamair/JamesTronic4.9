'use client';

import { useState, useEffect } from 'react';
import { supplyChainApi } from '@/lib/api/supply-chain';
import { StockoutAlert, ProcurementRecommendation } from '@/lib/types/supply-chain';
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
import { Factory, TrendingUp, AlertTriangle, ShoppingCart, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export default function SupplyChainDashboard() {
    const { toast } = useToast();
    const [alerts, setAlerts] = useState<StockoutAlert[]>([]);
    const [recommendations, setRecommendations] = useState<ProcurementRecommendation[]>([]);
    const [loading, setLoading] = useState(true);
    const [simulating, setSimulating] = useState(false);

    const fetchData = async () => {
        try {
            const [alertData, recData] = await Promise.all([
                supplyChainApi.getAlerts(),
                supplyChainApi.getRecommendations()
            ]);
            setAlerts(alertData);
            setRecommendations(recData);
        } catch (err) {
            console.error('Error fetching supply chain data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSimulate = async () => {
        setSimulating(true);
        try {
            // Fetch a real active store
            const stores = await supplyChainApi.getActiveStores();
            if (stores.length === 0) {
                toast({ title: 'No Active Stores', description: 'Please create a Dark Store first.', variant: 'destructive' });
                return;
            }

            await supplyChainApi.generateForecast(stores[0].id);
            toast({ title: 'Simulation Complete', description: `Forecast generated for ${stores[0].name}.` });
            fetchData();
        } catch (err) {
            console.error(err);
            toast({ title: 'Simulation Error', description: 'Failed to run forecast.', variant: 'destructive' });
        } finally {
            setSimulating(false);
        }
    };

    const handleApprove = async (id: string) => {
        try {
            await supplyChainApi.approveRecommendation(id);
            toast({ title: 'Approved', description: 'Procurement order created.' });
            fetchData();
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to approve', variant: 'destructive' });
        }
    };

    const getRiskBadge = (level: string) => {
        switch (level) {
            case 'critical': return <Badge variant="destructive" className="animate-pulse">CRITICAL</Badge>;
            case 'high': return <Badge variant="destructive">High</Badge>;
            case 'medium': return <Badge variant="secondary" className="text-orange-600">Medium</Badge>;
            default: return <Badge variant="outline">Low</Badge>;
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Supply Chain Brain</h1>
                    <p className="text-muted-foreground">AI-driven demand forecasting & smart procurement</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleSimulate} disabled={simulating}>
                        <TrendingUp className="w-4 h-4 mr-2" />
                        {simulating ? 'Processing...' : 'Run Forecast Simulation'}
                    </Button>
                    <Button variant="outline" onClick={fetchData}>
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Stockout Alerts</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{alerts.length}</div>
                        <p className="text-xs text-muted-foreground">items at risk</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{recommendations.length}</div>
                        <p className="text-xs text-muted-foreground">AI recommendations</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Forecast Accuracy</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">94%</div>
                        <p className="text-xs text-muted-foreground">last 30 days</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
                        <Factory className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">12</div>
                        <p className="text-xs text-muted-foreground">seasonality adjustments</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Alerts Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Stockout Risks</CardTitle>
                        <CardDescription>Predicted shortages in next 7 days</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Part ID</TableHead>
                                    <TableHead>Risk</TableHead>
                                    <TableHead>Stock / Demand</TableHead>
                                    <TableHead className="text-right">Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8">Loading...</TableCell>
                                    </TableRow>
                                ) : alerts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                            No active stockout risks.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    alerts.map((alert) => (
                                        <TableRow key={alert.id}>
                                            <TableCell className="font-mono text-xs">{alert.part_id.slice(0, 8)}...</TableCell>
                                            <TableCell>{getRiskBadge(alert.risk_level)}</TableCell>
                                            <TableCell>
                                                <span className="text-red-600 font-bold">{alert.current_stock}</span>
                                                <span className="text-muted-foreground mx-1">/</span>
                                                <span>{alert.predicted_demand_next_7_days}</span>
                                            </TableCell>
                                            <TableCell className="text-right text-xs">
                                                {alert.predicted_stockout_date ? format(new Date(alert.predicted_stockout_date), 'MMM d') : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Recommendations Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Procurement Suggestions</CardTitle>
                        <CardDescription>AI-recommended purchase orders</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Part</TableHead>
                                    <TableHead>Qty</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8">Loading...</TableCell>
                                    </TableRow>
                                ) : recommendations.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                            No pending recommendations.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    recommendations.map((rec) => (
                                        <TableRow key={rec.id}>
                                            <TableCell className="font-mono text-xs">{rec.part_id.slice(0, 8)}...</TableCell>
                                            <TableCell className="font-bold">{rec.recommended_quantity}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate" title={rec.reason || ''}>
                                                {rec.reason}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-600" onClick={() => handleApprove(rec.id)}>
                                                    <CheckCircle2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
