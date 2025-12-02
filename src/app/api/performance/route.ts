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

const slaRecordSchema = z.object({
  technician_id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  sla_target_minutes: z.number().int().positive(),
  completion_minutes: z.number().int().nonnegative().optional(),
  sla_met: z.boolean(),
});

export async function GET(request: NextRequest) {
  try {
    // Get Supabase session from cookies
    const authCookies = await cookies();
    const authCookie = authCookies.get('sb-access-token');
    if (!authCookie) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use the Supabase client with the auth token
    // We need to access the Supabase client with auth context, so using server component approach
    // For now, we'll use the service role key for this specific endpoint
    // In a real app, we'd validate the user's role properly
    const { data: { user }, error: userError } = await supabase.auth.getUser(authCookie.value);

    if (userError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user role by fetching from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !['admin', 'manager'].includes(profile.role)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sort') || 'score';
    const order = searchParams.get('order') || 'desc';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // Validate sort and order parameters
    const validSortFields = ['score', 'total_jobs', 'jobs_completed', 'sla_met', 'sla_breached', 'rating_avg', 'avg_completion_time_minutes'];
    const validOrder = ['asc', 'desc'];

    if (!validSortFields.includes(sortBy) || !validOrder.includes(order)) {
      return Response.json({ error: 'Invalid sort parameters' }, { status: 400 });
    }

    // Query performance data with sorting and pagination
    let query = supabase
      .from('technician_performance')
      .select(`
        *,
        profiles!technician_performance_technician_id_fkey (full_name, email, role)
      `)
      .order(sortBy as any, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching performance data:', error);
      return Response.json({ error: 'Failed to fetch performance data' }, { status: 500 });
    }

    // Format the response to include technician info
    const formattedData = data.map(item => ({
      id: item.technician_id,
      full_name: item.profiles?.full_name || 'Unknown',
      email: item.profiles?.email,
      role: item.profiles?.role,
      total_jobs: item.total_jobs,
      jobs_completed: item.jobs_completed,
      avg_completion_time_minutes: item.avg_completion_time_minutes,
      sla_met: item.sla_met,
      sla_breached: item.sla_breached,
      rating_avg: item.rating_avg,
      score: item.score,
      updated_at: item.updated_at,
    }));

    return Response.json(formattedData);
  } catch (error) {
    console.error('Error in GET /api/performance:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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

    // Verify user role by fetching from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !['admin', 'manager'].includes(profile.role)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = performanceRecordSchema.safeParse(body);

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
      console.error('Error upserting performance data:', error);
      return Response.json({ error: 'Failed to update performance data' }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    console.error('Error in POST /api/performance:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}