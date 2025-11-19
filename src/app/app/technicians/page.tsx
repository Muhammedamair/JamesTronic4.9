'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { createTicketService } from '@/lib/authenticated-service';
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

interface Technician {
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
  } | null;
}

export default function TechnicianManagementPage() {
  const { supabase, user } = useSupabase();
  const queryClient = useQueryClient();
  const ticketService = createTicketService(supabase);

  // Fetch technicians using TanStack Query
  const { data: technicians = [], isLoading: isLoadingTechnicians } = useQuery<Technician[]>({
    queryKey: ['technicians'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['technician'])
        .order('full_name', { ascending: true });
      if (error) throw new Error(`Failed to load technicians: ${error.message}`);
      return data || [];
    },
    enabled: !!user,
  });

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

  // Fetch pending users (only for admin users)
  const { data: pendingUsers = [], isLoading: isLoadingPending } = useQuery<PendingUser[]>({
    queryKey: ['pending-users'],
    queryFn: async () => {
      const { data: pendingData, error: pendingError } = await supabase
        .from('pending_technicians')
        .select('*')
        .eq('status', 'pending')
        .eq('requested_role', 'technician'); // Only fetch technician registrations

      if (pendingError) throw pendingError;

      // Fetch categories
      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id, name');

      if (categoryError) throw categoryError;

      // Combine data including category names
      const usersWithCategory = pendingData?.map((user: PendingUser) => {
        const category = categoryData?.find(cat => cat.id === user.category_id);
        return {
          ...user,
          category_name: category?.name || 'N/A'
        };
      }) || [];

      return usersWithCategory;
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
          id, customer_id, assigned_technician_id, device_category, brand, model,
          issue_summary, status, created_at,
          customers (id, name, phone_e164)
        `)
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Failed to load tickets: ${error.message}`);
      return data || [];
    },
    enabled: !!user,
  });

  // Real-time subscription using useEffect
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('public:tickets:technician-management')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        (payload) => {
          console.log('Technician Management: Realtime change detected, invalidating tickets query:', payload);
          queryClient.invalidateQueries({ queryKey: ['tickets'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user, queryClient]);

  // Mutation for assigning a ticket - enhanced to ensure proper real-time updates
  const assignMutation = useMutation({
    mutationFn: ({ ticketId, technicianId }: { ticketId: string; technicianId: string }) =>
      ticketService.assignToTechnician(ticketId, technicianId),
    onSuccess: (_, { technicianId }) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['tickets', 'technician', technicianId] });
      toast({
        title: 'Success',
        description: 'Ticket assigned successfully!',
      });
    },
    onError: (err) => {
      console.error('Error assigning ticket:', err);
      toast({
        title: 'Error',
        description: 'Failed to assign ticket',
        variant: 'error',
      });
    },
  });

  // Mutation for unassigning a ticket - enhanced to ensure proper real-time updates
  const unassignMutation = useMutation({
    mutationFn: (ticketId: string) => ticketService.unassignFromTechnician(ticketId),
    onSuccess: (_, ticketId) => {
      // Find which technician this ticket was assigned to so we can invalidate their specific query
      const ticket = allTickets.find(t => t.id === ticketId);
      const technicianId = ticket?.assigned_technician_id;

      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      if (technicianId) {
        queryClient.invalidateQueries({ queryKey: ['tickets', 'technician', technicianId] });
      }
      toast({
        title: 'Success',
        description: 'Ticket unassigned successfully!',
      });
    },
    onError: (err) => {
      console.error('Error unassigning ticket:', err);
      toast({
        title: 'Error',
        description: 'Failed to unassign ticket',
        variant: 'error',
      });
    },
  });

  // Mutation for approving a user - FIXED to handle duplicate profile issue and set proper role
  const approveMutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ['pending-users'] });
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
      toast({
        title: 'Success',
        description: 'User approved successfully!',
      });
    },
    onError: (err) => {
      console.error('Error approving user:', err);
      toast({
        title: 'Error',
        description: 'Failed to approve user',
        variant: 'error',
      });
    },
  });

  // Mutation for rejecting a user
  const rejectMutation = useMutation({
    mutationFn: (userId: string) =>
      supabase
        .from('pending_technicians')
        .update({ status: 'rejected' })
        .eq('user_id', userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-users'] });
      toast({
        title: 'Success',
        description: 'User rejected successfully!',
      });
    },
    onError: (err) => {
      console.error('Error rejecting user:', err);
      toast({
        title: 'Error',
        description: 'Failed to reject user',
        variant: 'error',
      });
    },
  });

  const getTechnicianName = (techId: string | null) => {
    if (!techId) return 'Unassigned';
    const tech = technicians.find(t => t.id === techId);
    return tech ? tech.full_name : 'Unknown Technician';
  };

  const isLoading = isLoadingTechnicians || isLoadingTickets || isLoadingPending;

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

  const unassignedTickets = allTickets.filter(ticket => !ticket.assigned_technician_id);

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Technician & Transporter Management</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage technicians, transporters, and pending approvals (Technicians: {technicians.length}, Pending: {pendingUsers.length})
        </p>
      </div>

      {/* Pending Approvals Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingUsers.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No pending approvals</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role Requested</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Registration Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((user: PendingUser) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.requested_role}</Badge>
                    </TableCell>
                    <TableCell>{user.category_name}</TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate({ userId: user.user_id, roleId: user.id })}
                          variant="default"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => rejectMutation.mutate(user.user_id)}
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
        {/* Technicians List */}
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle>Technicians</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow">
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {technicians.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-500 dark:text-gray-400">No technicians found</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Make sure technicians have the 'technician' role in the profiles table
                  </p>
                </div>
              ) : (
                technicians.map((technician: Technician) => (
                  <Link
                    key={technician.id}
                    href={`/app/technicians/${technician.id}`}
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
                          <h3 className="font-medium">{technician.full_name}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(technician.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">{technician.role}</Badge>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Unassigned Tickets */}
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle>Unassigned Tickets</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow">
            {unassignedTickets.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No unassigned tickets</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unassignedTickets.slice(0, 5).map((ticket: Ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-medium">
                          <div>
                            <div>{ticket.customers?.name || 'N/A'}</div>
                            <div className="text-xs text-gray-500">{ticket.customers?.phone_e164}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {ticket.device_category} {ticket.brand} {ticket.model}
                        </TableCell>
                        <TableCell>
                          {ticket.issue_summary}
                        </TableCell>
                        <TableCell>
                          <Select
                            onValueChange={(value) => assignMutation.mutate({ ticketId: ticket.id, technicianId: value })}
                            value=""
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Assign to..." />
                            </SelectTrigger>
                            <SelectContent>
                              {technicians.map((tech: Technician) => (
                                <SelectItem key={tech.id} value={tech.id}>
                                  {tech.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
                <TableHead>Device</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allTickets.map((ticket: Ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div>{ticket.customers?.name || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{ticket.customers?.phone_e164}</div>
                    </div>
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
                      <span>{getTechnicianName(ticket.assigned_technician_id)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {ticket.assigned_technician_id ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => unassignMutation.mutate(ticket.id)}
                      >
                        Unassign
                      </Button>
                    ) : (
                      <Select
                        onValueChange={(value) => assignMutation.mutate({ ticketId: ticket.id, technicianId: value })}
                        value=""
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Assign..." />
                        </SelectTrigger>
                        <SelectContent>
                          {technicians.map((tech: Technician) => (
                            <SelectItem key={tech.id} value={tech.id}>
                              {tech.full_name}
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