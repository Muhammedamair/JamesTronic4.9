'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, Activity, AlertCircle, FileText } from 'lucide-react';
import { AiEventsTable } from './components/AiEventsTable';
import { AiRecommendationsTable } from './components/AiRecommendationsTable';
import { AiValueScoresTable } from './components/AiValueScoresTable';
import { AiAuditTable } from './components/AiAuditTable';

export default function AiBrainPage() {
    const [activeTab, setActiveTab] = useState('events');
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    function triggerRefresh() {
        setRefreshTrigger(prev => prev + 1);
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Brain className="h-8 w-8 text-primary" />
                <div>
                    <h1 className="text-3xl font-bold">AI Brain Cockpit</h1>
                    <p className="text-muted-foreground">
                        Monitor AI events, recommendations, value scores, and audit logs
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="events" className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Events
                    </TabsTrigger>
                    <TabsTrigger value="recommendations" className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Recommendations
                    </TabsTrigger>
                    <TabsTrigger value="scores" className="flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        Value Scores
                    </TabsTrigger>
                    <TabsTrigger value="audit" className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Audit Log
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="events" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>AI Events</CardTitle>
                            <CardDescription>
                                Incoming events for AI processing (tickets, SLA breaches, compliance violations)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <AiEventsTable
                                refreshTrigger={refreshTrigger}
                                onProcessComplete={triggerRefresh}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="recommendations" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>AI Recommendations</CardTitle>
                            <CardDescription>
                                AI-generated recommendations awaiting review (RECOMMENDATION_ONLY mode)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <AiRecommendationsTable refreshTrigger={refreshTrigger} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="scores" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Value Function Scores</CardTitle>
                            <CardDescription>
                                OV/TV/BV/LGV scores per entity (Admin-only, not public)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <AiValueScoresTable refreshTrigger={refreshTrigger} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="audit" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Audit Log</CardTitle>
                            <CardDescription>
                                Complete audit trail of all AI decisions and actions
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <AiAuditTable refreshTrigger={refreshTrigger} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
