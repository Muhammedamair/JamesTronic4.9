'use client';

import { useState, useEffect } from 'react';
import { TimelineEvent } from '@/lib/api/customer';
import { customerAPI } from '@/lib/api/customer';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, CheckCircle, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { useSupabase } from '@/components/shared/supabase-provider';

interface TicketTimelineProps {
  ticket: any; // Using any for now since we need to extend the Ticket type
}

export function TicketTimeline({ ticket }: TicketTimelineProps) {
  const { user } = useSupabase();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);

  useEffect(() => {
    // Check network status
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setNetworkStatus(navigator.onLine ? 'online' : 'offline');

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (ticket?.id) {
      loadTimeline(currentPage);
    }
  }, [ticket, networkStatus, currentPage, user]);

  const loadTimeline = async (page: number = 1) => {
    if (!navigator.onLine) {
      // If offline, we can't load new data, but might have cached data
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Use the customerAPI service instead of direct fetch
      const timelineEvents = await customerAPI.getTimeline(ticket.id);
      setEvents(timelineEvents);
    } catch (error) {
      console.error('Error loading timeline:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex space-x-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (networkStatus === 'offline' && (!events || events.length === 0)) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-2">Offline: Cannot load timeline</p>
        <p className="text-sm text-muted-foreground">Connect to the internet to see updates</p>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No timeline events available yet
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 h-full w-0.5 bg-muted -translate-x-1/2" />

      <div className="space-y-6">
        {events.map((event, index) => (
          <div key={event.id} className="relative flex space-x-4">
            <div className="absolute left-0 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {event.event_type.includes('status') ? (
                <CheckCircle className="h-4 w-4" />
              ) : event.event_type.includes('pickup') ? (
                <Calendar className="h-4 w-4" />
              ) : event.event_type.includes('assign') ? (
                <User className="h-4 w-4" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
            </div>

            <div className="pt-1 pb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold">{event.title}</h3>
                    <Badge variant="secondary">
                      {new Date(event.created_at).toLocaleDateString()}
                    </Badge>
                  </div>
                  {event.description && (
                    <p className="mt-2 text-muted-foreground">{event.description}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={!hasPrevPage || isLoading}
          className={`flex items-center px-4 py-2 rounded-md ${!hasPrevPage || isLoading
            ? 'text-gray-400 cursor-not-allowed'
            : 'text-primary hover:bg-primary/10'
            }`}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </button>

        <span className="text-sm text-gray-600">
          Page {currentPage} of {totalPages} ({totalEvents} total events)
        </span>

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={!hasNextPage || isLoading}
          className={`flex items-center px-4 py-2 rounded-md ${!hasNextPage || isLoading
            ? 'text-gray-400 cursor-not-allowed'
            : 'text-primary hover:bg-primary/10'
            }`}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </button>
      </div>
    </div>
  );
}