'use client';

import { useState, useEffect } from 'react';
import { workforceApi } from '@/lib/api/workforce';
import { WorkforceBehaviourScore } from '@/lib/types/workforce';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
import { format } from 'date-fns';
import { Users, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function WorkforceDashboard() {
    const [scores, setScores] = useState<WorkforceBehaviourScore[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchScores() {
            try {
                const today = format(new Date(), 'yyyy-MM-dd');
                // In a real scenario, we'd join with profiles to get names.
                // For now, listing scores by user_id.
                const data = await workforceApi.getAllWorkforceScores(today);
                setScores(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchScores();
    }, []);

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight">Workforce Reliability Dashboard</h1>
                <Button>Log Incident</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{scores.length}</div>
                        <p className="text-xs text-muted-foreground">Scored today</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Reliability</CardTitle>
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {scores.length > 0
                                ? Math.round(scores.reduce((acc, s) => acc + s.composite_score, 0) / scores.length)
                                : 0}%
                        </div>
                        <p className="text-xs text-muted-foreground">Composite score</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">At Risk</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {scores.filter(s => s.composite_score < 75).length}
                        </div>
                        <p className="text-xs text-muted-foreground">Score &lt; 75</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Daily Performance</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User ID</TableHead>
                                <TableHead>Score</TableHead>
                                <TableHead>Reliability</TableHead>
                                <TableHead>Punctuality</TableHead>
                                <TableHead>Quality</TableHead>
                                <TableHead>Incidents</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-4">Loading...</TableCell>
                                </TableRow>
                            ) : scores.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                                        No scores generated for today.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                scores.map((score) => (
                                    <TableRow key={score.id}>
                                        <TableCell className="font-mono text-xs">{score.user_id}</TableCell>
                                        <TableCell>
                                            <Badge variant={score.composite_score >= 90 ? 'default' : score.composite_score >= 75 ? 'secondary' : 'destructive'}>
                                                {score.composite_score}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{score.reliability_score}%</TableCell>
                                        <TableCell>{score.punctuality_score}%</TableCell>
                                        <TableCell>{score.quality_score}%</TableCell>
                                        <TableCell>{score.incident_factor > 0 ? `-${score.incident_factor}` : '-'}</TableCell>
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
