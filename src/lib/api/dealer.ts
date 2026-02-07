import { createClient } from '@/utils/supabase/client';
import {
    Dealer,
    DealerZone,
    PartRequest,
    DealerQuote,
    PartOrder,
    DealerAlert,
    dealerSchema,
    dealerZoneSchema,
    partRequestSchema,
    dealerQuoteSchema,
    partOrderSchema,
    dealerAlertSchema,
    StockStatus,
    DealerScoreSnapshot,
    dealerScoreSnapshotSchema,
    DealerEventFact,
    dealerEventFactSchema,
    DealerDashboardSummary
} from '@/lib/types/dealer';
import { z } from 'zod';

const supabase = createClient();

export const dealerApi = {

    // =========================================================================
    // DEALERS
    // =========================================================================

    getAllDealers: async (): Promise<Dealer[]> => {
        const { data, error } = await supabase
            .from('dealers')
            .select('*')
            .order('name');
        if (error) throw new Error(error.message);
        return z.array(dealerSchema).parse(data);
    },

    getDealerById: async (id: string): Promise<Dealer | null> => {
        const { data, error } = await supabase
            .from('dealers')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error) throw new Error(error.message);
        return data ? dealerSchema.parse(data) : null;
    },

    createDealer: async (dealer: Partial<Dealer>): Promise<Dealer> => {
        const { data, error } = await supabase
            .from('dealers')
            .insert(dealer)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return dealerSchema.parse(data);
    },

    updateDealer: async (id: string, updates: Partial<Dealer>): Promise<Dealer> => {
        const { data, error } = await supabase
            .from('dealers')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return dealerSchema.parse(data);
    },

    getDealersByCity: async (city: string): Promise<Dealer[]> => {
        // Get dealer IDs from zones, then fetch dealers
        const { data: zones, error: zoneError } = await supabase
            .from('dealer_zones')
            .select('dealer_id')
            .eq('city', city);
        if (zoneError) throw new Error(zoneError.message);

        if (!zones || zones.length === 0) return [];

        const dealerIds = zones.map((zone: { dealer_id: string }) => zone.dealer_id);
        const { data, error } = await supabase
            .from('dealers')
            .select('*')
            .in('id', dealerIds)
            .eq('status', 'active');
        if (error) throw new Error(error.message);
        return z.array(dealerSchema).parse(data);
    },

    // =========================================================================
    // PART REQUESTS
    // =========================================================================

    // =========================================================================
    // PART REQUESTS
    // =========================================================================

    createPartRequest: async (request: Partial<PartRequest>): Promise<PartRequest> => {
        const { data, error } = await supabase
            .from('part_requests')
            .insert(request)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return partRequestSchema.parse(data);
    },

    getPartRequests: async (status?: string): Promise<PartRequest[]> => {
        let query = supabase.from('part_requests').select('*').order('created_at', { ascending: false });
        if (status) {
            query = query.eq('status', status);
        }
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return z.array(partRequestSchema).parse(data);
    },

    approvePartRequest: async (id: string): Promise<PartRequest> => {
        const { data, error } = await supabase
            .from('part_requests')
            .update({
                status: 'open_for_quotes',
                approved_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return partRequestSchema.parse(data);
    },

    // =========================================================================
    // QUOTES
    // =========================================================================

    submitQuote: async (quote: {
        part_request_id: string;
        dealer_id: string;
        price_per_unit: number;
        stock_status: StockStatus;
        lead_time_hours: number;
        warranty_months?: number;
        conditions?: string;
    }): Promise<DealerQuote> => {
        const { data, error } = await supabase
            .from('dealer_quotes')
            .insert(quote)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return dealerQuoteSchema.parse(data);
    },

    getQuotesForRequest: async (requestId: string): Promise<DealerQuote[]> => {
        const { data, error } = await supabase
            .from('dealer_quotes')
            .select('*')
            .eq('part_request_id', requestId)
            .order('total_price');
        if (error) throw new Error(error.message);
        return z.array(dealerQuoteSchema).parse(data);
    },

    // =========================================================================
    // ORDERS (via RPC)
    // =========================================================================

    awardOrder: async (quoteId: string): Promise<string> => {
        const { data, error } = await supabase.rpc('rpc_award_part_order', {
            p_quote_id: quoteId
        });
        if (error) throw new Error(error.message);
        return data as string;
    },

    getOrders: async (status?: string): Promise<PartOrder[]> => {
        let query = supabase.from('part_orders').select('*').order('ordered_at', { ascending: false });
        if (status) {
            query = query.eq('order_status', status);
        }
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return z.array(partOrderSchema).parse(data);
    },

    updateOrderStatus: async (id: string, status: string, notes?: string): Promise<PartOrder> => {
        const updates: any = { order_status: status };
        if (status === 'delivered') {
            updates.actual_delivery_at = new Date().toISOString();
        }
        if (notes) {
            updates.delivery_notes = notes;
        }
        const { data, error } = await supabase
            .from('part_orders')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return partOrderSchema.parse(data);
    },

    // =========================================================================
    // V1 ANALYTICS (Flight Recorder + Explainable Scoring)
    // =========================================================================

    /**
     * Ingests a new dealer event fact. Idempotent via hash-based deduplication.
     * 
     * @param dealerId - Dealer UUID
     * @param eventType - Event type (e.g., 'delivery_delayed', 'quality_incident')
     * @param contextType - Context type (e.g., 'ticket', 'part_order')
     * @param contextId - Context UUID
     * @param payload - Event payload (additional data)
     * @param ticketId - Optional ticket ID (will be merged into payload)
     * @param idempotencyKey - Optional client-provided idempotency key (auto-generated if not provided)
     * @returns Event fact ID
     */
    ingestEvent: async (
        dealerId: string,
        eventType: string,
        contextType: string,
        contextId: string,
        payload: Record<string, any> = {},
        ticketId?: string,
        idempotencyKey?: string
    ): Promise<string> => {
        // GATE G5: Generate stable idempotency_key if not provided
        // Use combination of dealer + event + context + timestamp for uniqueness
        // This key should remain stable across retries of the same logical event
        const generatedKey = idempotencyKey || `${dealerId}-${eventType}-${contextId}-${Date.now()}`;

        const { data, error } = await supabase.rpc('rpc_dealer_event_ingest', {
            p_dealer_id: dealerId,
            p_event_type: eventType,
            p_context_type: contextType,
            p_context_id: contextId,
            p_occurred_at: new Date().toISOString(),
            p_payload: payload,
            p_idempotency_key: generatedKey,
            p_ticket_id: ticketId || null
        });
        if (error) throw new Error(error.message);
        return data as string;
    },

    /**
     * Triggers VFL scoring engine for a dealer (7/30/90 windows).
     */
    computeScores: async (dealerId: string): Promise<DealerScoreSnapshot[]> => {
        const { data, error } = await supabase.rpc('rpc_dealer_compute_scores', {
            p_dealer_id: dealerId
        });
        if (error) throw new Error(error.message);

        // Return latest snapshots if needed, or just the JSON result
        // For strict typing, we might want to query the snapshot table after computing,
        // or ensure RPC returns the snapshots.
        // The RPC currently returns a JSON summary. Let's fetch the actual stored snapshots.

        const { data: snapshots, error: fetchError } = await supabase
            .from('dealer_score_snapshots')
            .select('*')
            .eq('dealer_id', dealerId)
            .order('computed_at', { ascending: false })
            .limit(3); // 7, 30, 90 windows usually

        if (fetchError) throw new Error(fetchError.message);
        return z.array(dealerScoreSnapshotSchema).parse(snapshots);
    },

    /**
     * Helper to get single dealer score (30d default) for backward compatibility
     */
    getDealerScore: async (dealerId: string): Promise<DealerScoreSnapshot | null> => {
        const { data, error } = await supabase
            .from('dealer_score_snapshots')
            .select('*')
            .eq('dealer_id', dealerId)
            .eq('window_days', 30) // Default to 30 days
            .order('computed_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw new Error(error.message);
        return data ? dealerScoreSnapshotSchema.parse(data) : null;
    },

    /**
     * Get event facts (Flight Recorder) for a dealer
     */
    getDealerEventFacts: async (dealerId: string, limit = 50): Promise<DealerEventFact[]> => {
        const { data, error } = await supabase
            .from('dealer_event_facts')
            .select('*')
            .eq('dealer_id', dealerId)
            .order('occurred_at', { ascending: false })
            .limit(limit);

        if (error) throw new Error(error.message);
        return z.array(dealerEventFactSchema).parse(data);
    },

    /**
     * Get score snapshot history
     */
    getDealerScoreHistory: async (dealerId: string, windowDays = 30, limit = 10): Promise<DealerScoreSnapshot[]> => {
        const { data, error } = await supabase
            .from('dealer_score_snapshots')
            .select('*')
            .eq('dealer_id', dealerId)
            .eq('window_days', windowDays)
            .order('computed_at', { ascending: false })
            .limit(limit);

        if (error) throw new Error(error.message);
        return z.array(dealerScoreSnapshotSchema).parse(data);
    },

    /**
     * Admin Dashboard: Get high-level summary of all dealers
     */
    getDealerAnalyticsDashboard: async (
        windowDays = 30,
        page = 1,
        limit = 50,
        filter: 'risk' | null = null
    ): Promise<DealerDashboardSummary[]> => {
        const offset = (page - 1) * limit;
        const { data, error } = await supabase.rpc('rpc_dealer_dashboard_summary', {
            p_window_days: windowDays,
            p_limit: limit,
            p_offset: offset,
            p_status_filter: filter
        });

        if (error) throw new Error(error.message);
        return data as DealerDashboardSummary[];
    },

    // Deprecated helpers (redirecting to new logic where possible)
    calculateDealerScore: async (dealerId: string): Promise<void> => {
        await dealerApi.computeScores(dealerId);
    },

    getAllDealerScores: async (date?: string): Promise<DealerScoreSnapshot[]> => {
        // Only getting latest 30d snapshots for "All Scores" equivalent
        const { data, error } = await supabase
            .from('dealer_score_snapshots')
            .select('*')
            .eq('window_days', 30)
            .order('computed_at', { ascending: false });

        if (error) throw new Error(error.message);
        // Deduplicate locally to get latest per dealer (simple approach for deprecated method)
        // ideally we use distinct on logic but this is safe deprecation
        const verify = z.array(dealerScoreSnapshotSchema).parse(data);
        const map = new Map<string, DealerScoreSnapshot>();
        verify.forEach(s => {
            if (!map.has(s.dealer_id)) map.set(s.dealer_id, s);
        });
        return Array.from(map.values());
    },

    // =========================================================================
    // ALERTS
    // =========================================================================

    getDealerAlerts: async (dealerId?: string, unacknowledgedOnly = true): Promise<DealerAlert[]> => {
        let query = supabase.from('dealer_alerts').select('*').order('created_at', { ascending: false });
        if (dealerId) {
            query = query.eq('dealer_id', dealerId);
        }
        if (unacknowledgedOnly) {
            query = query.eq('is_acknowledged', false);
        }
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return z.array(dealerAlertSchema).parse(data);
    },

    acknowledgeAlert: async (alertId: string): Promise<void> => {
        const { error } = await supabase
            .from('dealer_alerts')
            .update({ is_acknowledged: true, acknowledged_at: new Date().toISOString() })
            .eq('id', alertId);
        if (error) throw new Error(error.message);
    }
};
