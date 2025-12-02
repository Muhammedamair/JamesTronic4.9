import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client using environment variables
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
);

interface AssignmentLogEntry {
  ticketId: string;
  oldTechnicianId: string | null;
  newTechnicianId: string;
  assignedBy: string; // user ID of admin/staff who assigned
  timestamp: string; // ISO string timestamp
  slaStatus: string | null; // Could store SLA status if needed
}

export const assignmentLogger = {
  /**
   * Logs a ticket assignment with details
   * @param logEntry The assignment log entry to save
   */
  logAssignment: async (logEntry: AssignmentLogEntry): Promise<void> => {
    try {
      // Create a log entry in action_logs table
      const { error } = await supabase
        .from('action_logs')
        .insert({
          ticket_id: logEntry.ticketId,
          action: 'ticket_assigned',
          meta: {
            old_technician_id: logEntry.oldTechnicianId,
            new_technician_id: logEntry.newTechnicianId,
            assigned_by: logEntry.assignedBy,
            sla_status: logEntry.slaStatus,
          },
          actor: logEntry.assignedBy,
          created_at: logEntry.timestamp,
        });

      if (error) {
        console.error('Error logging assignment:', error);
        // Note: We don't throw an error here as logging shouldn't break the main functionality
      }
    } catch (error) {
      console.error('Unexpected error in assignmentLogger.logAssignment:', error);
      // Don't throw error to prevent breaking the main assignment functionality
    }
  },

  /**
   * Logs a ticket unassignment with details
   * @param ticketId The ticket that was unassigned
   * @param oldTechnicianId The technician ID that was removed
   * @param unassignedBy The admin/staff user ID who performed the unassignment
   * @param timestamp The timestamp of the unassignment
   */
  logUnassignment: async (
    ticketId: string,
    oldTechnicianId: string,
    unassignedBy: string,
    timestamp: string
  ): Promise<void> => {
    try {
      const { error } = await supabase
        .from('action_logs')
        .insert({
          ticket_id: ticketId,
          action: 'ticket_unassigned',
          meta: {
            old_technician_id: oldTechnicianId,
            unassigned_by: unassignedBy,
          },
          actor: unassignedBy,
          created_at: timestamp,
        });

      if (error) {
        console.error('Error logging unassignment:', error);
        // Note: We don't throw an error here as logging shouldn't break the main functionality
      }
    } catch (error) {
      console.error('Unexpected error in assignmentLogger.logUnassignment:', error);
      // Don't throw error to prevent breaking the main functionality
    }
  },

  /**
   * Retrieves assignment history for a ticket (who assigned it to whom and when)
   * @param ticketId The ticket ID to get assignment history for
   * @returns Array of assignment history entries
   */
  getAssignmentHistory: async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from('action_logs')
        .select(`
          id,
          ticket_id,
          action,
          meta,
          actor,
          created_at,
          profiles (full_name)
        `)
        .eq('ticket_id', ticketId)
        .in('action', ['ticket_assigned', 'ticket_unassigned'])
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Error fetching assignment history: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error in assignmentLogger.getAssignmentHistory:', error);
      throw error;
    }
  },
};