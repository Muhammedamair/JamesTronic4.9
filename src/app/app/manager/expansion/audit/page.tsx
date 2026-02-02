'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, ChevronLeft, ChevronRight, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useExpansionData } from '@/hooks/useExpansionData';

export default function AuditPage() {
    const { cityId } = useExpansionData();
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [eventType, setEventType] = useState('all');

    useEffect(() => {
        async function fetchLogs() {
            setIsLoading(true);
            try {
                const url = `/api/expansion/audit?page=${page}&limit=10${eventType !== 'all' ? `&event_type=${eventType}` : ''}`;
                const res = await fetch(url);
                const data = await res.json();
                if (data.success) {
                    setLogs(data.data);
                    setTotal(data.pagination.total);
                }
            } catch (e) {
                console.error("Fetch Audit Error:", e);
            }
            setIsLoading(false);
        }
        fetchLogs();
    }, [page, eventType, cityId]);

    return (
        <div className="expansion-container">
            <header className="expansion-header">
                <div>
                    <h1 className="expansion-h1">System Audit Trail</h1>
                    <p className="expansion-sub italic">Operational transparency and event history</p>
                </div>
            </header>

            {/* Filter Bar */}
            <div className="glass-card p-4 mb-6">
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex-1 min-w-[200px] relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input placeholder="Search run_id..." className="pl-9 h-10" />
                    </div>
                    <Select value={eventType} onValueChange={setEventType}>
                        <SelectTrigger className="w-[180px] h-10">
                            <SelectValue placeholder="Event Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Events</SelectItem>
                            <SelectItem value="COMPUTE_START">Compute Start</SelectItem>
                            <SelectItem value="COMPUTE_END">Compute Complete</SelectItem>
                            <SelectItem value="COMPUTE_FAIL">Compute Failure</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" className="h-10">
                        <Filter className="h-4 w-4 mr-2" />
                        Filters
                    </Button>
                </div>
            </div>

            <div className="glass-card p-0 overflow-hidden min-h-[400px]">
                {isLoading ? (
                    <div className="flex h-[400px] items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                ) : (
                    <>
                        <table className="w-full expansion-table-dense">
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>Event</th>
                                    <th>Role</th>
                                    <th className="text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="expansion-table-hover text-xs">
                                {logs.map((log) => (
                                    <tr key={log.id}>
                                        <td className="font-mono text-slate-500">
                                            {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                                        </td>
                                        <td>
                                            <Badge variant="outline" className={cn(
                                                "text-[10px] bg-opacity-10 border-opacity-20",
                                                log.event_type === 'COMPUTE_END' ? "bg-emerald-500 text-emerald-700 border-emerald-500" :
                                                    log.event_type === 'COMPUTE_START' ? "bg-blue-500 text-blue-700 border-blue-500" :
                                                        "bg-rose-500 text-rose-700 border-rose-500"
                                            )}>
                                                {log.event_type}
                                            </Badge>
                                            <span className="ml-2 font-medium text-slate-700">{log.ai_module}</span>
                                        </td>
                                        <td className="text-slate-600 italic uppercase">{log.role || 'system'}</td>
                                        <td className="text-right">
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {logs.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-500">No audit logs found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* Pagination UI */}
                        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                            <p className="text-xs text-slate-500">
                                Showing <span className="font-bold">{((page - 1) * 10) + 1}-{Math.min(page * 10, total)}</span> of <span className="font-bold">{total}</span> events
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page === 1}
                                    onClick={() => setPage(p => p - 1)}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={logs.length < 10}
                                    onClick={() => setPage(p => p + 1)}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// Helper for dynamic classes until tailwind re-runs
function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
