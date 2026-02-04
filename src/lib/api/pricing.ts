import { createClient } from '@/utils/supabase/client';
import {
    PricingRule,
    PricingModifier,
    SurgePricingEvent,
    PriceQuote,
    SLAPenaltyRecord,
    pricingRuleSchema,
    pricingModifierSchema,
    surgePricingEventSchema,
    priceQuoteSchema,
    slaPenaltyRecordSchema
} from '@/lib/types/pricing';
import { z } from 'zod';

const supabase = createClient();

export const pricingApi = {

    // =========================================================================
    // PRICING RULES
    // =========================================================================

    getPricingRules: async (): Promise<PricingRule[]> => {
        const { data, error } = await supabase
            .from('pricing_rules')
            .select('*')
            .eq('is_active', true)
            .order('category');
        if (error) throw new Error(error.message);
        return z.array(pricingRuleSchema).parse(data);
    },

    updatePricingRule: async (id: string, updates: Partial<PricingRule>): Promise<PricingRule> => {
        const { data, error } = await supabase
            .from('pricing_rules')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return pricingRuleSchema.parse(data);
    },

    // =========================================================================
    // PRICE CALCULATION
    // =========================================================================

    calculatePrice: async (
        category: string,
        labourHours = 1.0,
        partsCost = 0,
        city?: string,
        urgency = 'normal'
    ): Promise<any> => {
        const { data, error } = await supabase.rpc('rpc_calculate_service_price', {
            p_category: category,
            p_labour_hours: labourHours,
            p_parts_cost: partsCost,
            p_city: city || null,
            p_urgency: urgency
        });
        if (error) throw new Error(error.message);
        return data;
    },

    // =========================================================================
    // SURGE PRICING
    // =========================================================================

    getActiveSurgeEvents: async (): Promise<SurgePricingEvent[]> => {
        const { data, error } = await supabase
            .from('surge_pricing_events')
            .select('*')
            .eq('is_active', true)
            .gte('ends_at', new Date().toISOString())
            .order('starts_at');
        if (error) throw new Error(error.message);
        return z.array(surgePricingEventSchema).parse(data);
    },

    applySurgePricing: async (
        city: string | null,
        multiplier: number,
        reason: string,
        hours = 4
    ): Promise<string> => {
        const { data, error } = await supabase.rpc('rpc_apply_surge_pricing', {
            p_city: city,
            p_multiplier: multiplier,
            p_reason: reason,
            p_hours: hours
        });
        if (error) throw new Error(error.message);
        return data as string;
    },

    endSurgePricing: async (eventId: string): Promise<void> => {
        const { error } = await supabase
            .from('surge_pricing_events')
            .update({ is_active: false, ends_at: new Date().toISOString() })
            .eq('id', eventId);
        if (error) throw new Error(error.message);
    },

    // =========================================================================
    // PRICE QUOTES
    // =========================================================================

    getQuotesForTicket: async (ticketId: string): Promise<PriceQuote[]> => {
        const { data, error } = await supabase
            .from('price_quotes')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        return z.array(priceQuoteSchema).parse(data);
    },

    // =========================================================================
    // SLA PENALTIES
    // =========================================================================

    calculateSLAPenalty: async (
        ticketId: string,
        breachType: string,
        expectedValue: string,
        actualValue: string
    ): Promise<any> => {
        const { data, error } = await supabase.rpc('rpc_calculate_sla_penalty', {
            p_ticket_id: ticketId,
            p_breach_type: breachType,
            p_expected_value: expectedValue,
            p_actual_value: actualValue
        });
        if (error) throw new Error(error.message);
        return data;
    },

    getPenaltiesForTicket: async (ticketId: string): Promise<SLAPenaltyRecord[]> => {
        const { data, error } = await supabase
            .from('sla_penalty_records')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        return z.array(slaPenaltyRecordSchema).parse(data);
    }
};
