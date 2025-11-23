'use client';

import { useEffect } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { initializeOneSignal, savePlayerIdToDatabase } from '@/lib/onesignal-notification-service';

declare global {
  interface Window {
    OneSignal: any;
  }
}

export default function OneSignalInitializer() {
  const { user } = useSupabase();

  useEffect(() => {
    if (user) {
      initializeOneSignal();
    }
  }, [user]);

  useEffect(() => {
    // Load OneSignal SDK dynamically
    const loadOneSignalSDK = () => {
      if (typeof window !== 'undefined' && !window.OneSignal) {
        const script = document.createElement('script');
        script.src = 'https://cdn.onesignal.com/sdks/OneSignalSDK.js';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);

        script.onload = () => {
          // OneSignal SDK is now available
          console.log('OneSignal SDK loaded');
          
          // Initialize OneSignal if user is logged in
          if (user) {
            initializeOneSignal();
          }
        };
      } else if (window.OneSignal && user) {
        // SDK already loaded, initialize immediately
        initializeOneSignal();
      }
    };

    loadOneSignalSDK();
  }, [user]);

  return null; // This component doesn't render anything
}