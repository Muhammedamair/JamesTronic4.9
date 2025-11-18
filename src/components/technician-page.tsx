'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSupabase } from '@/components/supabase-provider';
import { createTicketService } from '@/lib/authenticated-service';
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
import { AlertCircle, Clock, CheckCircle, AlertTriangle, List } from 'lucide-react';

interface Technician {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
  created_at: string;
}

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
}

export default function TechnicianDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { supabase, user } = useSupabase();
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [technicianTickets, setTechnicianTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize services
  const ticketService = createTicketService(supabase);

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

        const transformedTickets = ticketData.map(ticket => ({
          ...ticket,
          customer: ticket.customers,
        }));
        setTechnicianTickets(transformedTickets);

      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load technician details');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up real-time subscription
    const channel = supabase
      .channel(`technician-tickets-${id}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'tickets',
          filter: `assigned_technician_id=eq.${id}`
        },
        (payload) => {
          console.log('Realtime update received for ticket:', payload.new);
          const updatedTicket = payload.new as Ticket;
          
          // We need to re-fetch the customer details as they are not in the payload
          const fetchCustomerForTicket = async (ticket: Ticket) => {
            const { data: customerData, error } = await supabase
              .from('customers')
              .select('*')
              .eq('id', ticket.customer_id)
              .single();
            
            if (error) {
              console.error('Error fetching customer for realtime update:', error);
              return { ...ticket, customer: null };
            }
            return { ...ticket, customer: customerData };
          };

          fetchCustomerForTicket(updatedTicket).then(ticketWithCustomer => {
            setTechnicianTickets(currentTickets =>
              currentTickets.map(t => t.id === ticketWithCustomer.id ? ticketWithCustomer : t)
            );
          });
        }
      )
      .subscribe();

    // Cleanup subscription on component unmount
    return () => {
      supabase.removeChannel(channel);
    };

  }, [supabase, user, id]);

  // Function to update ticket status
  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      await ticketService.updateStatus(ticketId, newStatus);
      
      // Update local state
      setTechnicianTickets(prev => 
        prev.map(ticket => 
          ticket.id === ticketId ? { ...ticket, status: newStatus } : ticket
        )
      );
      
      alert('Ticket status updated successfully!');
    } catch (err) {
      console.error('Error updating ticket status:', err);
      alert('Failed to update ticket status');
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