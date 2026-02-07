import { createClient } from '@/utils/supabase/client';
import {
    Bin, binSchema,
    StoreMetrics, storeMetricsSchema,
    TechnicianQueue, technicianQueueSchema
} from '@/lib/types/dark-store';

const supabase = createClient();

export const darkStoreApi = {

    // =========================================================================
    // ACTIONS
    // =========================================================================

    getBins: async (branchId: string): Promise<Bin[]> => {
        const { data, error } = await supabase
            .from('dark_store_bins')
            .select('*')
            .eq('branch_id', branchId)
            .order('bin_code', { ascending: true });

        if (error) throw new Error(error.message);
        return data.map((d: any) => binSchema.parse(d));
    },

    getStoreMetrics: async (branchId: string): Promise<StoreMetrics> => {
        // Use RPC for aggregation
        // Note: RPC returns a single row, but Supabase RPC usually returns array of rows.
        // We will select single().

        const { data, error } = await supabase.rpc('rpc_get_store_metrics', { p_branch_id: branchId }); // Returns array usually

        if (error) throw new Error(error.message);

        // If data is array (which it is for TABLE return types), take first
        const metricData = Array.isArray(data) ? data[0] : data;

        return storeMetricsSchema.parse(metricData);
    },

    getQueues: async (branchId: string): Promise<TechnicianQueue[]> => {
        const { data, error } = await supabase
            .from('technician_queues')
            .select(`
            *,
            profiles:technician_id(full_name)
        `)
            .eq('branch_id', branchId);

        if (error) throw new Error(error.message);

        return data.map((d: any) => technicianQueueSchema.parse({
            ...d,
            technician_name: d.profiles?.full_name || 'Unknown'
        }));
    },

    autoAssignBin: async (branchId: string, type: 'fast_moving' | 'standard' | 'bulk' = 'standard'): Promise<Bin | null> => {
        const { data, error } = await supabase.rpc('rpc_assign_bin', {
            p_branch_id: branchId,
            p_type: type
        });

        if (error) throw new Error(error.message);

        if (!data || data.length === 0) return null;

        // We need to fetch the full bin details now
        const binId = data[0].bin_id;

        const { data: binData, error: binError } = await supabase
            .from('dark_store_bins')
            .select('*')
            .eq('id', binId)
            .single();

        if (binError) throw new Error(binError.message);

        return binSchema.parse(binData);
    }
};
