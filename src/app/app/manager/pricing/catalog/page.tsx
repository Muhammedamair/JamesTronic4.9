'use client';

import React, { useState, useEffect } from 'react';
import { PricingPageHeader } from '@/components/pricing/PricingPageHeader';
import { DenseDataTable, ColumnDef } from '@/components/pricing/DenseDataTable';
import { PricingClient } from '@/lib/pricing/client';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

/*
  Pricing Catalog Page (Read-Only)
  - Lists canonical service catalog
  - Filters by code/description
*/

export default function CatalogPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState(searchParams.get('q') || '');

    useEffect(() => {
        // Debounce search update to URL
        const timer = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (search) params.set('q', search);
            else params.delete('q');
            router.replace(`?${params.toString()}`);
        }, 300);
        return () => clearTimeout(timer);
    }, [search, router, searchParams]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // In real impl, pass search params to API for server filtering
                const catalog = await PricingClient.getCatalog();
                // Client-side filter for now since API stub is simple
                const query = search.toLowerCase();
                const filtered = catalog.filter((item: any) =>
                    item.service_code.toLowerCase().includes(query) ||
                    item.description.toLowerCase().includes(query)
                );
                setData(filtered);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [search]); // Reload when search changes (or ideally when debounced URL changes)

    const columns: ColumnDef<any>[] = [
        { header: 'Service Code', accessorKey: 'service_code', className: 'font-mono text-violet-300' },
        { header: 'Category', accessorKey: 'category' },
        { header: 'Subcategory', accessorKey: 'subcategory' },
        { header: 'Description', accessorKey: 'description', className: 'max-w-md truncate' },
        {
            header: 'Status',
            accessorKey: 'is_active',
            cell: (item) => (
                <Badge variant="outline" className={item.is_active ? 'border-emerald-500/50 text-emerald-500' : 'border-slate-700 text-slate-500'}>
                    {item.is_active ? 'Active' : 'Inactive'}
                </Badge>
            )
        }
    ];

    return (
        <>
            <PricingPageHeader
                title="Service Catalog"
                subtitle="Canonical list of services and their base definitions."
            />

            <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                        placeholder="Search service code..."
                        className="pl-9 bg-slate-900 border-slate-800 focus:border-violet-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <DenseDataTable
                data={data}
                columns={columns}
                loading={loading}
                auditEntityBase="service_catalog"
            />
        </>
    );
}
