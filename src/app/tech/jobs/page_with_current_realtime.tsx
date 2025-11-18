'use client';

import React from 'react';
import { TicketCard } from '@/components/ui/ticket-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useSupabase } from '@/components/supabase-provider';
import { createTicketService, TicketWithCustomer } from '@/lib/authenticated-service';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Ticket } from '@/lib/supabase';

const TechJobsPage = () => {
  const { supabase, user, userRole, isLoading: isAuthLoading } = useSupabase();
  const queryClient = useQueryClient();
  const ticketService = createTicketService(supabase);

  // Get technician's assigned tickets
  const { data: tickets, isLoading: isTicketsLoading, error, refetch } = useQuery({
    queryKey: ['tickets', 'technician', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      // Get profile to get technician ID
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile) {
        throw new Error('Profile not found');
      }

      // Get tickets assigned to this technician
      const result = await ticketService.getByTechnicianId(profile.id);
      return result.data;
    },
    enabled: !!user && userRole === 'technician', // Only run query if user is authenticated AND is technician
    refetchOnWindowFocus: true, // Enable window focus refetch for better real-time behavior
    refetchInterval: 30000, // Refetch every 30 seconds to catch new assignments
    staleTime: 60 * 1000, // 1 minute
  });

  // Mutation for updating ticket status
  const updateStatusMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: string }) => {
      return ticketService.updateStatus(ticketId, status);
    },
    onMutate: async ({ ticketId, status }) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['tickets', 'technician', user?.id] });

      // Snapshot previous value
      const previousTickets = queryClient.getQueryData<TicketWithCustomer[]>(['tickets', 'technician', user?.id]);

      if (previousTickets) {
        // Optimistically update the cache
        queryClient.setQueryData<TicketWithCustomer[]>(['tickets', 'technician', user?.id], (old) => {
          if (!old) return [];
          return old.map(ticket =>
            ticket.id === ticketId
              ? { ...ticket, status }
              : ticket
          );
        });
      }

      return { previousTickets };
    },
    onError: (err, { ticketId, status }, context) => {
      // Rollback on error
      if (context?.previousTickets) {
        queryClient.setQueryData(['tickets', 'technician', user?.id], context.previousTickets);
      }
    },
    onSettled: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['tickets', 'technician', user?.id] });
    },
  });

  // Real-time subscription for tickets to handle status updates and new assignments
  React.useEffect(() => {
    if (!user || userRole !== 'technician') return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const getProfileAndSubscribe = async () => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile) {
        console.error('Profile not found for real-time subscription:', profileError);
        return;
      }

      const technicianId = profile.id;
      const channelName = `realtime:public:tickets:technician=${technicianId}`;

      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tickets',
            filter: `assigned_technician_id=eq.${technicianId}`,
          },
          (payload) => {
            console.log('Tech: Realtime change detected for any ticket.', payload);
            // Check if this change could affect what the technician sees
            // (e.g., ticket was unassigned and now assigned to technician, or status changed on assigned ticket)
            const newAssignedTechId = payload.new?.assigned_technician_id;
            const oldAssignedTechId = payload.old?.assigned_technician_id;
            
            // Invalidate cache if:
            // 1. Ticket was assigned to this technician (new assignment)
            // 2. Ticket was assigned to this technician and is now unassigned or assigned to someone else
            // 3. Ticket assigned to this technician had status change
            if (newAssignedTechId === technicianId || oldAssignedTechId === technicianId) {
              queryClient.invalidateQueries({ queryKey: ['tickets', 'technician', user?.id] });
            }
            queryClient.invalidateQueries({ queryKey: ['tickets', 'technician', user?.id] });
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log(`Subscribed to ${channelName}`);
          }
          if (status === 'CHANNEL_ERROR') {
            console.error('Real-time channel error:', err);
          }
        });
    };

    getProfileAndSubscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase, queryClient, user, userRole]);

  if (error) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error! </strong>
          <span className="block sm:inline">Failed to load tickets: {(error as Error).message}</span>
          <button
            onClick={() => refetch()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isLoading = isAuthLoading || isTicketsLoading;

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Your Service Tickets</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Showing tickets assigned to you
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, index) => (
            <motion.div
              key={`skeleton-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.2,
                type: "spring",
                stiffness: 220,
                damping: 26
              }}
            >
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <div className="mt-3">
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <div className="mt-4 flex space-x-2">
                  {[...Array(4)].map((_, idx) => (
                    <Skeleton key={idx} className="h-8 w-16 rounded-md" />
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : tickets && tickets.length === 0 ? (
        <EmptyState
          title="No assigned tickets"
          description="You don't have any tickets assigned to you yet. Check back later."
          actionText="View Dashboard"
          onAction={() => window.location.href = '/app'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {tickets?.map((ticket: TicketWithCustomer, index) => (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{
                  duration: 0.2,
                  type: "spring",
                  stiffness: 220,
                  damping: 26,
                  delay: index * 0.05
                }}
              >
                <TicketCard
                  id={ticket.id}
                  customerName={ticket.customer?.name || 'N/A'}
                  customerPhone={ticket.customer?.phone_e164 || 'N/A'}
                  customerArea={ticket.customer?.area || 'N/A'}
                  deviceCategory={ticket.device_category}
                  brand={ticket.brand || ''}
                  model={ticket.model || ''}
                  issueSummary={ticket.issue_summary}
                  status={ticket.status}
                  createdAt={ticket.created_at}
                  onUpdateStatus={(status) => updateStatusMutation.mutate({ ticketId: ticket.id, status })}
                  // Technicians can't delete tickets, so don't pass onDelete prop
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default TechJobsPage;