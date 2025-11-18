'use client';

import { useEffect } from 'react';

export default function ServiceWorkerUninstaller() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(const registration of registrations) {
          registration.unregister();
          console.log('Service worker unregistered:', registration);
        }
      }).catch(function(err) {
        console.error('Service worker unregistration failed:', err);
      });
    }
  }, []);

  return null; // This component doesn't render anything
}
