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
 * Enhanced to include Safari and iOS detection
 */
export function supportsWebPush(): boolean {
  const supportsBasic = 'serviceWorker' in navigator && 'PushManager' in window;
  if (!supportsBasic) {
    console.log('Basic Web Push APIs not supported');
    return false;
  }

  // Check Safari-specific requirements
  const userAgent = navigator.userAgent;
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);

  if (isSafari) {
    // Safari 16.4+ required for Web Push
    const safariVersionMatch = userAgent.match(/version\/(\d+\.\d+)/i);
    if (safariVersionMatch) {
      const version = parseFloat(safariVersionMatch[1]);
      if (version >= 16.4) {
        // Safari needs to be in PWA mode (standalone) to support Web Push
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                             ((navigator as any).standalone === true);

        if (!isStandalone) {
          console.log('Safari requires PWA installation for Web Push');
          return false;
        }
        console.log('Safari 16.4+ in PWA mode supports Web Push');
        return true;
      } else {
        console.log(`Safari ${version} does not support Web Push. Minimum version is 16.4.`);
        return false;
      }
    }
    console.log('Unable to detect Safari version');
    return false;
  }

  if (isIOS) {
    // iOS needs to be in PWA mode and iOS 16.4+
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         ((navigator as any).standalone === true);

    if (!isStandalone) {
      console.log('iOS requires PWA installation for Web Push');
      return false;
    }

    // Check iOS version
    const iosVersionMatch = userAgent.match(/os (\d+)_(\d+)\s|os\s(\d+)\s/i);
    if (iosVersionMatch) {
      const majorVersion = parseInt(iosVersionMatch[1] || iosVersionMatch[3]);
      if (majorVersion >= 16) {
        console.log('iOS 16.4+ in PWA mode supports Web Push');
        return true;
      } else {
        console.log(`iOS ${majorVersion} does not support Web Push. Minimum version is 16.4.`);
        return false;
      }
    }
    console.log('Unable to detect iOS version');
    return false;
  }

  // Other browsers (Chrome, Firefox, Edge) generally support Web Push
  console.log('Web Push is supported in this browser');
  return true;
}

/**
 * Request notification permission from the user
 * Ensures called from a user gesture (tap/click) as required by Safari
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!supportsWebPush()) {
    throw new Error('Web Push is not supported in this browser');
  }

  console.log('Requesting notification permission...');
  const permission = await Notification.requestPermission();
  console.log('Notification permission result:', permission);
  return permission;
}

/**
 * Get the VAPID public key from environment or configuration
 */
export function getVapidPublicKey(): string | null {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
  if (!vapidPublicKey) {
    console.error('VAPID public key not configured in environment variables');
  }
  return vapidPublicKey;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(options: SubscriptionOptions = {}): Promise<PushSubscription | null> {
  console.log('Starting subscription process...');

  if (!supportsWebPush()) {
    throw new Error('Web Push is not supported in this browser');
  }

  try {
    // Check notification permission
    let permission = Notification.permission;
    console.log('Current notification permission:', permission);

    if (permission === 'default') {
      console.log('Requesting permission...');
      permission = await requestNotificationPermission();
    }

    if (permission !== 'granted') {
      console.warn('Notification permission not granted:', permission);
      return null;
    }

    // Get service worker registration
    console.log('Getting service worker registration...');
    const registration = await navigator.serviceWorker.ready;
    console.log('Service worker ready:', registration);

    // Get VAPID public key
    const vapidPublicKey = getVapidPublicKey();
    if (!vapidPublicKey) {
      throw new Error('VAPID public key not configured');
    }

    // Convert the VAPID public key to the required format
    const applicationServerKey = urlB64ToUint8Array(vapidPublicKey);
    console.log('Application server key converted');

    // Subscribe to push notifications
    console.log('Subscribing to push notifications...');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as any,
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

    console.log('Push subscription created:', pushSubscription);

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

    console.log('Saving subscription to server...');
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
        device_info: options.device_info || {
          userAgent: navigator.userAgent,
          standalone: (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true),
          platform: navigator.platform,
          language: navigator.language
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to save subscription:', response.status, errorText);
      throw new Error(`Failed to save subscription: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Push subscription saved successfully:', result);
    return pushSubscription;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    if (error instanceof Error) {
      throw new Error(`Push subscription failed: ${error.message}`);
    }
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

    // Remove subscription from server
    const token = await getAccessToken();
    if (!token) {
      console.warn('User not authenticated, unable to remove subscription from server');
      return success;
    }

    // Get the Supabase URL from environment
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/unsubscribe`; // Assuming an unsubscribe endpoint exists

      try {
        const response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint
          }),
        });

        if (!response.ok) {
          console.error('Failed to remove subscription from server:', response.status);
        } else {
          console.log('Subscription removed from server successfully');
        }
      } catch (err) {
        console.error('Error removing subscription from server:', err);
      }
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
    const isSubscribed = subscription !== null;
    console.log('Current subscription status:', isSubscribed);
    return isSubscribed;
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