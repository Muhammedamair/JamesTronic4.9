// james-tronic/src/app/app/logistics/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Package, User, Clock, Navigation, Search, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface TransportJob {
  id: string;
  ticket_id: string;
  job_type: string;
  status: string;
  assigned_transporter_id: string | null;
  pickup_address_text: string;
  drop_address_text: string;
  scheduled_at: string;
  created_at: string;
  branch_id: string;
  ticket: {
    device_category: string;
    brand: string;
    model: string;
    customer: {
      name: string;
      phone_e164: string;
    };
  };
  assigned_transporter: {
    full_name: string;
  } | null;
}

interface Transporter {
  id: string;
  full_name: string;
  role: string;
}

export default function LogisticsDashboardPage() {
  const [jobs, setJobs] = useState<TransportJob[]>([]);
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const supabase = createClient();
  const { session, role } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!['admin', 'staff', 'manager'].includes(role || '')) {
      router.push('/login');
      return;
    }
    fetchData();
  }, [role, router]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch transport jobs with related data
      const { data: jobsData, error: jobsError } = await supabase
        .from('transport_jobs')
        .select(`
          id,
          ticket_id,
          job_type,
          status,
          assigned_transporter_id,
          pickup_address_text,
          drop_address_text,
          scheduled_at,
          created_at,
          branch_id,
          ticket: tickets!transport_jobs_ticket_id_fkey (device_category, brand, model, customer: customers!tickets_customer_id_fkey (name, phone_e164)),
          assigned_transporter: profiles (full_name)
        `)
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;

      // Transform the data to match the expected interface
      const transformedJobs = jobsData?.map((job: any) => ({
        ...job,
        ticket: {
          device_category: job.ticket[0]?.device_category || '',
          brand: job.ticket[0]?.brand || '',
          model: job.ticket[0]?.model || '',
          customer: {
            name: job.ticket[0]?.customer[0]?.name || '',
            phone_e164: job.ticket[0]?.customer[0]?.phone_e164 || ''
          }
        },
        assigned_transporter: job.assigned_transporter ? {
          full_name: job.assigned_transporter[0]?.full_name || null
        } : null
      })) || [];

      // Fetch available transporters
      const { data: transportersData, error: transportersError } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('role', 'transporter');

      if (transportersError) throw transportersError;

      setJobs(transformedJobs);
      setTransporters(transportersData || []);
    } catch (err) {
      setError('Failed to fetch data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTransporter = async (jobId: string, transporterId: string) => {
    try {
      const { error } = await supabase
        .from('transport_jobs')
        .update({ assigned_transporter_id: transporterId })
        .eq('id', jobId);

      if (error) throw error;

      // Update local state
      setJobs(prevJobs =>
        prevJobs.map(job =>
          job.id === jobId ? { ...job, assigned_transporter_id: transporterId } : job
        )
      );

      // Also update the assigned transporter in the job
      const transporter = transporters.find(t => t.id === transporterId);
      if (transporter) {
        setJobs(prevJobs =>
          prevJobs.map(job =>
            job.id === jobId ? { ...job, assigned_transporter: { full_name: transporter.full_name } } : job
          )
        );
      }
    } catch (err) {
      console.error('Error assigning transporter:', err);
      setError('Failed to assign transporter');
    }
  };

  const handleUpdateStatus = async (jobId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('transport_jobs')
        .update({ status: newStatus })
        .eq('id', jobId);

      if (error) throw error;

      // Update local state
      setJobs(prevJobs =>
        prevJobs.map(job =>
          job.id === jobId ? { ...job, status: newStatus } : job
        )
      );
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Failed to update status');
    }
  };

  // Filter jobs based on status and search query
  const filteredJobs = jobs.filter(job => {
    const matchesStatus = filterStatus === 'all' || job.status === filterStatus;
    const matchesSearch =
      searchQuery === '' ||
      job.ticket.device_category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.ticket.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.ticket.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.id.includes(searchQuery);

    return matchesStatus && matchesSearch;
  });

  if (loading) {
    return <div className="p-6">Loading logistics dashboard...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Logistics Dashboard</h1>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search jobs..."
              className="pl-8 pr-4 py-2 border rounded-lg w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="border rounded-lg px-3 py-2"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="created">Created</option>
            <option value="assigned">Assigned</option>
            <option value="en_route_pickup">En Route Pickup</option>
            <option value="arrived_pickup">Arrived Pickup</option>
            <option value="picked_up">Picked Up</option>
            <option value="en_route_drop">En Route Drop</option>
            <option value="arrived_drop">Arrived Drop</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{jobs.length}</div>
            <div className="text-sm text-muted-foreground">Total Jobs</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">
              {jobs.filter(j => j.status === 'delivered').length}
            </div>
            <div className="text-sm text-muted-foreground">Delivered</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">
              {jobs.filter(j => j.status === 'assigned' || j.status === 'en_route_pickup' || j.status === 'arrived_pickup').length}
            </div>
            <div className="text-sm text-muted-foreground">In Transit</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{transporters.length}</div>
            <div className="text-sm text-muted-foreground">Active Transporters</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {filteredJobs.map((job) => (
          <Card key={job.id}>
            <CardHeader className="pb-2">
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
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="text-sm font-medium">{job.ticket.customer.name}</p>
                  <p className="text-xs text-muted-foreground">{job.ticket.customer.phone_e164}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-xs font-medium uppercase text-muted-foreground">Pickup</h4>
                      <p className="text-sm">{job.pickup_address_text}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Navigation className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-xs font-medium uppercase text-muted-foreground">Drop</h4>
                      <p className="text-sm">{job.drop_address_text}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <div>
                      <h4 className="text-xs font-medium uppercase text-muted-foreground">Schedule</h4>
                      <p className="text-sm">
                        {job.scheduled_at ? new Date(job.scheduled_at).toLocaleString() : 'Not scheduled'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <div>
                      <h4 className="text-xs font-medium uppercase text-muted-foreground">Transporter</h4>
                      <p className="text-sm">
                        {job.assigned_transporter
                          ? job.assigned_transporter.full_name
                          : 'Not assigned'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    {!job.assigned_transporter_id && (
                      <select
                        className="border rounded px-2 py-1 text-xs flex-1"
                        onChange={(e) => handleAssignTransporter(job.id, e.target.value)}
                        defaultValue=""
                      >
                        <option value="" disabled>Assign Transporter</option>
                        {transporters.map(transporter => (
                          <option key={transporter.id} value={transporter.id}>
                            {transporter.full_name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {job.status === 'created' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(job.id, 'assigned')}
                      >
                        Mark Assigned
                      </Button>
                    )}
                    {job.status === 'assigned' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(job.id, 'en_route_pickup')}
                      >
                        En Route to Pickup
                      </Button>
                    )}
                    {job.status === 'en_route_pickup' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(job.id, 'arrived_pickup')}
                      >
                        Arrived at Pickup
                      </Button>
                    )}
                    {job.status === 'arrived_pickup' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(job.id, 'picked_up')}
                      >
                        Mark Picked Up
                      </Button>
                    )}
                    {job.status === 'picked_up' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(job.id, 'en_route_drop')}
                      >
                        En Route to Drop
                      </Button>
                    )}
                    {job.status === 'en_route_drop' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(job.id, 'arrived_drop')}
                      >
                        Arrived at Drop
                      </Button>
                    )}
                    {job.status === 'arrived_drop' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(job.id, 'delivered')}
                      >
                        Mark Delivered
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}