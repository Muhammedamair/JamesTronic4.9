import { Ticket } from '../types/ticket';

/**
 * Get the SLA target time in minutes based on the device category
 * @param deviceCategory The category of the device (Mobile, Laptop, TV, Appliances)
 * @returns SLA target time in minutes
 */
export function getSLATarget(deviceCategory: string): number {
  const slaTargets: Record<string, number> = {
    'Mobile': 1440,    // 24 hours in minutes
    'Laptop': 2880,    // 48 hours in minutes
    'TV': 4320,        // 72 hours in minutes
    'Appliances': 2880 // 48 hours in minutes
  };

  // Return the SLA target for the given category, or default to 48 hours if not found
  return slaTargets[deviceCategory] || 2880; // Default to 48 hours
}

/**
 * Determine if a ticket's SLA was breached based on its completion time
 * @param ticket The ticket to evaluate
 * @returns boolean indicating if SLA was breached
 */
export function isSLABreached(ticket: Ticket): boolean {
  // If ticket is not completed, we can't determine SLA breach yet
  if (!ticket.completed_at) {
    return false; // Not breached yet, still in progress
  }

  // Get the SLA target based on device category
  const slaTargetMinutes = getSLATarget(ticket.device_category || 'default');

  // Calculate actual completion time in minutes
  const completionMinutes = calculateTicketCompletionTime(ticket);

  // Return whether the completion time exceeded the SLA target
  return completionMinutes > slaTargetMinutes;
}

/**
 * Calculate the completion time for a ticket in minutes
 * @param ticket The ticket to calculate completion time for
 * @returns Completion time in minutes
 */
function calculateTicketCompletionTime(ticket: Ticket): number {
  try {
    // Parse creation and completion times
    const createdAt = new Date(ticket.created_at);
    const completedAt = ticket.completed_at ? new Date(ticket.completed_at) : new Date();

    // Calculate the difference in milliseconds
    const diffInMs = completedAt.getTime() - createdAt.getTime();

    // Convert milliseconds to minutes
    const diffInMinutes = Math.round(diffInMs / (1000 * 60));

    return Math.max(0, diffInMinutes); // Ensure non-negative result
  } catch (error) {
    console.error('Error calculating ticket completion time:', error);
    return 0; // Return 0 in case of error
  }
}

/**
 * Calculate the SLA percentage from a history of SLA records
 * @param history Array of SLA records with sla_met boolean values
 * @returns SLA compliance percentage
 */
export function calculateSLAPercentage(history: Array<{ sla_met: boolean }>): number {
  if (!history || history.length === 0) {
    return 100; // 100% if no history (perfect score by default)
  }

  // Count how many SLAs were met
  const metCount = history.filter(record => record.sla_met).length;

  // Calculate percentage
  const percentage = (metCount / history.length) * 100;

  return Math.round(percentage * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate SLA compliance within a specific time period
 * @param history Array of SLA records with creation dates and sla_met values
 * @param startDate Start date for the calculation period
 * @param endDate End date for the calculation period
 * @returns SLA compliance percentage for the specified period
 */
export function calculateSLAPercentageForPeriod(
  history: Array<{ sla_met: boolean; created_at: string }>,
  startDate: Date,
  endDate: Date
): number {
  if (!history || history.length === 0) {
    return 100; // 100% if no history
  }

  // Filter records within the specified date range
  const filteredHistory = history.filter(record => {
    const recordDate = new Date(record.created_at);
    return recordDate >= startDate && recordDate <= endDate;
  });

  if (filteredHistory.length === 0) {
    return 100; // 100% if no records in the period
  }

  // Count how many SLAs were met in the period
  const metCount = filteredHistory.filter(record => record.sla_met).length;

  // Calculate percentage
  const percentage = (metCount / filteredHistory.length) * 100;

  return Math.round(percentage * 100) / 100; // Round to 2 decimal places
}

/**
 * Determine the SLA status for a ticket
 * @param ticket The ticket to evaluate
 * @returns 'met', 'breached', or 'in-progress'
 */
export function getSLAStatus(ticket: Ticket): 'met' | 'breached' | 'in-progress' {
  // If ticket is not completed yet, it's still in progress
  if (!ticket.completed_at) {
    // Check if the deadline has passed for in-progress tickets
    const slaTargetMinutes = getSLATarget(ticket.device_category || 'default');
    const createdAt = new Date(ticket.created_at);
    const deadline = new Date(createdAt.getTime() + slaTargetMinutes * 60000); // Add minutes in milliseconds
    
    return new Date() > deadline ? 'breached' : 'in-progress';
  }

  // If ticket is completed, check if SLA was met or breached
  return isSLABreached(ticket) ? 'breached' : 'met';
}

/**
 * Get SLA performance summary for a technician
 * @param history Array of SLA records
 * @returns Object containing SLA performance metrics
 */
export function getSLAPerformanceSummary(
  history: Array<{ sla_met: boolean; created_at: string }>
): {
  total: number;
  met: number;
  breached: number;
  percentage: number;
} {
  if (!history || history.length === 0) {
    return {
      total: 0,
      met: 0,
      breached: 0,
      percentage: 100
    };
  }

  const metCount = history.filter(record => record.sla_met).length;
  const totalCount = history.length;
  const breachedCount = totalCount - metCount;
  const percentage = calculateSLAPercentage(history);

  return {
    total: totalCount,
    met: metCount,
    breached: breachedCount,
    percentage
  };
}