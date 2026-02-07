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
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { timeAgo } from '@/lib/utils/time';

interface ValueScore {
    id: string;
    event_id: string;
    ov: number | null;
    tv: number | null;
    bv: number | null;
    lgv: number | null;
    total_score: number | null;
    created_at: string;
    entity_type?: string;
    entity_id?: string;
}

interface AiValueScoresTableProps {
    refreshTrigger?: number;
}

export function AiValueScoresTable({ refreshTrigger }: AiValueScoresTableProps = {}) {
    const [scores, setScores] = useState<ValueScore[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Helper: Supabase might return numeric as string, parse safely
    const toNum = (v: number | string | null | undefined): number | null => {
        if (v === null || v === undefined) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };

    async function fetchScores() {
        setLoading(true);
        const supabase = createClient();

        // 1) Select using REAL column names + JOIN ai_events for entity info
        // We join ai_events via the event_id FK
        let query = supabase
            .from('value_function_scores')
            .select(`
                id,
                event_id,
                ov, tv, bv, lgv, total_score,
                created_at,
                ai_events (
                    entity_type,
                    entity_id
                )
            `)
            .order('created_at', { ascending: false })
            .limit(50);

        if (searchTerm) {
            // Filter by event_id or joined entity_id.
            // Note: filtering on joined columns with OR syntax can be tricky in Supabase JS.
            // We'll try a simpler filter first or fall back to event_id.
            query = query.or(`event_id.ilike.%${searchTerm}%,ai_events.entity_id.ilike.%${searchTerm}%`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Failed to fetch value scores:', error);
        } else {
            // 2) Parse and flatten
            const parsed = (data || []).map((row: any) => ({
                id: row.id,
                event_id: row.event_id,
                // Flatten entity info from joined table (with fallback)
                entity_type: row.ai_events?.entity_type || 'Unknown',
                entity_id: row.ai_events?.entity_id || 'Unknown',
                // Map scores
                ov: toNum(row.ov),
                tv: toNum(row.tv),
                bv: toNum(row.bv),
                lgv: toNum(row.lgv),
                total_score: toNum(row.total_score),
                created_at: row.created_at
            }));
            setScores(parsed);
        }
        setLoading(false);
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchScores();

        const supabase = createClient();
        const channel = supabase
            .channel('value_scores_realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'value_function_scores',
            }, () => {
                fetchScores();
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [searchTerm, refreshTrigger]);



    function getScoreColor(score: number | null): string {
        const val = score ?? 0;
        if (val >= 80) return 'text-green-600 font-semibold';
        if (val >= 60) return 'text-yellow-600';
        return 'text-red-600 font-semibold';
    }

    function ScoreBar({ value, label, color }: { value: number | null; label: string; color: string }) {
        const safeValue = value ?? 0;
        const displayValue = value === null ? '—' : safeValue.toFixed(1);
        const width = Math.max(0, Math.min(100, safeValue));

        return (
            <div>
                <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{label}</span>
                    <span className={getScoreColor(value)}>{displayValue}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className={`${color} h-2 rounded-full transition-all`}
                        style={{ width: `${width}%` }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filter */}
            <Input
                placeholder="Search by entity ID or event ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
            />

            {/* Table */}
            {loading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </div>
            ) : scores.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    No value scores found
                </div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Entity / Event</TableHead>
                                <TableHead className="w-[200px]">Trust (TV)</TableHead>
                                <TableHead className="w-[200px]">Operational (OV)</TableHead>
                                <TableHead className="w-[200px]">Brand (BV)</TableHead>
                                <TableHead className="w-[200px]">Governance (LGV)</TableHead>
                                <TableHead>Composite</TableHead>
                                <TableHead>Updated</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {scores.map((score) => (
                                <TableRow key={score.id}>
                                    <TableCell>
                                        <div className="text-sm">
                                            <div className="font-medium">{score.entity_type}</div>
                                            <div className="text-muted-foreground text-xs font-mono mb-1">{score.entity_id}</div>
                                            <div className="text-xs text-muted-foreground">Event: {score.event_id?.substring(0, 8)}...</div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <ScoreBar value={score.tv} label="TV" color="bg-green-500" />
                                    </TableCell>
                                    <TableCell>
                                        <ScoreBar value={score.ov} label="OV" color="bg-blue-500" />
                                    </TableCell>
                                    <TableCell>
                                        <ScoreBar value={score.bv} label="BV" color="bg-purple-500" />
                                    </TableCell>
                                    <TableCell>
                                        <ScoreBar value={score.lgv} label="LGV" color="bg-orange-500" />
                                    </TableCell>
                                    <TableCell>
                                        <div className={`text-2xl font-bold ${getScoreColor(score.total_score)}`}>
                                            {score.total_score === null ? '—' : score.total_score.toFixed(1)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {timeAgo(score.created_at)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Legend */}
            <div className="bg-muted p-4 rounded-lg">
                <div className="text-sm font-medium mb-2">Value Function Weights:</div>
                <div className="grid grid-cols-4 gap-4 text-xs">
                    <div><strong>Trust Value (TV)</strong>: 40% - Primary axis</div>
                    <div><strong>Operational Value (OV)</strong>: 30%</div>
                    <div><strong>Brand Value (BV)</strong>: 20%</div>
                    <div><strong>Governance Value (LGV)</strong>: 10%</div>
                </div>
            </div>
        </div>
    );
}
