// customer-notification-service.ts
// Service functions for managing OneSignal notifications to customers

import { supabase } from '@/lib/supabase/supabase';
import {
  sendNotificationToOneSignalPlayer,
  sendNotificationToList
} from '@/lib/notifications/onesignal-notification-service';
import { customerUpdatesService } from '@/lib/services/customer-updates-service';

/**
 * Send notification to customer when a ticket is created
 */
export async function sendTicketCreatedNotification(
  ticketId: string,
  customerId: string
): Promise<boolean> {
  try {
    // Get customer's phone number to find their user ID
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('phone_e164, name')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      console.error('Customer not found:', customerError);
      return false;
    }

    // Get the auth user ID from the phone number
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error fetching auth users:', authError);
      return false;
    }

    const user = users.find(u => u.phone === customer.phone_e164);
    if (!user) {
      console.error('Auth user not found for customer:', customer.phone_e164);
      return false;
    }

    // Get the profile with OneSignal player ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('onesignal_player_id, user_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.onesignal_player_id) {
      console.error('Customer profile or player ID not found:', profileError);
      return false;
    }

    // Create timeline event
    await customerUpdatesService.createTimelineEvent(
      ticketId,
      'ticket_created',
      'Ticket Booked',
      'Your repair request has been received and is pending assignment'
    );

    // Send notification
    await sendNotificationToOneSignalPlayer(
      profile.onesignal_player_id,
      'Ticket Booked Successfully',
      `Your repair request #${ticketId.substring(0, 8)}... has been received`,
      `${window.location.origin}/customer/tickets/${ticketId}`,
      {
        ticket_id: ticketId,
        customer_id: customerId,
        type: 'ticket_created'
      }
    );

    // Log notification
    await customerUpdatesService.createNotificationLog(
      ticketId,
      profile.user_id,
      'push',
      `Ticket #${ticketId} created notification sent to customer`
    );

    return true;
  } catch (error) {
    console.error('Error sending ticket created notification:', error);
    return false;
  }
}

/**
 * Send notification to customer when a technician is assigned
 */
export async function sendTechnicianAssignedNotification(
  ticketId: string,
  customerId: string,
  technicianId: string
): Promise<boolean> {
  try {
    // Get technician details
    const { data: technician, error: techError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', technicianId)
      .single();

    if (techError || !technician) {
      console.error('Technician not found:', techError);
      return false;
    }

    // Get customer's phone number to find their user ID
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('phone_e164, name')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      console.error('Customer not found:', customerError);
      return false;
    }

    // Get the auth user ID from the phone number
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error fetching auth users:', authError);
      return false;
    }

    const user = users.find(u => u.phone === customer.phone_e164);
    if (!user) {
      console.error('Auth user not found for customer:', customer.phone_e164);
      return false;
    }

    // Get the profile with OneSignal player ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('onesignal_player_id, user_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.onesignal_player_id) {
      console.error('Customer profile or player ID not found:', profileError);
      return false;
    }

    // Create timeline event
    await customerUpdatesService.createTimelineEvent(
      ticketId,
      'technician_assigned',
      'Technician Assigned',
      `Technician ${technician.full_name} has been assigned to your repair`
    );

    // Send notification
    await sendNotificationToOneSignalPlayer(
      profile.onesignal_player_id,
      'Technician Assigned',
      `Technician ${technician.full_name} has been assigned to your repair #${ticketId.substring(0, 8)}...`,
      `${window.location.origin}/customer/tickets/${ticketId}`,
      {
        ticket_id: ticketId,
        technician_id: technicianId,
        type: 'technician_assigned'
      }
    );

    // Log notification
    await customerUpdatesService.createNotificationLog(
      ticketId,
      profile.user_id,
      'push',
      `Technician assigned notification sent to customer for ticket #${ticketId}`
    );

    return true;
  } catch (error) {
    console.error('Error sending technician assigned notification:', error);
    return false;
  }
}

/**
 * Send notification to customer when work has started on their ticket
 */
export async function sendWorkStartedNotification(
  ticketId: string,
  customerId: string
): Promise<boolean> {
  try {
    // Get customer's phone number to find their user ID
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('phone_e164, name')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      console.error('Customer not found:', customerError);
      return false;
    }

    // Get the auth user ID from the phone number
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error fetching auth users:', authError);
      return false;
    }

    const user = users.find(u => u.phone === customer.phone_e164);
    if (!user) {
      console.error('Auth user not found for customer:', customer.phone_e164);
      return false;
    }

    // Get the profile with OneSignal player ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('onesignal_player_id, user_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.onesignal_player_id) {
      console.error('Customer profile or player ID not found:', profileError);
      return false;
    }

    // Create timeline event
    await customerUpdatesService.createTimelineEvent(
      ticketId,
      'work_started',
      'Work Started',
      'Technician has started working on your device'
    );

    // Send notification
    await sendNotificationToOneSignalPlayer(
      profile.onesignal_player_id,
      'Work Started',
      `Technician has started working on your repair #${ticketId.substring(0, 8)}...`,
      `${window.location.origin}/customer/tickets/${ticketId}`,
      {
        ticket_id: ticketId,
        type: 'work_started'
      }
    );

    // Log notification
    await customerUpdatesService.createNotificationLog(
      ticketId,
      profile.user_id,
      'push',
      `Work started notification sent to customer for ticket #${ticketId}`
    );

    return true;
  } catch (error) {
    console.error('Error sending work started notification:', error);
    return false;
  }
}

/**
 * Send notification to customer when parts are needed for their repair
 */
export async function sendPartsNeededNotification(
  ticketId: string,
  customerId: string
): Promise<boolean> {
  try {
    // Get customer's phone number to find their user ID
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('phone_e164, name')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      console.error('Customer not found:', customerError);
      return false;
    }

    // Get the auth user ID from the phone number
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error fetching auth users:', authError);
      return false;
    }

    const user = users.find(u => u.phone === customer.phone_e164);
    if (!user) {
      console.error('Auth user not found for customer:', customer.phone_e164);
      return false;
    }

    // Get the profile with OneSignal player ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('onesignal_player_id, user_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.onesignal_player_id) {
      console.error('Customer profile or player ID not found:', profileError);
      return false;
    }

    // Create timeline event
    await customerUpdatesService.createTimelineEvent(
      ticketId,
      'parts_needed',
      'Parts Ordered',
      'Required parts have been ordered for your repair'
    );

    // Send notification
    await sendNotificationToOneSignalPlayer(
      profile.onesignal_player_id,
      'Parts Ordered',
      `Required parts have been ordered for your repair #${ticketId.substring(0, 8)}...`,
      `${window.location.origin}/customer/tickets/${ticketId}`,
      {
        ticket_id: ticketId,
        type: 'parts_ordered'
      }
    );

    // Log notification
    await customerUpdatesService.createNotificationLog(
      ticketId,
      profile.user_id,
      'push',
      `Parts needed notification sent to customer for ticket #${ticketId}`
    );

    return true;
  } catch (error) {
    console.error('Error sending parts needed notification:', error);
    return false;
  }
}

/**
 * Send notification to customer when SLA is breached
 */
export async function sendSLABreachedNotification(
  ticketId: string,
  customerId: string
): Promise<boolean> {
  try {
    // Get customer's phone number to find their user ID
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('phone_e164, name')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      console.error('Customer not found:', customerError);
      return false;
    }

    // Get the auth user ID from the phone number
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error fetching auth users:', authError);
      return false;
    }

    const user = users.find(u => u.phone === customer.phone_e164);
    if (!user) {
      console.error('Auth user not found for customer:', customer.phone_e164);
      return false;
    }

    // Get the profile with OneSignal player ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('onesignal_player_id, user_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.onesignal_player_id) {
      console.error('Customer profile or player ID not found:', profileError);
      return false;
    }

    // Create timeline event
    await customerUpdatesService.createTimelineEvent(
      ticketId,
      'sla_breached',
      'SLA Breached',
      'There has been a delay in your repair. We are working to resolve it.'
    );

    // Update SLA snapshot to breached status
    await customerUpdatesService.updateSLASnapshot(
      ticketId,
      null, // Will be updated by the trigger
      null, // Will be updated by the trigger
      'breached'
    );

    // Send notification
    await sendNotificationToOneSignalPlayer(
      profile.onesignal_player_id,
      'Repair Delay',
      `There has been a delay in your repair #${ticketId.substring(0, 8)}... We are working to resolve it.`,
      `${window.location.origin}/customer/tickets/${ticketId}`,
      {
        ticket_id: ticketId,
        type: 'sla_breached'
      }
    );

    // Log notification
    await customerUpdatesService.createNotificationLog(
      ticketId,
      profile.user_id,
      'push',
      `SLA breach notification sent to customer for ticket #${ticketId}`
    );

    return true;
  } catch (error) {
    console.error('Error sending SLA breach notification:', error);
    return false;
  }
}

/**
 * Send notification to customer when their ticket is completed
 */
export async function sendTicketCompletedNotification(
  ticketId: string,
  customerId: string
): Promise<boolean> {
  try {
    // Get customer's phone number to find their user ID
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('phone_e164, name')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      console.error('Customer not found:', customerError);
      return false;
    }

    // Get the auth user ID from the phone number
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error fetching auth users:', authError);
      return false;
    }

    const user = users.find(u => u.phone === customer.phone_e164);
    if (!user) {
      console.error('Auth user not found for customer:', customer.phone_e164);
      return false;
    }

    // Get the profile with OneSignal player ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('onesignal_player_id, user_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.onesignal_player_id) {
      console.error('Customer profile or player ID not found:', profileError);
      return false;
    }

    // Create timeline event
    await customerUpdatesService.createTimelineEvent(
      ticketId,
      'repair_completed',
      'Repair Completed',
      'Your device has been repaired and is ready'
    );

    // Send notification
    await sendNotificationToOneSignalPlayer(
      profile.onesignal_player_id,
      'Repair Completed',
      `Your repair #${ticketId.substring(0, 8)}... has been completed`,
      `${window.location.origin}/customer/tickets/${ticketId}`,
      {
        ticket_id: ticketId,
        type: 'repair_completed'
      }
    );

    // Update SLA snapshot to fulfilled status
    await customerUpdatesService.updateSLASnapshot(
      ticketId,
      null, // Will be updated by the trigger
      null, // Will be updated by the trigger
      'fulfilled'
    );

    // Log notification
    await customerUpdatesService.createNotificationLog(
      ticketId,
      profile.user_id,
      'push',
      `Ticket completed notification sent to customer for ticket #${ticketId}`
    );

    return true;
  } catch (error) {
    console.error('Error sending ticket completed notification:', error);
    return false;
  }
}

/**
 * Send notification to customer when their ticket is delivered
 */
export async function sendTicketDeliveredNotification(
  ticketId: string,
  customerId: string
): Promise<boolean> {
  try {
    // Get customer's phone number to find their user ID
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('phone_e164, name')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      console.error('Customer not found:', customerError);
      return false;
    }

    // Get the auth user ID from the phone number
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error fetching auth users:', authError);
      return false;
    }

    const user = users.find(u => u.phone === customer.phone_e164);
    if (!user) {
      console.error('Auth user not found for customer:', customer.phone_e164);
      return false;
    }

    // Get the profile with OneSignal player ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('onesignal_player_id, user_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.onesignal_player_id) {
      console.error('Customer profile or player ID not found:', profileError);
      return false;
    }

    // Create timeline event
    await customerUpdatesService.createTimelineEvent(
      ticketId,
      'delivered',
      'Delivered',
      'Your repaired device has been delivered'
    );

    // Send notification
    await sendNotificationToOneSignalPlayer(
      profile.onesignal_player_id,
      'Device Delivered',
      `Your repaired device for ticket #${ticketId.substring(0, 8)}... has been delivered`,
      `${window.location.origin}/customer/tickets/${ticketId}`,
      {
        ticket_id: ticketId,
        type: 'delivered'
      }
    );

    // Log notification
    await customerUpdatesService.createNotificationLog(
      ticketId,
      profile.user_id,
      'push',
      `Ticket delivered notification sent to customer for ticket #${ticketId}`
    );

    return true;
  } catch (error) {
    console.error('Error sending ticket delivered notification:', error);
    return false;
  }
}

/**
 * Send notification to customer when a general update happens
 */
export async function sendGeneralUpdateNotification(
  ticketId: string,
  customerId: string,
  title: string,
  message: string,
  eventType: string
): Promise<boolean> {
  try {
    // Get customer's phone number to find their user ID
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('phone_e164, name')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      console.error('Customer not found:', customerError);
      return false;
    }

    // Get the auth user ID from the phone number
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error fetching auth users:', authError);
      return false;
    }

    const user = users.find(u => u.phone === customer.phone_e164);
    if (!user) {
      console.error('Auth user not found for customer:', customer.phone_e164);
      return false;
    }

    // Get the profile with OneSignal player ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('onesignal_player_id, user_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.onesignal_player_id) {
      console.error('Customer profile or player ID not found:', profileError);
      return false;
    }

    // Create timeline event
    await customerUpdatesService.createTimelineEvent(
      ticketId,
      eventType,
      title,
      message
    );

    // Send notification
    await sendNotificationToOneSignalPlayer(
      profile.onesignal_player_id,
      title,
      message,
      `${window.location.origin}/customer/tickets/${ticketId}`,
      {
        ticket_id: ticketId,
        type: eventType
      }
    );

    // Log notification
    await customerUpdatesService.createNotificationLog(
      ticketId,
      profile.user_id,
      'push',
      `${eventType} notification sent to customer for ticket #${ticketId}`
    );

    return true;
  } catch (error) {
    console.error('Error sending general update notification:', error);
    return false;
  }
}