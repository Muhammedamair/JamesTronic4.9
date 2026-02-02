'use client';

import { useState, useEffect } from 'react';
import { financeApi } from '@/lib/api/finance';
import { Transaction, FinancialSummary, FinancialKpi } from '@/lib/types/finance';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Coins,
    TrendingUp,
    TrendingDown,
    Wallet,
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    PieChart,
    Calendar,
    Search
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Legend
} from 'recharts';
import { format } from 'date-fns';

export default function FinancePage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [summaries, setSummaries] = useState<FinancialSummary[]>([]);
    const [kpis, setKpis] = useState<FinancialKpi | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [t, s, k] = await Promise.all([
                financeApi.getTransactions(),
                financeApi.getSummaries(),
                financeApi.getKpis()
            ]);
            setTransactions(t);
            setSummaries(s);
            setKpis(k);
        } catch (e) {
            console.error('Error loading financial data:', e);
        } finally {
            setLoading(false);
        }
    };

    const getCategoryColor = (type: string) => {
        return type === 'revenue' ? 'text-green-600' : 'text-red-600';
    };

    const getStatusBadge = (score: number) => {
        if (score >= 80) return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Healthy</Badge>;
        if (score >= 50) return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200">Stable</Badge>;
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">Alert</Badge>;
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Financial Brain</h1>
                    <p className="text-muted-foreground">Revenue intelligence and CFO dashboard</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline"><Calendar className="mr-2 h-4 w-4" /> Last 30 Days</Button>
                    <Button><Search className="mr-2 h-4 w-4" /> Deep Audit</Button>
                </div>
            </div>

            {/* KPI Ribbon */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between space-y-0 pb-2">
                            <p className="text-sm font-medium text-muted-foreground">Monthly Revenue</p>
                            <Coins className="h-4 w-4 text-green-500" />
                        </div>
                        <div className="text-2xl font-bold">₹{kpis?.monthly_revenue.toLocaleString()}</div>
                        <p className="text-xs text-green-600 flex items-center mt-1">
                            <ArrowUpRight className="h-3 w-3 mr-1" /> +12% from last month
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between space-y-0 pb-2">
                            <p className="text-sm font-medium text-muted-foreground">Monthly Burn</p>
                            <TrendingDown className="h-4 w-4 text-red-500" />
                        </div>
                        <div className="text-2xl font-bold">₹{kpis?.monthly_expenses.toLocaleString()}</div>
                        <p className="text-xs text-red-600 flex items-center mt-1">
                            <ArrowUpRight className="h-3 w-3 mr-1" /> +4% increase
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between space-y-0 pb-2">
                            <p className="text-sm font-medium text-muted-foreground">Gross Margin</p>
                            <PieChart className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="text-2xl font-bold">{kpis?.average_margin.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground mt-1">Target: 45.0%</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between space-y-0 pb-2">
                            <p className="text-sm font-medium text-muted-foreground">Daily Burn</p>
                            <Wallet className="h-4 w-4 text-orange-500" />
                        </div>
                        <div className="text-2xl font-bold">₹{kpis?.daily_burn.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        <p className="text-xs text-muted-foreground mt-1">OpEx Focus</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between space-y-0 pb-2">
                            <p className="text-sm font-medium text-muted-foreground">Health Score</p>
                            <Activity className="h-4 w-4 text-purple-500" />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="text-2xl font-bold">{kpis?.health_score}/100</div>
                            {kpis && getStatusBadge(kpis.health_score)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">AI Risk Assessment</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Chart */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Revenue & Profit Trend</CardTitle>
                        <CardDescription>Daily financial performance with 7-day projection</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={summaries}>
                                    <defs>
                                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis
                                        dataKey="summary_date"
                                        tickFormatter={(str: string) => format(new Date(str), 'MMM d')}
                                        tick={{ fontSize: 12 }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        hide
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        labelFormatter={(label: any) => format(new Date(label), 'MMMM d, yyyy')}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="total_revenue"
                                        stroke="#22c55e"
                                        fillOpacity={1}
                                        fill="url(#colorRev)"
                                        name="Revenue"
                                        strokeWidth={2}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey={(d: FinancialSummary) => d.total_revenue - d.total_expenses}
                                        stroke="#3b82f6"
                                        fillOpacity={1}
                                        fill="url(#colorProfit)"
                                        name="Net Profit"
                                        strokeWidth={2}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="forecast_revenue"
                                        stroke="#94a3b8"
                                        strokeDasharray="5 5"
                                        fill="none"
                                        name="Forecast"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Transaction Ledger */}
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Transactions</CardTitle>
                        <CardDescription>Unified financial events ledger</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y max-h-[400px] overflow-y-auto">
                            {transactions.map(tx => (
                                <div key={tx.id} className="p-4 hover:bg-muted/30 transition-colors">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-medium text-sm line-clamp-1">{tx.description}</div>
                                        <div className={`font-bold text-sm ${getCategoryColor(tx.type)}`}>
                                            {tx.type === 'revenue' ? '+' : '-'}₹{tx.amount.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                                        <span className="capitalize">{tx.category.replace('_', ' ')}</span>
                                        <span>{format(new Date(tx.transaction_date), 'HH:mm • MMM d')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t text-center">
                            <Button variant="link" className="text-xs text-muted-foreground">View Full Audit Log</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
