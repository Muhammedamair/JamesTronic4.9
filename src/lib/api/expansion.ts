import { createClient } from '@/utils/supabase/client';
import {
    DarkStore,
    LocationScore,
    ExpansionPlan,
    WorkloadDistribution,
    darkStoreSchema,
    locationScoreSchema,
    expansionPlanSchema,
    workloadDistributionSchema
} from '@/lib/types/expansion';
import { z } from 'zod';

const supabase = createClient();

export const expansionApi = {

    // =========================================================================
    // DARK STORES
    // =========================================================================

    getAllDarkStores: async (): Promise<DarkStore[]> => {
        const { data, error } = await supabase
            .from('dark_stores')
            .select('*')
            .order('city');
        if (error) throw new Error(error.message);
        return z.array(darkStoreSchema).parse(data);
    },

    getDarkStoreById: async (id: string): Promise<DarkStore | null> => {
        const { data, error } = await supabase
            .from('dark_stores')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error) throw new Error(error.message);
        return data ? darkStoreSchema.parse(data) : null;
    },

    createDarkStore: async (store: Partial<DarkStore>): Promise<DarkStore> => {
        const { data, error } = await supabase
            .from('dark_stores')
            .insert(store)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return darkStoreSchema.parse(data);
    },

    updateDarkStore: async (id: string, updates: Partial<DarkStore>): Promise<DarkStore> => {
        const { data, error } = await supabase
            .from('dark_stores')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return darkStoreSchema.parse(data);
    },

    calculateServiceArea: async (storeId: string): Promise<any> => {
        const { data, error } = await supabase.rpc('rpc_calculate_service_area', {
            p_store_id: storeId
        });
        if (error) throw new Error(error.message);
        return data;
    },

    // =========================================================================
    // LOCATION SCORES
    // =========================================================================

    getLocationScores: async (city?: string): Promise<LocationScore[]> => {
        let query = supabase.from('location_scores').select('*');
        if (city) query = query.eq('city', city);

        const { data, error } = await query.order('composite_score', { ascending: false });
        if (error) throw new Error(error.message);
        return z.array(locationScoreSchema).parse(data);
    },

    calculateLocationScore: async (city: string, areaName?: string): Promise<any> => {
        const { data, error } = await supabase.rpc('rpc_calculate_location_score', {
            p_city: city,
            p_area_name: areaName || null
        });
        if (error) throw new Error(error.message);
        return data;
    },

    // =========================================================================
    // EXPANSION PLANS
    // =========================================================================

    getExpansionPlans: async (): Promise<ExpansionPlan[]> => {
        const { data, error } = await supabase
            .from('expansion_plans')
            .select('*')
            .order('phase');
        if (error) throw new Error(error.message);
        return z.array(expansionPlanSchema).parse(data);
    },

    createExpansionPlan: async (plan: Partial<ExpansionPlan>): Promise<ExpansionPlan> => {
        const { data, error } = await supabase
            .from('expansion_plans')
            .insert(plan)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return expansionPlanSchema.parse(data);
    },

    // =========================================================================
    // WORKLOAD DISTRIBUTION
    // =========================================================================

    getWorkloadDistribution: async (date?: string): Promise<WorkloadDistribution[]> => {
        let query = supabase.from('workload_distribution').select('*');
        if (date) {
            query = query.eq('distribution_date', date);
        }

        const { data, error } = await query.order('capacity_utilization', { ascending: false });
        if (error) throw new Error(error.message);
        return z.array(workloadDistributionSchema).parse(data);
    },

    balanceWorkload: async (date?: string): Promise<number> => {
        const { data, error } = await supabase.rpc('rpc_balance_workload', {
            p_date: date || new Date().toISOString().split('T')[0]
        });
        if (error) throw new Error(error.message);
        return data as number;
    }
};
