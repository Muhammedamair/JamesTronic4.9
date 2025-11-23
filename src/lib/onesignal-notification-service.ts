// services/onesignal-notification-service.ts
// Service functions for managing OneSignal push notifications

import { supabase } from '@/lib/supabase';
import { getAccessToken } from '@/lib/auth-utils';

/**
 * Initialize OneSignal SDK
 */
export async function initializeOneSignal(): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).OneSignal) {
    const OneSignal = (window as any).OneSignal;

    await OneSignal.init({
      appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '',
      allowLocalhostAsSecureOrigin: process.env.NODE_ENV === 'development',
      // Enable logging to help debug domain issues
      logLevel: process.env.NODE_ENV === 'development' ? 6 : 4, // 6 = DEBUG, 4 = INFO
    });

    // Automatically save player ID when subscription changes
    OneSignal.on('subscriptionChange', async (isSubscribed: boolean) => {
      if (isSubscribed) {
        const playerId = await OneSignal.getUserId();
        if (playerId) {
          await savePlayerIdToDatabase(playerId);
        }
      }
    });
  }
}

/**
 * Save OneSignal player ID to the user's profile in the database
 */
export async function savePlayerIdToDatabase(playerId: string): Promise<boolean> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Error getting user for OneSignal player ID:', authError);
      return false;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ onesignal_player_id: playerId })
      .eq('user_id', user.id);

    if (error) {
      console.error('Error saving OneSignal player ID:', error);
      return false;
    }

    console.log('OneSignal player ID saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving OneSignal player ID:', error);
    return false;
  }
}

/**
 * Send notification to a specific OneSignal player
 */
export async function sendNotificationToOneSignalPlayer(
  playerId: string,
  title: string,
  body: string,
  url?: string,
  data?: Record<string, any>
): Promise<any> {
  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: process.env.ONESIGNAL_APP_ID,
        include_player_ids: [playerId],
        headings: { en: title },
        contents: { en: body },
        url: url || `${window.location.origin}/tech/jobs`,
        data: data || { timestamp: Date.now() }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OneSignal API error: ${response.status} - ${errorData}`);
    }

    const result = await response.json();
    console.log('Notification sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Error sending OneSignal notification:', error);
    throw error;
  }
}

/**
 * Send notification to a list of OneSignal players
 */
export async function sendNotificationToList(
  playerIds: string[],
  title: string,
  body: string,
  url?: string,
  data?: Record<string, any>
): Promise<any> {
  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: process.env.ONESIGNAL_APP_ID,
        include_player_ids: playerIds,
        headings: { en: title },
        contents: { en: body },
        url: url || `${window.location.origin}/tech/jobs`,
        data: data || { timestamp: Date.now() }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OneSignal API error: ${response.status} - ${errorData}`);
    }

    const result = await response.json();
    console.log('Notification sent to list successfully:', result);
    return result;
  } catch (error) {
    console.error('Error sending OneSignal notification to list:', error);
    throw error;
  }
}

/**
 * Get OneSignal player ID for current user from database
 */
export async function getCurrentUserPlayerId(): Promise<string | null> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Error getting user for OneSignal player ID:', authError);
      return null;
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('onesignal_player_id')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error getting OneSignal player ID:', error);
      return null;
    }

    return profile?.onesignal_player_id || null;
  } catch (error) {
    console.error('Error getting OneSignal player ID:', error);
    return null;
  }
}

/**
 * Send ticket assignment notification to technician
 */
export async function sendTicketAssignmentNotification(
  technicianId: string,
  ticketId: string
): Promise<boolean> {
  try {
    // Get technician profile with OneSignal player ID
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('onesignal_player_id, full_name')
      .eq('id', technicianId)
      .single();

    if (error || !profile?.onesignal_player_id) {
      console.error('Technician player ID not found:', error);
      return false;
    }

    await sendNotificationToOneSignalPlayer(
      profile.onesignal_player_id,
      'New Ticket Assigned',
      `Ticket #${ticketId} has been assigned to you`,
      `${window.location.origin}/tech/jobs/${ticketId}`,
      { ticket_id: ticketId, type: 'ticket_assignment' }
    );

    return true;
  } catch (error) {
    console.error('Error sending ticket assignment notification:', error);
    return false;
  }
}

/**
 * Send ticket status update notification to technician
 */
export async function sendTicketStatusUpdateNotification(
  technicianId: string,
  ticketId: string,
  status: string
): Promise<boolean> {
  try {
    // Get technician profile with OneSignal player ID
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('onesignal_player_id, full_name')
      .eq('id', technicianId)
      .single();

    if (error || !profile?.onesignal_player_id) {
      console.error('Technician player ID not found:', error);
      return false;
    }

    await sendNotificationToOneSignalPlayer(
      profile.onesignal_player_id,
      'Ticket Status Updated',
      `Ticket #${ticketId} status updated to ${status}`,
      `${window.location.origin}/tech/jobs/${ticketId}`,
      { ticket_id: ticketId, status, type: 'status_update' }
    );

    return true;
  } catch (error) {
    console.error('Error sending ticket status update notification:', error);
    return false;
  }
}