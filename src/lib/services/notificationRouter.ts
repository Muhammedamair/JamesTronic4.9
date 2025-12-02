import { sendNotificationToOneSignalPlayer } from '@/lib/notifications/onesignal-notification-service';
import { supabase } from '@/lib/supabase/supabase';

// Define notification priority types
export type NotificationPriority = 'low' | 'medium' | 'high';

// Define notification routing rules
interface NotificationRoute {
  priority: NotificationPriority;
  channels: ('push' | 'sms' | 'email')[];
  enabled: boolean;
}

/**
 * Get notification routing configuration based on priority
 */
export function getNotificationRoute(priority: number): NotificationRoute {
  if (priority >= 4) {
    // High priority: push + sms
    return {
      priority: 'high',
      channels: ['push', 'sms'],
      enabled: true
    };
  } else if (priority >= 2) {
    // Medium priority: push only
    return {
      priority: 'medium',
      channels: ['push'],
      enabled: true
    };
  } else {
    // Low priority: push only
    return {
      priority: 'low',
      channels: ['push'],
      enabled: true
    };
  }
}

/**
 * Route notification to appropriate channels based on priority
 */
export async function routeNotification(
  playerId: string,
  message: string,
  title: string,
  priority: number,
  originalChannel?: 'push' | 'sms' | 'email'
): Promise<boolean> {
  try {
    const route = getNotificationRoute(priority);

    // Always send push notification
    if (route.channels.includes('push')) {
      try {
        await sendNotificationToOneSignalPlayer(playerId, title, message, `${window.location.origin}/tech/jobs`);
      } catch (pushError) {
        console.error('Error sending push notification:', pushError);
      }
    }

    // Send SMS for high priority notifications
    if (route.channels.includes('sms')) {
      // In a real implementation, we would call an SMS service
      // For now we just log that we would send SMS
      console.log(`Would send SMS to ${playerId}: ${message}`);
    }

    // Send email for high priority notifications
    if (route.channels.includes('email')) {
      // In a real implementation, we would call an email service
      // For now we just log that we would send email
      console.log(`Would send email to ${playerId}: ${message}`);
    }

    return true;
  } catch (error) {
    console.error('Error routing notification:', error);
    return false;
  }
}

/**
 * Get customer's OneSignal player ID by customer ID
 */
export async function getCustomerPlayerIdByCustomerId(customerId: string): Promise<string | null> {
  // First try to find the player ID in profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('onesignal_player_id')
    .eq('customer_id', customerId)
    .single();

  if (profileError) {
    console.error('Error fetching profile by customer_id:', profileError);
    return null;
  }

  if (profile?.onesignal_player_id) {
    return profile.onesignal_player_id;
  }

  // Fallback: try to match by user ID if the customer is also a user
  const { data: profileByUser, error: userError } = await supabase
    .from('profiles')
    .select('onesignal_player_id')
    .eq('id', customerId)  // Some customer IDs might be user IDs
    .single();

  if (userError) {
    console.error('Error fetching profile by user ID:', userError);
    return null;
  }

  return profileByUser?.onesignal_player_id;
}