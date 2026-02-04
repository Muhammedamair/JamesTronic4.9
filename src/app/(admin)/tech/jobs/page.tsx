'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/shared/supabase-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Package,
  Phone,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  MoreVertical,
  ChevronRight,
  Play,
  Pause,
  Check,
  PackageOpen,
  AlertCircle,
  Camera,
  Wallet,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createTicketService } from '@/lib/services/authenticated-service';
import { WhatsAppTemplate } from '@/lib/utils/whatsapp-template';
import { useTechnicianStore } from '@/lib/services/technician-store';
import { Ticket } from '@/lib/types/ticket';

// Define the job detail type
interface JobDetail {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  deviceCategory: string;
  deviceBrand: string;
  deviceModel: string;
  issueSummary: string;
  issueDetails?: string;
  status: string;
  statusReason?: string;
  createdAt: string;
  updatedAt: string;
  area?: string;
}

// Status timeline step
interface TimelineStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  icon: React.ReactNode;
}

export default function TechnicianJobsPage() {
  const router = useRouter();
  const { supabase, user, userRole, isLoading: isAuthLoading } = useSupabase();
  const queryClient = useQueryClient();
  const { tickets = [], activeTab = 'upcoming', loading, error, setTickets, setActiveTab, setLoading, setError, setSelectedTicket } = useTechnicianStore();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedJob, setSelectedJobRaw] = useState<JobDetail | null>(null);
  const subscriptionRef = useRef<any>(null);

  // Function to update selected job
  const setSelectedJob = (job: JobDetail | null) => {
    setSelectedJobRaw(job);
  };

  // Fetch technician's profile ID first, then fetch assigned tickets
  const { data: fetchedTickets = [], isLoading: isLoadingTickets, error: fetchError } = useQuery<Ticket[]>({
    queryKey: ['tickets', 'technician', user?.id],
    queryFn: async () => {
      if (!supabase || !user) return [];

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

        console.log('Fetched profile ID:', profile.id);

        // Now fetch tickets assigned to this profile ID
        const { data, error: ticketsError } = await supabase
          .from('tickets')
          .select(`
            id, customer_id, assigned_technician_id, device_category, brand, model,
            issue_summary, status, status_reason, created_at, updated_at,
            customers!inner (
              id, name, phone_e164, area
            )
          `)
          .eq('assigned_technician_id', profile.id) // Use profile ID, not user ID
          .order('created_at', { ascending: false });

        if (ticketsError) throw new Error(`Failed to load tickets: ${ticketsError.message}`);
        console.log(`Fetched ${data?.length || 0} tickets for technician profile ID: ${profile.id}`);
        return data || [];
      } catch (error) {
        console.error('Error fetching tickets:', error);
        throw error;
      }
    },
    enabled: !!user && userRole === 'technician',
    staleTime: 0, // Data is considered stale immediately for real-time updates
    refetchInterval: 30000, // 30-second polling interval as fallback
    refetchOnWindowFocus: true, // Refresh when user returns to tab
  });

  // Handle success and update the Zustand store with the fetched tickets
  useEffect(() => {
    if (!isLoadingTickets && fetchedTickets) {
      console.log(`Updating store with ${fetchedTickets.length} tickets`);
      setTickets(fetchedTickets);
    }
  }, [isLoadingTickets, fetchedTickets, setTickets]);

  // Update loading and error states
  useEffect(() => {
    setLoading(isLoadingTickets);
    if (fetchError) {
      setError((fetchError as Error).message);
    }
  }, [isLoadingTickets, fetchError, setLoading, setError]);

  // Ensure that the store's tickets are always in sync with the query's data
  // Removed the potential conflicting useEffect that was causing state updates during render

  // Filter tickets based on active tab
  const filteredTickets = tickets.filter(ticket => {
    const normalizedStatus = ticket.status.toLowerCase();
    switch (activeTab) {
      case 'upcoming':
        return normalizedStatus === 'pending' || normalizedStatus === 'new';
      case 'in-progress':
        return normalizedStatus === 'in_progress';
      case 'completed':
        return normalizedStatus === 'completed' || normalizedStatus === 'ready';
      case 'cancelled':
        return normalizedStatus === 'cancelled';
      case 'paused':
        return normalizedStatus === 'paused';
      default:
        return true;
    }
  });

  // Set up real-time subscription to ticket changes
  useEffect(() => {
    if (!user || userRole !== 'technician') return;

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

      console.log('Setting up subscription for technician ID:', profile.id);

      // Cleanup any existing subscription
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }

      // Subscribe to ALL ticket changes to catch both assignments and unassignments
      // We're specifically listening for changes where the assigned_technician_id changes
      const subscription = supabase
        .channel(`tech_tickets_all_${profile.id}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tickets'
          },
          (payload: any) => {
            console.log('Realtime change detected for all tickets:', payload);
            const { eventType, oldRecord, newRecord } = payload;

            // Check if this change affects the current technician
            const techId = profile.id;
            const wasAssignedToTech = oldRecord?.assigned_technician_id === techId;
            const isNowAssignedToTech = newRecord?.assigned_technician_id === techId;

            // Handle unassignment: ticket was assigned to this tech but now isn't
            if (wasAssignedToTech && !isNowAssignedToTech) {
              console.log('Ticket unassigned from this technician:', newRecord?.id);
              // First, invalidate the query cache
              queryClient.invalidateQueries({ queryKey: ['tickets', 'technician', user?.id] });

              // Force a refetch of the query to update the technician's view
              setTimeout(() => {
                queryClient.refetchQueries({ queryKey: ['tickets', 'technician', user?.id] });

                // On mobile devices, force a state update to ensure UI re-renders
                if (typeof window !== 'undefined' && window.innerWidth <= 768) {
                  // Trigger a re-render by updating the loading state
                  setLoading(true);
                  setTimeout(() => {
                    setLoading(false);
                  }, 50);
                }
              }, 100);
            }
            // Handle new assignment: ticket wasn't assigned to this tech but now is
            else if (!wasAssignedToTech && isNowAssignedToTech) {
              console.log('Ticket newly assigned to this technician:', newRecord?.id);
              // First, invalidate the query cache
              queryClient.invalidateQueries({ queryKey: ['tickets', 'technician', user?.id] });

              // Force a refetch of the query to include this new ticket in the technician's view
              setTimeout(() => {
                queryClient.refetchQueries({ queryKey: ['tickets', 'technician', user?.id] });

                // On mobile devices, force a state update to ensure UI re-renders
                if (typeof window !== 'undefined' && window.innerWidth <= 768) {
                  // Trigger a re-render by updating the loading state
                  setLoading(true);
                  setTimeout(() => {
                    setLoading(false);
                  }, 50);
                }
              }, 100);
            }
            // For other updates (status changes, etc.) to tickets that are (or were) assigned to this tech
            else if (isNowAssignedToTech || wasAssignedToTech) {
              console.log('Ticket affecting this technician was updated:', newRecord?.id);
              // First, invalidate the query cache
              queryClient.invalidateQueries({ queryKey: ['tickets', 'technician', user?.id] });

              // Force a refetch of the query to refetch updated ticket
              setTimeout(() => {
                queryClient.refetchQueries({ queryKey: ['tickets', 'technician', user?.id] });

                // On mobile devices, force a state update to ensure UI re-renders
                if (typeof window !== 'undefined' && window.innerWidth <= 768) {
                  // Trigger a re-render by updating the loading state
                  setLoading(true);
                  setTimeout(() => {
                    setLoading(false);
                  }, 50);
                }
              }, 100);
            }
          }
        )
        .subscribe();

      // Store reference for cleanup
      subscriptionRef.current = subscription;
    };

    setupSubscription();

    // Cleanup function
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [supabase, user, userRole, queryClient, setLoading]);

  // Function to open job detail
  const openJobDetail = (ticket: Ticket) => {
    const jobDetail: JobDetail = {
      id: ticket.id,
      customerName: ticket.customer?.name || '',
      customerPhone: ticket.customer?.phone_e164 || '',
      customerAddress: ticket.customer?.area || '',
      deviceCategory: ticket.device_category,
      deviceBrand: ticket.brand || '',
      deviceModel: ticket.model || '',
      issueSummary: ticket.issue_summary || '',
      issueDetails: ticket.issue_summary || '',
      status: ticket.status,
      statusReason: ticket.status_reason || '',
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
      area: ticket.customer?.area
    };
    console.log('Opening job detail for ticket:', ticket.id);
    setSelectedJob(jobDetail);
    setIsDetailOpen(true);
  };

  // Function to close job detail
  const closeJobDetail = () => {
    setIsDetailOpen(false);
    setTimeout(() => setSelectedJob(null), 300); // Delay to allow animation to finish
  };

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
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Your Jobs</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage your repair assignments</p>
          </motion.div>

          <div className="animate-pulse mb-8">
            <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded-lg w-64 mx-auto"></div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="bg-white dark:bg-gray-800 shadow-md rounded-xl border-0">
                <CardContent className="p-6">
                  <div className="animate-pulse flex space-x-4">
                    <div className="rounded-full bg-gray-300 dark:bg-gray-700 h-12 w-12"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
                      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
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
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Your Jobs</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your repair assignments</p>
        </motion.div>

        {/* Tabs */}
        <div className="flex overflow-x-auto pb-2 mb-6">
          {[
            { id: 'upcoming', label: 'Upcoming', icon: Clock },
            { id: 'in-progress', label: 'In Progress', icon: Play },
            { id: 'paused', label: 'Paused', icon: Pause },
            { id: 'completed', label: 'Completed', icon: CheckCircle },
            { id: 'cancelled', label: 'Cancelled', icon: XCircle }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg mx-1 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#5B3FFF] text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Job List */}
        <div className="space-y-4">
          {error ? (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <strong className="font-bold">Error! </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                {activeTab === 'upcoming' && 'No upcoming jobs'}
                {activeTab === 'in-progress' && 'No jobs in progress'}
                {activeTab === 'paused' && 'No paused jobs'}
                {activeTab === 'completed' && 'No completed jobs'}
                {activeTab === 'cancelled' && 'No cancelled jobs'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {activeTab === 'upcoming' && 'You have no upcoming repair jobs assigned.'}
                {activeTab === 'in-progress' && 'You have no repair jobs currently in progress.'}
                {activeTab === 'paused' && 'You have no paused repair jobs.'}
                {activeTab === 'completed' && 'You have no completed repair jobs yet.'}
                {activeTab === 'cancelled' && 'You have no cancelled repair jobs.'}
              </p>
            </div>
          ) : (
            filteredTickets.map((ticket) => (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                whileHover={{ y: -2 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer"
                onClick={() => openJobDetail(ticket)}
              >
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <div className="bg-[#5B3FFF]/10 dark:bg-[#5B3FFF]/20 w-12 h-12 rounded-full flex items-center justify-center">
                          <User className="h-6 w-6 text-[#5B3FFF]" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-800 dark:text-white truncate">
                            {ticket.customer?.name || 'N/A'}
                          </h3>
                          <Badge
                            variant={ticket.status.toLowerCase() === 'completed' ? 'default' :
                                    ticket.status.toLowerCase() === 'pending' ? 'secondary' :
                                    ticket.status.toLowerCase() === 'in_progress' ? 'default' :
                                    'outline'}
                            className={`
                              ${ticket.status.toLowerCase() === 'completed' ? 'bg-green-500 hover:bg-green-600' :
                                ticket.status.toLowerCase() === 'pending' ? 'bg-yellow-500 hover:bg-yellow-600' :
                                ticket.status.toLowerCase() === 'in_progress' ? 'bg-blue-500 hover:bg-blue-600' :
                                ticket.status.toLowerCase() === 'paused' ? 'bg-orange-500 hover:bg-orange-600' :
                                'bg-gray-500 hover:bg-gray-600'}
                            `}
                          >
                            {ticket.status}
                          </Badge>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                          {ticket.device_category} {ticket.brand} {ticket.model}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">
                          {ticket.issue_summary}
                        </p>
                        <div className="flex items-center mt-3 text-sm text-gray-500 dark:text-gray-400">
                          <MapPin className="h-4 w-4 mr-1" />
                          {ticket.customer?.area || 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`tel:${ticket.customer?.phone_e164}`);
                        }}
                        className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          const template = WhatsAppTemplate.fillTemplate(
                            ticket.status.toLowerCase(),
                            {
                              name: ticket.customer?.name || 'Customer',
                              ticket_id: ticket.id,
                              eta: '24 hours',
                              reason: ticket.status_reason || 'N/A'
                            }
                          );
                          router.push(`https://wa.me/${ticket.customer?.phone_e164.replace('+', '')}?text=${encodeURIComponent(template)}`);
                        }}
                        className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Package className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </motion.div>
            ))
          )}
        </div>

        {/* Job Detail Drawer */}
        <AnimatePresence>
          {isDetailOpen && selectedJob && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex justify-end"
              onClick={closeJobDetail}
            >
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'tween', duration: 0.3 }}
                className="w-full max-w-md bg-white dark:bg-gray-900 h-full overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {selectedJob && (
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold text-gray-800 dark:text-white">Job Details</h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={closeJobDetail}
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        <XCircle className="h-6 w-6" />
                      </Button>
                    </div>

                    {/* Status Tag */}
                    <div className="mb-6">
                      <Badge
                        variant={selectedJob.status.toLowerCase() === 'completed' ? 'default' :
                                selectedJob.status.toLowerCase() === 'pending' ? 'secondary' :
                                selectedJob.status.toLowerCase() === 'in_progress' ? 'default' :
                                'outline'}
                        className={`
                          ${selectedJob.status.toLowerCase() === 'completed' ? 'bg-green-500 hover:bg-green-600' :
                            selectedJob.status.toLowerCase() === 'pending' ? 'bg-yellow-500 hover:bg-yellow-600' :
                            selectedJob.status.toLowerCase() === 'in_progress' ? 'bg-blue-500 hover:bg-blue-600' :
                            selectedJob.status.toLowerCase() === 'paused' ? 'bg-orange-500 hover:bg-orange-600' :
                            'bg-gray-500 hover:bg-gray-600'}
                          text-white
                        `}
                      >
                        {selectedJob.status}
                      </Badge>
                    </div>

                    {/* Customer Info */}
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">Customer Information</h3>
                      <div className="space-y-3">
                        <div className="flex items-center">
                          <User className="h-5 w-5 text-[#5B3FFF] mr-3" />
                          <div>
                            <p className="font-medium text-gray-700 dark:text-gray-300">{selectedJob.customerName}</p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <Phone className="h-5 w-5 text-[#5B3FFF] mr-3" />
                          <div>
                            <a
                              href={`tel:${selectedJob.customerPhone}`}
                              className="text-blue-600 hover:underline"
                            >
                              {selectedJob.customerPhone}
                            </a>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <MapPin className="h-5 w-5 text-[#5B3FFF] mr-3" />
                          <div>
                            <p className="text-gray-700 dark:text-gray-300">{selectedJob.customerAddress}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Device Info */}
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">Device Information</h3>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Category</p>
                          <p className="text-gray-700 dark:text-gray-300">{selectedJob.deviceCategory}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Brand</p>
                          <p className="text-gray-700 dark:text-gray-300">{selectedJob.deviceBrand}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Model</p>
                          <p className="text-gray-700 dark:text-gray-300">{selectedJob.deviceModel}</p>
                        </div>
                      </div>
                    </div>

                    {/* Issue Details */}
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">Issue Details</h3>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Summary</p>
                        <p className="text-gray-700 dark:text-gray-300">{selectedJob.issueSummary}</p>
                      </div>
                      {selectedJob.issueDetails && (
                        <div className="mt-3">
                          <p className="text-sm text-gray-500 dark:text-gray-400">Details</p>
                          <p className="text-gray-700 dark:text-gray-300">{selectedJob.issueDetails}</p>
                        </div>
                      )}
                    </div>

                    {/* 4-Step Timeline */}
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Repair Timeline</h3>
                      <div className="space-y-4">
                        {[
                          { id: 1, title: 'Before Photos', description: 'Capture device condition', icon: <Camera className="h-5 w-5" /> },
                          { id: 2, title: 'Quote', description: 'Provide repair estimate', icon: <Wallet className="h-5 w-5" /> },
                          { id: 3, title: 'After Photos', description: 'Show completed work', icon: <Camera className="h-5 w-5" /> },
                          { id: 4, title: 'Payment', description: 'Collect payment', icon: <CreditCard className="h-5 w-5" /> }
                        ].map((step, index) => (
                          <div key={step.id} className="flex items-start">
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                              index < 2 ? 'bg-green-500 text-white' :
                              index === 2 ? 'bg-blue-500 text-white' :
                              'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-300'
                            }`}>
                              {index < 2 ? <Check className="h-4 w-4" /> : step.icon}
                            </div>
                            <div className="ml-3">
                              <h4 className="font-medium text-gray-800 dark:text-white">{step.title}</h4>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{step.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="sticky bottom-0 bg-white dark:bg-gray-900 pt-4 border-t border-gray-200 dark:border-gray-800">
                      <Button
                        className={`w-full py-6 text-lg rounded-xl ${
                          selectedJob.status === 'in_progress'
                            ? 'bg-orange-500 hover:bg-orange-600'
                            : selectedJob.status === 'completed'
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-[#5B3FFF] hover:bg-[#4a32cc]'
                        }`}
                        disabled={selectedJob.status === 'completed'}
                      >
                        {selectedJob.status === 'in_progress' ? 'Pause Job' :
                         selectedJob.status === 'completed' ? 'Job Complete' :
                         'Start Repair'}
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}