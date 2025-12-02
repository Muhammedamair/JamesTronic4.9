'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/shared/supabase-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, MapPin, Package, Phone } from 'lucide-react';

interface Ticket {
  id: string;
  customer_id: string;
  assigned_transporter_id: string | null;
  assigned_technician_id: string | null;
  device_category: string;
  brand: string;
  model: string;
  issue_summary: string;
  status: string;
  created_at: string;
  updated_at: string;
  customers: {
    id: string;
    name: string;
    phone_e164: string;
    area: string; // Location
  } | null;
}

export default function TransporterPortalPage() {
  const router = useRouter();
  const { supabase, user, userRole, isLoading: isAuthLoading } = useSupabase();
  const queryClient = useQueryClient();

  // Fetch transporter's profile ID first, then fetch assigned tickets
  const { data: assignedTickets = [], isLoading: isLoadingTickets, error, refetch } = useQuery<Ticket[]>({
    queryKey: ['transporter-tickets', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');
      // First, get the transporter's profile ID
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        throw new Error(`Failed to fetch transporter profile: ${profileError.message}`);
      }

      // Now fetch tickets assigned to this profile ID
      const { data, error: ticketsError } = await supabase
        .from('tickets')
        .select(`
          id, customer_id, assigned_transporter_id, assigned_technician_id, device_category, brand, model,
          issue_summary, status, created_at, updated_at,
          customers (id, name, phone_e164, area)
        `)
        .eq('assigned_transporter_id', profile.id) // Use profile ID, not user ID
        .order('created_at', { ascending: false });

      if (ticketsError) throw new Error(`Failed to load tickets: ${ticketsError.message}`);
      return data || [];
    },
    enabled: !!user && userRole === 'transporter',
    staleTime: 30000, // 30 seconds before data is considered stale
  });

  // Set up real-time subscription to ticket changes
  useEffect(() => {
    if (!user || userRole !== 'transporter') return;

    let subscription: any;

    const setupSubscription = async () => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile for subscription:', profileError);
        return;
      }

      // Subscribe to changes in tickets assigned to this specific transporter
      subscription = supabase
        .channel(`realtime:transporter-tickets-${profile.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tickets',
            filter: `assigned_transporter_id=eq.${profile.id}`
          },
          (payload: any) => {
            console.log('Realtime change detected for transporter tickets:', payload);
            // Refetch data to ensure consistency
            queryClient.invalidateQueries({ queryKey: ['transporter-tickets', user?.id] });
          }
        )
        .subscribe();
    };

    setupSubscription();

    // Cleanup function
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [supabase, user, userRole, queryClient]);

  const isLoading = isAuthLoading || isLoadingTickets;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-4xl mx-auto py-8">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-gray-800 dark:text-white">
                Transporter Dashboard
              </CardTitle>
              <CardDescription className="text-lg text-gray-600 dark:text-gray-300">
                Manage device pickups and deliveries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full border-4 border-gray-300 border-t-blue-500 animate-spin mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // This part will only be reached when auth is resolved and user is not a transporter.
  // The middleware should have already redirected, but this is a client-side safeguard.
  if (userRole && userRole !== 'transporter' && userRole !== 'admin') {
    // router.push('/dashboard'); // This can cause a flash. Better to show an access denied message.
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Access Denied</CardTitle>
            <CardDescription>
              You do not have permission to view this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // This part will only be reached when auth is resolved and there is no user.
  if (!user) {
    // router.push('/login');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Authentication Required</CardTitle>
            <CardDescription>
              Please log in to access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-6xl mx-auto py-8">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-gray-800 dark:text-white">
              Transporter Dashboard
            </CardTitle>
            <CardDescription className="text-lg text-gray-600 dark:text-gray-300">
              Manage device pickups and deliveries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-8">
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Welcome to the transporter panel. Handle device pickups and deliveries.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 mb-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Pickups</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">View assigned pickup requests</p>
                  <Button
                    onClick={() => document.getElementById('assigned-tickets')?.scrollIntoView({ behavior: 'smooth' })}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    View Assigned ({assignedTickets.length})
                  </Button>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Deliveries</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">View assigned delivery requests</p>
                  <Button
                    onClick={() => document.getElementById('assigned-tickets')?.scrollIntoView({ behavior: 'smooth' })}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    View Assigned ({assignedTickets.length})
                  </Button>
                </div>
              </div>
            </div>

            {/* Assigned Tickets Section */}
            <div id="assigned-tickets">
              <CardHeader>
                <CardTitle className="text-xl">Your Assigned Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                {error ? (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <strong className="font-bold">Error! </strong>
                    <span className="block sm:inline">{(error as Error).message}</span>
                  </div>
                ) : assignedTickets.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No assigned tasks</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      You don't have any pickup or delivery tasks assigned yet.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Customer
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Location
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Device
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Issue
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {assignedTickets.map((ticket) => (
                          <tr key={ticket.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                  <User className="h-5 w-5 text-blue-600" />
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                                    {ticket.customers?.name || 'N/A'}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                    <Phone className="h-4 w-4" />
                                    {ticket.customers?.phone_e164}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {ticket.customers?.area || 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {ticket.device_category} {ticket.brand} {ticket.model}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                              {ticket.issue_summary}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge variant={ticket.status === 'ready' ? 'default' : 'secondary'}>
                                {ticket.status}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-2">
                                <a
                                  href={`tel:${ticket.customers?.phone_e164}`}
                                  className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                  Call
                                </a>
                                <a
                                  href={`https://wa.me/${ticket.customers?.phone_e164.replace('+', '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                >
                                  WhatsApp
                                </a>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </div>

            <div className="mt-8 text-center text-gray-600 dark:text-gray-400">
              <p>
                As a transporter, you are responsible for picking up and delivering devices
                to customers and technicians. Please maintain timely service and proper handling.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}