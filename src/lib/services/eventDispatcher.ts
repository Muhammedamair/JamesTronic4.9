import { supabase } from '@/lib/supabase/supabase';
import { triggerCustomerNotification } from '@/lib/services/customerNotificationEngine';

export async function dispatchNotificationEvent(
  eventKey: string,
  ticketId: string,
  additionalContext: Record<string, any> = {}
) {
  try {
    // Get ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, customer_id, created_at, updated_at, status, device_type, issue_summary')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error('Error fetching ticket for notification:', ticketError);
      return false;
    }

    // Build context for notification
    const context = {
      ticketId: ticket.id,
      customerId: ticket.customer_id,
      ticketDetails: ticket,
      ...additionalContext
    };

    // Trigger the notification
    const result = await triggerCustomerNotification(eventKey, context);
    return result;
  } catch (error) {
    console.error(`Error dispatching notification event ${eventKey} for ticket ${ticketId}:`, error);
    return false;
  }
}

// Function to handle ticket creation notifications
export async function handleTicketCreatedNotification(ticketId: string) {
  return await dispatchNotificationEvent('ticket_created', ticketId);
}

// Function to handle technician assignment notifications
export async function handleTechnicianAssignedNotification(ticketId: string) {
  return await dispatchNotificationEvent('technician_assigned', ticketId);
}

// Function to handle SLA risk notifications
export async function handleSlaRiskNotification(ticketId: string, delayHours: number) {
  return await dispatchNotificationEvent('sla_risk', ticketId, { delayHours });
}

// Function to handle part delay notifications
export async function handlePartDelayNotification(ticketId: string) {
  return await dispatchNotificationEvent('part_delay', ticketId);
}

// Function to handle job completion notifications
export async function handleJobCompletedNotification(ticketId: string) {
  return await dispatchNotificationEvent('job_completed', ticketId);
}