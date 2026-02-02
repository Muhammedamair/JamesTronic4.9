'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Package,
    AlertTriangle,
    TrendingUp,
    Clock,
    RefreshCw,
    ArrowRight,
    CheckCircle,
    BarChart3
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { inventoryApi } from '@/lib/api/inventory';
import { useToast } from "@/components/ui/use-toast"

interface DashboardSummary {
    low_stock_count: number;
    critical_alerts: number;
    pending_reorders: number;
    high_risk_parts: Array<{
        part_id: string;
        part_name?: string;
        location_id: string;
        location_name?: string;
        stockout_risk_score: number;
        recommended_qty: number;
    }>;
    forecast_freshness?: {
        last_computed: string;
        stale_locations: number;
    };
}

interface InventoryAlert {
    id: string;
    location_id: string | null;
    part_id: string | null;
    severity: 'info' | 'warning' | 'critical';
    category: string;
    message: string;
    created_at: string;
}

export default function InventoryDashboardPage() {
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
    const [locationFilter, setLocationFilter] = useState<string>('all');
    const [windowFilter, setWindowFilter] = useState<string>('7');
    const [loading, setLoading] = useState(true);
    const [resolving, setResolving] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [locations, setLocations] = useState<Array<{ id: string, name: string }>>([]);
    const { toast } = useToast();

    const supabase = createClient();

    const fetchDashboard = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch dashboard summary via RPC
            const { data: summaryData, error: summaryError } = await supabase
                .rpc('rpc_inventory_dashboard_summary');

            if (summaryError) {
                console.error('Summary fetch error:', summaryError);
            } else {
                setSummary(summaryData);
            }

            // Fetch active alerts via client API (wraps RLS select)
            let alertQuery = supabase
                .from('inventory_alerts')
                .select('*')
                .is('resolved_at', null)
                .order('severity', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(10);

            if (locationFilter !== 'all') {
                alertQuery = alertQuery.eq('location_id', locationFilter);
            }

            const { data: alertData, error: alertError } = await alertQuery;

            if (alertError) {
                console.error('Alerts fetch error:', alertError);
            } else {
                setAlerts(alertData || []);
            }

            // Fetch locations for filter
            const { data: locData } = await supabase
                .from('inventory_locations')
                .select('id, name')
                .eq('active', true)
                .order('name');

            if (locData) setLocations(locData);

        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [locationFilter, supabase]);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    const handleResolveAlert = async (alertId: string) => {
        const note = prompt('Enter resolution note:');
        if (!note || note.trim() === '') return;

        setResolving(alertId);
        try {
            // Use server route via API wrapper
            const result = await inventoryApi.resolveAlert(alertId, note);
            if (result) {
                fetchDashboard();
            }
        } catch (err: any) {
            alert(err.message || 'Failed to resolve alert');
        } finally {
            setResolving(null);
        }
    };

    const handleGenerateForecasts = async () => {
        setIsGenerating(true);
        try {
            await inventoryApi.generateForecasts();
            toast({
                title: 'Forecasts Regenerated',
                description: 'Demand, forecasts, and recommendations have been updated.'
            });
            fetchDashboard();
        } catch (err: any) {
            toast({
                title: 'Generation Failed',
                description: err.message || 'Failed to regenerate forecasts',
                variant: 'destructive'
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const getSeverityBadge = (severity: string) => {
        switch (severity) {
            case 'critical':
                return <Badge variant="destructive">{severity}</Badge>;
            case 'warning':
                return <Badge className="bg-yellow-500">{severity}</Badge>;
            default:
                return <Badge variant="secondary">{severity}</Badge>;
        }
    };

    const getRiskBadge = (score: number) => {
        if (score >= 80) return <Badge variant="destructive">{score}%</Badge>;
        if (score >= 60) return <Badge className="bg-yellow-500">{score}%</Badge>;
        return <Badge className="bg-green-600">{score}%</Badge>;
    };

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Inventory Prediction Engine</h1>
                    <p className="text-muted-foreground">
                        Real-time stock forecasting, reorder recommendations, and risk alerts
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <Select value={windowFilter} onValueChange={setWindowFilter}>
                        <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Window" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">7 Days</SelectItem>
                            <SelectItem value="30">30 Days</SelectItem>
                            <SelectItem value="90">90 Days</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={fetchDashboard} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Reorders</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary?.pending_reorders ?? '—'}</div>
                        <p className="text-xs text-muted-foreground">
                            Awaiting approval
                        </p>
                        <Link href="/admin/inventory/reorders" className="text-xs text-blue-500 hover:underline mt-2 inline-block">
                            View Queue →
                        </Link>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{summary?.critical_alerts ?? '—'}</div>
                        <p className="text-xs text-muted-foreground">
                            Requires immediate attention
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
                        <TrendingUp className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary?.low_stock_count ?? '—'}</div>
                        <p className="text-xs text-muted-foreground">
                            Below safety threshold
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Forecast Freshness</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {summary?.forecast_freshness?.last_computed
                                ? formatDistanceToNow(new Date(summary.forecast_freshness.last_computed), { addSuffix: true })
                                : '—'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {summary?.forecast_freshness?.stale_locations
                                ? `${summary.forecast_freshness.stale_locations} stale locations`
                                : 'All locations current'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* High Risk Parts Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        High Risk Parts
                    </CardTitle>
                    <CardDescription>
                        Parts with elevated stockout risk requiring attention
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {summary?.high_risk_parts && summary.high_risk_parts.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Part</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead>Risk Score</TableHead>
                                    <TableHead>Recommended Qty</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {summary.high_risk_parts.slice(0, 5).map((item, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>
                                            <Link
                                                href={`/admin/inventory/parts/${item.part_id}`}
                                                className="text-blue-500 hover:underline font-medium"
                                            >
                                                {item.part_name || item.part_id.slice(0, 8)}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <Link
                                                href={`/admin/inventory/locations/${item.location_id}`}
                                                className="text-blue-500 hover:underline"
                                            >
                                                {item.location_name || item.location_id.slice(0, 8)}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{getRiskBadge(item.stockout_risk_score)}</TableCell>
                                        <TableCell>{item.recommended_qty} units</TableCell>
                                        <TableCell>
                                            <Link href="/admin/inventory/reorders">
                                                <Button variant="ghost" size="sm">
                                                    <ArrowRight className="h-4 w-4" />
                                                </Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            No high risk parts detected
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Active Alerts Panel */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Active Alerts
                        </CardTitle>
                        <CardDescription>
                            Unresolved inventory alerts requiring action
                        </CardDescription>
                    </div>
                    <Select value={locationFilter} onValueChange={setLocationFilter}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Filter by location" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Locations</SelectItem>
                            {locations.map(loc => (
                                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardHeader>
                <CardContent>
                    {alerts.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Severity</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Message</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead>Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {alerts.map(alert => (
                                    <TableRow key={alert.id}>
                                        <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{alert.category}</Badge>
                                        </TableCell>
                                        <TableCell className="max-w-md truncate">
                                            {alert.message}
                                        </TableCell>
                                        <TableCell>
                                            {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleResolveAlert(alert.id)}
                                                disabled={resolving === alert.id}
                                            >
                                                {resolving === alert.id ? (
                                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <CheckCircle className="h-4 w-4 mr-1" />
                                                )}
                                                Resolve
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                            No active alerts
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-3">
                <Link href="/admin/inventory/reorders">
                    <Card className="hover:bg-accent cursor-pointer transition-colors">
                        <CardContent className="flex items-center gap-4 py-6">
                            <Package className="h-8 w-8 text-blue-500" />
                            <div>
                                <h3 className="font-semibold">Reorder Queue</h3>
                                <p className="text-sm text-muted-foreground">Approve or reject recommendations</p>
                            </div>
                            <ArrowRight className="h-5 w-5 ml-auto" />
                        </CardContent>
                    </Card>
                </Link>

                <Card className="hover:bg-accent cursor-pointer transition-colors" onClick={handleGenerateForecasts}>
                    <CardContent className="flex items-center gap-4 py-6">
                        <RefreshCw className={`h-8 w-8 text-green-500 ${isGenerating ? 'animate-spin' : ''}`} />
                        <div>
                            <h3 className="font-semibold">Refresh Forecasts</h3>
                            <p className="text-sm text-muted-foreground">{isGenerating ? 'Computing...' : 'Recompute demand predictions'}</p>
                        </div>
                        <ArrowRight className="h-5 w-5 ml-auto" />
                    </CardContent>
                </Card>

                <Link href="/admin/dealers/analytics">
                    <Card className="hover:bg-accent cursor-pointer transition-colors">
                        <CardContent className="flex items-center gap-4 py-6">
                            <TrendingUp className="h-8 w-8 text-purple-500" />
                            <div>
                                <h3 className="font-semibold">Dealer Analytics</h3>
                                <p className="text-sm text-muted-foreground">Supplier reliability scores</p>
                            </div>
                            <ArrowRight className="h-5 w-5 ml-auto" />
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    );
}
