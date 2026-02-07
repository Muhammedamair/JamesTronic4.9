'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, BrainCircuit, AlertTriangle, Lightbulb } from 'lucide-react';

interface AiCockpitWidgetProps {
    initialSummary?: any; // Hydrated state if needed
}

export function AiCockpitWidget({ }: AiCockpitWidgetProps) {
    const [loading, setLoading] = useState(false);
    const [brainData, setBrainData] = useState<any>(null);

    const fetchBriefing = async () => {
        setLoading(true);
        try {
            // Create a Server Action wrapper or API route for this later. 
            // For now, assume we have an API endpoint /api/admin/ai-brain
            const res = await fetch('/api/admin/ai-brain', { method: 'POST' });
            const data = await res.json();
            setBrainData(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-indigo-500/20 bg-indigo-50/5 dark:bg-indigo-950/10 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                    <CardTitle className="text-lg font-bold flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                        <BrainCircuit className="h-5 w-5" />
                        JamesTronic Strategic Brain
                    </CardTitle>
                    <CardDescription>AI Co-Pilot & Risk Analyzer</CardDescription>
                </div>
                <Button
                    size="sm"
                    onClick={fetchBriefing}
                    disabled={loading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {brainData ? 'Refresh Intelligence' : 'Generate Briefing'}
                </Button>
            </CardHeader>

            <CardContent>
                {!brainData && !loading && (
                    <div className="text-sm text-gray-500 italic py-4 text-center">
                        Click "Generate Briefing" to analyze live ecosystem metrics.
                    </div>
                )}

                {brainData && (
                    <div className="space-y-4 animate-in fade-in duration-500">
                        {/* Summary */}
                        <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                            <p className="text-sm font-medium leading-relaxed text-gray-800 dark:text-gray-200">
                                {brainData.summary}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Risks */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1 uppercase tracking-wider">
                                    <AlertTriangle className="h-3 w-3" /> Risks Detected
                                </h4>
                                <ul className="space-y-1">
                                    {brainData.risks?.map((risk: string, i: number) => (
                                        <li key={i} className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-2 py-1.5 rounded">
                                            • {risk}
                                        </li>
                                    ))}
                                    {(!brainData.risks || brainData.risks.length === 0) && (
                                        <li className="text-xs text-gray-400 italic">No critical risks detected.</li>
                                    )}
                                </ul>
                            </div>

                            {/* Opportunities */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 uppercase tracking-wider">
                                    <Lightbulb className="h-3 w-3" /> Strategic Opportunities
                                </h4>
                                <ul className="space-y-1">
                                    {brainData.opportunities?.map((opp: string, i: number) => (
                                        <li key={i} className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1.5 rounded">
                                            • {opp}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="pt-2 flex justify-between items-center text-[10px] text-gray-400">
                            <span>Confidence: {brainData.confidence_score}%</span>
                            <span>Metrics: {brainData.metrics_used?.join(', ')}</span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
