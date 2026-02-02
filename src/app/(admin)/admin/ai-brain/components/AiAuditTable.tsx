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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, Copy, Check } from 'lucide-react';
import { timeAgo } from '@/lib/utils/time';

interface AuditLogEntry {
    id: string;
    created_at: string;
    ai_module: string;
    action_taken: string;
    data_points: any;
    result_meta: any;
    confidence_score: number | null;
    ethical_check_passed: boolean | null;
    fairness_score: number | null;
    user_id: string | null;
}

function JsonViewer({ title, data, fieldId }: { title: string, data: any, fieldId: string }) {
    const [copied, setCopied] = useState(false);

    if (!data || Object.keys(data).length === 0) return null;

    const jsonString = JSON.stringify(data, null, 2);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(jsonString);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleCopy}
                >
                    {copied ? (
                        <Check className="h-3 w-3 text-green-500" />
                    ) : (
                        <Copy className="h-3 w-3" />
                    )}
                </Button>
            </div>
            <pre className="bg-muted/50 p-4 rounded-md overflow-x-auto text-xs font-mono max-h-[300px]">
                {jsonString}
            </pre>
        </div>
    );
}

const getEntityFromAuditRow = (log: AuditLogEntry) => {
    const dp = log.data_points || {};
    const rm = log.result_meta || {};

    // Check all possible locations in priority order
    // Priority: data_points.entity_X -> data_points.linked_entity_X -> result_meta.entity_X -> result_meta.linked_entity_X
    const entityType = dp.entity_type || dp.linked_entity_type || rm.entity_type || rm.linked_entity_type;
    const entityId = dp.entity_id || dp.linked_entity_id || rm.entity_id || rm.linked_entity_id;

    return { entityType, entityId };
};

interface AiAuditTableProps {
    refreshTrigger?: number;
}

export function AiAuditTable({ refreshTrigger }: AiAuditTableProps = {}) {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterModule, setFilterModule] = useState<string>('all');
    const [availableModules, setAvailableModules] = useState<string[]>([]);

    // Modal state
    const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

    useEffect(() => {
        fetchLogs();
    }, [filterModule, refreshTrigger]);

    // Fetch available modules on mount for dynamic dropdown
    useEffect(() => {
        fetchAvailableModules();
    }, [refreshTrigger]);

    const fetchAvailableModules = async () => {
        const supabase = createClient();
        // Fetch recent logs to discover active modules
        const { data } = await supabase
            .from('ai_audit_logs')
            .select('ai_module')
            .order('created_at', { ascending: false })
            .limit(500);

        if (data) {
            // Extract unique modules and filter out nulls/empty strings
            const uniqueModules = Array.from(new Set(data.map((item: any) => item.ai_module)))
                .filter((m): m is string => typeof m === 'string' && m.length > 0)
                .sort();
            setAvailableModules(uniqueModules);
        }
    };

    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel('ai_audit_logs_dynamic')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'ai_audit_logs',
            }, () => {
                fetchLogs();
                fetchAvailableModules(); // Refresh modules too
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, []);

    async function fetchLogs() {
        console.log('Fetching audit logs...');
        setLoading(true);
        try {
            const supabase = createClient();

            let query = supabase
                .from('ai_audit_logs')
                .select('id, ai_module, action_taken, data_points, result_meta, confidence_score, ethical_check_passed, fairness_score, user_id, created_at')
                .order('created_at', { ascending: false })
                .limit(100);

            if (filterModule !== 'all') {
                // Exact match for dynamic values
                query = query.eq('ai_module', filterModule);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Failed to fetch audit logs:', error);
            } else {
                console.log('Fetched logs:', data?.length);
                setLogs(data || []);
            }
        } catch (err) {
            console.error('Unexpected error fetching logs:', err);
        } finally {
            setLoading(false);
        }
    }

    const getModuleBadge = (module: string) => {
        return <Badge variant="outline">{module}</Badge>;
    };

    const getPolicyResultBadge = (meta: any) => {
        if (!meta) return <span className="text-muted-foreground">—</span>;
        if (meta.policy_guard_result === 'blocked') {
            return <Badge variant="destructive">Blocked</Badge>;
        }
        return <Badge variant="secondary">Allowed</Badge>;
    };

    const getFriendlyLabel = (key: string) => {
        return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const getUserLabel = (log: AuditLogEntry) => {
        const dp = log.data_points || {};
        const rm = log.result_meta || {};
        // Priority: data_points.reviewer_X -> result_meta.reviewer_X -> user_id
        const name = dp.reviewer_name || rm.reviewer_name;
        const email = dp.reviewer_email || rm.reviewer_email;

        if (name && email) return `${name} (${email})`;
        if (name) return name;
        if (email) return email;
        if (log.user_id) return log.user_id;

        return 'System / Anon';
    };

    return (
        <div className="space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-4">
                <Select value={filterModule} onValueChange={setFilterModule}>
                    <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder="Filter by module" />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-zinc-950/95 backdrop-blur border border-white/10 shadow-xl">
                        <SelectItem value="all">All Modules</SelectItem>
                        {availableModules.map(module => (
                            <SelectItem key={module} value={module}>
                                {getFriendlyLabel(module)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {filterModule !== 'all' && (
                    <span className="text-sm text-muted-foreground">
                        Showing: {getFriendlyLabel(filterModule)}
                    </span>
                )}
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </div>
            ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    {filterModule === 'all'
                        ? 'No audit logs found'
                        : `No audit logs found for module: ${getFriendlyLabel(filterModule)}`}
                </div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>Module</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>Entity</TableHead>
                                <TableHead>Confidence</TableHead>
                                <TableHead>Policy Result</TableHead>
                                <TableHead className="text-right">Details</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log) => {
                                const { entityType, entityId } = getEntityFromAuditRow(log);
                                return (
                                    <TableRow key={log.id}>
                                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                            {timeAgo(log.created_at)}
                                        </TableCell>
                                        <TableCell>{getModuleBadge(log.ai_module)}</TableCell>
                                        <TableCell className="font-medium">{log.action_taken}</TableCell>
                                        <TableCell>
                                            {entityType && entityId ? (
                                                <div className="text-sm">
                                                    <div>{entityType}</div>
                                                    <div className="text-muted-foreground text-xs">{String(entityId).substring(0, 20)}...</div>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {(log.confidence_score !== null && typeof log.confidence_score === 'number') ? (
                                                <div className={`font-semibold ${log.confidence_score >= 80 ? 'text-green-600' :
                                                    log.confidence_score >= 60 ? 'text-yellow-600' :
                                                        'text-red-600'
                                                    }`}>
                                                    {log.confidence_score.toFixed(1)}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{getPolicyResultBadge(log.result_meta)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSelectedLog(log)}
                                                className="h-8 w-8 p-0"
                                            >
                                                <Eye className="h-4 w-4" />
                                                <span className="sr-only">View Details</span>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Details Modal */}
            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            Details: {selectedLog ? getFriendlyLabel(selectedLog.ai_module) : ''}
                            <span className="font-normal text-muted-foreground">/ {selectedLog?.action_taken}</span>
                        </DialogTitle>
                        <DialogDescription>
                            Log ID: {selectedLog?.id} • {selectedLog ? timeAgo(selectedLog.created_at) : ''}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedLog && (() => {
                        const { entityType, entityId } = getEntityFromAuditRow(selectedLog);
                        return (
                            <div className="space-y-6 py-4">
                                {/* Metadata Grid */}
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="border rounded-md p-3">
                                        <div className="text-muted-foreground mb-1">Module</div>
                                        <div className="font-medium">{selectedLog.ai_module}</div>
                                    </div>
                                    <div className="border rounded-md p-3">
                                        <div className="text-muted-foreground mb-1">User</div>
                                        <div className="font-mono text-xs truncate" title={getUserLabel(selectedLog)}>
                                            {getUserLabel(selectedLog)}
                                        </div>
                                    </div>
                                    {entityType && (
                                        <div className="border rounded-md p-3 col-span-2">
                                            <div className="text-muted-foreground mb-1">Context Entity</div>
                                            <div className="font-medium">
                                                {entityType}
                                                <span className="mx-2 text-muted-foreground">/</span>
                                                <span className="font-mono text-xs font-normal">{entityId}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="border-t pt-4">
                                    <JsonViewer
                                        title="Data Points"
                                        data={selectedLog.data_points}
                                        fieldId="data_points"
                                    />
                                </div>

                                {selectedLog.result_meta && Object.keys(selectedLog.result_meta).length > 0 && (
                                    <div className="border-t pt-4">
                                        <JsonViewer
                                            title="Result Metadata"
                                            data={selectedLog.result_meta}
                                            fieldId="result_meta"
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    );
}
