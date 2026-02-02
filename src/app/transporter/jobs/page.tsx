// james-tronic/src/app/transporter/jobs/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useSupabase } from '@/components/shared/supabase-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, Package, CheckCircle, XCircle, Clock, Navigation } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface TransportJob {
  id: string;
  ticket_id: string;
  job_type: string;
  status: string;
  pickup_address_text: string;
  drop_address_text: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  drop_lat: number | null;
  drop_lng: number | null;
  scheduled_at: string;
  created_at: string;
  ticket: {
    device_category: string;
    brand: string;
    model: string;
  };
}

export default function TransporterJobsPage() {
  const [jobs, setJobs] = useState<TransportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const { user, userRole: role } = useSupabase();
  const router = useRouter();

  useEffect(() => {
    // Only check role if it's loaded (or handle loading state in provider)
    // Assuming role might be null initially
    if (role && role !== 'transporter') {
      router.push('/login');
      return;
    }

    if (user) {
      fetchJobs();
    }
  }, [user, role, router]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transport_jobs')
        .select(`
          id,
          ticket_id,
          job_type,
          status,
          pickup_address_text,
          drop_address_text,
          pickup_lat,
          pickup_lng,
          drop_lat,
          drop_lng,
          scheduled_at,
          created_at,
          ticket: tickets!transport_jobs_ticket_id_fkey (device_category, brand, model)
        `)
        .eq('assigned_transporter_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform the data to match the expected interface
      const transformedJobs = data?.map((job: any) => ({
        ...job,
        ticket: {
          device_category: job.ticket[0]?.device_category || '',
          brand: job.ticket[0]?.brand || '',
          model: job.ticket[0]?.model || ''
        }
      })) || [];

      setJobs(transformedJobs);
    } catch (err) {
      setError('Failed to fetch jobs');
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleArriveAtPickup = async (jobId: string) => {
    // In a real implementation, this would call the geolock API to verify location
    // and then update the job status
    console.log(`Arrive at pickup for job: ${jobId}`);
    // Call geolock verify API to ensure we're at the right location
    // Then update status to 'arrived_pickup'
  };

  const handleConfirmPickup = async (jobId: string) => {
    // In a real implementation, this would:
    // 1. Request an OTP for pickup
    // 2. Show OTP input to user
    // 3. Call custody event API with OTP and current location
    console.log(`Confirm pickup for job: ${jobId}`);
  };

  const handleArriveAtDrop = async (jobId: string) => {
    console.log(`Arrive at drop for job: ${jobId}`);
  };

  const handleConfirmDrop = async (jobId: string) => {
    console.log(`Confirm drop for job: ${jobId}`);
  };

  if (loading) {
    return <div className="p-6">Loading jobs...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">My Transport Jobs</h1>

      {jobs.length === 0 ? (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium">No active jobs</h3>
          <p className="mt-1 text-sm text-gray-500">You don't have any assigned transport jobs at the moment.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span>Job #{job.id.substring(0, 8)}</span>
                      <Badge variant={job.status === 'delivered' ? 'default' : 'secondary'}>
                        {job.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {job.ticket.device_category} - {job.ticket.brand} {job.ticket.model}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Scheduled</p>
                    <p className="text-sm font-medium">
                      {job.scheduled_at ? new Date(job.scheduled_at).toLocaleString() : 'Not scheduled'}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium">Pickup Location</h4>
                        <p className="text-sm text-muted-foreground">{job.pickup_address_text}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Navigation className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium">Drop Location</h4>
                        <p className="text-sm text-muted-foreground">{job.drop_address_text}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">Created: {new Date(job.created_at).toLocaleString()}</span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {job.status === 'assigned' && (
                        <Button
                          onClick={() => handleArriveAtPickup(job.id)}
                          size="sm"
                        >
                          <Navigation className="h-4 w-4 mr-2" />
                          Arrive at Pickup
                        </Button>
                      )}

                      {job.status === 'arrived_pickup' && (
                        <Button
                          onClick={() => handleConfirmPickup(job.id)}
                          size="sm"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Confirm Pickup
                        </Button>
                      )}

                      {job.status === 'picked_up' && (
                        <Button
                          onClick={() => handleArriveAtDrop(job.id)}
                          size="sm"
                        >
                          <Navigation className="h-4 w-4 mr-2" />
                          Arrive at Drop
                        </Button>
                      )}

                      {job.status === 'arrived_drop' && (
                        <Button
                          onClick={() => handleConfirmDrop(job.id)}
                          size="sm"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Confirm Drop
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Navigate to customer details
                        }}
                      >
                        <Phone className="h-4 w-4 mr-2" />
                        Contact
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}