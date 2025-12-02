import { Ticket } from '../types/ticket';
import {
  calculateTotalAdjustedSLA,
  calculateAdjustedTicketCompletionTime,
  isSLABreachedWithAdjustments,
  getSLATarget,
  PauseResumeLog,
  VendorDelay
} from './enhanced-sla-utils';
import { PartRequest } from '../api/parts';

/**
 * Calculate SLA compliance for a ticket with adjustments for pauses, part delays, and vendor delays
 * @param ticket The ticket to evaluate
 * @param pauseResumeLogs Array of pause/resume events
 * @param partRequests Array of part requests related to this ticket
 * @param vendorDelays Array of vendor delay records
 * @returns boolean indicating if SLA was met considering adjustments
 */
export function calculateSLAWithAdjustments(
  ticket: Ticket,
  pauseResumeLogs: PauseResumeLog[] = [],
  partRequests: PartRequest[] = [],
  vendorDelays: VendorDelay[] = []
): boolean {
  return !isSLABreachedWithAdjustments(ticket, pauseResumeLogs, partRequests, vendorDelays);
}

/**
 * Calculate the performance score for a technician based on their performance metrics with adjustments
 * @param performance The performance record containing metrics
 * @param tickets Array of tickets to evaluate for adjusted SLA calculations
 * @param pauseResumeLogs Array of pause/resume events per ticket
 * @param partRequests Array of part requests per ticket
 * @param vendorDelays Array of vendor delay records per ticket
 * @returns The calculated performance score (0-100)
 */
export function calculateScoreWithAdjustments(
  performance: {
    avg_completion_time_minutes?: number;
    sla_met?: number;
    sla_breached?: number;
    rating_avg?: number;
    jobs_completed?: number;
  },
  tickets: Ticket[],
  pauseResumeLogs: Record<string, PauseResumeLog[]> = {},
  partRequests: Record<string, PartRequest[]> = {},
  vendorDelays: Record<string, VendorDelay[]> = {}
): number {
  // Default values for calculations if metrics are not provided
  const avgCompletionTime = performance.avg_completion_time_minutes || 0;
  const slaMet = performance.sla_met || 0;
  const slaBreached = performance.sla_breached || 0;
  const ratingAvg = performance.rating_avg || 0;
  const jobsCompleted = performance.jobs_completed || 0;

  // Calculate adjusted SLA metrics based on tickets and adjustments
  let adjustedSlaMet = 0;
  let adjustedSlaBreached = 0;

  for (const ticket of tickets) {
    const ticketPauseLogs = pauseResumeLogs[ticket.id] || [];
    const ticketPartRequests = partRequests[ticket.id] || [];
    const ticketVendorDelays = vendorDelays[ticket.id] || [];

    if (isSLABreachedWithAdjustments(ticket, ticketPauseLogs, ticketPartRequests, ticketVendorDelays)) {
      adjustedSlaBreached++;
    } else {
      adjustedSlaMet++;
    }
  }

  // If no tickets provided, use original metrics
  const totalAdjustedSla = adjustedSlaMet + adjustedSlaBreached;
  const slaPercentage = totalAdjustedSla > 0
    ? (adjustedSlaMet / totalAdjustedSla) * 100
    : (slaMet + slaBreached > 0 ? (slaMet / (slaMet + slaBreached)) * 100 : 0);

  // Calculate consistency factor based on number of jobs completed
  // Higher completion count increases consistency score
  const consistencyFactor = jobsCompleted > 0 ? Math.min(jobsCompleted / 10, 1) * 10 : 0; // Up to 10 points

  // Calculate weighted score based on the provided formula:
  // completion_speed: 40%, sla_accuracy: 30%, rating: 20%, consistency: 10%
  let score = 0;

  // Completion speed: Higher scores for faster average completion times (inverted)
  // Assuming a target of 1440 minutes (24 hours) as a baseline
  const baselineCompletionTime = 1440; // 24 hours in minutes
  const speedScore = avgCompletionTime > 0
    ? Math.max(0, (1 - (avgCompletionTime / baselineCompletionTime)) * 40)
    : 40; // Full points if no time recorded yet

  // SLA accuracy: 30% of total score
  const slaAccuracyScore = (slaPercentage / 100) * 30;

  // Rating: 20% of total score (rating_avg is out of 5, so convert to percentage)
  const ratingScore = (ratingAvg / 5) * 20;

  // Consistency: 10% of total score
  const consistencyScore = consistencyFactor;

  score = speedScore + slaAccuracyScore + ratingScore + consistencyScore;

  // Ensure the score is within the range of 0-100
  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculate the base performance score without adjustments
 * @param performance The performance record containing metrics
 * @returns The calculated performance score (0-100)
 */
export function calculateScore(performance: {
  avg_completion_time_minutes?: number;
  sla_met?: number;
  sla_breached?: number;
  rating_avg?: number;
  jobs_completed?: number;
}): number {
  // Default values for calculations if metrics are not provided
  const avgCompletionTime = performance.avg_completion_time_minutes || 0;
  const slaMet = performance.sla_met || 0;
  const slaBreached = performance.sla_breached || 0;
  const ratingAvg = performance.rating_avg || 0;
  const jobsCompleted = performance.jobs_completed || 0;

  // Calculate total SLA attempts
  const totalSLA = slaMet + slaBreached;

  // Calculate SLA percentage (avoid division by zero)
  const slaPercentage = totalSLA > 0 ? (slaMet / totalSLA) * 100 : 0;

  // Calculate consistency factor based on number of jobs completed
  // Higher completion count increases consistency score
  const consistencyFactor = jobsCompleted > 0 ? Math.min(jobsCompleted / 10, 1) * 10 : 0; // Up to 10 points

  // Calculate weighted score based on the provided formula:
  // completion_speed: 40%, sla_accuracy: 30%, rating: 20%, consistency: 10%
  let score = 0;

  // Completion speed: Higher scores for faster average completion times (inverted)
  // Assuming a target of 1440 minutes (24 hours) as a baseline
  const baselineCompletionTime = 1440; // 24 hours in minutes
  const speedScore = avgCompletionTime > 0
    ? Math.max(0, (1 - (avgCompletionTime / baselineCompletionTime)) * 40)
    : 40; // Full points if no time recorded yet

  // SLA accuracy: 30% of total score
  const slaAccuracyScore = (slaPercentage / 100) * 30;

  // Rating: 20% of total score (rating_avg is out of 5, so convert to percentage)
  const ratingScore = (ratingAvg / 5) * 20;

  // Consistency: 10% of total score
  const consistencyScore = consistencyFactor;

  score = speedScore + slaAccuracyScore + ratingScore + consistencyScore;

  // Ensure the score is within the range of 0-100
  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculate the completion time in minutes between two timestamps with adjustments for pauses
 * @param ticket The ticket to calculate completion time for
 * @param pauseResumeLogs Array of pause/resume events
 * @returns The completion time in minutes adjusted for pauses
 */
export function calculateAdjustedCompletionMinutes(
  ticket: Ticket,
  pauseResumeLogs: PauseResumeLog[] = []
): number {
  try {
    return calculateAdjustedTicketCompletionTime(ticket, pauseResumeLogs);
  } catch (error) {
    console.error('Error calculating adjusted completion minutes:', error);
    return 0; // Return 0 in case of error
  }
}

/**
 * Calculate technician efficiency considering adjusted SLA metrics
 * @param performance The performance record containing metrics
 * @param tickets Array of tickets to evaluate for adjusted SLA calculations
 * @param pauseResumeLogs Array of pause/resume events per ticket
 * @param partRequests Array of part requests per ticket
 * @param vendorDelays Array of vendor delay records per ticket
 * @returns Efficiency score (0-100)
 */
export function calculateEfficiencyWithAdjustments(
  performance: {
    jobs_completed?: number;
    total_jobs?: number;
    sla_met?: number;
    sla_breached?: number;
  },
  tickets: Ticket[],
  pauseResumeLogs: Record<string, PauseResumeLog[]> = {},
  partRequests: Record<string, PartRequest[]> = {},
  vendorDelays: Record<string, VendorDelay[]> = {}
): number {
  const jobsCompleted = performance.jobs_completed || 0;
  const totalJobs = performance.total_jobs || 1; // Avoid division by zero

  // Calculate adjusted SLA compliance
  let adjustedSlaMet = 0;
  let adjustedSlaBreached = 0;

  for (const ticket of tickets) {
    const ticketPauseLogs = pauseResumeLogs[ticket.id] || [];
    const ticketPartRequests = partRequests[ticket.id] || [];
    const ticketVendorDelays = vendorDelays[ticket.id] || [];

    if (isSLABreachedWithAdjustments(ticket, ticketPauseLogs, ticketPartRequests, ticketVendorDelays)) {
      adjustedSlaBreached++;
    } else {
      adjustedSlaMet++;
    }
  }

  // Calculate completion rate (jobs completed vs total jobs assigned)
  const completionRate = (jobsCompleted / totalJobs) * 100;

  // Calculate adjusted SLA compliance rate
  const totalAdjustedSla = adjustedSlaMet + adjustedSlaBreached;
  const slaComplianceRate = totalAdjustedSla > 0 ? (adjustedSlaMet / totalAdjustedSla) * 100 : 100;

  // Combine both metrics for efficiency
  const efficiency = (completionRate * 0.4) + (slaComplianceRate * 0.6);

  return Math.min(100, Math.max(0, Math.round(efficiency)));
}

/**
 * Calculate technician reliability score based on adjusted SLA compliance
 * @param performance The performance record containing original SLA metrics
 * @param tickets Array of tickets to evaluate for adjusted SLA calculations
 * @param pauseResumeLogs Array of pause/resume events per ticket
 * @param partRequests Array of part requests per ticket
 * @param vendorDelays Array of vendor delay records per ticket
 * @returns Reliability score (0-100)
 */
export function calculateReliabilityWithAdjustments(
  performance: {
    sla_met?: number;
    sla_breached?: number;
  },
  tickets: Ticket[],
  pauseResumeLogs: Record<string, PauseResumeLog[]> = {},
  partRequests: Record<string, PartRequest[]> = {},
  vendorDelays: Record<string, VendorDelay[]> = {}
): number {
  // Calculate adjusted SLA metrics based on tickets and adjustments
  let adjustedSlaMet = 0;
  let adjustedSlaBreached = 0;

  for (const ticket of tickets) {
    const ticketPauseLogs = pauseResumeLogs[ticket.id] || [];
    const ticketPartRequests = partRequests[ticket.id] || [];
    const ticketVendorDelays = vendorDelays[ticket.id] || [];

    if (isSLABreachedWithAdjustments(ticket, ticketPauseLogs, ticketPartRequests, ticketVendorDelays)) {
      adjustedSlaBreached++;
    } else {
      adjustedSlaMet++;
    }
  }

  const totalAdjustedSla = adjustedSlaMet + adjustedSlaBreached;

  if (totalAdjustedSla === 0) {
    // If no adjusted data, fall back to original metrics
    const originalTotalSla = (performance.sla_met || 0) + (performance.sla_breached || 0);
    if (originalTotalSla === 0) {
      return 100; // Perfect score if no SLA data yet
    }
    return ((performance.sla_met || 0) / originalTotalSla) * 100;
  }

  const reliability = (adjustedSlaMet / totalAdjustedSla) * 100;

  return Math.min(100, Math.max(0, Math.round(reliability)));
}

/**
 * Calculate technician reliability score based on original SLA compliance
 * @param performance The performance record containing SLA metrics
 * @returns Reliability score (0-100)
 */
export function calculateReliability(performance: {
  sla_met?: number;
  sla_breached?: number;
}): number {
  const slaMet = performance.sla_met || 0;
  const slaBreached = performance.sla_breached || 0;

  const totalSla = slaMet + slaBreached;

  if (totalSla === 0) {
    return 100; // Perfect score if no SLA data yet
  }

  const reliability = (slaMet / totalSla) * 100;

  return Math.min(100, Math.max(0, Math.round(reliability)));
}