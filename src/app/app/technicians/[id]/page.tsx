'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useSupabase } from '@/components/shared/supabase-provider';
import { createTicketService } from '@/lib/services/authenticated-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, CheckCircle, AlertTriangle, List, UserX, UserCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Ticket } from '@/lib/types/ticket';

interface Technician {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
  created_at: string;
}

interface RawTicket {
  id: string;
  customer_id: string;
  assigned_technician_id: string | null;
  device_category: string;
  brand: string;
  model: string;
  issue_summary: string;
  status: string;
  created_at: string;
  customers: {
    id: string;
    name: string;
    phone_e164: string;
  };
}

export default function TechnicianDetailPage() {
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const { supabase, user } = useSupabase();
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [technicianTickets, setTechnicianTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  // Initialize services
  const ticketService = createTicketService(supabase);

  // Function to refetch tickets
  const refetchTickets = async () => {
    try {
      // Fetch tickets assigned to this technician
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select(`
          id, customer_id, assigned_technician_id, device_category, brand, model,
          issue_summary, status, created_at,
          customers!inner (id, name, phone_e164)
        `)
        .eq('assigned_technician_id', id)
        .order('created_at', { ascending: false });

      if (ticketError) throw ticketError;

      const transformedTickets = ticketData.map((ticket: RawTicket) => ({
        ...ticket,
        customer: ticket.customers,
      }));
      setTechnicianTickets(transformedTickets);
    } catch (err) {
      console.error('Error refetching tickets:', err);
      setError('Failed to refetch tickets');
    }
  };

  // Fetch technician details and their assigned tickets, and subscribe to real-time updates
  useEffect(() => {
    if (!user || !id) return;

    // Initial data fetch
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch technician details
        const { data: techData, error: techError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .single();

        if (techError) throw techError;
        if (techData) setTechnician(techData);

        await refetchTickets();

      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load technician details');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up real-time subscription with unique channel name to prevent conflicts
    const channelName = `admin-tech-detail-${id}-${Date.now()}-${Math.random()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
        },
        (payload: any) => {
          console.log('Technician Detail Page: Realtime change detected for tickets:', payload);

          // Check if this change affects the technician's tickets
          const newTicket = payload.new;
          const oldTicket = payload.old;

          // Check if ticket was related to this technician (either assigned or unassigned)
          const oldWasAssigned = oldTicket?.assigned_technician_id === id;
          const newIsAssigned = newTicket?.assigned_technician_id === id;

          // Update if: 1) ticket was assigned to this technician (so now unassigned), OR 2) ticket is now assigned to this technician
          if (oldWasAssigned || newIsAssigned) {
            console.log('Ticket assignment change detected for this technician, refetching');

            // Refetch tickets to ensure we have the latest data and proper customer info
            refetchTickets();

            // Also invalidate the technician's own view so they see the changes in real-time
            queryClient.invalidateQueries({ queryKey: ['tickets', 'technician', id] });
          }
        }
      )
      .subscribe((status: any, err: any) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to ${channelName}`);
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('Real-time channel error:', err);
        }
      });

    // Store the channel reference to avoid conflicts
    channelRef.current = channel;

    // Cleanup subscription on component unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };

  }, [supabase, user, id, queryClient]);

  // Function to update ticket status
  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      await ticketService.updateStatus(ticketId, newStatus);

      // Update local state immediately for responsiveness
      setTechnicianTickets(prev =>
        prev.map(ticket =>
          ticket.id === ticketId ? { ...ticket, status: newStatus } : ticket
        )
      );

      // Invalidate queries to ensure consistency across all views
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['tickets', 'technician', id] });

      alert('Ticket status updated successfully!');
    } catch (err) {
      console.error('Error updating ticket status:', err);
      alert('Failed to update ticket status');
    }
  };

  // Function to unassign a ticket - this now properly broadcasts to all affected views
  const unassignTicket = async (ticketId: string) => {
    try {
      // Use direct Supabase update to ensure proper real-time trigger
      const { data, error } = await supabase
        .from('tickets')
        .update({ assigned_technician_id: null })
        .eq('id', ticketId)
        .select()
        .single();

      if (error) throw error;

      // Update local state immediately
      setTechnicianTickets(prev =>
        prev.filter(ticket => ticket.id !== ticketId)
      );

      // Invalidate queries to trigger real-time updates for both admin and technician views
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['tickets', 'technician', id] });

      alert('Ticket unassigned successfully!');
    } catch (err) {
      console.error('Error unassigning ticket:', err);
      alert('Failed to unassign ticket');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="w-16 h-16 rounded-full border-4 border-gray-300 border-t-blue-500 animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error! </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  if (!technician) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <span><strong>Not Found! </strong>Technician not found</span>
          </div>
        </div>
      </div>
    );
  }

  // Calculate technician stats
  const completedTickets = technicianTickets.filter(t => t.status === 'ready').length;
  const inProgressTickets = technicianTickets.filter(t =>
    ['in_progress', 'part_required'].includes(t.status)
  ).length;
  const pendingTickets = technicianTickets.filter(t =>
    ['pending', 'waiting_customer'].includes(t.status)
  ).length;

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
      case 'part_required':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'pending':
      case 'waiting_customer':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{technician.full_name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Technician ID: {technician.id}
          </p>
        </div>
        <Badge variant="outline">{technician.role}</Badge>
      </div>

      {/* Technician Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Tickets</p>
                <p className="text-2xl font-bold">{technicianTickets.length}</p>
              </div>
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                <List className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Completed</p>
                <p className="text-2xl font-bold text-green-600">{completedTickets}</p>
              </div>
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">{inProgressTickets + pendingTickets}</p>
              </div>
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-full">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Technician's Tickets */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {technicianTickets.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No tickets assigned to this technician</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {technicianTickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{ticket.customer?.name || 'N/A'}</div>
                        <div className="text-xs text-gray-500">{ticket.customer?.phone_e164}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {ticket.device_category} {ticket.brand} {ticket.model}
                    </TableCell>
                    <TableCell>{ticket.issue_summary}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(ticket.status)}
                        <Badge variant={ticket.status === 'ready' ? 'default' : 'secondary'}>
                          {ticket.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newStatus = prompt(
                              'Enter new status (pending, in_progress, part_required, ready, waiting_customer, failed, cancelled):',
                              ticket.status
                            );
                            if (newStatus) {
                              updateTicketStatus(ticket.id, newStatus);
                            }
                          }}
                        >
                          Update Status
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unassignTicket(ticket.id)}
                          className="flex items-center gap-1"
                        >
                          <UserX className="h-4 w-4" />
                          Unassign
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}