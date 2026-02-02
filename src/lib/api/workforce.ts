import { createClient } from '@/utils/supabase/client';
import {
    WorkforceShift,
    WorkforceAttendance,
    WorkforceIncident,
    WorkforceBehaviourScore,
    WorkforcePerformanceDaily,
    WorkforceDailyScoreResult,
    IncidentType,
    IncidentSeverity,
    workforceShiftSchema,
    workforceAttendanceSchema,
    workforceIncidentSchema,
    workforceBehaviourScoreSchema,
    workforcePerformanceDailySchema
} from '@/lib/types/workforce';
import { z } from 'zod';

const supabase = createClient();

export const workforceApi = {

    // Fetch My Shifts (Upcoming/Recent)
    getMyShifts: async (startDate: string, endDate: string): Promise<WorkforceShift[]> => {
        try {
            const { data, error } = await supabase
                .from('workforce_shifts')
                .select('*')
                .gte('shift_date', startDate)
                .lte('shift_date', endDate)
                .order('shift_date', { ascending: true });

            if (error) throw new Error(error.message);

            return z.array(workforceShiftSchema).parse(data);
        } catch (error) {
            console.error('Error fetching shifts:', error);
            throw error;
        }
    },

    // Fetch My Attendance for Today
    getMyTodayAttendance: async (): Promise<WorkforceAttendance | null> => {
        try {
            const { data, error } = await supabase
                .from('workforce_attendance')
                .select('*')
                .is('check_out_at', null) // Still open check-in
                .order('check_in_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw new Error(error.message);
            if (!data) return null;

            return workforceAttendanceSchema.parse(data);
        } catch (error) {
            console.error('Error fetching today attendance:', error);
            throw error;
        }
    },

    // Check In (RPC)
    checkIn: async (lat: number, lng: number): Promise<string> => {
        try {
            const { data, error } = await supabase.rpc('rpc_workforce_check_in', {
                p_lat: lat,
                p_lng: lng
            });

            if (error) throw new Error(error.message);

            return data as string; // Returns attendance ID
        } catch (error) {
            console.error('Error checking in:', error);
            throw error;
        }
    },

    // Check Out (RPC)
    checkOut: async (lat: number, lng: number): Promise<boolean> => {
        try {
            const { data, error } = await supabase.rpc('rpc_workforce_check_out', {
                p_lat: lat,
                p_lng: lng
            });

            if (error) throw new Error(error.message);

            return data as boolean;
        } catch (error) {
            console.error('Error checking out:', error);
            throw error;
        }
    },

    // Get My Latest Score
    getMyLatestScore: async (): Promise<WorkforceBehaviourScore | null> => {
        try {
            // First try to calculate/ensure fresh score via RPC if we want strict real-time
            // But standard read is better for performance. 
            // We will read the table directly.
            const { data, error } = await supabase
                .from('workforce_behaviour_scores')
                .select('*')
                .order('score_date', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw new Error(error.message);
            if (!data) return null;

            return workforceBehaviourScoreSchema.parse(data);
        } catch (error) {
            console.error('Error fetching latest score:', error);
            throw error;
        }
    },

    // Get My Incidents
    getMyIncidents: async (limit = 10): Promise<WorkforceIncident[]> => {
        try {
            const { data, error } = await supabase
                .from('workforce_incidents')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw new Error(error.message);

            return z.array(workforceIncidentSchema).parse(data);
        } catch (error) {
            console.error('Error fetching incidents:', error);
            throw error;
        }
    },

    // Admin: Get All Workforce Scores (Dashboard)
    getAllWorkforceScores: async (date: string): Promise<WorkforceBehaviourScore[]> => {
        try {
            const { data, error } = await supabase
                .from('workforce_behaviour_scores')
                .select('*')
                .eq('score_date', date);

            if (error) throw new Error(error.message);

            return z.array(workforceBehaviourScoreSchema).parse(data);
        } catch (error) {
            console.error('Error fetching all scores:', error);
            throw error;
        }
    },

    // Admin: Log Incident (RPC)
    logIncident: async (
        userId: string,
        type: IncidentType,
        severity: IncidentSeverity,
        description: string,
        ticketId?: string
    ): Promise<string> => {
        try {
            const { data, error } = await supabase.rpc('rpc_log_workforce_incident', {
                p_user_id: userId,
                p_incident_type: type,
                p_severity: severity,
                p_description: description,
                p_ticket_id: ticketId || null
            });

            if (error) throw new Error(error.message);

            return data as string; // Returns incident ID
        } catch (error) {
            console.error('Error logging incident:', error);
            throw error;
        }
    },

    // Admin: Resolve Incident (RPC)
    resolveIncident: async (incidentId: string, notes: string): Promise<boolean> => {
        try {
            const { data, error } = await supabase.rpc('rpc_resolve_workforce_incident', {
                p_incident_id: incidentId,
                p_resolution_notes: notes
            });

            if (error) throw new Error(error.message);

            return data as boolean;
        } catch (error) {
            console.error('Error resolving incident:', error);
            throw error;
        }
    }
};
