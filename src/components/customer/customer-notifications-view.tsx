'use client';

import { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bell,
  Package,
  Wrench,
  CheckCircle,
  Clock,
  User,
  AlertTriangle
} from 'lucide-react';
import { useCustomer } from '@/components/customer/customer-provider';
import { Notification } from '@/lib/api/customer';
import { formatTimeAgo } from '@/lib/utils/date-utils';
import { TrustPanel } from '@/components/trust/trust-panel';

interface NotificationItemProps {
  notification: Notification;
}

const NotificationItem = ({ notification }: NotificationItemProps) => {
  // Determine icon based on notification type
  const getNotificationIcon = () => {
    if (notification.message.toLowerCase().includes('part') ||
        notification.message.toLowerCase().includes('ordered')) {
      return <Package className="w-5 h-5 text-blue-500" />;
    } else if (notification.message.toLowerCase().includes('complete') ||
               notification.message.toLowerCase().includes('finished')) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else if (notification.message.toLowerCase().includes('assign') ||
               notification.message.toLowerCase().includes('technician')) {
      return <User className="w-5 h-5 text-purple-500" />;
    } else if (notification.message.toLowerCase().includes('repair') ||
               notification.message.toLowerCase().includes('work')) {
      return <Wrench className="w-5 h-5 text-yellow-500" />;
    } else if (notification.message.toLowerCase().includes('breach') ||
               notification.message.toLowerCase().includes('delay')) {
      return <AlertTriangle className="w-5 h-5 text-red-500" />;
    }
    return <Bell className="w-5 h-5 text-gray-500" />;
  };

  // Determine badge variant based on channel
  const getChannelVariant = () => {
    switch (notification.channel) {
      case 'push':
        return 'default';
      case 'sms':
        return 'secondary';
      case 'email':
        return 'outline';
      default:
        return 'default';
    }
  };

  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <div className="flex gap-3">
        <div className="pt-1">
          {getNotificationIcon()}
        </div>
        <div className="flex-1">
          <p className="font-medium">{notification.message}</p>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <Badge variant={getChannelVariant()} className="text-xs">
                {notification.channel.toUpperCase()}
              </Badge>
              {notification.ticket && (
                <Badge variant="outline" className="text-xs">
                  {notification.ticket.device_category}
                </Badge>
              )}
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatTimeAgo(new Date(notification.sent_at))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CustomerNotificationsView = () => {
  const { customerData, isCustomer } = useCustomer();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && isCustomer) {
      const fetchNotifications = async () => {
        try {
          setLoading(true);
          const response = await fetch('/api/customer/notifications');

          if (response.ok) {
            const data = await response.json();
            setNotifications(data);
          } else {
            console.error('Failed to fetch notifications');
            setNotifications([]);
          }
        } catch (error) {
          console.error('Error fetching notifications:', error);
          setNotifications([]);
        } finally {
          setLoading(false);
        }
      };

      fetchNotifications();
    }
  }, [open, isCustomer]);

  if (!isCustomer) {
    return null;
  }

  const unreadCount = notifications.length; // In a real implementation, you'd track read status

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative"
          onClick={() => setOpen(true)}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      </DrawerTrigger>

      <DrawerContent>
        <div className="mx-auto w-full max-w-2xl">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </DrawerTitle>
            <DrawerDescription>
              All updates related to your repairs
            </DrawerDescription>
          </DrawerHeader>

          <div className="p-4 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                    <div className="flex gap-3">
                      <div className="pt-1">
                        <Bell className="w-5 h-5 text-gray-300 animate-pulse" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length > 0 ? (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                />
              ))
            ) : (
              <div className="text-center py-8">
                <Bell className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-600 dark:text-gray-400">No notifications yet</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  You'll see updates about your repairs here
                </p>
              </div>
            )}
          </div>

          {/* Show trust panel for the customer's account */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border-t border-gray-200 dark:border-gray-700">
            <TrustPanel
              ticketId="account-summary"
              slaStatus="active"
              promisedHours={null}
              elapsedHours={null}
              assignedTechnician={false}
              partRequired={false}
              confidenceLevel="high"
              compact={true}
            />
          </div>

          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
};