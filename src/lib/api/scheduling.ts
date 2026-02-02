import { createClient } from '@/utils/supabase/client';
import {
    ScheduleSlot, scheduleSlotSchema,
    TechCandidate, techCandidateSchema,
    JobAssignment, jobAssignmentSchema
} from '@/lib/types/scheduling';

const supabase = createClient();

export const schedulingApi = {

    // =========================================================================
    // ACTIONS
    // =========================================================================

    getTechCandidates: async (lat: number, lng: number, time?: string): Promise<TechCandidate[]> => {
        // time param not used in V1 RPC yet, but prepared for future
        const { data, error } = await supabase.rpc('rpc_find_best_technician', {
            p_lat: lat,
            p_lng: lng,
            p_required_time: time || new Date().toISOString()
        });

        if (error) throw new Error(error.message);
        return data.map((d: any) => techCandidateSchema.parse(d));
    },

    assignJob: async (ticketId: string, technicianId: string, score: number): Promise<JobAssignment> => {
        const { data, error } = await supabase
            .from('job_assignments')
            .insert({
                ticket_id: ticketId,
                technician_id: technicianId,
                match_score: score,
                status: 'proposed'
            })
            .select()
            .single();

        if (error) throw new Error(error.message);
        return jobAssignmentSchema.parse(data);
    },

    generateSlots: async (technicianId: string, date: string): Promise<number> => {
        const { data, error } = await supabase.rpc('rpc_generate_schedule_slots', {
            p_technician_id: technicianId,
            p_date: date
        });
        if (error) throw new Error(error.message);
        return data as number;
    },

    getAssignments: async (ticketId?: string) => {
        let query = supabase.from('job_assignments').select('*').order('assigned_at', { ascending: false });
        if (ticketId) query = query.eq('ticket_id', ticketId);

        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return data.map((d: any) => jobAssignmentSchema.parse(d));
    }
};
