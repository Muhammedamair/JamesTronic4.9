'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/shared/supabase-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Phone,
  MapPin,
  Calendar,
  TrendingUp,
  Award,
  Star,
  Target
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createTicketService } from '@/lib/services/authenticated-service';
import { useTechnicianStore } from '@/lib/services/technician-store';
import { Ticket } from '@/lib/types/ticket';

export default function TechnicianDashboardPage() {
  const router = useRouter();
  const { supabase, user, userRole, isLoading: isAuthLoading } = useSupabase();
  const queryClient = useQueryClient();
  const [ticketService, setTicketService] = useState<any>(null);
  const { tickets = [], setTickets, error: storeError } = useTechnicianStore();

  // Initialize ticket service
  useEffect(() => {
    if (supabase && user) {
      const service = createTicketService(supabase);
      setTicketService(service);
    }
  }, [supabase, user]);

  // Fetch technician's profile ID first, then fetch assigned tickets
  const { data: fetchedTickets = [], isLoading: isLoadingTickets, error: fetchError } = useQuery<Ticket[]>({
    queryKey: ['tech-tickets', user?.id],
    queryFn: async () => {
      if (!ticketService || !user) return [];

      try {
        // Get the technician's profile ID
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          throw new Error(`Failed to fetch technician profile: ${profileError.message}`);
        }

        // Now fetch tickets assigned to this profile ID
        const { data, error: ticketsError } = await supabase
          .from('tickets')
          .select(`
            id, customer_id, assigned_technician_id, device_category, brand, model,
            issue_summary, status, created_at, updated_at,
            customers!inner (
              id, name, phone_e164, area
            )
          `)
          .eq('assigned_technician_id', profile.id) // Use profile ID, not user ID
          .order('created_at', { ascending: false });

        if (ticketsError) throw new Error(`Failed to load tickets: ${ticketsError.message}`);
        return data || [];
      } catch (error) {
        console.error('Error fetching tickets:', error);
        throw error;
      }
    },
    enabled: !!user && userRole === 'technician' && !!ticketService,
    staleTime: 30000, // 30 seconds before data is considered stale
  });

  // Update Zustand store when fetched tickets change
  // Removed to prevent conflicting state updates that could cause React error #185

  // Calculate metrics from state with null safety
  const today = new Date().toISOString().split('T')[0];
  const todayTickets = tickets.filter(ticket => ticket.created_at.startsWith(today));
  const pendingTickets = tickets.filter(ticket => ticket.status === 'pending' || ticket.status === 'New');
  const completedTickets = tickets.filter(ticket => ticket.status === 'completed' || ticket.status === 'Ready');
  const cancelledTickets = tickets.filter(ticket => ticket.status === 'cancelled');



  // Set up real-time subscription to ticket changes
  useEffect(() => {
    if (!user || userRole !== 'technician') return;

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

      // Subscribe to changes in tickets assigned to this specific technician
      subscription = supabase
        .channel(`tech_tickets_dashboard_${profile.id}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tickets',
            filter: `assigned_technician_id=eq.${profile.id}`
          },
          (payload: any) => {
            console.log('Realtime change detected for technician tickets:', payload);
            // Refetch data to ensure consistency
            queryClient.invalidateQueries({ queryKey: ['tech-tickets', user?.id] });
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
        <div className="max-w-6xl mx-auto py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Technician Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage your repair jobs</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="bg-white dark:bg-gray-800 shadow-md rounded-xl border-0">
                <CardContent className="p-6">
                  <div className="animate-pulse flex space-x-4">
                    <div className="rounded-full bg-gray-300 dark:bg-gray-700 h-12 w-12"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // This part will only be reached when auth is resolved and user is not a technician.
  // The middleware should have already redirected, but this is a client-side safeguard.
  if (userRole && userRole !== 'technician' && userRole !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Access Denied</CardTitle>
            <p className="text-gray-600 dark:text-gray-400">
              You do not have permission to view this page.
            </p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // This part will only be reached when auth is resolved and there is no user.
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Authentication Required</CardTitle>
            <p className="text-gray-600 dark:text-gray-400">
              Please log in to access this page.
            </p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-6xl mx-auto py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Technician Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your repair jobs</p>
        </motion.div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-white dark:bg-gray-800 shadow-md rounded-xl border-0 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Today's Jobs</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-white">{todayTickets.length}</p>
                  </div>
                  <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/50">
                    <Calendar className="h-6 w-6 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white dark:bg-gray-800 shadow-md rounded-xl border-0 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending Jobs</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-white">{pendingTickets.length}</p>
                  </div>
                  <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/50">
                    <Clock className="h-6 w-6 text-yellow-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white dark:bg-gray-800 shadow-md rounded-xl border-0 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Completed</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-white">{completedTickets.length}</p>
                  </div>
                  <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/50">
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white dark:bg-gray-800 shadow-md rounded-xl border-0 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Cancelled</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-white">{cancelledTickets.length}</p>
                  </div>
                  <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/50">
                    <XCircle className="h-6 w-6 text-red-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-8"
        >
          <Card className="bg-white dark:bg-gray-800 shadow-md rounded-xl border-0">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#5B3FFF]" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  variant="outline"
                  className="flex items-center gap-2 border-[#5B3FFF] text-[#5B3FFF] hover:bg-[#5B3FFF] hover:text-white"
                  onClick={() => router.push('/tech/jobs')}
                >
                  <Package className="h-4 w-4" />
                  View All Jobs
                </Button>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 border-[#5B3FFF] text-[#5B3FFF] hover:bg-[#5B3FFF] hover:text-white"
                >
                  <Star className="h-4 w-4" />
                  Mark Available
                </Button>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 border-[#5B3FFF] text-[#5B3FFF] hover:bg-[#5B3FFF] hover:text-white"
                >
                  <User className="h-4 w-4" />
                  Contact Admin
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Jobs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="bg-white dark:bg-gray-800 shadow-md rounded-xl border-0">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-[#5B3FFF]" />
                Recent Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {storeError ? (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                  <strong className="font-bold">Error! </strong>
                  <span className="block sm:inline">{storeError}</span>
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No jobs assigned</h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    You don't have any repair jobs assigned yet.
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
                      {tickets.slice(0, 5).map((ticket) => (
                        <motion.tr
                          key={ticket.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 bg-[#5B3FFF]/10 dark:bg-[#5B3FFF]/20 rounded-full flex items-center justify-center">
                                <User className="h-5 w-5 text-[#5B3FFF]" />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {ticket.customer?.name || 'N/A'}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                  <MapPin className="h-4 w-4" />
                                  {ticket.customer?.area || 'N/A'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {ticket.device_category} {ticket.brand} {ticket.model}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                            {ticket.issue_summary}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge
                              variant={ticket.status.toLowerCase() === 'completed' ? 'default' :
                                      ticket.status.toLowerCase() === 'pending' ? 'secondary' :
                                      'outline'}
                              className={ticket.status.toLowerCase() === 'completed' ? 'bg-green-500 hover:bg-green-600' :
                                         ticket.status.toLowerCase() === 'pending' ? 'bg-yellow-500 hover:bg-yellow-600' :
                                         'bg-blue-500 hover:bg-blue-600'}
                            >
                              {ticket.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <a
                                href={`tel:${ticket.customer?.phone_e164}`}
                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                Call
                              </a>
                              <a
                                href={`https://wa.me/${ticket.customer?.phone_e164.replace('+', '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                              >
                                WhatsApp
                              </a>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                  {tickets.length > 5 && (
                    <div className="mt-4 text-center">
                      <Button
                        variant="outline"
                        onClick={() => router.push('/tech/jobs')}
                        className="border-[#5B3FFF] text-[#5B3FFF] hover:bg-[#5B3FFF] hover:text-white"
                      >
                        View All Jobs
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <div className="mt-8 text-center text-gray-600 dark:text-gray-400">
          <p>
            As a technician, you are responsible for completing repair jobs.
            Please maintain timely service and proper handling of devices.
          </p>
        </div>
      </div>
    </div>
  );
}