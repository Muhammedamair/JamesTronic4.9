import { createClient } from '@/utils/supabase/client';
import { Policy, policySchema, Claim, claimSchema, liabilityMetricsSchema } from '@/lib/types/insurance';

const supabase = createClient();

export const insuranceApi = {

    // =========================================================================
    // READ
    // =========================================================================

    getPolicies: async (): Promise<Policy[]> => {
        const { data, error } = await supabase
            .from('warranty_policies')
            .select(`
            *,
            provider:insurance_providers(*)
        `)
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        return data.map((d: any) => policySchema.parse(d));
    },

    getClaims: async (): Promise<Claim[]> => {
        const { data, error } = await supabase
            .from('warranty_claims')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        return data.map((d: any) => claimSchema.parse(d));
    },

    getLiabilities: async () => {
        const { data, error } = await supabase.rpc('rpc_get_active_liabilities');

        if (error) throw new Error(error.message);

        const metrics = Array.isArray(data) ? data[0] : data;
        return liabilityMetricsSchema.parse(metrics);
    },

    // =========================================================================
    // WRITE
    // =========================================================================

    createClaim: async (claim: Partial<Claim>) => {
        const { data, error } = await supabase
            .from('warranty_claims')
            .insert(claim)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return claimSchema.parse(data);
    }
};
