'use client';

import { useState, useEffect } from 'react';
import { performanceAPI as performanceApi } from '@/lib/api/performance';
import { PerformanceScore } from '@/lib/types/performance';
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
import { Trophy, TrendingUp, Users, Target, BookOpen, Star } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export default function PerformanceDashboard() {
    const { toast } = useToast();
    const [scores, setScores] = useState<PerformanceScore[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const scoresData = await performanceApi.getAllTechnicianScores();
                setScores(scoresData);
            } catch (err) {
                console.error('Error fetching performance data:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const getTrendIcon = (trend: string) => {
        switch (trend) {
            case 'improving':
                return <TrendingUp className="w-4 h-4 text-green-500" />;
            case 'declining':
                return <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />;
            case 'volatile':
                return <TrendingUp className="w-4 h-4 text-orange-500" />;
            default:
                return <span className="text-muted-foreground">-</span>;
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-green-600';
        if (score >= 75) return 'text-blue-600';
        if (score >= 60) return 'text-yellow-600';
        return 'text-red-600';
    };

    const avgScore = scores.length > 0
        ? Math.round(scores.reduce((sum, s) => sum + s.overall_score, 0) / scores.length)
        : 0;

    const topPerformer = scores.length > 0 ? scores[0] : null;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Performance Intelligence</h1>
                    <p className="text-muted-foreground">AI-driven technician scoring & quality metrics</p>
                </div>
                <Button variant="outline">
                    <BookOpen className="w-4 h-4 mr-2" /> View Training Needs
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Network Average</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${getScoreColor(avgScore)}`}>{avgScore}</div>
                        <p className="text-xs text-muted-foreground">overall score</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
                        <Trophy className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold truncate">
                            {topPerformer ? `${topPerformer.overall_score}` : 'N/A'}
                        </div>
                        <p className="text-xs text-muted-foreground truncate w-full">
                            {topPerformer ? 'Technician #' + topPerformer.technician_id.slice(0, 8) : 'No data'}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Technicians Scored</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{scores.length}</div>
                        <p className="text-xs text-muted-foreground">active this period</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Customer Rating</CardTitle>
                        <Star className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">4.8</div>
                        <p className="text-xs text-muted-foreground">average satisfaction</p>
                    </CardContent>
                </Card>
            </div>

            {/* Leaderboard Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Technician Leaderboard</CardTitle>
                    <CardDescription>Daily performance ranking based on AI scoring model</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Rank</TableHead>
                                <TableHead>Technician ID</TableHead>
                                <TableHead className="text-right">Overall Score</TableHead>
                                <TableHead className="text-right">Quality</TableHead>
                                <TableHead className="text-right">SLA</TableHead>
                                <TableHead className="text-right">Honesty</TableHead>
                                <TableHead className="text-right">Customer</TableHead>
                                <TableHead className="text-center">Trend</TableHead>
                                <TableHead className="text-right">Jobs</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-8">Loading...</TableCell>
                                </TableRow>
                            ) : scores.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                        No performance data available.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                scores.map((score, index) => (
                                    <TableRow key={score.id}>
                                        <TableCell className="font-medium">
                                            {index === 0 && <Trophy className="w-5 h-5 text-yellow-500 inline mr-2" />}
                                            #{index + 1}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {score.technician_id.slice(0, 8)}...
                                        </TableCell>
                                        <TableCell className={`text-right font-bold ${getScoreColor(score.overall_score)}`}>
                                            {score.overall_score}
                                        </TableCell>
                                        <TableCell className="text-right">{score.repair_quality_score}</TableCell>
                                        <TableCell className="text-right">{score.sla_compliance_score}</TableCell>
                                        <TableCell className="text-right">{score.part_usage_honesty_score}</TableCell>
                                        <TableCell className="text-right">{score.customer_satisfaction_score}</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex justify-center">{getTrendIcon(score.trend)}</div>
                                        </TableCell>
                                        <TableCell className="text-right">{score.jobs_completed}</TableCell>
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
