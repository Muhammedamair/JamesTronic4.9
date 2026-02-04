import { createClient } from '@/utils/supabase/client';
import { Territory, territorySchema, Application, applicationSchema } from '@/lib/types/franchise';

const supabase = createClient();

export const franchiseApi = {

    // =========================================================================
    // READ
    // =========================================================================

    getHeatmap: async (): Promise<Territory[]> => {
        const { data, error } = await supabase.rpc('rpc_get_expansion_heatmap');

        if (error) throw new Error(error.message);
        return data.map((d: any) => territorySchema.parse(d));
    },

    getApplications: async (): Promise<Application[]> => {
        const { data, error } = await supabase
            .from('franchise_applications')
            .select(`
            *,
            territory:franchise_territories(*)
        `)
            .order('applied_at', { ascending: false });

        if (error) throw new Error(error.message);
        return data.map((d: any) => applicationSchema.parse(d));
    },

    // =========================================================================
    // ACTIONS
    // =========================================================================

    scoreApplication: async (appId: string) => {
        const { error } = await supabase.rpc('rpc_auto_score_application', { p_application_id: appId });
        if (error) throw new Error(error.message);
    },

    updateApplicationStatus: async (appId: string, status: string) => {
        const { error } = await supabase
            .from('franchise_applications')
            .update({ status })
            .eq('id', appId);

        if (error) throw new Error(error.message);
    }
};
