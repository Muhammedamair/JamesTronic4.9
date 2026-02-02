'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Notification } from '@/lib/api/customer';
import { customerAPI } from '@/lib/api/customer';
import { Bell, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useSupabase } from '@/components/shared/supabase-provider';

export function NotificationPanel() {
  const { supabase, user } = useSupabase();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, [user]);

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) return;

      const notificationData = await customerAPI.getNotifications();
      setNotifications(notificationData);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getNotificationIcon = (channel: string) => {
    switch (channel) {
      case 'sms':
        return <Info className="h-4 w-4" />;
      case 'whatsapp':
        return <CheckCircle className="h-4 w-4" />;
      case 'push':
        return <Bell className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getNotificationVariant = (message: string) => {
    if (message.toLowerCase().includes('alert') || message.toLowerCase().includes('breach')) {
      return 'destructive';
    } else if (message.toLowerCase().includes('update') || message.toLowerCase().includes('progress')) {
      return 'secondary';
    } else if (message.toLowerCase().includes('completed') || message.toLowerCase().includes('success')) {
      return 'default';
    }
    return 'secondary';
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="py-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!notifications || notifications.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Bell className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mt-2 font-medium">No notifications</h3>
        <p className="text-sm text-muted-foreground">You'll see important updates here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notifications.map((notification) => (
        <Card key={notification.id}>
          <CardContent className="py-4">
            <div className="flex space-x-3">
              <div className="mt-0.5 text-muted-foreground">
                {getNotificationIcon(notification.channel)}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <h4 className="font-medium">{notification.message}</h4>
                  <Badge variant={getNotificationVariant(notification.message)}>
                    {notification.channel.toUpperCase()}
                  </Badge>
                </div>
                {notification.ticket && (
                  <p className="text-xs text-muted-foreground mt-1">
                    For: {notification.ticket.device_category} {notification.ticket.brand ? `(${notification.ticket.brand})` : ''}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(notification.sent_at).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}