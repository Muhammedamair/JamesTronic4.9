'use client';

import { useState, useEffect } from 'react';
import { callCenterApi } from '@/lib/api/call-center';
import { CallLog, VoiceInteraction } from '@/lib/types/call-center';
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
import { Phone, Users, Mic, MoreHorizontal, PlayCircle, BarChart2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export default function CallCenterDashboard() {
    const { toast } = useToast();
    const [activeCalls, setActiveCalls] = useState<CallLog[]>([]);
    const [recentCalls, setRecentCalls] = useState<CallLog[]>([]);
    const [loading, setLoading] = useState(true);

    // Simulator state
    const [simulating, setSimulating] = useState(false);

    useEffect(() => {
        fetchData();
        // Simulate real-time updates polling
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    async function fetchData() {
        try {
            const active = await callCenterApi.getActiveCalls();
            const recent = await callCenterApi.getRecentCalls();
            setActiveCalls(active);
            setRecentCalls(recent);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching call data:', err);
        }
    }

    const handleSimulateCall = async () => {
        setSimulating(true);
        try {
            // Simulate an incoming call
            const call = await callCenterApi.simulateIncomingCall('+919876543210', 'en');
            toast({ title: 'Simulated Incoming Call', description: `Call ID: ${call.id.slice(0, 8)}` });

            // Simulate conversation
            await callCenterApi.logInteraction(call.id, 'customer', 'Hello, my AC is not cooling.', 'en', 'neutral');
            await new Promise(r => setTimeout(r, 1000));
            await callCenterApi.logInteraction(call.id, 'ai', 'I understand. Is it a split or window AC?', 'en', 'neutral');
            await new Promise(r => setTimeout(r, 1000));
            await callCenterApi.logInteraction(call.id, 'customer', 'It is a split AC, Samsung brand.', 'en', 'frustrated');

            await fetchData();
        } catch (err) {
            console.error(err);
            toast({ title: 'Simulation Failed', variant: 'destructive' });
        } finally {
            setSimulating(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'in_progress':
                return <Badge className="bg-green-600 animate-pulse">Live</Badge>;
            case 'queued':
                return <Badge className="bg-yellow-500">Queued</Badge>;
            case 'completed':
                return <Badge variant="secondary">Completed</Badge>;
            case 'dropped':
                return <Badge variant="destructive">Dropped</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Call Center Command</h1>
                    <p className="text-muted-foreground">AI-powered multilingual voice support & monitoring</p>
                </div>
                <Button onClick={handleSimulateCall} disabled={simulating}>
                    <Phone className="w-4 h-4 mr-2" />
                    {simulating ? 'Simulating...' : 'Simulate Call'}
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Calls</CardTitle>
                        <Phone className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeCalls.length}</div>
                        <p className="text-xs text-muted-foreground">currently live</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">AI Handling Rate</CardTitle>
                        <Mic className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">85%</div>
                        <p className="text-xs text-muted-foreground">calls fully automated</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Sentiment</CardTitle>
                        <BarChart2 className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Positive</div>
                        <p className="text-xs text-muted-foreground">trend rising +5%</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Interventions</CardTitle>
                        <Users className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">3</div>
                        <p className="text-xs text-muted-foreground">require supervisor</p>
                    </CardContent>
                </Card>
            </div>

            {/* Active Calls Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Live Calls</CardTitle>
                    <CardDescription>Real-time monitoring of ongoing conversations</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Status</TableHead>
                                <TableHead>Caller</TableHead>
                                <TableHead>Language</TableHead>
                                <TableHead>Started</TableHead>
                                <TableHead>Intent</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                                </TableRow>
                            ) : activeCalls.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No active calls. Center is quiet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                activeCalls.map((call) => (
                                    <TableRow key={call.id}>
                                        <TableCell>{getStatusBadge(call.status)}</TableCell>
                                        <TableCell>{call.customer_phone || 'Unknown'}</TableCell>
                                        <TableCell className="uppercase">{call.language}</TableCell>
                                        <TableCell>{format(new Date(call.started_at), 'HH:mm:ss')}</TableCell>
                                        <TableCell>{call.intent_detected || 'Analyzing...'}</TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" variant="ghost">Monitor</Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Recent History */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent History</CardTitle>
                    <CardDescription>Completed calls and outcomes</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Status</TableHead>
                                <TableHead>Caller</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>AI Handled</TableHead>
                                <TableHead className="text-right">Recording</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recentCalls.filter(c => c.status === 'completed').length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No recent history.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                recentCalls.filter(c => c.status === 'completed').slice(0, 5).map((call) => (
                                    <TableRow key={call.id}>
                                        <TableCell>{getStatusBadge(call.status)}</TableCell>
                                        <TableCell>{call.customer_phone}</TableCell>
                                        <TableCell>{call.duration_seconds ? `${call.duration_seconds}s` : '-'}</TableCell>
                                        <TableCell>{format(new Date(call.started_at), 'MMM d, HH:mm')}</TableCell>
                                        <TableCell>
                                            {call.c24_ai_handled ? <Badge variant="secondary">Yes</Badge> : <Badge variant="outline">No</Badge>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" variant="ghost">
                                                <PlayCircle className="w-4 h-4" />
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
    );
}
