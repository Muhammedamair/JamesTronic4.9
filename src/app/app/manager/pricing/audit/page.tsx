'use client';

import React, { useState, useEffect } from 'react';
import { PricingPageHeader } from '@/components/pricing/PricingPageHeader';
import { DenseDataTable, ColumnDef } from '@/components/pricing/DenseDataTable';
import { PricingClient } from '@/lib/pricing/client';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

/*
  Pricing Audit Log (P4.2 Wave 1)
  - Immutable log viewer
  - Filters: Entity, Date (implicit via limit/cursor in API stub for now)
*/

export default function AuditPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // Fetch audit logs (stub API)
                const logs = await PricingClient.getAuditLog(new URLSearchParams());
                setData(logs);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const columns: ColumnDef<any>[] = [
        {
            header: 'Timestamp',
            accessorKey: 'created_at',
            cell: (item) => <span className="text-slate-400 font-mono text-xs">{format(new Date(item.created_at || Date.now()), 'MMM d, HH:mm:ss')}</span>
        },
        {
            header: 'Event',
            accessorKey: 'event_type',
            cell: (item) => <span className="font-semibold text-violet-300">{item.event_type}</span>
        },
        {
            header: 'Entity',
            accessorKey: 'entity_type',
            cell: (item) => (
                <div className="flex flex-col">
                    <span className="text-xs uppercase">{item.entity_type}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{item.entity_id?.slice(0, 8)}...</span>
                </div>
            )
        },
        {
            header: 'Actor',
            accessorKey: 'actor_role',
            cell: (item) => (
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-slate-800 bg-slate-900 text-slate-400 text-[10px] px-1.5">
                        {item.actor_role}
                    </Badge>
                    <span className="text-xs text-slate-500">{item.actor_email || 'System'}</span>
                </div>
            )
        },
        {
            header: 'Changes',
            accessorKey: 'payload',
            cell: (item) => (
                <code className="text-[10px] text-slate-500 block max-w-xs truncate">
                    {JSON.stringify(item.payload || {})}
                </code>
            )
        }
    ];

    return (
        <>
            <PricingPageHeader
                title="Audit Trail"
                subtitle="Immutable record of all pricing engine events."
            />

            <DenseDataTable
                data={data}
                columns={columns}
                loading={loading}
                auditEntityBase="audit_log"
                getAuditId={(item) => item.id}
            />
        </>
    );
}
