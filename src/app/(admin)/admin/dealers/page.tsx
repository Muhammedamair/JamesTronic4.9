'use client';

import { useState, useEffect } from 'react';
import { dealerApi } from '@/lib/api/dealer';
import { Dealer, DealerScoreSnapshot } from '@/lib/types/dealer';
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
import { Building2, TrendingUp, AlertTriangle, Plus, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

export default function DealersPage() {
    const [dealers, setDealers] = useState<Dealer[]>([]);
    const [scores, setScores] = useState<Record<string, DealerScoreSnapshot>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const dealerData = await dealerApi.getAllDealers();
                setDealers(dealerData);

                // Fetch scores for each dealer
                const scoreMap: Record<string, DealerScoreSnapshot> = {};
                for (const dealer of dealerData) {
                    const score = await dealerApi.getDealerScore(dealer.id);
                    if (score) {
                        scoreMap[dealer.id] = score;
                    }
                }
                setScores(scoreMap);
            } catch (err) {
                console.error('Error fetching dealers:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const getScoreBadge = (score?: number | null) => {
        if (!score && score !== 0) return <Badge variant="secondary">N/A</Badge>;
        if (score >= 90) return <Badge className="bg-green-600">{score}</Badge>;
        if (score >= 75) return <Badge className="bg-yellow-500">{score}</Badge>;
        if (score >= 60) return <Badge variant="secondary">{score}</Badge>;
        return <Badge variant="destructive">{score}</Badge>;
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <Badge className="bg-green-600">Active</Badge>;
            case 'pending_kyc':
                return <Badge variant="secondary">Pending KYC</Badge>;
            case 'suspended':
                return <Badge variant="destructive">Suspended</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    // Helper to safely extract metrics for list items
    const getMetric = (score: DealerScoreSnapshot | undefined, key: string): number => {
        if (!score?.metrics_snapshot) return 0;
        const val = score.metrics_snapshot[key];
        return typeof val === 'number' ? val : 0;
    };

    const activeCount = dealers.filter(d => d.status === 'active').length;
    const avgScore = Object.values(scores).length > 0
        ? Math.round(Object.values(scores).reduce((acc, s) => acc + (s.reliability_score || 0), 0) / Object.values(scores).length)
        : 0;
    const atRiskCount = Object.values(scores).filter(s => (s.reliability_score || 0) < 70).length;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dealer Network</h1>
                    <p className="text-muted-foreground">Manage your parts supply chain</p>
                </div>
                <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Dealer
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Dealers</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeCount}</div>
                        <p className="text-xs text-muted-foreground">In network</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Reliability</CardTitle>
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{avgScore}%</div>
                        <p className="text-xs text-muted-foreground">Composite score</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">At Risk</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{atRiskCount}</div>
                        <p className="text-xs text-muted-foreground">Score &lt; 70</p>
                    </CardContent>
                </Card>
            </div>

            {/* Dealers Table */}
            <Card>
                <CardHeader>
                    <CardTitle>All Dealers</CardTitle>
                    <CardDescription>Click on a dealer to view full details and history</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>City</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Reliability</TableHead>
                                <TableHead>Availability</TableHead>
                                <TableHead>Quality</TableHead>
                                <TableHead>Created</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                                </TableRow>
                            ) : dealers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        No dealers in network yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                dealers.map((dealer) => {
                                    const score = scores[dealer.id];
                                    return (
                                        <TableRow key={dealer.id} className="cursor-pointer hover:bg-muted/50">
                                            <TableCell className="font-medium">
                                                <Link href={`/admin/dealers/${dealer.id}`} className="hover:underline">
                                                    {dealer.name}
                                                </Link>
                                            </TableCell>
                                            <TableCell>{dealer.city || '-'}</TableCell>
                                            <TableCell>{getStatusBadge(dealer.status)}</TableCell>
                                            <TableCell>{getScoreBadge(score?.reliability_score)}</TableCell>
                                            <TableCell>{score ? `${getMetric(score, 'availability_score')}%` : '-'}</TableCell>
                                            <TableCell>{score ? `${getMetric(score, 'quality_score')}%` : '-'}</TableCell>
                                            <TableCell>{format(new Date(dealer.created_at), 'MMM d, yyyy')}</TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
