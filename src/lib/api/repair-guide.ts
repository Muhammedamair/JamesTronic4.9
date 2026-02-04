import { createClient } from '@/utils/supabase/client';
import { RepairGuide, repairGuideSchema, RepairStep, repairStepSchema } from '@/lib/types/repair-guide';

const supabase = createClient();

export const repairGuideApi = {

    // =========================================================================
    // READ
    // =========================================================================

    searchGuides: async (query: string): Promise<RepairGuide[]> => {
        let rpcName = 'rpc_search_guides';
        const { data, error } = await supabase.rpc(rpcName, { p_query: query });

        if (error) throw new Error(error.message);
        return data.map((d: any) => repairGuideSchema.parse(d));
    },

    getAllGuides: async (): Promise<RepairGuide[]> => {
        const { data, error } = await supabase
            .from('repair_guides')
            .select('*')
            .order('device_model', { ascending: true });

        if (error) throw new Error(error.message);
        return data.map((d: any) => repairGuideSchema.parse(d));
    },

    getGuideDetails: async (guideId: string): Promise<RepairGuide> => {
        // Fetch guide metadata
        const { data: guideData, error: guideError } = await supabase
            .from('repair_guides')
            .select('*')
            .eq('id', guideId)
            .single();

        if (guideError) throw new Error(guideError.message);

        // Fetch steps
        const { data: stepsData, error: stepsError } = await supabase
            .from('repair_steps')
            .select('*')
            .eq('guide_id', guideId)
            .order('order_index', { ascending: true });

        if (stepsError) throw new Error(stepsError.message);

        const guide = repairGuideSchema.parse(guideData);
        guide.steps = stepsData.map((d: any) => repairStepSchema.parse(d));

        return guide;
    },

    // =========================================================================
    // AI SIMULATION
    // =========================================================================

    simulateDiagnosis: async (query: string): Promise<string> => {
        // Mocked AI Logic
        const q = query.toLowerCase();

        if (q.includes('screen') || q.includes('display')) {
            return "Based on visual patterns, this looks like a shattered OLED panel. Recommended action: Full Display Assembly Replacement. Check for frame bending.";
        }
        if (q.includes('battery') || q.includes('power') || q.includes('charge')) {
            return "Symptoms suggest battery degradation or charging port failure. Check cycle count. If < 80% health, recommend replacement.";
        }
        if (q.includes('water') || q.includes('liquid')) {
            return "CRITICAL: Liquid contact detected. Do not power on. Disconnect battery immediately and inspect LVDS connectors for corrosion.";
        }

        return "Unable to determine specific issue from description. Please upload a photo or inspect the logic board.";
    }
};
