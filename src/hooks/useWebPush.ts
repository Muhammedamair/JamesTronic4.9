'use client';
// hooks/useWebPush.ts
// React hook for managing web push notifications

import { useState, useEffect } from 'react';
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
      }

      setIsChecking(false);

      // Auto-subscribe if requested and conditions are met
      if (autoSubscribe && supported && Notification.permission === 'granted' && !isSubscribed) {
        await subscribe(subscriptionOptions);
      }
    }

    checkStatus();
  }, [autoSubscribe, subscriptionOptions]);

  const subscribe = async (options: SubscriptionOptions = {}): Promise<PushSubscription | null> => {
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
  };

  const unsubscribe = async (): Promise<boolean> => {
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
  };

  const requestPermission = async (): Promise<NotificationPermission> => {
    try {
      const perm = await requestNotificationPermission();
      setPermission(perm);
      return perm;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return Notification.permission;
    }
  };

  const refreshSubscriptionStatus = async (): Promise<void> => {
    if (isSupported) {
      setIsChecking(true);
      const subscribed = await isSubscribedToPush();
      setIsSubscribed(subscribed);
      setPermission(Notification.permission);
      setIsChecking(false);
    }
  };

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