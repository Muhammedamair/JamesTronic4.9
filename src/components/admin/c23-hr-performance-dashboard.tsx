'use client';

import { useState } from 'react';
import { useSupabase } from '@/components/shared/supabase-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
    Shield, AlertTriangle, ClipboardCheck, ChevronDown, ChevronUp,
    FileSearch, MessageSquare
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
interface FlaggedPacket {
    packet_id: string;
    tech_id: string;
    branch_id: string;
    window_start: string;
    window_end: string;
    packet_json: any;
    status: string;
    trend: string;
    confidence: number;
    review_state: string;
    review_reason: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    hr_review_state: string;
    hr_reviewed_by: string | null;
    hr_reviewed_at: string | null;
    hr_reason: string | null;
    generated_at: string;
    tech_name?: string;
    reviewer_name?: string;
}

interface AuditEntry {
    log_id: string;
    packet_id: string;
    actor_id: string;
    actor_role: string;
    action: string;
    reason: string | null;
    previous_state: string | null;
    new_state: string | null;
    created_at: string;
}

// ─────────────────────────────────────────────────────────
// HR Performance Dashboard
// Scope: Flagged packets + audit trail + coaching history
// GOVERNANCE: No rankings. No punitive automation.
// ─────────────────────────────────────────────────────────
export default function HRPerformanceDashboard() {
    const { supabase, user } = useSupabase();
    const queryClient = useQueryClient();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [hrReason, setHrReason] = useState('');
    const [activePacketId, setActivePacketId] = useState<string | null>(null);

    // Feature flag
    const { data: flagEnabled } = useQuery({
        queryKey: ['c23-feature-flag', 'c23_hr_dashboard_enabled'],
        queryFn: async () => {
            const { data } = await supabase
                .from('c23_feature_flags')
                .select('enabled')
                .eq('flag_key', 'c23_hr_dashboard_enabled')
                .single();
            return data?.enabled ?? false;
        },
        enabled: !!user,
    });

    // Flagged packets (hr_review_state = PENDING or ACTION_REQUESTED)
    const { data: flaggedPackets = [], isLoading } = useQuery<FlaggedPacket[]>({
        queryKey: ['c23-hr-packets'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('c23_technician_performance_packets')
                .select('*')
                .in('hr_review_state', ['PENDING', 'ACTION_REQUESTED'])
                .order('generated_at', { ascending: false });
            if (error) throw error;

            if (data && data.length > 0) {
                const techIds = [...new Set(data.map((p: FlaggedPacket) => p.tech_id))];
                const reviewerIds = [...new Set(data.filter((p: FlaggedPacket) => p.reviewed_by).map((p: FlaggedPacket) => p.reviewed_by!))];
                const allIds = [...new Set([...techIds, ...reviewerIds])];

                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', allIds);
                const nameMap = Object.fromEntries((profiles || []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));

                return data.map((p: FlaggedPacket) => ({
                    ...p,
                    tech_name: nameMap[p.tech_id] || 'Unknown',
                    reviewer_name: p.reviewed_by ? (nameMap[p.reviewed_by] || 'Unknown') : null,
                }));
            }
            return data || [];
        },
        enabled: !!user && flagEnabled === true,
    });

    // Audit trail for expanded packet
    const { data: auditTrail = [] } = useQuery<AuditEntry[]>({
        queryKey: ['c23-audit', expandedId],
        queryFn: async () => {
            if (!expandedId) return [];
            const { data, error } = await supabase
                .from('c23_review_audit_log')
                .select('*')
                .eq('packet_id', expandedId)
                .order('created_at', { ascending: true });
            if (error) throw error;
            return data || [];
        },
        enabled: !!expandedId,
    });

    // HR review mutation
    const hrReviewMutation = useMutation({
        mutationFn: async ({ packetId, action, reason }: { packetId: string; action: string; reason: string }) => {
            const { data, error } = await supabase.rpc('c23_hr_review_packet', {
                p_packet_id: packetId,
                p_action: action,
                p_reason: reason,
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['c23-hr-packets'] });
            queryClient.invalidateQueries({ queryKey: ['c23-audit'] });
            setHrReason('');
            setActivePacketId(null);
        },
    });

    if (flagEnabled === false) {
        return (
            <div className="container mx-auto py-12 px-4 text-center">
                <Shield className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-300">HR Dashboard Not Yet Enabled</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                    Contact admin to enable <code>c23_hr_dashboard_enabled</code>.
                </p>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 px-4 md:px-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">HR Review Queue</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Flagged performance packets requiring HR review — workflow-oriented, not punitive
                    </p>
                </div>
                <Badge variant="outline" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {flaggedPackets.length} flagged
                </Badge>
            </div>

            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-10 h-10 rounded-full border-4 border-gray-300 border-t-blue-500 animate-spin" />
                        </div>
                    ) : flaggedPackets.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">No flagged packets requiring HR review.</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Technician</TableHead>
                                    <TableHead>Window</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Flagged By</TableHead>
                                    <TableHead>Flag Reason</TableHead>
                                    <TableHead>HR State</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {flaggedPackets.map((pkt) => (
                                    <>
                                        <TableRow
                                            key={pkt.packet_id}
                                            className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                            onClick={() => setExpandedId(expandedId === pkt.packet_id ? null : pkt.packet_id)}
                                        >
                                            <TableCell className="font-medium">{pkt.tech_name}</TableCell>
                                            <TableCell className="text-xs">
                                                {new Date(pkt.window_start).toLocaleDateString()} — {new Date(pkt.window_end).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400">
                                                    {pkt.status}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-sm">{pkt.reviewer_name || '—'}</TableCell>
                                            <TableCell className="text-sm max-w-[200px] truncate">{pkt.review_reason || '—'}</TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                                    {(pkt.hr_review_state || 'PENDING').replace(/_/g, ' ')}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {expandedId === pkt.packet_id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                                            </TableCell>
                                        </TableRow>

                                        {expandedId === pkt.packet_id && (
                                            <TableRow key={`${pkt.packet_id}-detail`}>
                                                <TableCell colSpan={7} className="bg-gray-50/50 dark:bg-gray-800/30">
                                                    <div className="p-4 space-y-4">
                                                        {/* Audit Trail */}
                                                        <div className="rounded-lg border p-3 bg-white dark:bg-gray-900">
                                                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1">
                                                                <FileSearch className="h-3.5 w-3.5" /> Audit Trail
                                                            </h4>
                                                            {auditTrail.length === 0 ? (
                                                                <p className="text-sm text-gray-400">No audit entries yet.</p>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    {auditTrail.map((entry) => (
                                                                        <div key={entry.log_id} className="flex items-start gap-2 text-sm border-l-2 border-gray-200 dark:border-gray-700 pl-3">
                                                                            <div className="flex-1">
                                                                                <span className="font-medium">{entry.action}</span>
                                                                                <span className="text-gray-400"> by {entry.actor_role}</span>
                                                                                {entry.reason && <p className="text-gray-500 text-xs mt-0.5">"{entry.reason}"</p>}
                                                                                <div className="text-xs text-gray-400">
                                                                                    {entry.previous_state} → {entry.new_state} • {new Date(entry.created_at).toLocaleString()}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Packet signals summary */}
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                            <div className="rounded-lg border p-3 bg-white dark:bg-gray-900">
                                                                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Quality</h4>
                                                                <div className="text-sm">
                                                                    Rework: {(pkt.packet_json?.signals?.quality?.rework_rate * 100 || 0).toFixed(1)}%
                                                                    ({pkt.packet_json?.signals?.quality?.rework_count || 0} tickets)
                                                                </div>
                                                            </div>
                                                            <div className="rounded-lg border p-3 bg-white dark:bg-gray-900">
                                                                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Efficiency</h4>
                                                                <div className="text-sm">
                                                                    Avg: {pkt.packet_json?.signals?.efficiency?.avg_cycle_time_mins || 0} min |
                                                                    Uncontrolled: {pkt.packet_json?.signals?.efficiency?.uncontrollable_delay_mins || 0} min
                                                                </div>
                                                            </div>
                                                            <div className="rounded-lg border p-3 bg-white dark:bg-gray-900">
                                                                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Confidence</h4>
                                                                <div className="text-sm">{Math.round(pkt.confidence * 100)}%</div>
                                                            </div>
                                                        </div>

                                                        {/* HR Actions */}
                                                        <div className="rounded-lg border p-3 bg-white dark:bg-gray-900">
                                                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">HR Actions</h4>
                                                            <textarea
                                                                className="w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 mb-3"
                                                                placeholder="HR review reason (required)..."
                                                                rows={2}
                                                                value={activePacketId === pkt.packet_id ? hrReason : ''}
                                                                onChange={(e) => { setActivePacketId(pkt.packet_id); setHrReason(e.target.value); }}
                                                            />
                                                            <div className="flex flex-wrap gap-2">
                                                                <Button size="sm" variant="default"
                                                                    disabled={!hrReason.trim() || hrReviewMutation.isPending}
                                                                    onClick={(e) => { e.stopPropagation(); hrReviewMutation.mutate({ packetId: pkt.packet_id, action: 'ACKNOWLEDGE', reason: hrReason }); }}>
                                                                    <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Acknowledge
                                                                </Button>
                                                                <Button size="sm" variant="outline"
                                                                    disabled={!hrReason.trim() || hrReviewMutation.isPending}
                                                                    onClick={(e) => { e.stopPropagation(); hrReviewMutation.mutate({ packetId: pkt.packet_id, action: 'REQUEST_MANAGER_ACTION', reason: hrReason }); }}>
                                                                    <MessageSquare className="h-3.5 w-3.5 mr-1" /> Request Manager Action
                                                                </Button>
                                                                <Button size="sm" variant="secondary"
                                                                    disabled={!hrReason.trim() || hrReviewMutation.isPending}
                                                                    onClick={(e) => { e.stopPropagation(); hrReviewMutation.mutate({ packetId: pkt.packet_id, action: 'CLOSE', reason: hrReason }); }}>
                                                                    Close
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
