// enhanced-sla-utils.ts
// Enhanced SLA utilities with pause/resume, part-delay penalties, vendor-delay breach functionality, and notification triggers

import { Ticket } from '../types/ticket';
import { PartRequest } from '../api/parts';
import { handleSlaRiskNotification, handlePartDelayNotification } from '../services/eventDispatcher';

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
 * Calculate SLA adjusted for pause periods
 * @param ticket The ticket to evaluate
 * @param pauseResumeLogs Array of pause/resume events with timestamps
 * @returns Adjusted SLA target time considering pause periods
 */
export function calculateAdjustedSLATarget(ticket: Ticket, pauseResumeLogs: PauseResumeLog[]): number {
  const baseSLATarget = getSLATarget(ticket.device_category || 'default');

  // Calculate total pause time in minutes
  let totalPauseTime = 0;
  for (const log of pauseResumeLogs) {
    if (log.action === 'pause' && log.resumed_at) {
      const pauseStart = new Date(log.paused_at).getTime();
      const pauseEnd = new Date(log.resumed_at).getTime();
      const pauseDurationMs = pauseEnd - pauseStart;
      totalPauseTime += Math.round(pauseDurationMs / (1000 * 60)); // Convert to minutes
    }
  }

  return baseSLATarget + totalPauseTime;
}

/**
 * Calculate SLA considering part delay penalties
 * @param ticket The ticket to evaluate
 * @param partRequests Array of part requests related to this ticket
 * @returns Adjusted SLA target time considering part delays
 */
export function calculateSLAWithPartDelays(ticket: Ticket, partRequests: PartRequest[]): number {
  const baseSLATarget = getSLATarget(ticket.device_category || 'default');

  // Calculate total part delay penalty time
  let totalPartDelayPenalty = 0;
  for (const request of partRequests) {
    // Only consider requests that are pending or approved for delay calculation
    if (request.status === 'pending' || request.status === 'approved') {
      // Calculate how long the request has been pending since approval
      const requestDate = new Date(request.created_at);
      const approvedDate = request.approved_at ? new Date(request.approved_at) : requestDate;
      const currentDate = new Date();

      // Calculate delay in minutes since approval
      const delayMs = currentDate.getTime() - approvedDate.getTime();
      const delayInMinutes = Math.round(delayMs / (1000 * 60));

      // Apply penalty based on urgency - critical: 100% delay, high: 80%, normal: 50%, low: 25%
      const urgencyMultiplier = getUrgencyMultiplier(request.urgency_level);
      const penaltyMinutes = delayInMinutes * urgencyMultiplier;
      totalPartDelayPenalty += penaltyMinutes;
    }
  }

  return baseSLATarget + totalPartDelayPenalty;
}

/**
 * Get multiplier based on urgency level for part delay penalties
 * @param urgencyLevel The urgency level of the part request
 * @returns Multiplier for calculating penalty
 */
function getUrgencyMultiplier(urgencyLevel: string): number {
  const multipliers: Record<string, number> = {
    'critical': 1.0, // 100% of delay time
    'high': 0.8,     // 80% of delay time
    'normal': 0.5,   // 50% of delay time
    'low': 0.25      // 25% of delay time
  };

  return multipliers[urgencyLevel] || 0.5; // Default to normal
}

/**
 * Calculate SLA considering vendor delay penalties
 * @param ticket The ticket to evaluate
 * @param poDelays Array of purchase order delay records
 * @returns Adjusted SLA target time considering vendor delays
 */
export function calculateSLAWithVendorDelays(ticket: Ticket, poDelays: VendorDelay[]): number {
  const baseSLATarget = getSLATarget(ticket.device_category || 'default');

  // Calculate total vendor delay penalty time
  let totalVendorDelayPenalty = 0;
  for (const delay of poDelays) {
    totalVendorDelayPenalty += delay.delay_minutes;
  }

  return baseSLATarget + totalVendorDelayPenalty;
}

/**
 * Calculate total adjusted SLA considering all factors
 * @param ticket The ticket to evaluate
 * @param pauseResumeLogs Array of pause/resume events
 * @param partRequests Array of part requests related to this ticket
 * @param vendorDelays Array of vendor delay records
 * @returns Adjusted SLA target time considering all factors
 */
export function calculateTotalAdjustedSLA(
  ticket: Ticket,
  pauseResumeLogs: PauseResumeLog[] = [],
  partRequests: PartRequest[] = [],
  vendorDelays: VendorDelay[] = []
): number {
  let adjustedSLA = getSLATarget(ticket.device_category || 'default');

  // Add pause time
  let totalPauseTime = 0;
  for (const log of pauseResumeLogs) {
    if (log.action === 'pause' && log.resumed_at) {
      const pauseStart = new Date(log.paused_at).getTime();
      const pauseEnd = new Date(log.resumed_at).getTime();
      const pauseDurationMs = pauseEnd - pauseStart;
      totalPauseTime += Math.round(pauseDurationMs / (1000 * 60));
    }
  }
  adjustedSLA += totalPauseTime;

  // Add part delay penalties
  let totalPartDelayPenalty = 0;
  for (const request of partRequests) {
    if (request.status === 'pending' || request.status === 'approved') {
      const requestDate = new Date(request.created_at);
      const approvedDate = request.approved_at ? new Date(request.approved_at) : requestDate;
      const currentDate = new Date();

      // Calculate delay in minutes since approval
      const delayMs = currentDate.getTime() - approvedDate.getTime();
      const delayInMinutes = Math.round(delayMs / (1000 * 60));
      const urgencyMultiplier = getUrgencyMultiplier(request.urgency_level);
      const penaltyMinutes = delayInMinutes * urgencyMultiplier;
      totalPartDelayPenalty += penaltyMinutes;
    }
  }
  adjustedSLA += totalPartDelayPenalty;

  // Add vendor delay penalties
  let totalVendorDelayPenalty = 0;
  for (const delay of vendorDelays) {
    totalVendorDelayPenalty += delay.delay_minutes;
  }
  adjustedSLA += totalVendorDelayPenalty;

  return adjustedSLA;
}

/**
 * Calculate the actual completion time for a ticket adjusting for pause periods
 * @param ticket The ticket to calculate completion time for
 * @param pauseResumeLogs Array of pause/resume events
 * @returns Actual completion time in minutes adjusted for pauses
 */
export function calculateAdjustedTicketCompletionTime(
  ticket: Ticket,
  pauseResumeLogs: PauseResumeLog[] = []
): number {
  try {
    // Parse creation and completion times
    const createdAt = new Date(ticket.created_at);
    const completedAt = ticket.completed_at ? new Date(ticket.completed_at) : new Date();

    // Calculate the difference in milliseconds
    const totalDiffInMs = completedAt.getTime() - createdAt.getTime();

    // Calculate total pause duration
    let totalPauseMs = 0;
    for (const log of pauseResumeLogs) {
      if (log.action === 'pause' && log.resumed_at) {
        const pauseStart = new Date(log.paused_at).getTime();
        const pauseEnd = new Date(log.resumed_at).getTime();
        // Ensure pause is within ticket's timeline
        const adjustedPauseStart = Math.max(pauseStart, createdAt.getTime());
        const adjustedPauseEnd = Math.min(pauseEnd, completedAt.getTime());
        if (adjustedPauseEnd > adjustedPauseStart) {
          totalPauseMs += adjustedPauseEnd - adjustedPauseStart;
        }
      }
    }

    // Calculate adjusted time (total time minus pause time)
    const adjustedDiffInMs = totalDiffInMs - totalPauseMs;
    const adjustedDiffInMinutes = Math.round(adjustedDiffInMs / (1000 * 60));

    return Math.max(0, adjustedDiffInMinutes); // Ensure non-negative result
  } catch (error) {
    console.error('Error calculating adjusted ticket completion time:', error);
    return 0; // Return 0 in case of error
  }
}

/**
 * Determine if a ticket's SLA was breached based on its completion time considering adjustments
 * @param ticket The ticket to evaluate
 * @param pauseResumeLogs Array of pause/resume events
 * @param partRequests Array of part requests related to this ticket
 * @param vendorDelays Array of vendor delay records
 * @returns boolean indicating if SLA was breached
 */
export function isSLABreachedWithAdjustments(
  ticket: Ticket,
  pauseResumeLogs: PauseResumeLog[] = [],
  partRequests: PartRequest[] = [],
  vendorDelays: VendorDelay[] = []
): boolean {
  // If ticket is not completed, we can't determine SLA breach yet
  if (!ticket.completed_at) {
    return false; // Not breached yet, still in progress
  }

  // Get the adjusted SLA target based on device category and adjustments
  const slaTargetMinutes = calculateTotalAdjustedSLA(
    ticket,
    pauseResumeLogs,
    partRequests,
    vendorDelays
  );

  // Calculate actual completion time adjusted for pauses
  const completionMinutes = calculateAdjustedTicketCompletionTime(ticket, pauseResumeLogs);

  // Return whether the completion time exceeded the adjusted SLA target
  return completionMinutes > slaTargetMinutes;
}

/**
 * Determine the SLA status for a ticket considering all adjustments
 * @param ticket The ticket to evaluate
 * @param pauseResumeLogs Array of pause/resume events
 * @param partRequests Array of part requests related to this ticket
 * @param vendorDelays Array of vendor delay records
 * @returns 'met', 'breached', or 'in-progress'
 */
export function getSLAStatusWithAdjustments(
  ticket: Ticket,
  pauseResumeLogs: PauseResumeLog[] = [],
  partRequests: PartRequest[] = [],
  vendorDelays: VendorDelay[] = []
): 'met' | 'breached' | 'in-progress' {
  // If ticket is not completed yet, it's still in progress
  if (!ticket.completed_at) {
    // Calculate adjusted deadline
    const adjustedSLATarget = calculateTotalAdjustedSLA(
      ticket,
      pauseResumeLogs,
      partRequests,
      vendorDelays
    );

    const createdAt = new Date(ticket.created_at);
    // Calculate adjusted elapsed time
    const adjustedElapsedTime = calculateAdjustedTicketCompletionTime(ticket, pauseResumeLogs);

    // Calculate deadline by adding adjusted SLA to creation time
    const deadline = new Date(createdAt.getTime() + adjustedSLATarget * 60000);

    return new Date() > deadline ? 'breached' : 'in-progress';
  }

  // If ticket is completed, check if SLA was met or breached considering adjustments
  return isSLABreachedWithAdjustments(ticket, pauseResumeLogs, partRequests, vendorDelays) ? 'breached' : 'met';
}

/**
 * Calculate total delay caused by parts
 * @param partRequests Array of part requests
 * @returns Total part delay in minutes
 */
export function calculatePartDelayMinutes(partRequests: PartRequest[]): number {
  let totalDelay = 0;

  for (const request of partRequests) {
    if (request.status === 'pending' || request.status === 'approved') {
      const requestDate = new Date(request.created_at);
      const approvedDate = request.approved_at ? new Date(request.approved_at) : requestDate;
      const currentDate = new Date();

      // Calculate delay since approval for pending/approved requests
      const delayMs = currentDate.getTime() - approvedDate.getTime();
      const delayInMinutes = Math.round(delayMs / (1000 * 60));
      const urgencyMultiplier = getUrgencyMultiplier(request.urgency_level);
      totalDelay += delayInMinutes * urgencyMultiplier;
    }
  }

  return totalDelay;
}

/**
 * Calculate total delay caused by vendors
 * @param vendorDelays Array of vendor delay records
 * @returns Total vendor delay in minutes
 */
export function calculateVendorDelayMinutes(vendorDelays: VendorDelay[]): number {
  return vendorDelays.reduce((total, delay) => total + delay.delay_minutes, 0);
}

/**
 * Check if a vendor delay constitutes a breach
 * @param vendorDelay The vendor delay record
 * @param thresholdMinutes Threshold beyond which it's considered a breach
 * @returns boolean indicating if vendor delay is a breach
 */
export function isVendorDelayBreach(vendorDelay: VendorDelay, thresholdMinutes: number = 1440): boolean {
  return vendorDelay.delay_minutes > thresholdMinutes;
}

/**
 * Check if a ticket is at risk of missing its SLA and trigger notification if needed
 * @param ticket The ticket to evaluate
 * @param pauseResumeLogs Array of pause/resume events
 * @param partRequests Array of part requests related to this ticket
 * @param vendorDelays Array of vendor delay records
 * @returns boolean indicating if SLA is at risk and notification was triggered
 */
export async function checkAndTriggerSLARiskNotification(
  ticket: Ticket,
  pauseResumeLogs: PauseResumeLog[] = [],
  partRequests: PartRequest[] = [],
  vendorDelays: VendorDelay[] = []
): Promise<boolean> {
  // Only check SLA risk for tickets that are not yet completed
  if (ticket.completed_at) {
    return false; // Ticket already completed
  }

  // Calculate adjusted deadline
  const adjustedSLATarget = calculateTotalAdjustedSLA(
    ticket,
    pauseResumeLogs,
    partRequests,
    vendorDelays
  );

  const createdAt = new Date(ticket.created_at);
  // Calculate adjusted elapsed time
  const adjustedElapsedTime = calculateAdjustedTicketCompletionTime(ticket, pauseResumeLogs);

  // Calculate deadline by adding adjusted SLA to creation time
  const deadline = new Date(createdAt.getTime() + adjustedSLATarget * 60000);

  // Check if we're approaching the deadline (e.g., within 4 hours of SLA target)
  const timeRemaining = deadline.getTime() - new Date().getTime();
  const fourHoursInMs = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

  // If the ticket has part delays, trigger part delay notification
  const partDelayMinutes = calculatePartDelayMinutes(partRequests);
  if (partDelayMinutes > 60) { // If part is delayed by more than 1 hour
    try {
      await handlePartDelayNotification(ticket.id);
      return true;
    } catch (error) {
      console.error('Error triggering part delay notification:', error);
      return false;
    }
  }

  // If we're within 4 hours of SLA deadline, trigger SLA risk notification
  if (timeRemaining <= fourHoursInMs && timeRemaining > 0) {
    try {
      const delayHours = Math.max(0, (adjustedElapsedTime - adjustedSLATarget) / 60);
      await handleSlaRiskNotification(ticket.id, delayHours);
      return true;
    } catch (error) {
      console.error('Error triggering SLA risk notification:', error);
      return false;
    }
  }

  // If we're past the deadline, trigger SLA risk notification
  if (timeRemaining <= 0) {
    try {
      const delayHours = Math.max(0, (adjustedElapsedTime - adjustedSLATarget) / 60);
      await handleSlaRiskNotification(ticket.id, delayHours);
      return true;
    } catch (error) {
      console.error('Error triggering SLA risk notification:', error);
      return false;
    }
  }

  return false; // No SLA risk detected
}

// Define type for pause/resume logs
export interface PauseResumeLog {
  id: string;
  ticket_id: string;
  action: 'pause' | 'resume';
  reason: string;
  paused_at: string;
  resumed_at?: string;
  created_by: string;
}

// Define type for vendor delay records
export interface VendorDelay {
  id: string;
  po_id: string;
  supplier_id: string;
  delay_minutes: number;
  reason: string;
  created_at: string;
}