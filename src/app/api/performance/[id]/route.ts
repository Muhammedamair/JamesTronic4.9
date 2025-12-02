import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { cookies } from 'next/headers';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Zod schemas for validation
const performanceRecordSchema = z.object({
  technician_id: z.string().uuid(),
  total_jobs: z.number().int().min(0).optional(),
  jobs_completed: z.number().int().min(0).optional(),
  avg_completion_time_minutes: z.number().int().min(0).optional(),
  sla_met: z.number().int().min(0).optional(),
  sla_breached: z.number().int().min(0).optional(),
  rating_avg: z.number().min(0).max(5).optional(),
  score: z.number().min(0).max(100).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: technicianId } = await params;

    // Get Supabase session from cookies
    const authCookies = await cookies();
    const authCookie = authCookies.get('sb-access-token');
    if (!authCookie) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(authCookie.value);

    if (userError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify that the user is authorized to access this data
    // First, get the user's role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (profile.role !== 'admin' && profile.role !== 'manager' && profile.role !== 'technician') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Technicians can only access their own data
    if (profile.role === 'technician' && profile.id !== technicianId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch specific technician's performance data
    const { data, error } = await supabase
      .from('technician_performance')
      .select(`
        *,
        profiles!technician_performance_technician_id_fkey (full_name, email, role)
      `)
      .eq('technician_id', technicianId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        // Return a default response when no performance data exists for the technician
        return Response.json({
          id: technicianId,
          full_name: 'Unknown',
          email: null,
          role: null,
          total_jobs: 0,
          jobs_completed: 0,
          avg_completion_time_minutes: 0,
          sla_met: 0,
          sla_breached: 0,
          rating_avg: 0,
          score: 0,
          updated_at: null,
        });
      }
      console.error('Error fetching technician performance:', error);
      return Response.json({ error: 'Failed to fetch performance data' }, { status: 500 });
    }

    // Format the response
    const formattedData = {
      id: data.technician_id,
      full_name: data.profiles?.full_name || 'Unknown',
      email: data.profiles?.email,
      role: data.profiles?.role,
      total_jobs: data.total_jobs,
      jobs_completed: data.jobs_completed,
      avg_completion_time_minutes: data.avg_completion_time_minutes,
      sla_met: data.sla_met,
      sla_breached: data.sla_breached,
      rating_avg: data.rating_avg,
      score: data.score,
      updated_at: data.updated_at,
    };

    return Response.json(formattedData);
  } catch (error) {
    console.error('Error in GET /api/performance/[id]:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: technicianId } = await params;
    const body = await request.json();

    // Get Supabase session from cookies
    const authCookies = await cookies();
    const authCookie = authCookies.get('sb-access-token');
    if (!authCookie) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(authCookie.value);

    if (userError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !['admin', 'manager'].includes(profile.role)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate the technician ID in the body matches the route parameter
    if (body.technician_id && body.technician_id !== technicianId) {
      return Response.json({ error: 'Technician ID mismatch' }, { status: 400 });
    }

    const validatedData = performanceRecordSchema.safeParse({
      ...body,
      technician_id: technicianId
    });

    if (!validatedData.success) {
      return Response.json(
        { error: 'Invalid data', details: validatedData.error.issues },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('technician_performance')
      .upsert([validatedData.data], { onConflict: 'technician_id' });

    if (error) {
      console.error('Error updating performance data:', error);
      return Response.json({ error: 'Failed to update performance data' }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    console.error('Error in PUT /api/performance/[id]:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: technicianId } = await params;

    // Get Supabase session from cookies
    const authCookies = await cookies();
    const authCookie = authCookies.get('sb-access-token');
    if (!authCookie) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(authCookie.value);

    if (userError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !['admin', 'manager'].includes(profile.role)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('technician_performance')
      .delete()
      .eq('technician_id', technicianId);

    if (error) {
      console.error('Error deleting performance data:', error);
      return Response.json({ error: 'Failed to delete performance data' }, { status: 500 });
    }

    return Response.json({ message: 'Performance data deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/performance/[id]:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}