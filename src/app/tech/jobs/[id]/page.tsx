'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/supabase-provider';
import { createTicketService } from '@/lib/authenticated-service';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { Phone, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { WhatsAppTemplate } from '@/lib/whatsapp-template';

interface TicketDetails {
  id: string;
  customer: {
    name: string;
    phone_e164: string;
    area?: string;
  };
  device_category: string;
  brand?: string;
  model?: string;
  size_inches?: number;
  issue_summary: string;
  issue_details?: string;
  quoted_price?: number;
  status: string;
  status_reason?: string;
  created_at: string;
  updated_at: string;
}

type TechJobDetailPageProps = {
  params: Promise<{ id: string }>;
};

const TechJobDetailPage = ({ params }: TechJobDetailPageProps) => {
  const [resolvedParams, setResolvedParams] = React.useState<{ id: string } | null>(null);

  React.useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  const router = useRouter();
  const { supabase, user } = useSupabase();
  const queryClient = useQueryClient();
  const ticketService = createTicketService(supabase);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'part_required', label: 'Part Required' },
    { value: 'ready', label: 'Ready' },
    { value: 'waiting_customer', label: 'Waiting for Customer' },
    { value: 'failed', label: 'Failed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const { data: ticket, isLoading, error, refetch } = useQuery({
    queryKey: ['tickets', 'detail', resolvedParams?.id, user?.id],
    queryFn: async () => {
      if (!user || !resolvedParams) {
        return null;
      }

      // Get profile to verify technician access
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile || (profile.role !== 'technician' && profile.role !== 'admin')) {
        router.push('/app');
        return null;
      }

      const ticketData = await ticketService.getById(resolvedParams.id);

      if (!ticketData) {
        throw new Error('Ticket not found');
      }

      // Verify this technician has access to this ticket
      if (profile.role === 'technician') {
        const { data: ticketRecord, error: ticketError } = await supabase
          .from('tickets')
          .select('assigned_technician_id')
          .eq('id', resolvedParams.id)
          .single();

        if (ticketError || !ticketRecord || ticketRecord.assigned_technician_id !== profile.id) {
          router.push('/tech/jobs');
          return null;
        }
      }

      return ticketData as TicketDetails;
    },
    enabled: !!user && !!resolvedParams?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Real-time subscription to update ticket data when status changes from other sources
  React.useEffect(() => {
    if (!user || !resolvedParams?.id) return;

    console.log('Setting up real-time subscription for tech ticket detail...');

    // Subscribe to real-time updates for this specific ticket
    const channel = supabase
      .channel(`realtime:tickets:id:${resolvedParams.id}`)  // Use consistent naming convention
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets',
          filter: `id=eq.${resolvedParams.id}`
        },
        (payload: any) => {
          console.log('Tech ticket detail: Realtime change detected, invalidating cache.', payload);
          queryClient.invalidateQueries({ queryKey: ['tickets', 'detail', resolvedParams?.id, user?.id] });
        }
      )
      .subscribe((status: any) => {
        console.log('Tech ticket detail channel subscription status:', status);
      });

    // Cleanup subscription on component unmount
    return () => {
      console.log('Unsubscribing from tech ticket detail channel...');
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient, user?.id, user, resolvedParams?.id]);

  // Mutation for updating ticket status
  const updateStatusMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: string }) => {
      return ticketService.updateStatus(ticketId, status);
    },
    onMutate: async ({ ticketId, status }) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['tickets', 'detail', ticketId, user?.id] });

      // Snapshot previous value
      const previousTicket = queryClient.getQueryData<TicketDetails>(['tickets', 'detail', ticketId, user?.id]);

      // Optimistically update the cache
      if (previousTicket) {
        queryClient.setQueryData<TicketDetails>(['tickets', 'detail', ticketId, user?.id], {
          ...previousTicket,
          status
        });
      }

      return { previousTicket };
    },
    onError: (err, { ticketId, status }, context) => {
      // Rollback on error
      if (context?.previousTicket) {
        queryClient.setQueryData(['tickets', 'detail', ticketId, user?.id], context.previousTicket);
      }
    },
    onSettled: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['tickets', 'detail', resolvedParams?.id, user?.id] });
    },
  });

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket || !resolvedParams) return;

    try {
      updateStatusMutation.mutate({ ticketId: ticket.id, status: newStatus });
      setIsStatusDropdownOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleWhatsApp = () => {
    if (!ticket) return;

    const message = WhatsAppTemplate.fillTemplate(ticket.status, {
      name: ticket.customer.name,
      ticket_id: ticket.id.substring(0, 8),
      eta: '2-3 days', // This would come from the ticket data
      part: 'Screen', // This would come from the ticket data
      reason: 'Technical issues' // This would come from the ticket data
    });

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${ticket.customer.phone_e164}?text=${encodedMessage}`, '_blank');
  };

  const handleCall = () => {
    if (!ticket) return;
    window.open(`tel:${ticket.customer.phone_e164}`, '_self');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
            <Card>
              <CardHeader>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error! </strong>
          <span className="block sm:inline">{error.message}</span>
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

  if (!ticket) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <div className="text-center py-10">
          <h2 className="text-xl font-semibold">Ticket not found</h2>
          <Button
            className="mt-4"
            onClick={() => router.push('/tech/jobs')}
          >
            Back to Jobs
          </Button>
        </div>
      </div>
    );
  }

  const currentStatusLabel = statusOptions.find(opt => opt.value === ticket.status)?.label || ticket.status;

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ticket Details</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ticket #{ticket.id.substring(0, 8)}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push('/tech/jobs')}
          >
            ← Back to Jobs
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-wrap justify-between items-start gap-4">
              <div>
                <CardTitle className="text-xl">{ticket.customer.name}</CardTitle>
                <CardDescription className="mt-1">
                  {ticket.customer.phone_e164} {ticket.customer.area && `• ${ticket.customer.area}`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <button
                    onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-haspopup="listbox"
                    aria-expanded={isStatusDropdownOpen}
                    disabled={updateStatusMutation.isPending}
                  >
                    <StatusPill status={ticket.status} />
                    {isStatusDropdownOpen ? (
                      <ChevronUp className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    )}
                  </button>

                  {isStatusDropdownOpen && (
                    <div
                      className="absolute right-0 mt-1 w-44 bg-white dark:bg-gray-800 shadow-lg rounded-md py-1 z-10 border border-gray-200 dark:border-gray-700"
                      role="listbox"
                    >
                      {statusOptions.map((option) => (
                        <button
                          key={option.value}
                          className={`block w-full text-left px-4 py-2 text-sm ${
                            option.value === ticket.status
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                          onClick={() => handleStatusChange(option.value)}
                          role="option"
                          aria-selected={option.value === ticket.status}
                          disabled={updateStatusMutation.isPending}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Device Information</h3>
                <p className="text-gray-900 dark:text-gray-100">
                  {ticket.device_category} {ticket.brand && `(${ticket.brand}`}{ticket.model && ` ${ticket.model}`}{ticket.brand && ')'}
                  {ticket.size_inches && `, ${ticket.size_inches}"`}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Created</h3>
                <p className="text-gray-900 dark:text-gray-100">
                  {new Date(ticket.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Issue Summary</h3>
              <p className="text-gray-900 dark:text-gray-100">
                {ticket.issue_summary}
              </p>
            </div>

            {ticket.issue_details && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Issue Details</h3>
                <p className="text-gray-900 dark:text-gray-100">
                  {ticket.issue_details}
                </p>
              </div>
            )}

            {ticket.quoted_price && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quoted Price</h3>
                <p className="text-gray-900 dark:text-gray-100">
                  ₹{ticket.quoted_price.toFixed(2)}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={handleWhatsApp}
                className="flex items-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={handleCall}
                className="flex items-center gap-2"
              >
                <Phone className="h-4 w-4" />
                Call
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TechJobDetailPage;