'use client';

import { useState, useEffect } from 'react';
import { complianceApi } from '@/lib/api/compliance';
import {
    CompliancePolicy,
    ComplianceViolation,
    AiAuditLog,
    ComplianceOverview
} from '@/lib/types/compliance';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
    ShieldAlert,
    ShieldCheck,
    Gavel,
    Fingerprint,
    Scale,
    Terminal,
    RefreshCcw,
    AlertCircle,
    CheckCircle2,
    Eye
} from 'lucide-react';
import {
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip
} from 'recharts';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function CompliancePage() {
    const [overview, setOverview] = useState<ComplianceOverview | null>(null);
    const [policies, setPolicies] = useState<CompliancePolicy[]>([]);
    const [violations, setViolations] = useState<ComplianceViolation[]>([]);
    const [auditLogs, setAuditLogs] = useState<AiAuditLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [o, p, v, a] = await Promise.all([
                complianceApi.getOverview(),
                complianceApi.getPolicies(),
                complianceApi.getViolations(),
                complianceApi.getAuditLogs()
            ]);
            setOverview(o);
            setPolicies(p);
            setViolations(v);
            setAuditLogs(a);
        } catch (e) {
            console.error('Error loading compliance data:', e);
            toast.error('Failed to load governance data');
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePolicy = async (id: string, currentStatus: boolean) => {
        try {
            await complianceApi.togglePolicy(id, !currentStatus);
            setPolicies(policies.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
            toast.success('Policy updated');
        } catch (e) {
            toast.error('Failed to update policy');
        }
    };

    const handleRunAudit = async () => {
        try {
            await complianceApi.triggerAudit();
            toast.success('Manual audit triggered');
            loadData();
        } catch (e) {
            toast.error('Audit failed');
        }
    };

    const getSeverityBadge = (severity: string) => {
        const colors: Record<string, string> = {
            critical: 'bg-red-100 text-red-800 border-red-200',
            high: 'bg-orange-100 text-orange-800 border-orange-200',
            medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            low: 'bg-blue-100 text-blue-800 border-blue-200'
        };
        return <Badge className={`capitalize font-semibold ${colors[severity] || ''}`}>{severity}</Badge>;
    };

    const radarData = [
        { subject: 'Finance', value: 95, fullMark: 100 },
        { subject: 'HR', value: 88, fullMark: 100 },
        { subject: 'Logistics', value: 72, fullMark: 100 },
        { subject: 'Security', value: 99, fullMark: 100 },
        { subject: 'Ethics', value: 94, fullMark: 100 },
        { subject: 'Legal', value: 90, fullMark: 100 },
    ];

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Governance Hub</h1>
                    <p className="text-muted-foreground">AI compliance, safety, and regulatory audit</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={loadData}><RefreshCcw className="mr-2 h-4 w-4" /> Sync Logs</Button>
                    <Button onClick={handleRunAudit} className="bg-slate-900"><ShieldAlert className="mr-2 h-4 w-4" /> Trigger Auto-Audit</Button>
                </div>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-red-500">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between space-y-0 pb-2">
                            <p className="text-sm font-medium text-muted-foreground">Critical Violations</p>
                            <AlertCircle className="h-4 w-4 text-red-500" />
                        </div>
                        <div className="text-3xl font-bold">{overview?.critical_violations}</div>
                        <p className="text-xs text-muted-foreground mt-1">Requires Immediate Attention</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-yellow-500">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between space-y-0 pb-2">
                            <p className="text-sm font-medium text-muted-foreground">Active Investigations</p>
                            <RefreshCcw className="h-4 w-4 text-yellow-500" />
                        </div>
                        <div className="text-3xl font-bold">{overview?.active_violations}</div>
                        <p className="text-xs text-muted-foreground mt-1">Status: Operational Audit</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between space-y-0 pb-2">
                            <p className="text-sm font-medium text-muted-foreground">Policy Adherence</p>
                            <ShieldCheck className="h-4 w-4 text-green-500" />
                        </div>
                        <div className="text-3xl font-bold">{overview?.policy_adherence_rate.toFixed(1)}%</div>
                        <p className="text-xs text-green-600 mt-1">Top 5% in Sector</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-purple-500">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between space-y-0 pb-2">
                            <p className="text-sm font-medium text-muted-foreground">AI Fairness Score</p>
                            <Scale className="h-4 w-4 text-purple-500" />
                        </div>
                        <div className="text-3xl font-bold">0.965</div>
                        <p className="text-xs text-muted-foreground mt-1">Delta: -0.002 bias detected</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Governance Radar & Metrics */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Compliance Risk Map</CardTitle>
                        <CardDescription>Visualizing department-wise safety coverage</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart data={radarData}>
                                    <PolarGrid stroke="#e5e7eb" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 12 }} />
                                    <Radar
                                        name="Coverage"
                                        dataKey="value"
                                        stroke="#8b5cf6"
                                        fill="#8b5cf6"
                                        fillOpacity={0.6}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">GST Compliance</span>
                                <span className="text-green-600 font-medium">100% Verified</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Data Privacy</span>
                                <span className="text-green-600 font-medium">99.9% Secure</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-red-600">
                                <span className="text-muted-foreground">Logistics Audit</span>
                                <span className="font-medium">72% Warning</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Policy Management Toggle */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>AI Policy Engine</CardTitle>
                        <CardDescription>Automated governance rules and enforcement toggles</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {policies.map(policy => (
                                <div key={policy.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:shadow-sm transition-all">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold">{policy.name}</span>
                                            {getSeverityBadge(policy.severity)}
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-1">{policy.description}</p>
                                    </div>
                                    <Switch
                                        checked={policy.is_active}
                                        onCheckedChange={() => handleTogglePolicy(policy.id, policy.is_active)}
                                    />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Violation Feed */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 font-mono">
                            <Terminal className="h-5 w-5" /> RECENT_VIOLATIONS
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-[400px] overflow-y-auto divide-y bg-slate-950 text-slate-100 font-mono text-xs">
                            {violations.map(v => (
                                <div key={v.id} className="p-4 border-slate-800 hover:bg-slate-900 transition-colors group">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={v.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'}>
                                            [{v.severity.toUpperCase()}] {v.policy?.name || 'UNKNOWN_POLICY'}
                                        </span>
                                        <span className="text-slate-500">{format(new Date(v.detected_at), 'MM/dd HH:mm:ss')}</span>
                                    </div>
                                    <div className="text-slate-300 mb-2">{v.description}</div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500">REF: {v.reference_id || 'N/A'}</span>
                                        <Badge className="bg-slate-800 border-slate-700 text-slate-400 group-hover:bg-slate-700">{v.status.toUpperCase()}</Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* AI Audit Logs */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Fingerprint className="h-5 w-5" /> AI Decision Transparency
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-[400px] overflow-y-auto">
                            <div className="divide-y">
                                {auditLogs.map(log => (
                                    <div key={log.id} className="p-4 hover:bg-muted/30 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="text-sm font-semibold">{log.ai_module}</div>
                                            <div className="flex items-center gap-1">
                                                {log.ethical_check_passed ? (
                                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                                ) : (
                                                    <AlertCircle className="h-3 w-3 text-red-500" />
                                                )}
                                                <span className="text-[10px] font-bold text-muted-foreground">CONF: {(log.confidence_score || 0 * 100).toFixed(0)}%</span>
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground line-clamp-2 italic">"{log.action_taken}"</div>
                                        <div className="flex justify-between items-center mt-2">
                                            <span className="text-[10px] text-muted-foreground uppercase">{format(new Date(log.created_at), 'MMM d, HH:mm')}</span>
                                            <Button variant="ghost" size="sm" className="h-6 text-[10px]"><Eye className="h-3 w-3 mr-1" /> EXPLAIN</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
