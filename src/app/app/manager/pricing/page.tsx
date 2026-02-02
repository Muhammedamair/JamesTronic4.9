'use client';

import React, { useState, useEffect } from 'react';
import { PricingPageHeader } from '@/components/pricing/PricingPageHeader';
import { DenseDataTable, ColumnDef } from '@/components/pricing/DenseDataTable';
import { PricingClient } from '@/lib/pricing/client';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, AlertTriangle, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

/*
  Pricing Overview Page (P4.2 Wave 1)
  - Real-time KPIs
  - Anomaly Alerts
  - Recent Quotes Feed
*/

export default function PricingOverviewPage() {
    const [stats, setStats] = useState<any>(null);
    const [recentQuotes, setRecentQuotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [statsData, quotesData] = await Promise.all([
                    PricingClient.getOverviewStats(),
                    PricingClient.getQuotes(new URLSearchParams('limit=5&sort=created_at.desc'))
                ]);
                setStats(statsData?.data || statsData || {});
                // Handle various API return shapes (array vs { data: [] })
                const rawQuotes = quotesData?.data || quotesData;
                setRecentQuotes(Array.isArray(rawQuotes) ? rawQuotes : []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const quoteColumns: ColumnDef<any>[] = [
        {
            header: 'Time',
            accessorKey: 'created_at',
            cell: (item) => <span className="text-slate-400 font-mono text-xs">{format(new Date(item.created_at), 'HH:mm:ss')}</span>
        },
        {
            header: 'Quote ID',
            accessorKey: 'id',
            className: 'font-mono text-xs',
            cell: (item) => item.id.slice(0, 8)
        },
        { header: 'Service', accessorKey: 'service_code', className: 'text-xs' },
        {
            header: 'Total',
            accessorKey: 'total_amount',
            cell: (item) => {
                const val = Number(item.total_amount ?? 0);
                return (
                    <span className="text-emerald-400 font-medium">
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val)}
                    </span>
                );
            }
        },
        {
            header: 'Status',
            accessorKey: 'status',
            cell: (item) => (
                <Badge variant="outline" className={`text-[10px] px-1.5 ${item.status === 'accepted' ? 'border-emerald-500 text-emerald-500' :
                    item.status === 'blocked' ? 'border-red-500 text-red-500' :
                        'border-slate-600 text-slate-500'
                    }`}>
                    {item.status}
                </Badge>
            )
        }
    ];

    return (
        <>
            <PricingPageHeader
                title="Pricing Overview"
                subtitle="Real-time cockpit for dynamic pricing activity."
            />

            {/* Anomaly Banner Check */}
            {/* Logic: If stats.anomalies > 0, show Banner */}
            {/* For stub, we assume 0 or hardcode mock in API */}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatsCard
                    title="Active Ruleset"
                    value={stats?.active_ruleset || '...'}
                    icon={<CheckCircle className="text-emerald-500" />}
                    trend="System Healthy"
                />
                <StatsCard
                    title="Quotes (24h)"
                    value={stats?.quotes_today || 0}
                    icon={<Activity className="text-violet-500" />}
                    trend="Volume"
                />
                <StatsCard
                    title="Accept Rate"
                    value={`${stats?.acceptance_rate || 0}%`}
                    icon={<TrendingUp className="text-blue-500" />}
                    trend="Conversion"
                />
                <StatsCard
                    title="Guardrail Blocks"
                    value={stats?.guardrail_blocks || 0}
                    icon={<AlertTriangle className="text-amber-500" />}
                    trend="Safety Violations"
                    alert={stats?.guardrail_blocks > 0}
                />
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-slate-200 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-500" />
                        Recent Quotes
                    </h3>
                    <Link href="/app/manager/pricing/quotes" className="text-sm text-violet-400 hover:text-violet-300">
                        View All
                    </Link>
                </div>

                <DenseDataTable
                    data={recentQuotes}
                    columns={quoteColumns}
                    loading={loading}
                    auditEntityBase="pricing_quotes"
                />
            </div>
        </>
    );
}

function StatsCard({ title, value, icon, trend, alert = false }: any) {
    return (
        <Card className={`border-slate-800 bg-slate-900/50 ${alert ? 'border-amber-900/50 bg-amber-950/10' : ''}`}>
            <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                    <p className="text-sm font-medium text-slate-400">{title}</p>
                    {icon}
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                    <div className="text-2xl font-bold text-slate-100">{value}</div>
                    <p className={`text-xs ${alert ? 'text-amber-500 font-bold' : 'text-slate-500'}`}>{trend}</p>
                </div>
            </CardContent>
        </Card>
    );
}
