'use client';

import { useState, useEffect } from 'react';
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
    MapPin,
    AlertTriangle,
    Package,
    ArrowLeft,
    Search,
    RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { inventoryApi } from '@/lib/api/inventory';
import { formatDistanceToNow } from 'date-fns';

export default function LocationDeepDivePage() {
    const params = useParams();
    const locationId = params.id as string;

    // State
    const [location, setLocation] = useState<any>(null);
    const [stock, setStock] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [reorders, setReorders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [resolving, setResolving] = useState<string | null>(null);

    const supabase = createClient();

    const fetchLocationData = async () => {
        if (!locationId) return;
        setLoading(true);

        try {
            // 1. Location Details
            const { data: locData } = await supabase
                .from('inventory_locations')
                .select('*')
                .eq('id', locationId)
                .single();
            setLocation(locData);

            // 2. Stock at Location
            const { data: stockData } = await supabase
                .from('inventory_stock_current')
                .select(`
                    *,
                    inventory_parts (name, sku, category)
                `)
                .eq('location_id', locationId)
                .order('current_stock'); // Low stock first
            setStock(stockData || []);

            // 3. Active Alerts at Location
            const { data: alertData } = await supabase
                .from('inventory_alerts')
                .select(`
                    *,
                    inventory_parts (name, sku)
                `)
                .eq('location_id', locationId)
                .is('resolved_at', null)
                .order('severity');
            setAlerts(alertData || []);

            // 4. Pending Reorders for Location
            const { data: reorderData } = await supabase
                .from('reorder_recommendations')
                .select('*')
                .eq('location_id', locationId)
                .eq('status', 'proposed');
            setReorders(reorderData || []);

        } catch (err) {
            console.error('Error loading location data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLocationData();
    }, [locationId]);

    const handleResolveAlert = async (alertId: string) => {
        const note = prompt('Resolution Note:');
        if (!note) return;

        setResolving(alertId);
        try {
            await inventoryApi.resolveAlert(alertId, note);
            fetchLocationData();
        } catch (err: any) {
            alert('Failed to resolve: ' + err.message);
        } finally {
            setResolving(null);
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading location intelligence...</div>;
    if (!location) return <div className="p-8 text-center font-bold text-red-500">Location not found</div>;

    // Calc stats
    const lowStockCount = stock.filter(s => s.current_stock < s.safety_stock).length;

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
                    <h1 className="text-2xl font-bold tracking-tight">{location.name}</h1>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{location.city || 'Unknown City'}</span>
                        <Badge variant={location.active ? "secondary" : "destructive"} className="ml-2">
                            {location.active ? 'Active' : 'Inactive'}
                        </Badge>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Items Stocked</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stock.length}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">{lowStockCount}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Reorders</CardTitle>
                        <RefreshCw className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{reorders.length}</div>
                        <Link href={`/admin/inventory/reorders?location=${locationId}`}>
                            <Button variant="link" className="p-0 h-auto text-xs">View Queue</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>

            {/* Content Area */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Active Alerts */}
                <Card className="col-span-2 md:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Active Alerts
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {alerts.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Severity</TableHead>
                                        <TableHead>Part</TableHead>
                                        <TableHead>Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {alerts.map(a => (
                                        <TableRow key={a.id}>
                                            <TableCell>
                                                <Badge variant={a.severity === 'critical' ? 'destructive' : 'secondary'}>
                                                    {a.severity}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">{a.inventory_parts?.name}</div>
                                                <div className="text-xs text-muted-foreground truncate w-32">{a.message}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Button size="sm" variant="outline" onClick={() => handleResolveAlert(a.id)}>
                                                    Resolve
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">No active alerts for this location</div>
                        )}
                    </CardContent>
                </Card>

                {/* Stock Matrix */}
                <Card className="col-span-2 md:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5" />
                            Stock Levels
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-[400px] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Part</TableHead>
                                    <TableHead className="text-right">On Hand</TableHead>
                                    <TableHead className="text-right">Safety</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stock.map(s => (
                                    <TableRow key={s.id}>
                                        <TableCell>
                                            <Link href={`/admin/inventory/parts/${s.part_id}`} className="hover:underline text-blue-600 font-medium">
                                                {s.inventory_parts?.name || s.part_id.slice(0, 8)}
                                            </Link>
                                            <div className="text-xs text-muted-foreground">{s.inventory_parts?.sku}</div>
                                        </TableCell>
                                        <TableCell className="text-right font-bold">{s.current_stock}</TableCell>
                                        <TableCell className="text-right text-muted-foreground">{s.safety_stock}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
