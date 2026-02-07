'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Activity, Trophy, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useExpansionData } from '@/hooks/useExpansionData';
import { CityContextChip } from '@/components/expansion/shared/CityContextChip';
import { useSupabase } from '@/components/shared/supabase-provider';

export default function ExpansionDashboard() {
    const { cityName, getLatestRuns, cityId } = useExpansionData();
    const { supabase } = useSupabase();
    const [runs, setRuns] = useState<any[]>([]);
    const [topCandidates, setTopCandidates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function init() {
            setIsLoading(true);
            const latestRuns = await getLatestRuns(5);
            setRuns(latestRuns);

            // If we have a successful run, fetch top candidates
            const lastCompleted = latestRuns.find((r: any) => r.status === 'completed');
            if (lastCompleted) {
                const { data } = await supabase
                    .from('expansion_location_scores')
                    .select('*, expansion_candidate_locations(name, pincode)')
                    .eq('run_id', lastCompleted.id)
                    .order('final_score', { ascending: false })
                    .limit(5);
                setTopCandidates(data || []);
            }
            setIsLoading(false);
        }
        init();
    }, [cityId]); // Re-run when cityId is resolved

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
                    <h1 className="expansion-h1 italic tracking-tighter">ExpansionOS</h1>
                    <p className="expansion-sub">Strategic Market Planning & Demand Intelligence</p>
                </div>
                <CityContextChip cityName={cityName} />
            </header>

            {/* Health Banner */}
            <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                <Activity className="h-5 w-5 text-emerald-600" />
                <div>
                    <p className="text-sm font-medium text-emerald-900">Expansion Protocol V1: ACTIVE</p>
                    <p className="text-xs text-emerald-700">Compute ledger and RLS city-scoping are enforced for {cityName}.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="glass-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">Run Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900 capitalize">
                            {runs[0]?.status || 'No Runs'}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Latest execution status</p>
                    </CardContent>
                </Card>

                <Card className="glass-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">Top Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">
                            {topCandidates[0]?.final_score ? (topCandidates[0].final_score * 100).toFixed(1) + '%' : '--'}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Highest candidate score</p>
                    </CardContent>
                </Card>

                <Card className="glass-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Runs</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{runs.length}</div>
                        <p className="text-xs text-slate-500 mt-1">Total runs in this cycle</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Top Candidates Snapshot */}
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-amber-500" />
                            Top Recommendations
                        </h3>
                        {runs[0] && (
                            <Link href={`/app/manager/expansion/results/${runs.find((r: any) => r.status === 'completed')?.id || 'latest'}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                                View All <ArrowRight className="h-3 w-3" />
                            </Link>
                        )}
                    </div>
                    <div className="glass-card overflow-hidden">
                        {topCandidates.length > 0 ? (
                            <table className="w-full expansion-table-dense">
                                <thead>
                                    <tr>
                                        <th>Pincode</th>
                                        <th>Location</th>
                                        <th>Score</th>
                                    </tr>
                                </thead>
                                <tbody className="expansion-table-hover">
                                    {topCandidates.map((c) => (
                                        <tr key={c.id}>
                                            <td className="font-mono text-xs">{c.expansion_candidate_locations?.pincode}</td>
                                            <td>{c.expansion_candidate_locations?.name}</td>
                                            <td className="font-mono text-xs font-bold">{(c.final_score).toFixed(4)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-8 text-center text-sm text-slate-500">
                                No run results available yet for this city.
                            </div>
                        )}
                    </div>
                </section>

                {/* Quick Links / Actions */}
                <section className="space-y-4">
                    <h3 className="text-lg font-semibold">Operational Actions</h3>
                    <Link href="/app/manager/expansion/scenarios" className="block p-4 glass-card group">
                        <div className="flex justify-between items-center">
                            <div>
                                <h4 className="font-semibold text-slate-900">Manage Scenarios</h4>
                                <p className="text-xs text-slate-500">Configure weights and trigger new compute runs.</p>
                            </div>
                            <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                        </div>
                    </Link>
                    <Link href="/app/manager/expansion/audit" className="block p-4 glass-card group">
                        <div className="flex justify-between items-center">
                            <div>
                                <h4 className="font-semibold text-slate-900">System Audit</h4>
                                <p className="text-xs text-slate-500">Review compute ledger and event history.</p>
                            </div>
                            <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                        </div>
                    </Link>
                </section>
            </div>
        </div>
    );
}
