import { createClient } from '@/utils/supabase/client';
import {
    TechnicianSkillProfile,
    technicianSkillProfileSchema,
    XPAwardResult,
    xpAwardResultSchema
} from '@/lib/types/skills';

const supabase = createClient();

export const skillsApi = {

    // =========================================================================
    // ACTIONS
    // =========================================================================

    getSkillTree: async (userId: string): Promise<TechnicianSkillProfile> => {
        const { data, error } = await supabase.rpc('rpc_get_technician_skill_tree', {
            p_user_id: userId
        });

        if (error) throw new Error(error.message);
        return technicianSkillProfileSchema.parse(data);
    },

    awardXP: async (userId: string, amount: number, reason: string, skillId?: string): Promise<XPAwardResult> => {
        const { data, error } = await supabase.rpc('rpc_award_xp', {
            p_user_id: userId,
            p_amount: amount,
            p_reason: reason,
            p_skill_id: skillId || null
        });

        if (error) throw new Error(error.message);
        return xpAwardResultSchema.parse(data);
    },

    // Helper for simulators (admin testing)
    getAllSkills: async () => {
        const { data, error } = await supabase.from('skill_definitions').select('*');
        if (error) throw new Error(error.message);
        return data;
    }
};
