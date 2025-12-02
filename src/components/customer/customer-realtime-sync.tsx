'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useCustomer } from '@/components/customer/customer-provider';
import { useQueryClient } from '@tanstack/react-query';

// Define specific ticket type for the payloads
interface TicketRecord {
  id: string;
  customer_id: string;
  assigned_technician_id?: string | null;
  device_category: string;
  brand?: string | null;
  model?: string | null;
  issue_summary: string;
  issue_details?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// Define the payload type for the realtime changes with proper type inference
interface RealtimePayload<T = Record<string, any>> {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  old?: T;
  new?: T;
  errors: string[] | null;
  commit_timestamp: string;
}

// Define the payload specifically for ticket changes
type TicketRealtimePayload = RealtimePayload<TicketRecord>;

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const useCustomerRealtimeSync = () => {
  const { isCustomer, customerData, refetchCustomerData } = useCustomer();
  const queryClient = useQueryClient();
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!isCustomer || !customerData) {
      // Unsubscribe if not a customer
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // Create a channel to listen to ticket updates for this customer
    // Since we can't directly filter by customer_id in the tickets table subscription,
    // we'll subscribe to all tickets but filter on the frontend
    const channel = supabase
      .channel(`customer_tickets_sync_${customerData.id}_${Date.now()}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
        },
        (payload: TicketRealtimePayload) => {
          // Check if this ticket update is relevant to the current customer
          if (payload.new?.customer_id === customerData.id || payload.old?.customer_id === customerData.id) {
            // Invalidate customer-related queries to trigger refresh
            queryClient.invalidateQueries({ queryKey: ['customer', 'tickets'] });
            queryClient.invalidateQueries({ queryKey: ['customer', 'ticket', payload.new?.id] });
            refetchCustomerData();
          }
        }
      )
      .subscribe();

    // Store reference to the channel for cleanup
    channelRef.current = channel;

    // Cleanup function
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [isCustomer, customerData, queryClient, refetchCustomerData]);

  // Additional subscription for customer-specific tables
  useEffect(() => {
    if (!isCustomer || !customerData) {
      return;
    }

    // Subscribe to customer_timeline updates
    const timelineChannel = supabase
      .channel(`customer_timeline_sync_${customerData.id}_${Date.now()}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'customer_timeline',
        },
        (payload: RealtimePayload<{ ticket_id?: string }>) => {
          // Invalidate timeline-related queries
          queryClient.invalidateQueries({ queryKey: ['customer', 'timeline', payload.new?.ticket_id] });
        }
      )
      .subscribe();

    // Subscribe to customer_sla_snapshot updates
    const slaChannel = supabase
      .channel(`customer_sla_sync_${customerData.id}_${Date.now()}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'customer_sla_snapshot',
        },
        (payload: RealtimePayload<{ ticket_id?: string }>) => {
          // Invalidate SLA-related queries
          queryClient.invalidateQueries({ queryKey: ['customer', 'sla', payload.new?.ticket_id] });
        }
      )
      .subscribe();

    // Cleanup function
    return () => {
      supabase.removeChannel(timelineChannel);
      supabase.removeChannel(slaChannel);
    };
  }, [isCustomer, customerData, queryClient]);

  return null; // This hook doesn't render anything
};