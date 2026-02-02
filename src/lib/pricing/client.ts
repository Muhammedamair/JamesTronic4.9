import { SupabaseClient } from '@supabase/supabase-js';

/*
  PricingClient
  - Client-side data fetcher for Pricing Console
  - Uses strictly /api/pricing/* endpoints where possible, or supabase client for direct reads if safe (RLS).
  - P4 Pattern: "Use only /api/pricing/* endpoints—never direct DB calls from client" (from Prompt)
  - WAIT: The prompt says "Use only /api/pricing/* endpoints".
  - So I must fetch via Next.js API routes, not supabase.from(...).
*/

const BASE_URL = '/api/pricing';

export const PricingClient = {
    // --- Overview ---
    getOverviewStats: async () => {
        // In P4.1 we might mock this or create a strictly aggregate endpoint
        const res = await fetch(`${BASE_URL}/overview`);
        if (!res.ok) throw new Error('Failed to fetch overview');
        return res.json();
    },

    // --- Catalog ---
    getCatalog: async () => {
        const res = await fetch(`${BASE_URL}/catalog`);
        if (!res.ok) throw new Error('Failed to fetch catalog');
        return res.json();
    },

    // --- Rates ---
    getBaseRates: async (params: URLSearchParams) => {
        const res = await fetch(`${BASE_URL}/base-rates?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch rates');
        return res.json();
    },

    createBaseRateRevision: async (data: {
        city_id: string;
        service_code: string;
        effective_from: string;
        labor_base: number;
        diagnostic_fee: number;
        transport_base: number;
        parts_markup_pct: number;
        reason: string;
    }) => {
        const res = await fetch(`${BASE_URL}/base-rates/revision`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to create revision');
        }
        return res.json();
    },

    createRateRevision: async (data: any) => {
        // Legacy alias or just delegate
        return PricingClient.createBaseRateRevision(data);
    },

    // --- Guardrails ---
    getGuardrails: async (cityId: string) => {
        const res = await fetch(`${BASE_URL}/guardrails?city_id=${cityId}`);
        if (!res.ok) throw new Error('Failed to fetch guardrails');
        return res.json();
    },

    createGuardrailRevision: async (data: {
        city_id: string;
        service_code: string;
        min_total: number;
        max_total: number;
        max_discount_pct: number;
        max_surge_pct: number;
        floor_margin_pct: number;
        effective_from: string;
        reason: string;
        confirm_text: string;
    }) => {
        const res = await fetch(`${BASE_URL}/guardrails/revision`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to revise guardrail');
        }
        return res.json();
    },

    // --- Rulesets ---
    getRulesets: async () => {
        const res = await fetch(`${BASE_URL}/rulesets`);
        if (!res.ok) throw new Error('Failed to fetch rulesets');
        return res.json();
    },

    activateRuleset: async (version: string, reason: string) => {
        const res = await fetch(`${BASE_URL}/rulesets/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ version, reason })
        });
        if (!res.ok) throw new Error('Failed to activate ruleset');
        return res.json();
    },

    // --- Quotes ---
    simulateQuote: async (payload: any) => {
        // Determine path based on if it's a real quote or simulation
        // Prompt says: "Impact Preview must call POST /api/pricing/quote (server truth)"
        // We can add "simulation: true" to body to avoid persisting?
        // OR we just generate a quote and don't "Accept" it.
        // Generated quotes are "pending" and expire. That's fine for preview.
        const res = await fetch(`${BASE_URL}/quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed to simulate quote');
        return res.json();
    },

    getQuotes: async (params: URLSearchParams) => {
        const res = await fetch(`${BASE_URL}/quotes?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch quotes');
        return res.json();
    },

    // --- Audit ---
    getAuditLog: async (params: URLSearchParams) => {
        const res = await fetch(`${BASE_URL}/audit?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch audit log');
        return res.json();
    }
};
