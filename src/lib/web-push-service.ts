// lib/web-push-service.ts
// Client-side service functions for web push notifications

import { supabase } from '@/lib/supabase';
import { getAccessToken } from '@/lib/auth-utils'; // Assuming we have a utility to get access token

// Interface for push subscription
export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// Interface for subscription options
export interface SubscriptionOptions {
  role?: string;
  device_info?: Record<string, any>;
}

/**
 * Check if the browser supports web push notifications
 */
export function supportsWebPush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!supportsWebPush()) {
    throw new Error('Web Push is not supported in this browser');
  }

  return Notification.requestPermission();
}

/**
 * Get the VAPID public key from environment or configuration
 */
export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(options: SubscriptionOptions = {}): Promise<PushSubscription | null> {
  if (!supportsWebPush()) {
    throw new Error('Web Push is not supported in this browser');
  }

  // Check notification permission
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    console.warn('Notification permission not granted');
    return null;
  }

  try {
    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Get VAPID public key
    const vapidPublicKey = getVapidPublicKey();
    if (!vapidPublicKey) {
      throw new Error('VAPID public key not configured');
    }

    // Convert the VAPID public key to the required format
    const applicationServerKey = urlB64ToUint8Array(vapidPublicKey);

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    // Convert subscription to the required format for the backend
    const subscriptionJson = subscription.toJSON() as any;
    const pushSubscription: PushSubscription = {
      endpoint: subscriptionJson.endpoint,
      keys: {
        p256dh: subscriptionJson.keys.p256dh,
        auth: subscriptionJson.keys.auth,
      }
    };

    // Get access token
    const token = await getAccessToken();
    if (!token) {
      throw new Error('User not authenticated');
    }

    // Get the Supabase URL from environment
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }

    // Send subscription to the Supabase Edge Function
    // The edge function should be deployed at: {SUPABASE_URL}/functions/v1/save-subscription
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/save-subscription`;

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'jamestronic-web/1.0',
      },
      body: JSON.stringify({
        ...pushSubscription,
        role: options.role || 'technician', // Default to technician for tech portal
        device_info: options.device_info || {},
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to save subscription: ${response.status} - ${errorText}`);
    }

    console.log('Push subscription saved successfully');
    return pushSubscription;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    throw error;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!supportsWebPush()) {
    throw new Error('Web Push is not supported in this browser');
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      console.log('No active subscription to unsubscribe');
      return true;
    }

    // Unsubscribe from push notifications
    const success = await subscription.unsubscribe();

    if (success) {
      console.log('Successfully unsubscribed from push notifications');
    } else {
      console.warn('Failed to unsubscribe from push notifications');
    }

    return success;
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    return false;
  }
}

/**
 * Check if the browser is currently subscribed to push notifications
 */
export async function isSubscribedToPush(): Promise<boolean> {
  if (!supportsWebPush()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch (error) {
    console.error('Error checking push subscription status:', error);
    return false;
  }
}

/**
 * Utility function to convert base64 string to Uint8Array for VAPID key
 */
function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Send a notification (for admin/staff only)
 */
export async function sendNotification(userIds: string[], title: string, body: string, url?: string, data?: Record<string, any>) {
  try {
    // Get access token
    const token = await getAccessToken();
    if (!token) {
      throw new Error('User not authenticated');
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }

    // Send notification to the Supabase Edge Function
    // The edge function should be deployed at: {SUPABASE_URL}/functions/v1/send-notification
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-notification`;

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'jamestronic-web/1.0',
      },
      body: JSON.stringify({
        userIds,
        title,
        body,
        url: url || '/tech/jobs',
        data,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send notification: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Notification sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}