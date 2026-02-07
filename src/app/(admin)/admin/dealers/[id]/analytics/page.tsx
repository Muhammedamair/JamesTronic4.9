
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { dealerApi } from '@/lib/api/dealer';
import { Dealer, DealerScoreSnapshot, DealerEventFact } from '@/lib/types/dealer';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell
} from '@/components/ui/table';
import {
    Activity,
    ShieldCheck,
    BrainCircuit,
    Clock,
    AlertCircle,
    CheckCircle2,
    History,
    RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';

export default function DealerAnalyticsDetailPage() {
    const params = useParams();
    const dealerId = params.id as string;

    const [dealer, setDealer] = useState<Dealer | null>(null);
    const [snapshots, setSnapshots] = useState<DealerScoreSnapshot[]>([]);
    const [facts, setFacts] = useState<DealerEventFact[]>([]);
    const [loading, setLoading] = useState(true);
    const [computing, setComputing] = useState(false);

    // UI State
    const [windowDays, setWindowDays] = useState('30');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [dealerData, factsData, scoresData] = await Promise.all([
                dealerApi.getDealerById(dealerId),
                dealerApi.getDealerEventFacts(dealerId, 50),
                dealerApi.getDealerScoreHistory(dealerId, parseInt(windowDays), 1) // Get latest snapshot for selected window
            ]);

            setDealer(dealerData);
            setFacts(factsData);
            setSnapshots(scoresData); // Only fetching latest for now, but could fetch more history
        } catch (err) {
            console.error('Error fetching dealer analytics:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRecompute = async () => {
        setComputing(true);
        try {
            await dealerApi.computeScores(dealerId);
            await fetchData(); // Refresh data
        } catch (err) {
            console.error('Error recomputing scores:', err);
        } finally {
            setComputing(false);
        }
    };

    useEffect(() => {
        if (dealerId) {
            fetchData();
        }
    }, [dealerId, windowDays]);

    if (loading && !dealer) {
        return <div className="p-8 text-center">Loading Data Mesh...</div>;
    }

    if (!dealer) {
        return <div className="p-8 text-center text-destructive">Dealer not found via ID lookup.</div>;
    }

    const currentSnapshot = snapshots.length > 0 ? snapshots[0] : null;

    const getScoreColor = (score: number) => {
        if (score >= 90) return "text-green-600";
        if (score >= 70) return "text-blue-600";
        if (score >= 50) return "text-yellow-600";
        return "text-red-600";
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{dealer.name}</h1>
                    <div className="flex items-center text-muted-foreground mt-1 gap-2">
                        <Badge variant="outline">{dealer.city || 'No City'}</Badge>
                        <span className="text-sm">•</span>
                        <span className="text-sm text-muted-foreground font-mono">{dealerId}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleRecompute} disabled={computing}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${computing ? 'animate-spin' : ''}`} />
                        {computing ? 'Running VFL...' : 'Recompute Scores'}
                    </Button>
                </div>
            </div>

            {/* Main Tabs */}
            <Tabs defaultValue="30" onValueChange={setWindowDays} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="7">7 Days</TabsTrigger>
                    <TabsTrigger value="30">30 Days</TabsTrigger>
                    <TabsTrigger value="90">90 Days</TabsTrigger>
                </TabsList>

                {/* VFL Scorecard */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Primary Scorecard */}
                    <Card className="md:col-span-1">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-primary" />
                                VFL Usefulness Score
                            </CardTitle>
                            <CardDescription>
                                Consolidated reliability metric based on operational facts.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {currentSnapshot ? (
                                <>
                                    <div className="flex items-baseline justify-between">
                                        <div className={`text-5xl font-extrabold ${getScoreColor(currentSnapshot.reliability_score ?? 0)}`}>
                                            {currentSnapshot.reliability_score ?? 'N/A'}
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm text-muted-foreground">Confidence</div>
                                            <div className="font-semibold">{currentSnapshot.confidence_score}%</div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span>Trust Value</span>
                                            <span className="font-medium">{currentSnapshot.trust_value}%</span>
                                        </div>
                                        <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                            <div
                                                className="bg-green-600 h-full"
                                                style={{ width: `${currentSnapshot.trust_value ?? 0}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="p-4 bg-muted/50 rounded-lg border">
                                        <div className="text-sm font-medium mb-1">Explainability (Primary Reason)</div>
                                        <div className="text-sm text-muted-foreground flex items-start gap-2">
                                            <BrainCircuit className="w-4 h-4 mt-0.5 shrink-0" />
                                            {currentSnapshot.primary_reason || 'No specific reason identified.'}
                                        </div>
                                        {currentSnapshot.contributing_factors && currentSnapshot.contributing_factors.length > 0 && (
                                            <div className="mt-2 pl-6">
                                                <ul className="list-disc text-xs text-muted-foreground">
                                                    {currentSnapshot.contributing_factors.map((f, i) => (
                                                        <li key={i}>{f}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Computed: {format(new Date(currentSnapshot.computed_at), 'MMM d, yyyy HH:mm:ss')}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    No snapshot available for this window.
                                    <br />
                                    <Button variant="link" onClick={handleRecompute} className="mt-2">Compute Now</Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Flight Recorder Log (Condensed) */}
                    <Card className="md:col-span-1 flex flex-col">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="w-5 h-5 text-primary" />
                                Recent Event Facts
                            </CardTitle>
                            <CardDescription>
                                Immutable "Flight Recorder" stream (Last 50 events).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto max-h-[400px]">
                            {facts.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    No events recorded via Flight Recorder.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {facts.map((fact) => (
                                        <div key={fact.id} className="flex items-start gap-3 text-sm pb-3 border-b last:border-0 border-border/50">
                                            {fact.event_type === 'order_fulfilled' ? (
                                                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                            ) : fact.event_type.includes('delay') || fact.event_type.includes('issue') ? (
                                                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                                            ) : (
                                                <History className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                            )}

                                            <div className="flex-1">
                                                <div className="font-medium flex justify-between">
                                                    <span>{fact.event_type}</span>
                                                    <span className="text-xs text-muted-foreground font-normal">
                                                        {format(new Date(fact.occurred_at), 'MMM d, HH:mm')}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    Context: {fact.context_type} • ID: ...{fact.context_id?.slice(-6)}
                                                </div>
                                                {fact.payload && Object.keys(fact.payload).length > 0 && (
                                                    <div className="text-xs font-mono bg-muted p-1 mt-1 rounded text-muted-foreground truncate max-w-[300px]">
                                                        {JSON.stringify(fact.payload)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </Tabs>
        </div>
    );
}
