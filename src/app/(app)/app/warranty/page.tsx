'use client';

import { useState, useEffect } from 'react';
import { insuranceApi } from '@/lib/api/insurance';
import { Policy, Claim } from '@/lib/types/insurance';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, AlertTriangle, FileText, CheckCircle, Wallet } from 'lucide-react';
import { format } from 'date-fns';

export default function WarrantyPage() {
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [claims, setClaims] = useState<Claim[]>([]);
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [p, c, m] = await Promise.all([
                insuranceApi.getPolicies(),
                insuranceApi.getClaims(),
                insuranceApi.getLiabilities()
            ]);
            setPolicies(p);
            setClaims(c);
            setMetrics(m);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Warranty & Protection</h1>
                    <p className="text-muted-foreground">Manage device coverage and liability claims.</p>
                </div>
            </div>

            {metrics && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-6 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Policies</p>
                                <h2 className="text-2xl font-bold">{metrics.total_policies}</h2>
                            </div>
                            <Shield className="h-8 w-8 text-blue-500" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Liability Exposure</p>
                                <h2 className="text-2xl font-bold">${metrics.total_exposure.toLocaleString()}</h2>
                            </div>
                            <Wallet className="h-8 w-8 text-orange-500" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Active Claims</p>
                                <h2 className="text-2xl font-bold">{metrics.active_claims_count}</h2>
                            </div>
                            <AlertTriangle className="h-8 w-8 text-red-500" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Pending Payouts</p>
                                <h2 className="text-2xl font-bold">${metrics.pending_claims_amount.toLocaleString()}</h2>
                            </div>
                            <FileText className="h-8 w-8 text-slate-400" />
                        </CardContent>
                    </Card>
                </div>
            )}

            <Tabs defaultValue="policies" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="policies">Active Policies</TabsTrigger>
                    <TabsTrigger value="claims">Claim History</TabsTrigger>
                </TabsList>

                <TabsContent value="policies" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {policies.map(policy => (
                            <Card key={policy.id}>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-base font-medium">
                                        {policy.policy_number}
                                    </CardTitle>
                                    <Shield className="h-4 w-4 text-green-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold mb-2">${policy.liability_limit}</div>
                                    <p className="text-xs text-muted-foreground mb-4">Coverage Limit</p>

                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Provider</span>
                                            <span className="font-medium">{policy.provider?.name || 'Internal'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Expires</span>
                                            <span className="font-medium">{format(new Date(policy.end_date), 'MMM dd, yyyy')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Type</span>
                                            <Badge variant="outline">{policy.type.replace('_', ' ')}</Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="claims" className="space-y-4">
                    <Card>
                        <CardContent className="p-0">
                            <div className="divide-y">
                                {claims.map(claim => (
                                    <div key={claim.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-full ${claim.status === 'paid' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                                                {claim.status === 'paid' ? <CheckCircle className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                            </div>
                                            <div>
                                                <div className="font-medium">{claim.claim_type}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {format(new Date(claim.created_at), 'MMM dd, yyyy')} • {claim.description}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold">${claim.amount_claimed.toLocaleString()}</div>
                                            <Badge variant={claim.status === 'paid' ? 'default' : 'secondary'} className="mt-1">
                                                {claim.status}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
