import { createClient } from '@/utils/supabase/client';
import {
    PredictionLog,
    PredictionResult,
    predictionLogSchema,
    predictionResultSchema
} from '@/lib/types/predictions';
import { z } from 'zod';

const supabase = createClient();

export const predictionsApi = {

    // =========================================================================
    // PREDICTIONS
    // =========================================================================

    calculatePrediction: async (
        ticketId: string,
        deviceAge?: number,
        brand?: string
    ): Promise<PredictionResult> => {
        const { data, error } = await supabase.rpc('rpc_predict_repair_outcome', {
            p_ticket_id: ticketId,
            p_device_age: deviceAge,
            p_brand: brand
        });
        if (error) throw new Error(error.message);
        return predictionResultSchema.parse(data);
    },

    getRecentPredictions: async (): Promise<PredictionLog[]> => {
        const { data, error } = await supabase
            .from('repair_prediction_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) throw new Error(error.message);
        return z.array(predictionLogSchema).parse(data);
    },

    getPredictionsByTicket: async (ticketId: string): Promise<PredictionLog[]> => {
        const { data, error } = await supabase
            .from('repair_prediction_logs')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        return z.array(predictionLogSchema).parse(data);
    }
};
