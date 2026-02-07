'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Quote, CreateQuotePayload, CreateQuoteResponse, AcceptQuoteResponse } from './types';
import { toast } from 'sonner';

interface QuotesQueryParams {
    status?: string;
    q?: string;
    limit?: number;
    // cursor not fully supported by UI yet but ready in API structure
}

// Fetcher
const fetchQuotes = async (params: QuotesQueryParams): Promise<Quote[]> => {
    const searchParams = new URLSearchParams();
    if (params.status && params.status !== 'all') searchParams.set('status', params.status);
    if (params.q) searchParams.set('q', params.q);
    if (params.limit) searchParams.set('limit', params.limit.toString());

    const res = await fetch(`/api/pricing/quotes?${searchParams.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch quotes');
    const json = await res.json();
    return json.data || [];
};

// Create
const createQuote = async (payload: CreateQuotePayload): Promise<CreateQuoteResponse> => {
    const res = await fetch('/api/pricing/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create quote');
    }
    return res.json();
};

// Accept
const acceptQuote = async ({ id, reason }: { id: string; reason?: string }): Promise<AcceptQuoteResponse> => {
    const res = await fetch(`/api/pricing/quotes/${id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to accept quote');
    }
    return res.json();
};

// Hook
export function useQuotes(initialParams: QuotesQueryParams = {}) {
    const queryClient = useQueryClient();
    const queryKey = ['quotes', initialParams];

    // Query
    const query = useQuery({
        queryKey,
        queryFn: () => fetchQuotes(initialParams),
        staleTime: 1000 * 30, // 30s stale
        retry: 1,
    });

    // Create Mutation
    const createMutation = useMutation({
        mutationFn: createQuote,
        onSuccess: (data) => {
            // Invalidate list
            queryClient.invalidateQueries({ queryKey: ['quotes'] });

            if (data.idempotent) {
                toast.info(`Existing quote returned: ${data.quote_id} (Idempotent)`);
            } else {
                toast.success(`Quote created: ${data.quote_id}`, {
                    description: `Total: $${data.total_amount.toFixed(2)}`
                });
            }
        },
        onError: (error: Error) => {
            toast.error('Creation failed', { description: error.message });
        },
    });

    // Accept Mutation
    const acceptMutation = useMutation({
        mutationFn: acceptQuote,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['quotes'] });
            toast.success('Quote accepted successfully');
        },
        onError: (error: Error) => {
            toast.error('Acceptance failed', { description: error.message });
        },
    });

    return {
        quotes: query.data || [],
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch,
        createQuote: createMutation.mutateAsync,
        isCreating: createMutation.isPending,
        acceptQuote: acceptMutation.mutateAsync,
        isAccepting: acceptMutation.isPending,
    };
}
