import { supabase } from '@/lib/supabase/supabase';
import { sendNotificationToOneSignalPlayer } from '@/lib/notifications/onesignal-notification-service';

// Define types for notification rules
export interface NotificationRule {
  id: string;
  event_key: string;
  channel: 'push' | 'sms' | 'email';
  priority: number;
  auto_message: string;
  tone: 'calm' | 'informative' | 'warning' | 'apology' | 'reassurance';
  retry_policy: string;
  created_at: string;
}

export interface NotificationContext {
  ticketId: string;
  customerId: string;
  delayHours?: number;
  ticketDetails?: any;
  customerDetails?: any;
}

export interface NotificationMessage {
  message: string;
  tone: string;
  channel: string;
  priority: number;
}

/**
 * Build message with intelligent tone adjustment based on context
 */
export async function buildMessage(
  rule: NotificationRule,
  context: NotificationContext
): Promise<NotificationMessage> {
  let message = rule.auto_message;

  // Adjust message based on delay or urgency
  if (context.delayHours && context.delayHours > 4) {
    message = "We're truly sorry for the delay. Your repair is our priority.";
  }

  return {
    message,
    tone: rule.tone,
    channel: rule.channel,
    priority: rule.priority
  };
}

/**
 * Get notification rule by event key
 */
export async function getNotificationRule(eventKey: string): Promise<NotificationRule | null> {
  const { data, error } = await supabase
    .from('customer_notification_rules')
    .select('*')
    .eq('event_key', eventKey)
    .single();

  if (error) {
    console.error('Error fetching notification rule:', error);
    return null;
  }

  return data;
}

/**
 * Get customer details by ID
 */
export async function getCustomerDetails(customerId: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  if (error) {
    console.error('Error fetching customer details:', error);
    return null;
  }

  return data;
}

/**
 * Get customer's OneSignal player ID
 */
export async function getCustomerPlayerId(customerId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('onesignal_player_id')
    .eq('customer_id', customerId)  // Assuming we have customer_id in profiles
    .single();

  if (error) {
    console.error('Error fetching customer player ID:', error);
    return null;
  }

  return data?.onesignal_player_id;
}

/**
 * Queue notification for customer
 */
export async function queueCustomerNotification(
  eventKey: string,
  context: NotificationContext,
  rule: NotificationRule,
  message: NotificationMessage,
  sentiment: 'anxious' | 'neutral' | 'hopeful' | 'happy' | 'angry' = 'neutral'
) {
  // Insert into notification queue
  const { error } = await supabase
    .from('customer_notification_queue')
    .insert({
      ticket_id: context.ticketId,
      customer_id: context.customerId,
      event_type: eventKey,
      message: message.message,
      channel: message.channel,
      priority: message.priority,
      status: 'pending',
      retry_count: 0,
      sentiment: sentiment,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error queuing notification:', error);
    return false;
  }

  return true;
}

/**
 * Process a notification immediately if needed
 */
export async function processImmediateNotification(
  eventKey: string,
  context: NotificationContext
) {
  // Get the rule for this event
  const rule = await getNotificationRule(eventKey);
  if (!rule) {
    console.error(`No rule found for event: ${eventKey}`);
    return false;
  }

  // Build the message based on context
  const message = await buildMessage(rule, context);

  // Determine sentiment based on event type
  let sentiment: 'anxious' | 'neutral' | 'hopeful' | 'happy' | 'angry' = 'neutral';
  switch (eventKey) {
    case 'sla_risk':
      sentiment = 'anxious';
      break;
    case 'part_delay':
      sentiment = 'anxious';
      break;
    case 'job_completed':
      sentiment = 'happy';
      break;
    case 'ticket_created':
      sentiment = 'hopeful';
      break;
    default:
      sentiment = 'neutral';
  }

  // Queue the notification
  const queued = await queueCustomerNotification(eventKey, context, rule, message, sentiment);
  if (!queued) {
    return false;
  }

  // Send the notification based on channel
  if (rule.channel === 'push') {
    const playerId = await getCustomerPlayerId(context.customerId);
    if (playerId) {
      try {
        await sendNotificationToOneSignalPlayer(
          playerId,
          'JamesTronic Update',
          message.message,
          `${window.location.origin}/tech/jobs`
        );
      } catch (error) {
        console.error('Error sending OneSignal notification:', error);
      }
    }
  }

  return true;
}

/**
 * Main function to trigger customer notification
 */
export async function triggerCustomerNotification(
  eventKey: string,
  context: NotificationContext
) {
  try {
    // Check if same message was sent in the last hour to prevent spam
    const isSpam = await sameMessageSentLastHour(context.ticketId, eventKey);
    if (isSpam) {
      console.log(`Notification spam prevention: Skipping notification for ticket ${context.ticketId} event ${eventKey}`);
      return false;
    }

    // Get the rule for this event to get the message
    const rule = await getNotificationRule(eventKey);
    if (!rule) {
      console.error(`No rule found for event: ${eventKey}`);
      return false;
    }

    // Build the message based on context
    const message = await buildMessage(rule, context);

    // Also check for similar messages to prevent spam
    const isSimilarSpam = await isNotificationSpam(context.ticketId, message.message);
    if (isSimilarSpam) {
      console.log(`Notification spam prevention: Similar message recently sent for ticket ${context.ticketId}`);
      return false;
    }

    // Process the notification
    const result = await processImmediateNotification(eventKey, context);
    return result;
  } catch (error) {
    console.error('Error triggering customer notification:', error);
    return false;
  }
}

/**
 * Check if same message was sent last hour (spam prevention)
 */
export async function sameMessageSentLastHour(ticketId: string, eventKey: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('customer_notifications_log')
    .select('*')
    .eq('ticket_id', ticketId)
    .eq('event_type', eventKey)
    .gte('created_at', oneHourAgo)
    .limit(1);

  if (error) {
    console.error('Error checking notification spam:', error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Enhanced spam prevention: Check if similar message was sent recently
 */
export async function isNotificationSpam(ticketId: string, message: string): Promise<boolean> {
  // Check for similar messages in the last 30 minutes
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('customer_notifications_log')
    .select('message')
    .eq('ticket_id', ticketId)
    .gte('created_at', thirtyMinsAgo)
    .limit(1);

  if (error) {
    console.error('Error checking notification spam:', error);
    return false;
  }

  if (!data || data.length === 0) {
    return false;
  }

  // Check if the new message is very similar to the recent one
  const recentMessage = data[0].message.toLowerCase();
  const newMessage = message.toLowerCase();

  // Simple similarity check - if messages are 80% similar, consider it spam
  const similarity = calculateStringSimilarity(recentMessage, newMessage);
  return similarity > 0.8;
}

/**
 * Calculate similarity between two strings
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  // Simple similarity using edit distance
  const editDistance = computeEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Compute edit distance between two strings
 */
function computeEditDistance(s1: string, s2: string): number {
  const matrix = [];

  // Initialize matrix
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[s2.length][s1.length];
}