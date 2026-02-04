'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { dealerApi } from '@/lib/api/dealer';
import { Dealer, DealerScoreSnapshot, DealerAlert, PartOrder } from '@/lib/types/dealer';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
    Building2, Phone, Mail, MapPin, ShieldCheck, Clock, AlertTriangle, RefreshCw, Package
} from 'lucide-react';
import { format } from 'date-fns';

export default function DealerDetailPage() {
    const params = useParams();
    const dealerId = params.id as string;

    const [dealer, setDealer] = useState<Dealer | null>(null);
    const [score, setScore] = useState<DealerScoreSnapshot | null>(null);
    const [alerts, setAlerts] = useState<DealerAlert[]>([]);
    const [orders, setOrders] = useState<PartOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [recalculating, setRecalculating] = useState(false);

    useEffect(() => {
        async function fetchData() {
            try {
                const [dealerData, scoreData, alertsData, ordersData] = await Promise.all([
                    dealerApi.getDealerById(dealerId),
                    dealerApi.getDealerScore(dealerId),
                    dealerApi.getDealerAlerts(dealerId),
                    dealerApi.getOrders() // Ideally filter by dealer
                ]);
                setDealer(dealerData);
                setScore(scoreData);
                setAlerts(alertsData);
                setOrders(ordersData.filter(o => o.dealer_id === dealerId));
            } catch (err) {
                console.error('Error fetching dealer:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [dealerId]);

    const handleRecalculateScore = async () => {
        setRecalculating(true);
        try {
            await dealerApi.calculateDealerScore(dealerId);
            const newScore = await dealerApi.getDealerScore(dealerId);
            setScore(newScore);
        } catch (err) {
            console.error('Error recalculating score:', err);
        } finally {
            setRecalculating(false);
        }
    };

    if (loading) {
        return <div className="p-6 animate-pulse"><div className="h-8 bg-muted rounded w-1/3" /></div>;
    }

    if (!dealer) {
        return <div className="p-6 text-center text-muted-foreground">Dealer not found.</div>;
    }

    const getScoreColor = (value: number) => {
        if (value >= 90) return 'text-green-600';
        if (value >= 75) return 'text-yellow-600';
        return 'text-red-600';
    };

    // Helper to safely extract metrics
    const getMetric = (key: string): number => {
        if (!score?.metrics_snapshot) return 0;
        const val = score.metrics_snapshot[key];
        return typeof val === 'number' ? val : 0;
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{dealer.name}</h1>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        {dealer.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {dealer.city}</span>}
                        {dealer.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {dealer.phone}</span>}
                        {dealer.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {dealer.email}</span>}
                    </div>
                </div>
                <Badge variant={dealer.status === 'active' ? 'default' : 'secondary'}>
                    {dealer.status.toUpperCase()}
                </Badge>
            </div>

            {/* Alerts */}
            {alerts.length > 0 && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Active Alerts ({alerts.length})</AlertTitle>
                    <AlertDescription>
                        {alerts.slice(0, 2).map(a => a.title).join(', ')}
                    </AlertDescription>
                </Alert>
            )}

            {/* Score Card */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Reliability Score</CardTitle>
                        <CardDescription>Last updated: {score ? format(new Date(score.computed_at), 'MMM d, HH:mm') : 'Never'}</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleRecalculateScore} disabled={recalculating}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
                        Recalculate
                    </Button>
                </CardHeader>
                <CardContent>
                    {score ? (
                        <div className="space-y-6">
                            <div className="flex justify-center">
                                <div className={`text-6xl font-black ${getScoreColor(score.reliability_score || 0)}`}>
                                    {score.reliability_score || 0}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div className="bg-muted/50 p-3 rounded-lg text-center">
                                    <div className="text-xs text-muted-foreground mb-1">Availability</div>
                                    <div className="font-bold text-lg">{getMetric('availability_score')}%</div>
                                </div>
                                <div className="bg-muted/50 p-3 rounded-lg text-center">
                                    <div className="text-xs text-muted-foreground mb-1">Delivery Speed</div>
                                    <div className="font-bold text-lg">{getMetric('delivery_speed_score')}%</div>
                                </div>
                                <div className="bg-muted/50 p-3 rounded-lg text-center">
                                    <div className="text-xs text-muted-foreground mb-1">Quality</div>
                                    <div className="font-bold text-lg">{getMetric('quality_score')}%</div>
                                </div>
                                <div className="bg-muted/50 p-3 rounded-lg text-center">
                                    <div className="text-xs text-muted-foreground mb-1">Pricing</div>
                                    <div className="font-bold text-lg">{getMetric('pricing_compliance_score')}%</div>
                                </div>
                                <div className="bg-muted/50 p-3 rounded-lg text-center">
                                    <div className="text-xs text-muted-foreground mb-1">Fraud Risk</div>
                                    <div className="font-bold text-lg">{getMetric('fraud_risk_score')}%</div>
                                </div>
                            </div>
                            <div className="text-center text-sm text-muted-foreground">
                                Based on {getMetric('orders_total')} orders ({getMetric('orders_fulfilled')} fulfilled) in the last {score.window_days} days.
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            No score calculated yet. Click "Recalculate" to generate.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Recent Orders */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="w-4 h-4" /> Recent Orders
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {orders.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">No orders yet.</div>
                    ) : (
                        <div className="space-y-3">
                            {orders.slice(0, 5).map(order => (
                                <div key={order.id} className="flex justify-between items-center border-b pb-2">
                                    <div>
                                        <span className="font-mono text-xs">{order.id.slice(0, 8)}</span>
                                        <div className="text-sm text-muted-foreground">
                                            {format(new Date(order.ordered_at), 'MMM d, yyyy HH:mm')}
                                        </div>
                                    </div>
                                    <Badge variant={order.order_status === 'delivered' ? 'default' : 'secondary'}>
                                        {order.order_status}
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
