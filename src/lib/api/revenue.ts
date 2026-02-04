import { createClient } from '@/utils/supabase/client';
import { LeakageAlert, leakageAlertSchema, scanResultSchema } from '@/lib/types/revenue';

const supabase = createClient();

export const revenueApi = {

    // =========================================================================
    // ACTIONS
    // =========================================================================

    getAlerts: async (): Promise<LeakageAlert[]> => {
        const { data, error } = await supabase
            .from('revenue_leakage_alerts')
            .select(`
            *,
            rule:leakage_rules(*)
        `)
            .order('detected_at', { ascending: false });

        if (error) throw new Error(error.message);
        return data.map((d: any) => leakageAlertSchema.parse(d));
    },

    resolveAlert: async (id: string, notes: string): Promise<void> => {
        const { error } = await supabase
            .from('revenue_leakage_alerts')
            .update({
                status: 'resolved',
                resolution_notes: notes,
                resolved_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw new Error(error.message);
    },

    runSimulation: async (ticketId: string): Promise<any> => {
        // Calls the simulation RPC
        const { data, error } = await supabase.rpc('rpc_scan_revenue_leakage', {
            p_ticket_id: ticketId
        });

        if (error) throw new Error(error.message);
        return scanResultSchema.parse(data);
    }
};
