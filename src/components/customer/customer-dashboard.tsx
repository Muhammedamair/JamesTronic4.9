'use client';

import { useState, useEffect } from 'react';
import { useCustomer } from '@/components/customer/customer-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TicketTimeline } from './ticket-timeline';
import { QuotationCard } from './quotation-card';
import { SLACountdown } from './sla-countdown';
import { PickupStatusCard } from './pickup-status-card';
import { NotificationPanel } from './notification-panel';
import { Ticket } from '@/lib/api/customer';
import { toast } from 'sonner';
import { updateCustomerCaches, getCachedTicketState, getCachedSLA, getCachedEvents, getCachedTransporterState } from '@/lib/pwa-cache-service';

export default function CustomerDashboard() {
  const { customerData, customerTickets, isLoading, refetchCustomerData } = useCustomer();
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');

  useEffect(() => {
    // Check network status
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setNetworkStatus(navigator.onLine ? 'online' : 'offline');

    if (!navigator.onLine) {
      toast.warning('You are currently offline. Some features may be limited.');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (customerTickets && customerTickets.length > 0 && !selectedTicket) {
      // Set the most recent ticket as selected by default
      const mostRecent = customerTickets.reduce((prev, current) =>
        new Date(prev.created_at) > new Date(current.created_at) ? prev : current
      );
      setSelectedTicket(mostRecent);
    }
  }, [customerTickets, selectedTicket]);

  // Function to cache data when online
  useEffect(() => {
    const cacheData = async () => {
      if (networkStatus === 'online' && selectedTicket) {
        try {
          // Cache ticket state
          if (selectedTicket) {
            await updateCustomerCaches(
              selectedTicket.id,
              selectedTicket,
              null, // We'll get SLA separately
              null, // We'll get events separately
              {
                transporter_job_id: (selectedTicket as any).transporter_job_id || (selectedTicket as any).assigned_transporter_id || null,
                transporter_contact_name: (selectedTicket as any).transporter_contact_name || null,
                transporter_contact_phone: (selectedTicket as any).transporter_contact_phone || null,
                transporter_tracking_url: (selectedTicket as any).transporter_tracking_url || null
              }
            );
          }
        } catch (error) {
          console.error('Error caching data:', error);
        }
      }
    };

    cacheData();
  }, [selectedTicket, networkStatus]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading your dashboard...</div>
      </div>
    );
  }

  if (!customerData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Please log in to access your dashboard</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      {networkStatus === 'offline' && (
        <div className="mb-4 p-3 bg-yellow-100 text-yellow-800 rounded-md text-center">
          You are currently offline. Data may be outdated.
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Hello, {customerData.name}!</h1>
        <p className="text-muted-foreground">
          Track your repair requests and stay updated on their status
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <SLACountdown ticket={selectedTicket} />
        <PickupStatusCard ticket={selectedTicket} />
        <QuotationCard ticket={selectedTicket} />
      </div>

      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="timeline">Repair Timeline</TabsTrigger>
          <TabsTrigger value="tickets">My Repairs</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>
        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Repair Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedTicket ? (
                <TicketTimeline ticket={selectedTicket} />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No repair selected
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tickets" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>My Repairs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {customerTickets && customerTickets.length > 0 ? (
                  customerTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className={`p-4 border rounded-lg cursor-pointer hover:bg-accent transition-colors ${
                        selectedTicket?.id === ticket.id ? 'bg-primary/5 border-primary' : ''
                      }`}
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold">
                            {ticket.device_category} {ticket.brand ? `(${ticket.brand})` : ''}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Status: {ticket.status}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Created: {new Date(ticket.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          ticket.status === 'completed' ? 'bg-green-100 text-green-800' :
                          ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          ticket.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No repairs found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}