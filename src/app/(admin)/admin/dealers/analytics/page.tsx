
'use client';

import { useState, useEffect } from 'react';
import { dealerApi } from '@/lib/api/dealer';
import { DealerDashboardSummary } from '@/lib/types/dealer';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell
} from '@/components/ui/table';
import {
    TrendingUp,
    AlertTriangle,
    ShieldCheck,
    BrainCircuit,
    ArrowRight,
    RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DealerAnalyticsPage() {
    const [summaries, setSummaries] = useState<DealerDashboardSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRiskOnly, setShowRiskOnly] = useState(false);
    const router = useRouter();

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const data = await dealerApi.getDealerAnalyticsDashboard(
                30, // 30 day window default
                1,
                100,
                showRiskOnly ? 'risk' : null
            );
            setSummaries(data);
        } catch (err) {
            console.error('Error fetching analytics:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [showRiskOnly]);

    const getScoreBadge = (score: number) => {
        if (score >= 90) return <Badge className="bg-green-600">{score}</Badge>;
        if (score >= 75) return <Badge className="bg-blue-500">{score}</Badge>;
        if (score >= 60) return <Badge className="bg-yellow-500">{score}</Badge>;
        return <Badge variant="destructive">{score}</Badge>;
    };

    const getTrustBadge = (trust: number) => {
        if (trust >= 90) return <Badge variant="outline" className="text-green-600 border-green-600">{trust}% High</Badge>;
        if (trust >= 70) return <Badge variant="outline" className="text-blue-500 border-blue-500">{trust}% Good</Badge>;
        if (trust >= 50) return <Badge variant="outline" className="text-yellow-500 border-yellow-500">{trust}% Fair</Badge>;
        return <Badge variant="outline" className="text-red-500 border-red-500">{trust}% Low</Badge>;
    };

    // Calculate aggregations
    const avgReliability = summaries.length > 0
        ? Math.round(summaries.reduce((acc, s) => acc + (s.reliability_score ?? 0), 0) / summaries.length)
        : 0;

    const highTrustCount = summaries.filter(s => (s.trust_value ?? 0) >= 80).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dealer Analytics Engine (V1)</h1>
                    <p className="text-muted-foreground">
                        Real-time VFL Usefulness Scores & Performance Explainability
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="risk-mode"
                            checked={showRiskOnly}
                            onCheckedChange={setShowRiskOnly}
                        />
                        <Label htmlFor="risk-mode">Show At-Risk Only</Label>
                    </div>
                    <Button variant="outline" size="icon" onClick={fetchAnalytics}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Reliability (30d)</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{avgReliability}</div>
                        <p className="text-xs text-muted-foreground">Across all visible dealers</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">High Trust Partners</CardTitle>
                        <ShieldCheck className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{highTrustCount}</div>
                        <p className="text-xs text-muted-foreground">Trust Value {'>'}= 80</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">AI Observation</CardTitle>
                        <BrainCircuit className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm font-medium">VFL Engine Active</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Scoring based on 7/30/90 day sliding windows.
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Analytics Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Dealer Scorecards</CardTitle>
                    <CardDescription>
                        Explainable scores based on immutable operational facts.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Dealer</TableHead>
                                <TableHead>Reliability Score</TableHead>
                                <TableHead>Trust Value (VFL)</TableHead>
                                <TableHead>Confidence</TableHead>
                                <TableHead>Primary Reason</TableHead>
                                <TableHead>Last Computed</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8">Loading analytics...</TableCell>
                                </TableRow>
                            ) : summaries.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        No analytics data found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                summaries.map((s) => (
                                    <TableRow key={s.dealer_id} className="group">
                                        <TableCell className="font-medium">
                                            <div>{s.dealer_name}</div>
                                            <div className="text-xs text-muted-foreground">{s.city}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {getScoreBadge(s.reliability_score ?? 0)}
                                                {/* <span className="text-xs text-muted-foreground">Target: 95</span> */}
                                            </div>
                                        </TableCell>
                                        <TableCell>{getTrustBadge(s.trust_value ?? 0)}</TableCell>
                                        <TableCell>
                                            <div className="w-[80px] h-2 bg-secondary rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500"
                                                    style={{ width: `${s.confidence_score ?? 0}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-muted-foreground">{s.confidence_score ?? 0}%</span>
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate" title={s.primary_reason || ''}>
                                            {s.primary_reason || '-'}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {s.last_computed_at ? format(new Date(s.last_computed_at), 'MMM d, HH:mm') : 'Pending'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" asChild>
                                                <Link href={`/admin/dealers/${s.dealer_id}/analytics`}>
                                                    Deep Dive <ArrowRight className="ml-2 h-3 w-3" />
                                                </Link>
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
