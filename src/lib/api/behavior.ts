import { createClient } from '@/utils/supabase/client';
import {
    BehaviorProfile,
    behaviorProfileSchema,
    InteractionMetrics,
    interactionMetricsSchema,
    CustomerInsight
} from '@/lib/types/behavior';

const supabase = createClient();

export const behaviorApi = {

    // =========================================================================
    // ACTIONS
    // =========================================================================

    analyzeCustomer: async (userId: string): Promise<BehaviorProfile> => {
        // Calls RPC to calculate/update profile
        const { data: result, error: rpcError } = await supabase.rpc('rpc_calculate_ltv_profile', {
            p_user_id: userId
        });

        if (rpcError) throw new Error(rpcError.message);

        // Fetch the full updated profile row
        const { data, error } = await supabase
            .from('customer_behavior_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) throw new Error(error.message);
        return behaviorProfileSchema.parse(data);
    },

    getAllProfiles: async (): Promise<BehaviorProfile[]> => {
        const { data, error } = await supabase
            .from('customer_behavior_profiles')
            .select('*')
            .order('ltv_score', { ascending: false })
            .limit(50);

        if (error) throw new Error(error.message);
        return data.map((d: any) => behaviorProfileSchema.parse(d)); // Manual map for safety
    },

    getMetrics: async (userId: string): Promise<InteractionMetrics | null> => {
        const { data, error } = await supabase
            .from('customer_interaction_metrics')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw new Error(error.message); // Ignore no rows
        if (!data) return null;
        return interactionMetricsSchema.parse(data);
    }
};
