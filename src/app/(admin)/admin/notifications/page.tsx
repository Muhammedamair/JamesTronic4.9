'use client';

import { useState, useEffect } from 'react';
import { notificationsApi } from '@/lib/api/notifications';
import { NotificationLog, NotificationTemplate } from '@/lib/types/notifications';
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
import { Bell, MessageSquare, Send, CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function NotificationsDashboard() {
    const { toast } = useToast();
    const [logs, setLogs] = useState<NotificationLog[]>([]);
    const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
    const [loading, setLoading] = useState(true);

    // Simulation State
    const [simName, setSimName] = useState('John Doe');
    const [simStage, setSimStage] = useState('booking_confirmation');
    const [simSentiment, setSimSentiment] = useState('neutral');
    const [sending, setSending] = useState(false);

    const fetchData = async () => {
        try {
            const [logData, templateData] = await Promise.all([
                notificationsApi.getLogs(),
                notificationsApi.getTemplates()
            ]);
            setLogs(logData);
            setTemplates(templateData);
        } catch (err) {
            console.error('Error fetching notification data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSimulate = async () => {
        setSending(true);
        try {
            const log = await notificationsApi.simulateSend(simStage, null, simName, simSentiment);
            toast({
                title: 'Notification Sent',
                description: `Sent via ${log.channel}. ID: ${log.id.slice(0, 8)}`
            });
            fetchData();
        } catch (err) {
            console.error(err);
            toast({ title: 'Send Failed', description: 'Could not send notification', variant: 'destructive' });
        } finally {
            setSending(false);
        }
    };

    const getChannelBadge = (channel: string) => {
        switch (channel) {
            case 'whatsapp': return <Badge className="bg-green-600">WhatsApp</Badge>;
            case 'sms': return <Badge variant="secondary">SMS</Badge>;
            case 'email': return <Badge variant="outline">Email</Badge>;
            default: return <Badge variant="outline">{channel}</Badge>;
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Notification Intelligence</h1>
                    <p className="text-muted-foreground">Trust-based messaging & emotional adaptation</p>
                </div>
                <Button variant="outline" onClick={fetchData}>
                    <Bell className="w-4 h-4 mr-2" /> Refresh Logs
                </Button>
            </div>

            {/* Simulator Card */}
            <Card className="border-l-4 border-l-blue-500">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Send className="w-5 h-5" />
                        Simulator
                    </CardTitle>
                    <CardDescription>Test AI template selection and message rendering</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Customer Name</label>
                            <Input value={simName} onChange={(e) => setSimName(e.target.value)} />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Stage / Event</label>
                            <Select value={simStage} onValueChange={setSimStage}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="booking_confirmation">Booking Confirmation</SelectItem>
                                    <SelectItem value="pickup_reminder">Pickup Reminder</SelectItem>
                                    <SelectItem value="sla_warning">SLA Warning (Risk)</SelectItem>
                                    <SelectItem value="delivery_completed">Delivery Completed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Customer Sentiment</label>
                            <Select value={simSentiment} onValueChange={setSimSentiment}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="neutral">Neutral</SelectItem>
                                    <SelectItem value="happy">Happy</SelectItem>
                                    <SelectItem value="frustrated">Frustrated</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button onClick={handleSimulate} disabled={sending}>
                            {sending ? 'Sending...' : 'Trigger Notification'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Messages Sent (Today)</CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{logs.length}</div>
                        <p className="text-xs text-muted-foreground">across all channels</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Supabase SMS Delivery Rate</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">99.8%</div>
                        <p className="text-xs text-muted-foreground">reliable</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Templates</CardTitle>
                        <MessageSquare className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{templates.length}</div>
                        <p className="text-xs text-muted-foreground">variants available</p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Logs Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Communication Log</CardTitle>
                    <CardDescription>Real-time history of outbound messages</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Channel</TableHead>
                                <TableHead>Content Preview</TableHead>
                                <TableHead>Sent At</TableHead>
                                <TableHead className="text-right">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8">Loading...</TableCell>
                                </TableRow>
                            ) : logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        No messages sent yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell>{getChannelBadge(log.channel)}</TableCell>
                                        <TableCell className="max-w-[400px] truncate" title={log.message_content}>
                                            {log.message_content}
                                        </TableCell>
                                        <TableCell>{format(new Date(log.sent_at), 'MMM d, HH:mm:ss')}</TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="outline">{log.status}</Badge>
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
