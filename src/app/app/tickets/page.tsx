'use client';

import { useState, useEffect, useRef } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { createTicketService, TicketWithCustomer } from '@/lib/authenticated-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Filter, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Ticket {
  id: string;
  customer_id: string;
  assigned_technician_id: string | null;
  device_category: string;
  brand: string;
  model: string;
  issue_summary: string;
  status: string;
  created_at: string;
  customer: {
    name: string;
    phone_e164: string;
  } | null;
  assigned_technician: {
    full_name: string;
  } | null;
}

export default function TicketsPage() {
  const { supabase, user, userRole } = useSupabase();
  const queryClient = useQueryClient();
  const router = useRouter();
  const ticketService = createTicketService(supabase);
  const channelRef = useRef<any>(null); // Use ref to store channel reference

  // Fetch all tickets
  const { data: tickets = [], isLoading, error, refetch } = useQuery({
    queryKey: ['tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          id, customer_id, assigned_technician_id, device_category, brand, model,
          issue_summary, status, created_at,
          customers (id, name, phone_e164),
          profiles!assigned_technician_id (id, full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw new Error(`Failed to load tickets: ${error.message}`);

      // Transform data to match our interface expectations
      return data.map(ticket => ({
        ...ticket,
        customer: ticket.customers,
        assigned_technician: ticket.profiles
      }));
    },
    enabled: !!user,
    refetchOnWindowFocus: true,
    staleTime: 60 * 1000, // 1 minute
  });

  // Real-time subscription for all tickets
  useEffect(() => {
    if (!user) return;

    // Create unique channel name to prevent binding conflicts
    const channelName = `realtime:tickets:admin-${Date.now()}-${Math.random()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
        },
        (payload) => {
          console.log('Main Tickets Page: Realtime change detected for ticket', payload);
          
          // Check the old and new states to see if this affects any technician's view
          const newTicket = payload.new;
          const oldTicket = payload.old;
          
          // Get the technician IDs that need to have their queries invalidated
          const affectedTechIds = new Set();
          
          // Add the old technician if ticket was assigned to them (for unassignment)
          if (oldTicket?.assigned_technician_id) {
            affectedTechIds.add(oldTicket.assigned_technician_id);
          }
          
          // Add the new technician if ticket is now assigned to them (for assignment)
          if (newTicket?.assigned_technician_id) {
            affectedTechIds.add(newTicket.assigned_technician_id);
          }
          
          // Invalidate the main tickets query
          queryClient.invalidateQueries({ queryKey: ['tickets'] });
          
          // Invalidate each affected technician's specific query
          affectedTechIds.forEach(techId => {
            queryClient.invalidateQueries({ queryKey: ['tickets', 'technician', techId] });
          });
        }
      )
      .subscribe();

    // Store channel reference to prevent binding conflicts
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [supabase, queryClient, user]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ready':
        return 'default';
      case 'in_progress':
      case 'part_required':
        return 'secondary';
      case 'cancelled':
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getTechnicianName = (techId: string | null) => {
    if (!techId) return 'Unassigned';
    const ticket = tickets.find(t => t.id);
    if (ticket?.assigned_technician) {
      return ticket.assigned_technician.full_name;
    }
    return 'Unknown Technician';
  };

  if (isLoading) {
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
          <span className="block sm:inline">{(error as Error).message}</span>
          <Button
            onClick={() => refetch()}
            className="mt-2"
            variant="secondary"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Service Tickets</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage all service tickets in the system
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/app/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Ticket
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Tickets List</CardTitle>
            <div className="flex space-x-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search tickets..."
                  className="pl-8 pr-4 py-2 border rounded-md w-full sm:w-64"
                />
              </div>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
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
                    <Badge variant={getStatusBadgeVariant(ticket.status)}>
                      {ticket.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {getTechnicianName(ticket.assigned_technician_id)}
                  </TableCell>
                  <TableCell>
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/app/tickets/${ticket.id}`)}
                      >
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/app/technicians/${ticket.assigned_technician_id}`)}
                        disabled={!ticket.assigned_technician_id}
                      >
                        Tech Profile
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}