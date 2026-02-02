'use client';

import { useState, useEffect } from 'react';
import { franchiseApi } from '@/lib/api/franchise';
import { Territory, Application } from '@/lib/types/franchise';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Map, UserPlus, TrendingUp, CheckCircle, Smartphone } from 'lucide-react';

export default function ExpansionPage() {
    const [territories, setTerritories] = useState<Territory[]>([]);
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [t, a] = await Promise.all([
                franchiseApi.getHeatmap(),
                franchiseApi.getApplications()
            ]);
            setTerritories(t);
            setApplications(a);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const scoreApplicant = async (id: string) => {
        await franchiseApi.scoreApplication(id);
        loadData();
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-600';
        if (score >= 50) return 'text-yellow-600';
        return 'text-red-600';
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Network Expansion</h1>
                    <p className="text-muted-foreground">Franchise Intelligence & Territory Mapping</p>
                </div>
                <Button>
                    <UserPlus className="mr-2 h-4 w-4" /> New Application
                </Button>
            </div>

            <Tabs defaultValue="heatmap" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="heatmap">Demand Heatmap</TabsTrigger>
                    <TabsTrigger value="pipeline">Franchise Pipeline</TabsTrigger>
                </TabsList>

                <TabsContent value="heatmap" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {territories.map(t => (
                            <Card key={t.id} className="border-t-4 border-t-primary">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <div>
                                        <Badge variant="outline" className="mb-2">{t.city}</Badge>
                                        <CardTitle className="text-lg">{t.name}</CardTitle>
                                    </div>
                                    <div className={`text-xl font-bold ${getScoreColor(t.density_score)}`}>
                                        {t.density_score}
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-muted-foreground">Demand Density</span>
                                            <span>{t.density_score}%</span>
                                        </div>
                                        <Progress value={t.density_score} className="h-2" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div className="bg-muted p-2 rounded text-center">
                                            <div className="text-muted-foreground text-xs">Potential</div>
                                            <div className="font-semibold">₹{(t.estimated_revenue_potential / 1000).toFixed(0)}k</div>
                                        </div>
                                        <div className="bg-muted p-2 rounded text-center">
                                            <div className="text-muted-foreground text-xs">Status</div>
                                            <div className="font-semibold capitalize">{t.status.replace(/_/g, ' ')}</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="pipeline" className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        {applications.map(app => (
                            <Card key={app.id}>
                                <div className="flex flex-col md:flex-row items-start md:items-center p-6 gap-6">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-lg">{app.applicant_name}</h3>
                                            <Badge>{app.status}</Badge>
                                        </div>
                                        <div className="text-sm text-muted-foreground mb-4">
                                            {app.email} • Applied for {app.territory?.name || 'General'}
                                        </div>

                                        <div className="flex gap-6">
                                            <div className="text-center">
                                                <div className={`text-lg font-bold ${getScoreColor(app.financial_score)}`}>{app.financial_score}</div>
                                                <div className="text-xs text-muted-foreground">Financial</div>
                                            </div>
                                            <div className="text-center">
                                                <div className={`text-lg font-bold ${getScoreColor(app.experience_score)}`}>{app.experience_score}</div>
                                                <div className="text-xs text-muted-foreground">Experience</div>
                                            </div>
                                            <div className="text-center">
                                                <div className={`text-lg font-bold ${getScoreColor(app.location_score)}`}>{app.location_score}</div>
                                                <div className="text-xs text-muted-foreground">Location</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 min-w-[150px]">
                                        {app.financial_score === 0 ? (
                                            <Button variant="secondary" onClick={() => scoreApplicant(app.id)}>
                                                <TrendingUp className="mr-2 h-4 w-4" /> Run AI Score
                                            </Button>
                                        ) : (
                                            <Button disabled variant="outline" className="opacity-100 bg-green-50 text-green-700 border-green-200">
                                                <CheckCircle className="mr-2 h-4 w-4" /> Scored
                                            </Button>
                                        )}
                                        <Button variant="outline">View Details</Button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
