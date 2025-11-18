'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, Clock, Check, X } from 'lucide-react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';

interface Transporter {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
  created_at: string;
}

interface PendingUser {
  id: string;
  user_id: string;
  full_name: string;
  category_id: string | null;
  requested_role: string;
  status: string;
  created_at: string;
  category_name?: string;
}

interface Ticket {
  id: string;
  customer_id: string;
  assigned_technician_id: string | null;
  assigned_transporter_id: string | null; // Add this for transporter assignments
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
    area: string; // For location
  } | null;
}

export default function TransporterManagementPage() {
  const { supabase, user } = useSupabase();
  const queryClient = useQueryClient();

  // Fetch user role to determine if user can see pending approvals
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!error && profile) {
        setUserRole(profile.role);
      } else {
        setUserRole(null);
      }
    };

    fetchUserRole();
  }, [user, supabase]);

  // Fetch transporters using TanStack Query
  const { data: transporters = [], isLoading: isLoadingTransporters } = useQuery<Transporter[]>({
    queryKey: ['transporters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'transporter')
        .order('full_name', { ascending: true });
      if (error) throw new Error(`Failed to load transporters: ${error.message}`);
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch pending transporter users (only for admin users)
  const { data: pendingUsers = [], isLoading: isLoadingPending } = useQuery<PendingUser[]>({
    queryKey: ['pending-transporters'],
    queryFn: async () => {
      const { data: pendingData, error: pendingError } = await supabase
        .from('pending_technicians')
        .select('*')
        .eq('status', 'pending')
        .eq('requested_role', 'transporter'); // Only fetch transporter registrations

      if (pendingError) throw pendingError;

      return pendingData || [];
    },
    enabled: !!user && userRole === 'admin', // Only enable for admin users
  });

  // Fetch all tickets using TanStack Query
  const { data: allTickets = [], isLoading: isLoadingTickets, error } = useQuery<Ticket[]>({
    queryKey: ['tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          id, customer_id, assigned_technician_id, assigned_transporter_id, device_category, brand, model,
          issue_summary, status, created_at,
          customers (id, name, phone_e164, area)
        `)
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Failed to load tickets: ${error.message}`);
      return data || [];
    },
    enabled: !!user,
  });

  // Mutation for assigning a ticket to a transporter
  const assignTransporterMutation = useMutation({
    mutationFn: ({ ticketId, transporterId }: { ticketId: string; transporterId: string }) =>
      supabase
        .from('tickets')
        .update({ assigned_transporter_id: transporterId })
        .eq('id', ticketId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({
        title: 'Success',
        description: 'Ticket assigned to transporter successfully!',
      });
    },
    onError: (err) => {
      console.error('Error assigning transporter:', err);
      toast({
        title: 'Error',
        description: 'Failed to assign transporter to ticket',
        variant: 'error',
      });
    },
  });

  // Mutation for unassigning a transporter
  const unassignTransporterMutation = useMutation({
    mutationFn: (ticketId: string) =>
      supabase
        .from('tickets')
        .update({ assigned_transporter_id: null })
        .eq('id', ticketId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({
        title: 'Success',
        description: 'Transporter unassigned successfully!',
      });
    },
    onError: (err) => {
      console.error('Error unassigning transporter:', err);
      toast({
        title: 'Error',
        description: 'Failed to unassign transporter',
        variant: 'error',
      });
    },
  });

  // Mutation for approving a transporter user
  const approveTransporterMutation = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string, roleId: string }) => {
      // Get pending user details to know their requested role
      const { data: pendingUser, error: fetchError } = await supabase
        .from('pending_technicians')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (fetchError) throw fetchError;

      // Check if profile already exists for this user
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      // Determine the role to use based on the requested role
      let roleToUse = pendingUser.requested_role;

      // Validate the role is one of the allowed values in the database
      if (!['admin', 'staff', 'technician', 'transporter'].includes(roleToUse)) {
        roleToUse = 'staff'; // default fallback
      }

      if (existingProfile) {
        // Profile already exists, just update the role
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: roleToUse })
          .eq('user_id', userId);

        if (updateError) throw updateError;
      } else {
        // Create new profile for the user
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: userId,
            full_name: pendingUser.full_name,
            role: roleToUse
          });

        if (profileError) throw profileError;
      }

      // Update pending status to approved
      const { error: updateError } = await supabase
        .from('pending_technicians')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-transporters'] });
      queryClient.invalidateQueries({ queryKey: ['transporters'] });
      toast({
        title: 'Success',
        description: 'Transporter approved successfully!',
      });
    },
    onError: (err) => {
      console.error('Error approving transporter:', err);
      toast({
        title: 'Error',
        description: 'Failed to approve transporter',
        variant: 'error',
      });
    },
  });

  // Mutation for rejecting a transporter user
  const rejectTransporterMutation = useMutation({
    mutationFn: (userId: string) =>
      supabase
        .from('pending_technicians')
        .update({ status: 'rejected' })
        .eq('user_id', userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-transporters'] });
      toast({
        title: 'Success',
        description: 'Transporter rejected successfully!',
      });
    },
    onError: (err) => {
      console.error('Error rejecting transporter:', err);
      toast({
        title: 'Error',
        description: 'Failed to reject transporter',
        variant: 'error',
      });
    },
  });

  const isLoading = isLoadingTransporters || isLoadingTickets || isLoadingPending;

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
        </div>
      </div>
    );
  }

  const unassignedTickets = allTickets.filter(ticket => !ticket.assigned_transporter_id);

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Transporter Management</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage transporters and delivery tasks (Transporters: {transporters.length}, Pending: {pendingUsers.length})
        </p>
      </div>

      {/* Pending Transporter Approvals Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Transporter Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingUsers.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No pending transporter approvals</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role Requested</TableHead>
                  <TableHead>Registration Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.requested_role}</Badge>
                    </TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={() => approveTransporterMutation.mutate({ userId: user.user_id, roleId: user.id })}
                          variant="default"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => rejectTransporterMutation.mutate(user.user_id)}
                          variant="destructive"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Transporters List */}
        <Card>
          <CardHeader>
            <CardTitle>Transporters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transporters.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-500 dark:text-gray-400">No transporters found</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Make sure transporters have the 'transporter' role in the profiles table
                  </p>
                </div>
              ) : (
                transporters.map((transporter) => (
                  <Link
                    key={transporter.id}
                    href={`/app/transporters/${transporter.id}`}
                    className="block"
                  >
                    <div
                      className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-medium">{transporter.full_name}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(transporter.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">{transporter.role}</Badge>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Unassigned Tickets for Pickup/Delivery */}
        <Card>
          <CardHeader>
            <CardTitle>Unassigned Pickup/Delivery Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {unassignedTickets.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No unassigned pickup/delivery tasks</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unassignedTickets.slice(0, 5).map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{ticket.customers?.name || 'N/A'}</div>
                          <div className="text-xs text-gray-500">{ticket.customers?.phone_e164}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {ticket.customers?.area || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {ticket.device_category} {ticket.brand} {ticket.model}
                      </TableCell>
                      <TableCell>
                        {ticket.issue_summary}
                      </TableCell>
                      <TableCell>
                        <Select
                          onValueChange={(value) => assignTransporterMutation.mutate({ ticketId: ticket.id, transporterId: value })}
                          value=""
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Assign to..." />
                          </SelectTrigger>
                          <SelectContent>
                            {transporters.map((transporter) => (
                              <SelectItem key={transporter.id} value={transporter.id}>
                                {transporter.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Tickets with Assignment Status */}
      <Card>
        <CardHeader>
          <CardTitle>All Tickets & Assignment Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To Transporter</TableHead>
                <TableHead>Assigned To Technician</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allTickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div>{ticket.customers?.name || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{ticket.customers?.phone_e164}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {ticket.customers?.area || 'N/A'}
                  </TableCell>
                  <TableCell>
                    {ticket.device_category} {ticket.brand} {ticket.model}
                  </TableCell>
                  <TableCell>{ticket.issue_summary}</TableCell>
                  <TableCell>
                    <Badge variant={ticket.status === 'ready' ? 'default' : 'secondary'}>
                      {ticket.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{ticket.assigned_transporter_id ? transporters.find(t => t.id === ticket.assigned_transporter_id)?.full_name : 'Unassigned'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{ticket.assigned_technician_id ? 'Assigned' : 'Unassigned'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {ticket.assigned_transporter_id ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => unassignTransporterMutation.mutate(ticket.id)}
                      >
                        Unassign
                      </Button>
                    ) : (
                      <Select
                        onValueChange={(value) => assignTransporterMutation.mutate({ ticketId: ticket.id, transporterId: value })}
                        value=""
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Assign..." />
                        </SelectTrigger>
                        <SelectContent>
                          {transporters.map((transporter) => (
                            <SelectItem key={transporter.id} value={transporter.id}>
                              {transporter.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
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