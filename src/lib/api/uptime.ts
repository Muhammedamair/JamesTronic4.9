import { createClient } from '@/utils/supabase/client';
import {
    Monitor, monitorSchema,
    SystemIncident, systemIncidentSchema
} from '@/lib/types/uptime';

const supabase = createClient();

export const uptimeApi = {

    // =========================================================================
    // ACTIONS
    // =========================================================================

    getSystemHealth: async (): Promise<Monitor[]> => {
        // Use RPC for fast aggregation
        const { data, error } = await supabase.rpc('rpc_get_system_health');
        if (error) throw new Error(error.message);
        return data.map((d: any) => monitorSchema.parse({
            id: d.monitor_id,
            name: d.name,
            type: d.type,
            endpoint: null,
            current_status: d.status,
            last_checked_at: d.last_checked_at,
            last_latency_ms: d.latency_ms,
            uptime_percentage_24h: 99.99
        }));
    },

    getIncidents: async (): Promise<SystemIncident[]> => {
        const { data, error } = await supabase
            .from('system_incidents')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw new Error(error.message);
        return data.map((d: any) => systemIncidentSchema.parse(d));
    },

    simultateHeartbeat: async (monitorId: string, status: 'operational' | 'degraded' | 'down', latency: number) => {
        const { error } = await supabase.rpc('rpc_record_heartbeat', {
            p_monitor_id: monitorId,
            p_status: status,
            p_latency_ms: latency
        });
        if (error) throw new Error(error.message);
    }
};
