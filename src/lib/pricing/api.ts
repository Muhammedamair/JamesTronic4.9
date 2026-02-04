'use client';

import { PricingClient } from '@/lib/pricing/client';
import { BaseRate } from '@/types/pricing';

export const PricingAPI = {
    // Re-export existing overview/client methods if needed, or consolidate here.
    // For now, extending the pattern started in client.ts

    async getBaseRates(params: URLSearchParams) {
        // GET /api/pricing/base-rates?city_id=...
        const res = await fetch(`/api/pricing/base-rates?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch base rates');
        return res.json();
    },

    async createBaseRateRevision(payload: {
        city_id: string;
        service_code: string;
        effective_from: string; // ISO
        labor_base: number;
        diagnostic_fee: number;
        transport_base: number;
        parts_markup_pct: number;
        reason: string;
    }) {
        const res = await fetch('/api/pricing/base-rates/revision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to create revision');
        }
        return res.json();
    },

    async simulateQuote(payload: {
        city_id: string;
        service_code: string;
        override_rates: {
            labor_base: number;
            diagnostic_fee: number;
            transport_base: number;
            parts_markup_pct: number;
        }
    }) {
        const res = await fetch('/api/pricing/base-rates/preview-quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to simulate quote');
        return res.json();
    }
};
