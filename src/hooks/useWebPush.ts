'use client';
// hooks/useWebPush.ts
// React hook for managing web push notifications

import { useState, useEffect, useCallback } from 'react';
import {
  supportsWebPush,
  requestNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  isSubscribedToPush,
  PushSubscription,
  SubscriptionOptions
} from '@/lib/web-push-service';

export interface UseWebPushOptions extends SubscriptionOptions {
  autoSubscribe?: boolean;
}

export interface UseWebPushReturn {
  isSupported: boolean;
  isSubscribed: boolean;
  isChecking: boolean;
  permission: NotificationPermission | null;
  subscribe: (options?: SubscriptionOptions) => Promise<PushSubscription | null>;
  unsubscribe: () => Promise<boolean>;
  requestPermission: () => Promise<NotificationPermission>;
  refreshSubscriptionStatus: () => Promise<void>;
}

export function useWebPush(options: UseWebPushOptions = {}): UseWebPushReturn {
  const { autoSubscribe = false, ...subscriptionOptions } = options;
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  // Check support and subscription status on mount
  useEffect(() => {
    async function checkStatus() {
      setIsChecking(true);

      const supported = supportsWebPush();
      setIsSupported(supported);

      if (supported) {
        const subscribed = await isSubscribedToPush();
        setIsSubscribed(subscribed);

        // Get current notification permission
        setPermission(Notification.permission);
      } else {
        // If not supported, set to false to avoid hanging loading state
        setIsSubscribed(false);
        setPermission(null);
      }

      setIsChecking(false);

      // Auto-subscribe if requested and conditions are met
      if (autoSubscribe && supported && Notification.permission === 'granted' && !isSubscribed) {
        await subscribe(subscriptionOptions);
      }
    }

    checkStatus();

    // Also add an event listener for service worker updates
    const handleServiceWorkerStateChange = () => {
      // Refresh subscription status when service worker changes
      if (isSupported) {
        refreshSubscriptionStatus();
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleServiceWorkerStateChange);
    }

    // Cleanup
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleServiceWorkerStateChange);
      }
    };
  }, [autoSubscribe, subscriptionOptions, isSupported]); // Add isSupported to dependency array to refresh when support changes

  const subscribe = useCallback(async (options: SubscriptionOptions = {}): Promise<PushSubscription | null> => {
    try {
      const subscription = await subscribeToPushNotifications(options);
      if (subscription) {
        setIsSubscribed(true);
        setPermission('granted');
        return subscription;
      }
      return null;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      const success = await unsubscribeFromPushNotifications();
      if (success) {
        setIsSubscribed(false);
      }
      return success;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return false;
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    try {
      const perm = await requestNotificationPermission();
      setPermission(perm);
      return perm;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return Notification.permission;
    }
  }, []);

  const refreshSubscriptionStatus = useCallback(async (): Promise<void> => {
    if (isSupported) {
      setIsChecking(true);
      try {
        const subscribed = await isSubscribedToPush();
        setIsSubscribed(subscribed);
        setPermission(Notification.permission);
      } catch (error) {
        console.error('Error refreshing subscription status:', error);
        setIsSubscribed(false);
      } finally {
        setIsChecking(false);
      }
    } else {
      // If not supported, set appropriate defaults
      setIsChecking(false);
      setIsSubscribed(false);
    }
  }, [isSupported]);

  return {
    isSupported,
    isSubscribed,
    isChecking,
    permission,
    subscribe,
    unsubscribe,
    requestPermission,
    refreshSubscriptionStatus,
  };
}