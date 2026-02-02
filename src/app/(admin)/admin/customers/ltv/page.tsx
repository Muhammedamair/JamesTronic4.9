'use client';

import { useState, useEffect } from 'react';
import { behaviorApi } from '@/lib/api/behavior';
import { BehaviorProfile } from '@/lib/types/behavior';
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
import { Fingerprint, BarChart4, TrendingUp, AlertTriangle, UserCheck } from 'lucide-react'; // Changed DNA to Fingerprint if DNA not available, checking Lucide... DNA is Fingerprint or similar metaphors. Fingerprint is good.
// Actually Lucide has 'Dna' icon in newer versions, but to be safe sticking to common ones. 
// Let's use 'Fingerprint' for identification/DNA metaphor.
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { useSupabase } from '@/components/shared/supabase-provider';

export default function ConsumerBehaviorDashboard() {
    const { toast } = useToast();
    const { user } = useSupabase();
    const [profiles, setProfiles] = useState<BehaviorProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);

    const fetchData = async () => {
        try {
            const data = await behaviorApi.getAllProfiles();
            setProfiles(data);
        } catch (err) {
            console.error('Error fetching behavior data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAnalyzeSelf = async () => {
        if (!user) {
            toast({ title: 'No User', description: 'Log in to simulate analysis on self.', variant: 'destructive' });
            return;
        }
        setAnalyzing(true);
        try {
            await behaviorApi.analyzeCustomer(user.id);
            toast({ title: 'Analysis Complete', description: 'Your behavior profile has been updated.' });
            fetchData();
        } catch (err) {
            console.error(err);
            toast({ title: 'Analysis Failed', description: 'Could not analyze customer.', variant: 'destructive' });
        } finally {
            setAnalyzing(false);
        }
    };

    // NOTE: For demo purposes, we might want to simulate analysis on a dummy user if none exists in list?
    // But profiles list might be empty initially.

    const getLTVBadge = (band: string | null) => {
        switch (band) {
            case 'vip': return <Badge className="bg-purple-600">VIP</Badge>;
            case 'high': return <Badge className="bg-green-600">High Value</Badge>;
            case 'medium': return <Badge className="bg-blue-500">Medium</Badge>;
            case 'strategic': return <Badge className="bg-amber-500 text-black">Strategic</Badge>;
            default: return <Badge variant="outline">Low/New</Badge>;
        }
    };

    const getChurnBadge = (risk: string | null) => {
        if (risk?.includes('high') || risk?.includes('imminent')) {
            return <Badge variant="destructive">High Risk</Badge>;
        }
        if (risk?.includes('medium')) {
            return <Badge variant="secondary" className="text-orange-600">Medium Risk</Badge>;
        }
        return <Badge variant="outline" className="text-green-600 border-green-600">Safe</Badge>;
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Customer DNA & LTV</h1>
                    <p className="text-muted-foreground">Behavioral segmentation and retention intelligence</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleAnalyzeSelf} disabled={analyzing}>
                        <Fingerprint className="w-4 h-4 mr-2" />
                        {analyzing ? 'Analyzing...' : 'Analyze My Profile'}
                    </Button>
                    <Button variant="outline" onClick={fetchData}>
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">VIP Customers</CardTitle>
                        <UserCheck className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{profiles.filter(p => p.ltv_band === 'vip').length}</div>
                        <p className="text-xs text-muted-foreground">top tier segment</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg LTV Score</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {profiles.length > 0 ? (profiles.reduce((acc, p) => acc + (p.ltv_score || 0), 0) / profiles.length).toFixed(0) : 0}
                        </div>
                        <p className="text-xs text-muted-foreground">portfolio health</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">At Risk</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{profiles.filter(p => p.churn_risk?.includes('high')).length}</div>
                        <p className="text-xs text-muted-foreground">require intervention</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Segments Active</CardTitle>
                        <BarChart4 className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">5</div>
                        <p className="text-xs text-muted-foreground">behavioral clusters</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Customer Profiles</CardTitle>
                    <CardDescription>AI-generated behavioral insights</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Customer ID</TableHead>
                                <TableHead>LTV Band</TableHead>
                                <TableHead>Score</TableHead>
                                <TableHead>Churn Risk</TableHead>
                                <TableHead>Behavior Tags</TableHead>
                                <TableHead className="text-right">Last Analyzed</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                                </TableRow>
                            ) : profiles.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No profiles analyzed yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                profiles.map((profile) => (
                                    <TableRow key={profile.user_id}>
                                        <TableCell className="font-mono text-xs">{profile.user_id.slice(0, 8)}...</TableCell>
                                        <TableCell>{getLTVBadge(profile.ltv_band)}</TableCell>
                                        <TableCell>{profile.ltv_score}</TableCell>
                                        <TableCell>{getChurnBadge(profile.churn_risk)}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {profile.behavior_tags?.map(tag => (
                                                    <Badge key={tag} variant="secondary" className="text-[10px] px-1 h-5">
                                                        {tag.replace('_', ' ')}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground">
                                            {format(new Date(profile.last_analyzed_at), 'MMM d, HH:mm')}
                                        </TableCell>
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
