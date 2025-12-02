import { supabase } from '@/lib/supabase/supabase';

/**
 * Calculates the current workload for a technician based on assigned tickets
 * @param technicianId - The UUID of the technician
 * @returns The number of active tickets assigned to the technician
 */
export const calculateTechnicianLoad = async (technicianId: string): Promise<number> => {
  try {
    // Count tickets assigned to this technician that are not yet closed
    const { count, error } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_technician_id', technicianId)
      .not('status', 'in', '(Closed,Cancelled,Completed)'); // Not closed tickets

    if (error) {
      throw new Error(`Error calculating technician load: ${error.message}`);
    }

    return count || 0;
  } catch (error) {
    console.error('Error in calculateTechnicianLoad:', error);
    throw error;
  }
};

/**
 * Gets the history of a technician's assignments and performance
 * @param technicianId - The UUID of the technician
 * @param daysBack - Number of days back to fetch history (default: 30)
 * @returns Technician's assignment history with performance metrics
 */
export const getTechnicianHistory = async (
  technicianId: string,
  daysBack: number = 30
): Promise<{
  totalAssigned: number;
  completed: number;
  active: number;
  averageCompletionTime: number | null; // In hours
  performanceScore: number; // 0-100 scale
}> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    const cutoffDateString = cutoffDate.toISOString();

    // Get all tickets assigned to this technician in the specified time period
    const { data: assignedTickets, error: assignedError } = await supabase
      .from('tickets')
      .select(`
        id,
        status,
        created_at,
        updated_at,
        ticket_status_history (status, changed_at)
      `)
      .eq('assigned_technician_id', technicianId)
      .gte('created_at', cutoffDateString);

    if (assignedError) {
      throw new Error(`Error fetching technician history: ${assignedError.message}`);
    }

    // Calculate metrics
    const totalAssigned = assignedTickets.length;
    const completed = assignedTickets.filter(ticket =>
      ticket.status === 'Completed' || ticket.status === 'Closed'
    ).length;

    const active = assignedTickets.filter(ticket =>
      ticket.status !== 'Completed' && ticket.status !== 'Closed' && ticket.status !== 'Cancelled'
    ).length;

    // Calculate average completion time
    let totalCompletionTime = 0;
    let completionCount = 0;

    assignedTickets.forEach(ticket => {
      if (ticket.status === 'Completed' || ticket.status === 'Closed') {
        // Find the transition from any status to "Completed" or "Closed"
        const statusHistory = ticket.ticket_status_history || [];
        const completionEvent = statusHistory.find(
          (event: any) => event.status === 'Completed' || event.status === 'Closed'
        );

        if (completionEvent) {
          const createdTime = new Date(ticket.created_at).getTime();
          const completedTime = new Date(completionEvent.changed_at).getTime();
          const completionTimeHours = (completedTime - createdTime) / (1000 * 60 * 60);
          totalCompletionTime += completionTimeHours;
          completionCount++;
        }
      }
    });

    const averageCompletionTime = completionCount > 0
      ? totalCompletionTime / completionCount
      : null;

    // Calculate performance score (0-100) based on completion rate and other factors
    const completionRate = totalAssigned > 0 ? (completed / totalAssigned) * 100 : 100;
    // For now, a simple performance score based on completion rate
    const performanceScore = completionRate;

    return {
      totalAssigned,
      completed,
      active,
      averageCompletionTime,
      performanceScore
    };
  } catch (error) {
    console.error('Error in getTechnicianHistory:', error);
    throw error;
  }
};