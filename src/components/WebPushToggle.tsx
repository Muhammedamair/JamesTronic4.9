'use client';
// components/WebPushToggle.tsx
// Component for enabling/disabling web push notifications

import React, { useState, useEffect } from 'react';
import { useWebPush } from '@/hooks/useWebPush';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Info, AlertCircle, Download } from 'lucide-react';

interface WebPushToggleProps {
  userId?: string;
  role?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

// Improved Safari and PWA mode detection
function getWebPushSupportStatus() {
  // Check if required APIs exist
  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasPushManager = 'PushManager' in window;
  const hasNotification = 'Notification' in window;

  // Check if all APIs are available
  if (!hasServiceWorker || !hasPushManager || !hasNotification) {
    return {
      isSupported: false,
      isPwaRequired: false,
      reason: "Missing required APIs (ServiceWorker, PushManager, or Notification)"
    };
  }

  // Detect browser
  const userAgent = navigator.userAgent;
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);

  if (isSafari) {
    // Extract Safari version
    const safariVersionMatch = userAgent.match(/version\/(\d+\.\d+)/i);
    if (safariVersionMatch) {
      const version = parseFloat(safariVersionMatch[1]);
      if (version >= 16.4) {
        // Check if running in standalone mode (PWA)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                             (navigator.standalone === true) ||
                             document.referrer.includes('android-app://');

        if (isStandalone) {
          return {
            isSupported: true,
            isPwaRequired: false,
            reason: "Safari 16.4+ in PWA mode supports Web Push on macOS/iOS"
          };
        } else {
          return {
            isSupported: false,
            isPwaRequired: true,
            reason: "Safari 16.4+ supports Web Push only when installed as a PWA (Add to Dock/Home Screen)"
          };
        }
      } else {
        return {
          isSupported: false,
          isPwaRequired: false,
          reason: `Safari ${version} does not support Web Push. Minimum version is 16.4.`
        };
      }
    } else {
      return {
        isSupported: false,
        isPwaRequired: false,
        reason: "Unable to detect Safari version"
      };
    }
  }

  // For iOS, Web Push is not supported in regular browser, only in PWAs from Safari 16.4+
  if (isIOS) {
    // Check if running in standalone mode (PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         (navigator.standalone === true) ||
                         document.referrer.includes('android-app://');

    if (isStandalone) {
      // Check iOS version (needs 16.4+)
      const iosVersionMatch = userAgent.match(/os (\d+)_(\d+)\s|os\s(\d+)\s/i);
      if (iosVersionMatch) {
        const majorVersion = parseInt(iosVersionMatch[1] || iosVersionMatch[3]);
        if (majorVersion >= 16) {
          return {
            isSupported: true,
            isPwaRequired: false,
            reason: "iOS 16.4+ in PWA mode supports Web Push"
          };
        }
      }
    }

    return {
      isSupported: false,
      isPwaRequired: true,
      reason: "Web Push is supported on iOS only when installed as a PWA (Add to Home Screen) with iOS 16.4+"
    };
  }

  // Other browsers (Chrome, Firefox, Edge) generally support Web Push
  return {
    isSupported: true,
    isPwaRequired: false,
    reason: "Web Push is supported in this browser"
  };
}

const WebPushToggle: React.FC<WebPushToggleProps> = ({
  userId,
  role = 'technician',
  checked = false,
  onCheckedChange
}) => {
  const {
    isSupported: hookIsSupported,
    isSubscribed,
    isChecking,
    permission,
    subscribe,
    unsubscribe,
    requestPermission,
    refreshSubscriptionStatus
  } = useWebPush();

  // Use our improved detection instead of the hook's basic detection
  const browserSupport = getWebPushSupportStatus();
  const isActuallySupported = browserSupport.isSupported && hookIsSupported;
  const needsPwaInstallation = !browserSupport.isSupported && browserSupport.isPwaRequired;

  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Update the parent component's state when subscription changes
    if (onCheckedChange) {
      onCheckedChange(isSubscribed);
    }
  }, [isSubscribed, onCheckedChange]);

  const handleToggle = () => {
    if (!isActuallySupported || isChecking || isUpdating) return;

    setIsUpdating(true);

    const toggleAction = async () => {
      try {
        if (!checked) {
          // Enable push notifications
          if (permission !== 'granted') {
            const perm = await requestPermission();
            if (perm !== 'granted') {
              setIsUpdating(false);
              return;
            }
          }

          await subscribe({ role });
          await refreshSubscriptionStatus();
        } else {
          // Disable push notifications
          await unsubscribe();
          await refreshSubscriptionStatus();
        }
      } catch (error) {
        console.error('Error toggling push notifications:', error);
      } finally {
        setIsUpdating(false);
      }
    };

    toggleAction();
  };

  // Show PWA installation message if needed
  if (needsPwaInstallation) {
    return (
      <div className="w-full p-6 bg-blue-50 rounded-lg shadow border border-blue-200 dark:border-blue-800 dark:bg-blue-900/20">
        <div className="flex items-start space-x-3">
          <Download className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">PWA Installation Required</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {browserSupport.reason}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              To install this app: In Safari, tap the Share button and select "Add to Home Screen" (iOS) or "Add to Dock" (macOS).
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show general unsupported message
  if (!isActuallySupported) {
    return (
      <div className="w-full p-6 bg-white rounded-lg shadow border border-amber-200 dark:border-amber-800">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Push Notifications Not Supported</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {browserSupport.reason}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Web push notifications require a browser that supports the Push API and Service Workers.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 bg-white rounded-lg shadow border">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Push Notifications</h3>
            <Badge variant={checked ? "default" : "secondary"} className="capitalize">
              {checked ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Receive notifications about new ticket assignments and status updates
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {isUpdating ? (
            <Button variant="outline" disabled className="min-w-[80px]">
              <span className="h-3 w-3 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
              Updating...
            </Button>
          ) : (
            <Button
              onClick={handleToggle}
              disabled={isChecking || isUpdating}
              variant={checked ? "outline" : "default"}
              className="min-w-[80px]"
            >
              {checked ? 'Disable' : 'Enable'}
            </Button>
          )}
        </div>
      </div>

      {permission === 'denied' && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">
            Notifications are blocked. Please enable them in your browser settings.
          </p>
        </div>
      )}
    </div>
  );
};

export default WebPushToggle;