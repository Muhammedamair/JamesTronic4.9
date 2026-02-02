'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { timeAgo } from '@/lib/utils/time';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PlayCircle } from 'lucide-react';

interface AiEvent {
    id: string;
    created_at: string;
    event_type: string;
    entity_type: string;
    entity_id: string;
    processed: boolean;
    processed_at: string | null;
    context: Record<string, any> | null;
}

interface AiEventsTableProps {
    refreshTrigger?: number;
    onProcessComplete?: () => void;
}

export function AiEventsTable({ refreshTrigger, onProcessComplete }: AiEventsTableProps = {}) {
    const [events, setEvents] = useState<AiEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterEntityType, setFilterEntityType] = useState<string>('all');
    const [searchId, setSearchId] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [batchSize, setBatchSize] = useState('3');
    const { toast } = useToast();

    useEffect(() => {
        fetchEvents();
    }, [refreshTrigger, filterEntityType, searchId]); // Re-fetch when trigger changes

    useEffect(() => {
        // Real-time subscription
        const supabase = createClient();
        const channel = supabase
            .channel('ai_events_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'ai_events',
            }, () => {
                fetchEvents();
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, []);

    async function fetchEvents() {
        setLoading(true);
        const supabase = createClient();

        let query = supabase
            .from('ai_events')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (filterEntityType !== 'all') {
            query = query.eq('entity_type', filterEntityType);
        }

        if (searchId) {
            query = query.ilike('entity_id', `%${searchId}%`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Failed to fetch AI events:', error);
        } else {
            setEvents(data || []);
        }

        setLoading(false);
    }

    async function handleProcessEvents() {
        setIsProcessing(true);
        try {
            const response = await fetch('/api/admin/ai-brain/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batch_size: parseInt(batchSize) }),
            });

            const result = await response.json();

            if (response.ok) {
                if (result.processed_count > 0 || result.error_count > 0) {
                    toast({
                        title: 'Batch Processing Complete',
                        description: `Processed: ${result.processed_count} | Skipped: ${result.skipped_count} | Errors: ${result.error_count}`,
                    });
                } else if (result.skipped_count > 0) {
                    toast({
                        title: 'No New Events Processed',
                        description: `Skipped ${result.skipped_count} events (already processed or filtered).`,
                    });
                } else {
                    toast({
                        title: 'No Pending Events',
                        description: 'There were no pending events to process.',
                    });
                }

                // Trigger global refresh
                if (onProcessComplete) onProcessComplete();
                fetchEvents(); // Self refresh as well
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Processing Failed',
                    description: result.error || 'Unknown error occurred',
                });
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to connect to processor endpoint.',
            });
        }
        setIsProcessing(false);
    }

    return (
        <div className="space-y-4">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                {/* Filters */}
                <div className="flex flex-1 gap-4">
                    <Select value={filterEntityType} onValueChange={setFilterEntityType}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter entity" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Entity Types</SelectItem>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="ticket">Ticket</SelectItem>
                            <SelectItem value="transaction">Transaction</SelectItem>
                        </SelectContent>
                    </Select>

                    <Input
                        placeholder="Search ID..."
                        value={searchId}
                        onChange={(e) => setSearchId(e.target.value)}
                        className="max-w-xs"
                    />
                </div>

                {/* Process Actions */}
                <div className="flex items-center gap-2">
                    <Select value={batchSize} onValueChange={setBatchSize}>
                        <SelectTrigger className="w-[100px]">
                            <SelectValue placeholder="Batch" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1">1 Event</SelectItem>
                            <SelectItem value="3">3 Events</SelectItem>
                            <SelectItem value="5">5 Events</SelectItem>
                            <SelectItem value="10">10 Events</SelectItem>
                            <SelectItem value="20">20 Events</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button
                        onClick={handleProcessEvents}
                        disabled={isProcessing}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                        {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <PlayCircle className="h-4 w-4 mr-2" />
                        )}
                        Process Pending
                    </Button>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </div>
            ) : events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    No events found
                </div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Event Type</TableHead>
                                <TableHead>Entity</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Context</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {events.map((event) => (
                                <TableRow key={event.id}>
                                    <TableCell className="font-medium">{event.event_type}</TableCell>
                                    <TableCell>
                                        <div className="text-sm">
                                            <div className="font-medium">{event.entity_type}</div>
                                            <div className="text-muted-foreground">{event.entity_id}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {event.processed ? (
                                            <Badge variant="outline" className="bg-green-50">
                                                Processed
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary">Pending</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {timeAgo(event.created_at)}
                                    </TableCell>
                                    <TableCell>
                                        {event.context && (
                                            <code className="text-xs bg-muted px-2 py-1 rounded">
                                                {JSON.stringify(event.context).substring(0, 50)}...
                                            </code>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
