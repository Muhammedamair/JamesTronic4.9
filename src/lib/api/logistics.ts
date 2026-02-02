import { createClient } from '@/utils/supabase/client';
import {
    Transporter,
    Delivery,
    transporterSchema,
    deliverySchema
} from '@/lib/types/logistics';
import { z } from 'zod';

const supabase = createClient();

export const logisticsApi = {

    // =========================================================================
    // FLEET MANAGEMENT
    // =========================================================================

    getActiveTransporters: async (): Promise<Transporter[]> => {
        const { data, error } = await supabase
            .from('transporter_fleets')
            .select('*')
            .eq('is_active', true)
            .order('reliability_score', { ascending: false });
        if (error) throw new Error(error.message);
        return z.array(transporterSchema).parse(data);
    },

    getTransporterById: async (id: string): Promise<Transporter | null> => {
        const { data, error } = await supabase
            .from('transporter_fleets')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw new Error(error.message);
        return transporterSchema.parse(data);
    },

    createTransporter: async (
        plate: string,
        type: string,
        provider: string = 'internal'
    ): Promise<Transporter> => {
        const { data, error } = await supabase
            .from('transporter_fleets')
            .insert({
                vehicle_plate: plate,
                vehicle_type: type,
                provider_type: provider,
                is_active: true,
                current_status: 'idle'
            })
            .select()
            .single();
        if (error) throw new Error(error.message);
        return transporterSchema.parse(data);
    },

    // =========================================================================
    // DELIVERIES
    // =========================================================================

    getActiveDeliveries: async (): Promise<Delivery[]> => {
        const { data, error } = await supabase
            .from('logistics_deliveries')
            .select('*')
            .neq('status', 'delivered')
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        return z.array(deliverySchema).parse(data);
    },

    createDelivery: async (
        pickup: string,
        drop: string,
        items: string,
        weight: number
    ): Promise<Delivery> => {
        const { data, error } = await supabase
            .from('logistics_deliveries')
            .insert({
                pickup_address: pickup,
                delivery_address: drop,
                items_description: items,
                items_weight_kg: weight,
                status: 'pending_assignment'
            })
            .select()
            .single();
        if (error) throw new Error(error.message);
        return deliverySchema.parse(data);
    },

    assignTransporter: async (deliveryId: string, strategy: string = 'auto_internal_first'): Promise<any> => {
        const { data, error } = await supabase.rpc('rpc_assign_transporter', {
            p_delivery_id: deliveryId,
            p_strategy: strategy
        });
        if (error) throw new Error(error.message);
        return data;
    }
};
