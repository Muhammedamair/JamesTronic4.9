'use client';

import { useState, useEffect } from 'react';
import { logisticsApi } from '@/lib/api/logistics';
import { Transporter, Delivery } from '@/lib/types/logistics';
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
import { Truck, MapPin, Package, RefreshCw, Zap, Navigation } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export default function LogisticsDashboard() {
    const { toast } = useToast();
    const [fleets, setFleets] = useState<Transporter[]>([]);
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            const [fleetData, deliveryData] = await Promise.all([
                logisticsApi.getActiveTransporters(),
                logisticsApi.getActiveDeliveries()
            ]);
            setFleets(fleetData);
            setDeliveries(deliveryData);
        } catch (err) {
            console.error('Error fetching logistics data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAutoAssign = async (deliveryId: string) => {
        setAssigning(deliveryId);
        try {
            const result = await logisticsApi.assignTransporter(deliveryId);
            if (result.success) {
                toast({ title: 'Assignment Successful', description: `Assigned to ${result.provider} fleet` });
                fetchData(); // Refresh data
            } else {
                toast({ title: 'Assignment Failed', description: result.message, variant: 'destructive' });
            }
        } catch (err) {
            console.error(err);
            toast({ title: 'Error', description: 'Failed to assign transporter', variant: 'destructive' });
        } finally {
            setAssigning(null);
        }
    };

    const getProviderBadge = (provider: string) => {
        if (provider === 'internal') return <Badge className="bg-blue-600">Internal</Badge>;
        if (provider.includes('rapido')) return <Badge className="bg-yellow-500 text-black">Rapido</Badge>;
        if (provider.includes('porter')) return <Badge className="bg-blue-400">Porter</Badge>;
        return <Badge>{provider}</Badge>;
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'idle': return <Badge variant="outline" className="text-green-600 border-green-600">Idle</Badge>;
            case 'busy': return <Badge variant="outline" className="text-orange-600 border-orange-600">Busy</Badge>;
            case 'offline': return <Badge variant="secondary">Offline</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Logistics Control Tower</h1>
                    <p className="text-muted-foreground">Hybrid fleet management & real-time tracking</p>
                </div>
                <Button variant="outline" onClick={fetchData}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                </Button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Fleet</CardTitle>
                        <Truck className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{fleets.filter(f => f.is_active).length}</div>
                        <p className="text-xs text-muted-foreground">{fleets.filter(f => f.provider_type === 'internal').length} internal vehicles</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Deliveries</CardTitle>
                        <Package className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{deliveries.filter(d => d.status === 'pending_assignment').length}</div>
                        <p className="text-xs text-muted-foreground">awaiting assignment</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">On-Time Rate</CardTitle>
                        <Zap className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">94%</div>
                        <p className="text-xs text-muted-foreground">fleet reliability</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Routes</CardTitle>
                        <MapPin className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">8</div>
                        <p className="text-xs text-muted-foreground">vehicles in transit</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Fleet Status */}
                <div className="space-y-6">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle>Fleet Status</CardTitle>
                            <CardDescription>Real-time vehicle availability</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {fleets.length === 0 ? (
                                    <div className="text-center py-4 text-muted-foreground">No active vehicles found.</div>
                                ) : (
                                    fleets.map(fleet => (
                                        <div key={fleet.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                                            <div>
                                                <div className="font-medium flex items-center gap-2">
                                                    {fleet.vehicle_plate || 'No Plate'}
                                                    {getProviderBadge(fleet.provider_type)}
                                                </div>
                                                <div className="text-sm text-muted-foreground capitalize">{fleet.vehicle_type.replace('_', ' ')}</div>
                                            </div>
                                            <div className="text-right">
                                                {getStatusBadge(fleet.current_status || 'unknown')}
                                                <div className="text-xs text-muted-foreground mt-1">{fleet.reliability_score}% Score</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Delivery Management */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Simulated Map View */}
                    <Card className="bg-muted/20 border-dashed min-h-[200px] flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-slate-100 dark:bg-slate-900 opacity-50"></div>
                        <div className="z-10 text-center">
                            <Navigation className="w-12 h-12 mx-auto text-muted-foreground mb-2 opacity-50" />
                            <h3 className="font-semibold text-muted-foreground">Live Map Visualization</h3>
                            <p className="text-xs text-muted-foreground">Vehicle positions would be rendered here via Mapbox/Google Maps</p>
                        </div>
                    </Card>

                    {/* Pending Deliveries */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Delivery Queue</CardTitle>
                            <CardDescription>Jobs requiring immediate assignment</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Items</TableHead>
                                        <TableHead>Pickup / Drop</TableHead>
                                        <TableHead>Weight</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {deliveries.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                No pending deliveries.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        deliveries.map((delivery) => (
                                            <TableRow key={delivery.id}>
                                                <TableCell>
                                                    <div className="font-medium">{delivery.items_description || 'General Items'}</div>
                                                    {delivery.is_fragile && <Badge variant="outline" className="text-xs border-red-200 text-red-500 mt-1">Fragile</Badge>}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-xs space-y-1 max-w-[200px]">
                                                        <div className="flex items-start gap-1">
                                                            <div className="w-1 h-1 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                                                            <span className="truncate">{delivery.pickup_address}</span>
                                                        </div>
                                                        <div className="flex items-start gap-1">
                                                            <div className="w-1 h-1 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                                                            <span className="truncate">{delivery.delivery_address}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{delivery.items_weight_kg} kg</TableCell>
                                                <TableCell>
                                                    {delivery.status === 'assigned' ? (
                                                        <Badge variant="outline" className="text-blue-600 border-blue-600">Assigned</Badge>
                                                    ) : (
                                                        <Badge variant="secondary">Pending</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {delivery.status === 'pending_assignment' && (
                                                        <Button
                                                            size="sm"
                                                            disabled={assigning === delivery.id}
                                                            onClick={() => handleAutoAssign(delivery.id)}
                                                        >
                                                            {assigning === delivery.id ? 'Assigning...' : 'Auto Assign'}
                                                        </Button>
                                                    )}
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
        </div>
    );
}
