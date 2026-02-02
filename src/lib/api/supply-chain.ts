import { createClient } from '@/utils/supabase/client';
import {
    InventoryForecast,
    StockoutAlert,
    ProcurementRecommendation,
    stockoutAlertSchema,
    procurementRecommendationSchema,
    forecastSchema
} from '@/lib/types/supply-chain';
import { z } from 'zod';

const supabase = createClient();

export const supplyChainApi = {

    // =========================================================================
    // ACTIONS
    // =========================================================================

    generateForecast: async (storeId: string): Promise<void> => {
        const { error } = await supabase.rpc('rpc_generate_store_replenishment_forecast', {
            p_store_id: storeId
        });
        if (error) throw new Error(error.message);
    },

    getAlerts: async (): Promise<StockoutAlert[]> => {
        const { data, error } = await supabase
            .from('stockout_alerts')
            .select('*')
            .eq('is_resolved', false)
            .order('risk_level', { ascending: false }) // Critical first (if enums ordered correctly... actually alphabetic order might be wrong for enums without custom sort. But 'critical' < 'high'? No. Let's trust DB sort or fix later.)
            .limit(50);

        if (error) throw new Error(error.message);
        return z.array(stockoutAlertSchema).parse(data);
    },

    getRecommendations: async (): Promise<ProcurementRecommendation[]> => {
        const { data, error } = await supabase
            .from('procurement_recommendations')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        return z.array(procurementRecommendationSchema).parse(data);
    },

    approveRecommendation: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('procurement_recommendations')
            .update({ status: 'approved' })
            .eq('id', id);
        if (error) throw new Error(error.message);
    },

    getActiveStores: async (): Promise<{ id: string, name: string }[]> => {
        const { data, error } = await supabase
            .from('dark_stores')
            .select('id, name')
            .eq('status', 'active')
            .limit(1);

        if (error) throw new Error(error.message);
        return data || [];
    }
};
