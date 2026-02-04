'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell
} from '@/components/ui/table';
import {
    LineChart,
    BarChart3,
    ArrowLeft,
    Box,
    History,
    AlertTriangle,
    RefreshCw
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function PartDeepDivePage() {
    const params = useParams();
    const partId = params.id as string;

    // State
    const [part, setPart] = useState<any>(null);
    const [forecasts, setForecasts] = useState<any[]>([]);
    const [stock, setStock] = useState<any[]>([]);
    const [ledger, setLedger] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const supabase = createClient();

    useEffect(() => {
        async function loadPartData() {
            if (!partId) return;
            setLoading(true);

            try {
                // 1. Part Details
                const { data: partData } = await supabase
                    .from('inventory_parts')
                    .select('*')
                    .eq('id', partId)
                    .single();
                setPart(partData);

                // 2. Forecast Snapshots (Latest per window)
                const { data: forecastData } = await supabase
                    .from('inventory_forecast_snapshots')
                    .select('*')
                    .eq('part_id', partId)
                    .order('created_at', { ascending: false })
                    .limit(3); // Get latest for 7/30/90
                setForecasts(forecastData || []);

                // 3. Current Stock by Location
                const { data: stockData } = await supabase
                    .from('inventory_stock_current')
                    .select(`
                        *,
                        inventory_locations (name)
                    `)
                    .eq('part_id', partId);
                setStock(stockData || []);

                // 4. Recent Ledger Movements
                const { data: ledgerData } = await supabase
                    .from('inventory_stock_ledger')
                    .select(`
                        id,
                        qty_change,
                        event_type,
                        created_at,
                        inventory_locations (name)
                    `)
                    .eq('part_id', partId)
                    .order('created_at', { ascending: false })
                    .limit(10);
                setLedger(ledgerData || []);

                // 5. Active Alerts
                const { data: alertData } = await supabase
                    .from('inventory_alerts')
                    .select('*')
                    .eq('part_id', partId)
                    .is('resolved_at', null);
                setAlerts(alertData || []);

            } catch (err) {
                console.error('Error loading part data:', err);
            } finally {
                setLoading(false);
            }
        }

        loadPartData();
    }, [partId, supabase]);

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading part intelligence...</div>;
    }

    if (!part) {
        return <div className="p-8 text-center font-bold text-red-500">Part not found</div>;
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/admin/inventory">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{part.name}</h1>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline" className="font-mono">{part.sku || part.id.slice(0, 8)}</Badge>
                        <span>•</span>
                        <span>{part.category || 'Uncategorized'}</span>
                    </div>
                </div>
            </div>

            {/* Top Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
                        <Box className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stock.reduce((sum, s) => sum + s.current_stock, 0)}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{alerts.length}</div>
                    </CardContent>
                </Card>

                {/* 7d Forecast Summary */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Next 7 Days Demand</CardTitle>
                        <LineChart className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {Math.round(forecasts.find(f => f.window_days === 7)?.forecast_qty || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Confidence: {forecasts.find(f => f.window_days === 7)?.confidence_score || 0}%
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="stock" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="stock">Current Stock</TabsTrigger>
                    <TabsTrigger value="forecast">Forecast Analysis</TabsTrigger>
                    <TabsTrigger value="ledger">Recent History</TabsTrigger>
                </TabsList>

                {/* CURRENT STOCK */}
                <TabsContent value="stock">
                    <Card>
                        <CardHeader>
                            <CardTitle>Stock by Location</CardTitle>
                            <CardDescription>
                                Real-time inventory levels across all active hubs
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Location</TableHead>
                                        <TableHead>On Hand</TableHead>
                                        <TableHead>Safety Stock</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stock.map(s => {
                                        const locationName = s.inventory_locations?.name || s.location_id;
                                        const isLow = s.current_stock <= s.safety_stock;
                                        return (
                                            <TableRow key={s.id}>
                                                <TableCell className="font-medium">{locationName}</TableCell>
                                                <TableCell>{s.current_stock}</TableCell>
                                                <TableCell>{s.safety_stock}</TableCell>
                                                <TableCell>
                                                    {isLow ? (
                                                        <Badge variant="destructive">Low</Badge>
                                                    ) : (
                                                        <Badge className="bg-green-600">Health</Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* FORECAST ANALYSIS */}
                <TabsContent value="forecast">
                    <div className="grid gap-4 md:grid-cols-3">
                        {forecasts.map(f => (
                            <Card key={f.id}>
                                <CardHeader>
                                    <CardTitle>{f.window_days} Day Outlook</CardTitle>
                                    <CardDescription>
                                        Computed {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <div className="text-3xl font-bold">{Math.round(f.forecast_qty)} units</div>
                                        <div className="text-sm text-muted-foreground">Predicted Demand</div>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium mb-1">Explainability</div>
                                        <div className="bg-slate-50 p-3 rounded-md text-sm border">
                                            <div className="font-semibold text-slate-700 mb-1">
                                                {f.primary_reason}
                                            </div>
                                            {f.drivers && (
                                                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                                                    {JSON.stringify(f.drivers, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline">Confidence: {f.confidence_score}%</Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {forecasts.length === 0 && (
                            <div className="col-span-3 text-center py-8 text-muted-foreground">
                                No forecast data available yet.
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* LEDGER HISTORY */}
                <TabsContent value="ledger">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Movements</CardTitle>
                            <CardDescription>Last 10 ledger transactions</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Change</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {ledger.map(l => (
                                        <TableRow key={l.id}>
                                            <TableCell className="font-mono text-xs">
                                                {format(new Date(l.created_at), 'MMM d, HH:mm')}
                                            </TableCell>
                                            <TableCell>{l.inventory_locations?.name || 'Local'}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{l.event_type}</Badge>
                                            </TableCell>
                                            <TableCell className={l.qty_change > 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                                                {l.qty_change > 0 ? '+' : ''}{l.qty_change}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
