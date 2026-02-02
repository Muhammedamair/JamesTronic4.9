'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuotes } from '@/components/pricing/quotes/useQuotes';
import {
    QuotesTable,
    NewQuoteDrawer,
    QuoteBreakdownDrawer,
    AcceptQuoteDialog,
    Quote
} from '@/components/pricing/quotes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, FilterX, Loader2 } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
// useCityScope removed - context implicit in manager session
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { isPast, parseISO } from 'date-fns';

// Minimal catalog fetcher or use manual input for now
import { createClient } from '@/utils/supabase/client';

export default function QuotesPage() {
    // State
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Modals state
    const [showNewDrawer, setShowNewDrawer] = useState(false);
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
    const [quoteToAccept, setQuoteToAccept] = useState<Quote | null>(null);

    // Service Catalog Selection
    const [serviceCodes, setServiceCodes] = useState<string[]>([]);
    const [loadingCatalog, setLoadingCatalog] = useState(false);

    // Context
    // For manager, scope is implicit in the session.
    // We'll fall back to 'current' which the API handles.
    const cityId = 'current_manager_scope';

    // Data Fetching
    const {
        quotes,
        isLoading,
        isError,
        createQuote,
        isCreating,
        acceptQuote,
        isAccepting
    } = useQuotes({
        status: statusFilter === 'all' ? undefined : statusFilter,
        q: debouncedSearch,
        limit: 50
    });

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Fetch Service Catalog (One-off)
    useEffect(() => {
        async function fetchCatalog() {
            setLoadingCatalog(true);
            try {
                // Use server API to bypass RLS/Auth complexity on client
                const res = await fetch('/api/pricing/catalog');
                if (res.ok) {
                    const data = await res.json();
                    setServiceCodes(data.map((d: { service_code: string }) => d.service_code));
                } else {
                    console.error('Catalog fetch failed:', res.statusText);
                }
            } catch (err) {
                console.error('Failed to fetch catalog', err);
            } finally {
                setLoadingCatalog(false);
            }
        }
        fetchCatalog();
    }, []);

    // Soft Expiry Logic Wrapper
    // We augment the data for display purposes if needed, 
    // but the Table component handles expiry display logic internally based on `expires_at`.
    // We just need to filter actions.

    const handleCreate = async (payload: any) => {
        try {
            const result = await createQuote(payload);
            setShowNewDrawer(false);
            // Auto-open breakdown for new quote
            // Need to find the quote object. Ideally createQuote returns it or we fetch it.
            // The API returns { quote_id, ... }. We might need to refetch or wait for invalidate.
            const newQuote = { ...result, id: result.quote_id } as unknown as Quote; // Partial match, enough to open if we had full object
            // Actually, better to just let the list refresh. User can click view.
            // Or we can try to find it in the refreshed list after a delay.
        } catch (e) {
            // Toast handled in hook
        }
    };

    const handleAccept = async (reason?: string) => {
        if (!quoteToAccept) return;
        try {
            await acceptQuote({ id: quoteToAccept.id, reason });
            setQuoteToAccept(null);
        } catch (e) {
            // Toast handled in hook
        }
    };

    if (process.env.NEXT_PUBLIC_DYNAMIC_PRICING_V1 !== 'true') {
        return <div className="p-8">Feature Disabled</div>;
    }

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Quote Management</h1>
                    <p className="text-muted-foreground">
                        Create and manage fixed-price quotes for services.
                    </p>
                </div>
                <div className="flex items-center gap-2">

                    <Button onClick={() => setShowNewDrawer(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Quote
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end md:items-center">
                    <div className="flex-1 w-full space-y-2">
                        <label className="text-sm font-medium">Search</label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search Quote ID, Ticket, or Service Code..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="w-full md:w-[200px] space-y-2">
                        <label className="text-sm font-medium">Status</label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="accepted">Accepted</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                                <SelectItem value="blocked">Blocked</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {/* Clear Filters (if active) */}
                    {(statusFilter !== 'all' || searchQuery) && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setStatusFilter('all'); setSearchQuery(''); }}
                            className="mb-0.5"
                            title="Clear filters"
                        >
                            <FilterX className="h-4 w-4" />
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Data Table */}
            <QuotesTable
                data={quotes}
                loading={isLoading}
                onView={(q) => { setSelectedQuote(q); setShowBreakdown(true); }}
                onAccept={(q) => setQuoteToAccept(q)}
                onRowClick={(q) => { setSelectedQuote(q); setShowBreakdown(true); }}
            />

            {/* Drawers & Dialogs */}
            <NewQuoteDrawer
                open={showNewDrawer}
                onOpenChange={setShowNewDrawer}
                onSubmit={handleCreate}
                isSubmitting={isCreating}
                serviceCodes={serviceCodes}
                cityId={cityId} // Passed but mostly decorative as API derives from session
            />

            <QuoteBreakdownDrawer
                quote={selectedQuote}
                open={showBreakdown}
                onOpenChange={setShowBreakdown}
            />

            <AcceptQuoteDialog
                quote={quoteToAccept}
                open={!!quoteToAccept}
                onOpenChange={(open) => !open && setQuoteToAccept(null)}
                onConfirm={handleAccept}
                isSubmitting={isAccepting}
            />
        </div>
    );
}
