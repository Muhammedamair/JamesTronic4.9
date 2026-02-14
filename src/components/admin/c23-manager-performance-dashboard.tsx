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
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
    ClipboardCheck, AlertTriangle, TrendingUp, TrendingDown, Minus,
    Shield, Eye, MessageSquarePlus, ChevronDown, ChevronUp, ListFilter
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
interface PerformancePacket {
    packet_id: string;
    tech_id: string;
    branch_id: string;
    window_start: string;
    window_end: string;
    packet_json: {
        summary: { status: string; trend: string; confidence: number; tickets_completed: number };
        signals: {
            quality: { rework_rate: number; rework_count: number; evidence: string[] };
            efficiency: { avg_cycle_time_mins: number; total_controllable_mins: number; uncontrollable_delay_mins: number };
            exceptions: { parts_delay: number; transport_delay: number; admin_hold: number; customer_unresponsive: number };
        };
        explainability: { controllable_factors: string[]; uncontrollable_factors: string[] };
        governance: { review_required: boolean; engine_version: string; generated_at: string };
    };
    status: string;
    trend: string;
    confidence: number;
    review_required: boolean;
    review_state: string;
    reviewed_by: string | null;
    reviewed_at: string | null;
    review_reason: string | null;
    generated_at: string;
    engine_version: string;
    tech_name?: string;
}

// ─────────────────────────────────────────────────────────
// Helpers (NO ranking, NO percentile, NO "best/worst")
// ─────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const variants: Record<string, string> = {
        GOOD: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
        WARNING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        NEEDS_REVIEW: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
    };
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${variants[status] || 'bg-gray-100 text-gray-800'}`}>
            {status === 'NEEDS_REVIEW' ? 'Needs Review' : status.charAt(0) + status.slice(1).toLowerCase()}
        </span>
    );
}

function TrendIcon({ trend }: { trend: string }) {
    switch (trend) {
        case 'IMPROVING': return <TrendingUp className="h-4 w-4 text-emerald-500" />;
        case 'DEGRADING': return <TrendingDown className="h-4 w-4 text-rose-500" />;
        default: return <Minus className="h-4 w-4 text-gray-400" />;
    }
}

function ConfidenceMeter({ value }: { value: number }) {
    const pct = Math.round(value * 100);
    const color = pct >= 70 ? 'bg-emerald-500' : pct >= 45 ? 'bg-amber-500' : 'bg-rose-500';
    return (
        <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">{pct}%</span>
        </div>
    );
}

function ReviewStateBadge({ state }: { state: string }) {
    const variants: Record<string, string> = {
        PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        FLAGGED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        NOT_REQUIRED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variants[state] || 'bg-gray-100'}`}>
            {state.replace(/_/g, ' ')}
        </span>
    );
}

// ─────────────────────────────────────────────────────────
// Manager Performance Dashboard
// ─────────────────────────────────────────────────────────
export default function ManagerPerformanceDashboard() {
    const { supabase, user } = useSupabase();
    const queryClient = useQueryClient();

    // Filters
    const [windowFilter, setWindowFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [reviewFilter, setReviewFilter] = useState<string>('PENDING');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Review action state
    const [reviewReason, setReviewReason] = useState('');
    const [reviewAction, setReviewAction] = useState<string | null>(null);
    const [activePacketId, setActivePacketId] = useState<string | null>(null);

    // Feature flag check
    const { data: flagEnabled } = useQuery({
        queryKey: ['c23-feature-flag', 'c23_manager_dashboard_enabled'],
        queryFn: async () => {
            const { data } = await supabase
                .from('c23_feature_flags')
                .select('enabled')
                .eq('flag_key', 'c23_manager_dashboard_enabled')
                .single();
            return data?.enabled ?? false;
        },
        enabled: !!user,
    });

    // Packets query (branch-scoped via RLS)
    const { data: packets = [], isLoading } = useQuery<PerformancePacket[]>({
        queryKey: ['c23-packets', windowFilter, statusFilter, reviewFilter],
        queryFn: async () => {
            let query = supabase
                .from('c23_technician_performance_packets')
                .select('*')
                .order('generated_at', { ascending: false });

            if (statusFilter !== 'all') query = query.eq('status', statusFilter);
            if (reviewFilter !== 'all') query = query.eq('review_state', reviewFilter);

            const { data, error } = await query;
            if (error) throw error;

            // Enrich with tech names
            if (data && data.length > 0) {
                const techIds = [...new Set(data.map((p: PerformancePacket) => p.tech_id))];
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', techIds);
                const nameMap = Object.fromEntries((profiles || []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));
                return data.map((p: PerformancePacket) => ({ ...p, tech_name: nameMap[p.tech_id] || 'Unknown' }));
            }
            return data || [];
        },
        enabled: !!user && flagEnabled === true,
    });

    // Review mutation
    const reviewMutation = useMutation({
        mutationFn: async ({ packetId, action, reason }: { packetId: string; action: string; reason: string }) => {
            const { data, error } = await supabase.rpc('c23_manager_review_packet', {
                p_packet_id: packetId,
                p_action: action,
                p_reason: reason,
                p_evidence_refs: [],
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['c23-packets'] });
            setReviewReason('');
            setReviewAction(null);
            setActivePacketId(null);
        },
    });

    // Coaching task creation
    const coachingMutation = useMutation({
        mutationFn: async ({ techId, packetId, taskText }: { techId: string; packetId: string; taskText: string }) => {
            const { data, error } = await supabase.rpc('c23_create_coaching_task', {
                p_tech_id: techId,
                p_packet_id: packetId,
                p_task_text: taskText,
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['c23-packets'] });
        },
    });

    // Gate: disabled flag
    if (flagEnabled === false) {
        return (
            <div className="container mx-auto py-12 px-4 text-center">
                <Shield className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-300">
                    Performance Dashboard Not Yet Enabled
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                    This feature is currently disabled. Contact admin to enable <code>c23_manager_dashboard_enabled</code>.
                </p>
            </div>
        );
    }

    // Summary counts (NOT rankings)
    const pendingCount = packets.filter(p => p.review_state === 'PENDING').length;
    const warningCount = packets.filter(p => p.status === 'WARNING' || p.status === 'NEEDS_REVIEW').length;
    const improvingCount = packets.filter(p => p.trend === 'IMPROVING').length;

    return (
        <div className="container mx-auto py-6 px-4 md:px-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Performance Review Queue</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Review technician performance packets — evidence-based, branch-scoped
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Shield className="h-3.5 w-3.5" />
                    Engine v{packets[0]?.engine_version || '1.0.0'}
                </div>
            </div>

            {/* Summary Cards (counts only, never rankings) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                                <ClipboardCheck className="h-5 w-5 text-yellow-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{pendingCount}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Pending Review</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{warningCount}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Attention Needed</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                                <TrendingUp className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{improvingCount}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Improving Trend</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <ListFilter className="h-4 w-4 text-gray-400" />
                <Select value={reviewFilter} onValueChange={setReviewFilter}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Review state" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All States</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="APPROVED">Approved</SelectItem>
                        <SelectItem value="FLAGGED">Flagged HR</SelectItem>
                        <SelectItem value="NOT_REQUIRED">Not Required</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="GOOD">Good</SelectItem>
                        <SelectItem value="WARNING">Warning</SelectItem>
                        <SelectItem value="NEEDS_REVIEW">Needs Review</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Packets Table */}
            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-10 h-10 rounded-full border-4 border-gray-300 border-t-blue-500 animate-spin" />
                        </div>
                    ) : packets.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            No performance packets match the current filters.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Technician</TableHead>
                                    <TableHead>Window</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Trend</TableHead>
                                    <TableHead>Confidence</TableHead>
                                    <TableHead>Tickets</TableHead>
                                    <TableHead>Review</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {packets.map((pkt) => (
                                    <>
                                        <TableRow
                                            key={pkt.packet_id}
                                            className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${expandedId === pkt.packet_id ? 'bg-gray-50 dark:bg-gray-800/50' : ''
                                                }`}
                                            onClick={() => setExpandedId(expandedId === pkt.packet_id ? null : pkt.packet_id)}
                                        >
                                            <TableCell className="font-medium">{pkt.tech_name || 'Unknown'}</TableCell>
                                            <TableCell className="text-xs">
                                                {new Date(pkt.window_start).toLocaleDateString()} — {new Date(pkt.window_end).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell><StatusBadge status={pkt.status} /></TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <TrendIcon trend={pkt.trend} />
                                                    <span className="text-xs">{pkt.trend.charAt(0) + pkt.trend.slice(1).toLowerCase()}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell><ConfidenceMeter value={pkt.confidence} /></TableCell>
                                            <TableCell>{pkt.packet_json?.summary?.tickets_completed || 0}</TableCell>
                                            <TableCell><ReviewStateBadge state={pkt.review_state} /></TableCell>
                                            <TableCell>
                                                {expandedId === pkt.packet_id
                                                    ? <ChevronUp className="h-4 w-4 text-gray-400" />
                                                    : <ChevronDown className="h-4 w-4 text-gray-400" />
                                                }
                                            </TableCell>
                                        </TableRow>

                                        {/* Expanded drill-down */}
                                        {expandedId === pkt.packet_id && (
                                            <TableRow key={`${pkt.packet_id}-detail`}>
                                                <TableCell colSpan={8} className="bg-gray-50/50 dark:bg-gray-800/30">
                                                    <div className="p-4 space-y-4">
                                                        {/* Signals Grid */}
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                            {/* Quality */}
                                                            <div className="rounded-lg border p-3 bg-white dark:bg-gray-900">
                                                                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Quality</h4>
                                                                <div className="space-y-1 text-sm">
                                                                    <div className="flex justify-between">
                                                                        <span>Rework Rate</span>
                                                                        <span className="font-mono">{(pkt.packet_json.signals.quality.rework_rate * 100).toFixed(1)}%</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span>Rework Count</span>
                                                                        <span className="font-mono">{pkt.packet_json.signals.quality.rework_count}</span>
                                                                    </div>
                                                                    <div className="text-xs text-gray-400 mt-1">
                                                                        {pkt.packet_json.signals.quality.evidence?.length || 0} evidence refs
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {/* Efficiency */}
                                                            <div className="rounded-lg border p-3 bg-white dark:bg-gray-900">
                                                                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Efficiency</h4>
                                                                <div className="space-y-1 text-sm">
                                                                    <div className="flex justify-between">
                                                                        <span>Avg Cycle Time</span>
                                                                        <span className="font-mono">{pkt.packet_json.signals.efficiency.avg_cycle_time_mins} min</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span>Controllable Time</span>
                                                                        <span className="font-mono">{pkt.packet_json.signals.efficiency.total_controllable_mins} min</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                                                        <span>Uncontrollable Delay</span>
                                                                        <span className="font-mono">{pkt.packet_json.signals.efficiency.uncontrollable_delay_mins} min</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {/* Exceptions */}
                                                            <div className="rounded-lg border p-3 bg-white dark:bg-gray-900">
                                                                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Exceptions</h4>
                                                                <div className="space-y-1 text-sm">
                                                                    <div className="flex justify-between"><span>Parts Delay</span><span className="font-mono">{pkt.packet_json.signals.exceptions.parts_delay}</span></div>
                                                                    <div className="flex justify-between"><span>Transport Delay</span><span className="font-mono">{pkt.packet_json.signals.exceptions.transport_delay}</span></div>
                                                                    <div className="flex justify-between"><span>Admin Hold</span><span className="font-mono">{pkt.packet_json.signals.exceptions.admin_hold}</span></div>
                                                                    <div className="flex justify-between"><span>Customer Unresponsive</span><span className="font-mono">{pkt.packet_json.signals.exceptions.customer_unresponsive}</span></div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Explainability */}
                                                        {(pkt.packet_json.explainability.controllable_factors.length > 0 ||
                                                            pkt.packet_json.explainability.uncontrollable_factors.length > 0) && (
                                                                <div className="rounded-lg border p-3 bg-white dark:bg-gray-900">
                                                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Explainability</h4>
                                                                    {pkt.packet_json.explainability.controllable_factors.map((f, i) => (
                                                                        <div key={i} className="text-sm text-amber-700 dark:text-amber-400 mb-1">⚠ {f}</div>
                                                                    ))}
                                                                    {pkt.packet_json.explainability.uncontrollable_factors.map((f, i) => (
                                                                        <div key={i} className="text-sm text-blue-600 dark:text-blue-400 mb-1">ℹ {f}</div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                        {/* Review Actions (only if PENDING) */}
                                                        {pkt.review_state === 'PENDING' && (
                                                            <div className="rounded-lg border p-3 bg-white dark:bg-gray-900">
                                                                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Review Actions</h4>
                                                                <div className="space-y-3">
                                                                    <textarea
                                                                        className="w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700"
                                                                        placeholder="Review reason (required for all actions)..."
                                                                        rows={2}
                                                                        value={activePacketId === pkt.packet_id ? reviewReason : ''}
                                                                        onChange={(e) => {
                                                                            setActivePacketId(pkt.packet_id);
                                                                            setReviewReason(e.target.value);
                                                                        }}
                                                                    />
                                                                    <div className="flex flex-wrap gap-2">
                                                                        <Button
                                                                            size="sm"
                                                                            variant="default"
                                                                            disabled={!reviewReason.trim() || reviewMutation.isPending}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                reviewMutation.mutate({ packetId: pkt.packet_id, action: 'APPROVE', reason: reviewReason });
                                                                            }}
                                                                        >
                                                                            <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
                                                                            Approve
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="destructive"
                                                                            disabled={!reviewReason.trim() || reviewMutation.isPending}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                reviewMutation.mutate({ packetId: pkt.packet_id, action: 'FLAG_HR', reason: reviewReason });
                                                                            }}
                                                                        >
                                                                            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                                                                            Flag for HR
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            disabled={!reviewReason.trim() || reviewMutation.isPending}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                reviewMutation.mutate({ packetId: pkt.packet_id, action: 'NEEDS_MORE_DATA', reason: reviewReason });
                                                                            }}
                                                                        >
                                                                            <Eye className="h-3.5 w-3.5 mr-1" />
                                                                            Request More Data
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="secondary"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const taskText = prompt('Enter coaching task description:');
                                                                                if (taskText) {
                                                                                    coachingMutation.mutate({ techId: pkt.tech_id, packetId: pkt.packet_id, taskText });
                                                                                }
                                                                            }}
                                                                        >
                                                                            <MessageSquarePlus className="h-3.5 w-3.5 mr-1" />
                                                                            Create Coaching Task
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Previous review info */}
                                                        {pkt.reviewed_at && (
                                                            <div className="text-xs text-gray-400">
                                                                Reviewed {new Date(pkt.reviewed_at).toLocaleString()}
                                                                {pkt.review_reason && ` — "${pkt.review_reason}"`}
                                                            </div>
                                                        )}
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
