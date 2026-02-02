'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Play, History, Edit2, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useExpansionData } from '@/hooks/useExpansionData';
import { useSupabase } from '@/components/shared/supabase-provider';
import { useToast } from '@/components/ui/use-toast';

export default function ScenariosPage() {
    const { getScenarios, getLatestRuns, cityId } = useExpansionData();
    const { supabase } = useSupabase();
    const { toast } = useToast();
    const [scenarios, setScenarios] = useState<any[]>([]);
    const [runs, setRuns] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRunning, setIsRunning] = useState<string | null>(null);

    async function loadData() {
        setIsLoading(true);
        const [s, r] = await Promise.all([getScenarios(), getLatestRuns()]);
        setScenarios(s);
        setRuns(r);
        setIsLoading(false);
    }

    useEffect(() => {
        loadData();
    }, [cityId]);

    const handleRunScenario = async (scenarioId: string) => {
        setIsRunning(scenarioId);
        try {
            // 1. Create a new run record
            const runId = crypto.randomUUID();
            const { error: insertErr } = await supabase
                .from('expansion_scenario_runs')
                .insert({
                    id: runId,
                    scenario_id: scenarioId,
                    city_id: cityId,
                    status: 'pending'
                });

            if (insertErr) throw insertErr;

            // 2. Trigger RPC
            const { data, error } = await supabase.rpc('rpc_c20_run_scenario', { p_run_id: runId });

            if (error) {
                toast({ title: 'Run Failed', description: error.message, variant: 'destructive' });
            } else if (data?.success) {
                toast({ title: 'Run Successful', description: `Scored ${data.candidates_scored} candidates.` });
                await loadData();
            }
        } catch (e: any) {
            toast({ title: 'Execution Error', description: e.message, variant: 'destructive' });
        }
        setIsRunning(null);
    };

    return (
        <div className="expansion-container">
            <header className="expansion-header">
                <div>
                    <h1 className="expansion-h1">Expansion Scenarios</h1>
                    <p className="expansion-sub">Configure and simulate market expansion strategies</p>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Scenario
                </Button>
            </header>

            <div className="glass-card overflow-hidden min-h-[200px]">
                {isLoading ? (
                    <div className="flex h-24 items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    </div>
                ) : (
                    <table className="w-full expansion-table-dense">
                        <thead>
                            <tr>
                                <th>Scenario Name</th>
                                <th>Weights</th>
                                <th>Latest Run</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="expansion-table-hover">
                            {scenarios.map((s) => (
                                <tr key={s.id}>
                                    <td>
                                        <div className="font-medium text-slate-900">{s.name}</div>
                                        <div className="text-[10px] text-slate-400 font-mono italic">ID: {s.id.split('-')[0]}</div>
                                    </td>
                                    <td>
                                        <div className="flex gap-2 text-[10px] font-medium text-slate-500">
                                            <span>T: {s.weight_travel_time}</span>
                                            <span>D: {s.weight_demand}</span>
                                            <span>C: {s.weight_competition}</span>
                                        </div>
                                    </td>
                                    <td>
                                        {runs.find(r => r.scenario_id === s.id) ? (
                                            <Badge className={cn(
                                                "badge-compute",
                                                runs.find(r => r.scenario_id === s.id).status === 'completed' ? "badge-compute-completed" :
                                                    runs.find(r => r.scenario_id === s.id).status === 'processing' ? "badge-compute-processing" :
                                                        "badge-compute-failed"
                                            )}>
                                                {runs.find(r => r.scenario_id === s.id).status}
                                            </Badge>
                                        ) : (
                                            <span className="text-xs text-slate-400">Never Run</span>
                                        )}
                                    </td>
                                    <td className="text-right space-x-2">
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Edit">
                                            <Edit2 className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-blue-600"
                                            title="Run Now"
                                            disabled={isRunning === s.id}
                                            onClick={() => handleRunScenario(s.id)}
                                        >
                                            {isRunning === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {scenarios.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-slate-500">No scenarios defined for this city.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            <section className="mt-12">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <History className="h-5 w-5 text-slate-400" />
                    Recent Execution Ledger
                </h3>
                <div className="glass-card p-0 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs text-slate-500 font-medium">
                        <span>Execution Status</span>
                        <span>Audit Link</span>
                    </div>
                    <div className="p-4 space-y-4">
                        {runs.slice(0, 3).map((r) => (
                            <div key={r.id} className="flex items-start gap-4">
                                {r.status === 'completed' ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-1" /> :
                                    r.status === 'failed' ? <XCircle className="h-4 w-4 text-rose-500 mt-1" /> :
                                        <Loader2 className="h-4 w-4 text-blue-500 animate-spin mt-1" />}
                                <div className="flex-1">
                                    <p className="text-sm font-medium">
                                        Run for "{r.expansion_scenarios?.name}" {r.status}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-mono italic">{r.id}</p>
                                </div>
                                <Link href={r.status === 'completed' ? `/app/manager/expansion/results/${r.id}` : '#'}
                                    className={cn("text-xs font-semibold", r.status === 'completed' ? "text-blue-600 hover:underline" : "text-slate-300 pointer-events-none")}>
                                    Results
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
