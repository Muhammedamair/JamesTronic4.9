'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/components/supabase-provider';
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
import { User, Package, MapPin, Phone, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';

interface Transporter {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
  created_at: string;
}

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
  customers: {
    id: string;
    name: string;
    phone_e164: string;
    area: string;
  } | null;
}

export default function TransporterDetailPage() {
  const { supabase, user } = useSupabase();
  const { id } = useParams<{ id: string }>();
  const [transporter, setTransporter] = useState<Transporter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch transporter details
  useEffect(() => {
    const fetchTransporter = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .eq('role', 'transporter')
          .single();

        if (error) throw error;

        setTransporter(data);
      } catch (error) {
        setError('Failed to load transporter details');
        console.error('Error fetching transporter:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user && id) {
      fetchTransporter();
    }
  }, [supabase, user, id]);

  // Fetch assigned tickets using TanStack Query
  const { data: assignedTickets = [], isLoading: isLoadingTickets } = useQuery<Ticket[]>({
    queryKey: ['transporter-tickets', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          id, customer_id, assigned_transporter_id, device_category, brand, model,
          issue_summary, status, created_at,
          customers (id, name, phone_e164, area)
        `)
        .eq('assigned_transporter_id', id)
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Failed to load tickets: ${error.message}`);
      return data || [];
    },
    enabled: !!user && !!id,
  });

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

  if (!transporter) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error! </strong>
          <span className="block sm:inline">Transporter not found</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
            <User className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{transporter.full_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{transporter.role}</Badge>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                <Calendar className="inline h-4 w-4 mr-1" />
                Joined: {new Date(transporter.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transporter Info Card */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Transporter Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <h3 className="font-medium">Full Name</h3>
                    <p className="text-gray-600 dark:text-gray-400">{transporter.full_name}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Package className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <h3 className="font-medium">Role</h3>
                    <p className="text-gray-600 dark:text-gray-400">{transporter.role}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <h3 className="font-medium">Member Since</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {new Date(transporter.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Assigned Tickets Card */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Assigned Pickup/Delivery Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {assignedTickets.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No assigned tasks</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignedTickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <div>
                              <div>{ticket.customers?.name || 'N/A'}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {ticket.customers?.phone_e164}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {ticket.customers?.area || 'N/A'}
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
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}