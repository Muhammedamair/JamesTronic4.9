'use client';

import { useState, useEffect } from 'react';

// Trust Memory System - stores trust-related information in localStorage
// so it persists across page refreshes but remains tied to the session
export const useTrustMemory = () => {
  const [trustMemory, setTrustMemory] = useState<any>({});

  // Load trust memory from localStorage on mount
  useEffect(() => {
    const storedTrustMemory = localStorage.getItem('jamestronic-trust-memory');
    if (storedTrustMemory) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTrustMemory(JSON.parse(storedTrustMemory));
      } catch (e) {
        console.error('Error parsing trust memory:', e);
        setTrustMemory({});
      }
    }
  }, []);

  // Save to localStorage whenever trustMemory changes
  useEffect(() => {
    if (Object.keys(trustMemory).length > 0) {
      localStorage.setItem('jamestronic-trust-memory', JSON.stringify(trustMemory));
    }
  }, [trustMemory]);

  const updateTrustMemory = (key: string, value: any) => {
    setTrustMemory((prev: any) => ({
      ...prev,
      [key]: value
    }));
  };

  const getTrustMemory = (key: string) => {
    return trustMemory[key];
  };

  const clearTrustMemory = (key?: string) => {
    if (key) {
      setTrustMemory((prev: any) => {
        const newMemory = { ...prev };
        delete newMemory[key];
        return newMemory;
      });
    } else {
      setTrustMemory({});
      localStorage.removeItem('jamestronic-trust-memory');
    }
  };

  return {
    trustMemory,
    updateTrustMemory,
    getTrustMemory,
    clearTrustMemory
  };
};

// Trust Memory Provider Component
export const TrustMemoryProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

// Hook to use trust notifications globally
export const useTrustNotifications = () => {
  const { getTrustMemory, updateTrustMemory } = useTrustMemory();

  const addTrustNotification = (ticketId: string, notification: {
    id: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    timestamp: string;
    read: boolean;
  }) => {
    const existingNotifications = getTrustMemory(`notifications-${ticketId}`) || [];
    updateTrustMemory(`notifications-${ticketId}`, [
      ...existingNotifications,
      notification
    ]);
  };

  const getUnreadTrustNotifications = (ticketId: string) => {
    const notifications = getTrustMemory(`notifications-${ticketId}`) || [];
    return notifications.filter((n: any) => !n.read);
  };

  const markTrustNotificationAsRead = (ticketId: string, notificationId: string) => {
    const notifications = getTrustMemory(`notifications-${ticketId}`) || [];
    updateTrustMemory(`notifications-${ticketId}`,
      notifications.map((n: any) =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  };

  return {
    addTrustNotification,
    getUnreadTrustNotifications,
    markTrustNotificationAsRead
  };
};