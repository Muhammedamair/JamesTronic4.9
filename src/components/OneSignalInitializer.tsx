'use client';

import { useEffect, useRef } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { initializeOneSignal, savePlayerIdToDatabase } from '@/lib/onesignal-notification-service';

declare global {
  interface Window {
    OneSignal: any;
  }
}

export default function OneSignalInitializer() {
  const { user } = useSupabase();
  const isOneSignalInitialized = useRef(false);

  useEffect(() => {
    if (user && !isOneSignalInitialized.current) {
      // Load OneSignal SDK dynamically
      const script = document.createElement('script');
      script.src = 'https://cdn.onesignal.com/sdks/OneSignalSDK.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);

      script.onload = async () => {
        // OneSignal SDK is now available
        console.log('OneSignal SDK loaded');

        // Initialize OneSignal if not already initialized
        if (window.OneSignal && !isOneSignalInitialized.current) {
          isOneSignalInitialized.current = true;
          await initializeOneSignal();
        }
      };

      // Cleanup function
      return () => {
        document.head.removeChild(script);
      };
    }
  }, [user]);

  return null; // This component doesn't render anything
}