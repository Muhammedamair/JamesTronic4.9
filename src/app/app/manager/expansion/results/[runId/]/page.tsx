'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Info, Download, Loader2, MapPinned, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSupabase } from '@/components/shared/supabase-provider';
import { useExpansionData } from '@/hooks/useExpansionData';

export default function ResultsPage() {
    const params = useParams();
    const runId = params.runId as string;
    const { supabase } = useSupabase();
    const { cityName } = useExpansionData();
    const [scores, setScores] = useState<any[]>([]);
    const [runDetails, setRunDetails] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchResults() {
            setIsLoading(true);

            // 1. Fetch Run & Scenario Details
            const { data: run } = await supabase
                .from('expansion_scenario_runs')
                .select('*, expansion_scenarios(*)')
                .eq('id', runId)
                .single();

            setRunDetails(run);

            // 2. Fetch Scores
            const { data: scoreData } = await supabase
                .from('expansion_location_scores')
                .select('*, expansion_candidate_locations(*)')
                .eq('run_id', runId)
                .order('final_score', { ascending: false });

            setScores(scoreData || []);
            setIsLoading(false);
        }
        fetchResults();
    }, [runId]);

    if (isLoading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="expansion-container">
            <header className="expansion-header">
                <div>
                    <h1 className="expansion-h1 italic">Compute Analysis</h1>
                    <p className="expansion-sub italic text-[10px] font-mono">Run ID: {runId}</p>
                </div>
                <Button variant="outline" className="h-9">
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                </Button>
            </header>

            {/* Run Header */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <Card className="glass-card">
                    <CardHeader className="p-3">
                        <CardTitle className="text-[10px] uppercase text-slate-500 font-bold">Status</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <Badge className={cn(
                            "badge-compute",
                            runDetails?.status === 'completed' ? "badge-compute-completed" : "badge-compute-failed"
                        )}>
                            {runDetails?.status}
                        </Badge>
                    </CardContent>
                </Card>
                <Card className="glass-card">
                    <CardHeader className="p-3">
                        <CardTitle className="text-[10px] uppercase text-slate-500 font-bold">Candidates</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-xl font-bold">{scores.length}</div>
                    </CardContent>
                </Card>
                <Card className="glass-card">
                    <CardHeader className="p-3">
                        <CardTitle className="text-[10px] uppercase text-slate-500 font-bold">Scenario</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-sm font-semibold truncate">{runDetails?.expansion_scenarios?.name || 'Manual Run'}</div>
                    </CardContent>
                </Card>
                <Card className="glass-card">
                    <CardHeader className="p-3">
                        <CardTitle className="text-[10px] uppercase text-slate-500 font-bold">City Profile</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-sm font-semibold">{cityName}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <section className="lg:col-span-2">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-amber-500" />
                        Ranked Candidate Locations
                    </h3>
                    <div className="glass-card overflow-hidden">
                        <table className="w-full expansion-table-dense">
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Pincode</th>
                                    <th>Location Name</th>
                                    <th className="text-right">Final Score</th>
                                </tr>
                            </thead>
                            <tbody className="expansion-table-hover">
                                {scores.map((s, idx) => (
                                    <tr key={s.id} className={idx === 0 ? "bg-emerald-50/20" : ""}>
                                        <td className={cn("font-bold", idx === 0 ? "text-emerald-700" : "text-slate-400")}>
                                            #{idx + 1}
                                        </td>
                                        <td className="font-mono text-xs">{s.expansion_candidate_locations?.pincode}</td>
                                        <td className="text-slate-700 font-medium">{s.expansion_candidate_locations?.name}</td>
                                        <td className="text-right font-mono font-bold">{(s.final_score).toFixed(4)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Scale className="h-5 w-5 text-blue-500" />
                            Weight Distribution
                        </h3>
                        <Card className="glass-card">
                            <CardContent className="p-4 space-y-4">
                                <WeightRow label="Travel Time" value={runDetails?.expansion_scenarios?.weight_travel_time} />
                                <WeightRow label="Demand Density" value={runDetails?.expansion_scenarios?.weight_demand} />
                                <WeightRow label="Competition" value={runDetails?.expansion_scenarios?.weight_competition} />
                            </CardContent>
                        </Card>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <MapPinned className="h-5 w-5 text-slate-400" />
                            Drilldown Insights
                        </h3>
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                            <p className="text-xs text-slate-500 italic">
                                Select a candidate row to view specific distance and coverage metrics for that location. (Drilldown Drawer coming in V2)
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

function WeightRow({ label, value }: { label: string, value: number }) {
    if (value === undefined) return null;
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-600">{label}</span>
                <span className="text-blue-600">{(value * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full" style={{ width: `${value * 100}%` }} />
            </div>
        </div>
    );
}

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
