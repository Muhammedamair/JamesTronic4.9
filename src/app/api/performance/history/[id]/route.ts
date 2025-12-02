import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { cookies } from 'next/headers';

// Create a Supabase client instance function
function getSupabaseClient() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Zod schemas for validation
const slaRecordSchema = z.object({
  technician_id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  sla_target_minutes: z.number().int().positive(),
  completion_minutes: z.number().int().nonnegative().optional(),
  sla_met: z.boolean(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = getSupabaseClient();

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

    const { id: technicianId } = await params;

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

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';
    const slaStatus = searchParams.get('sla_status'); // 'met' or 'breached'

    // Build the query
    let query = supabase
      .from('technician_sla_history')
      .select(`
        *,
        tickets!technician_sla_history_ticket_id_fkey (id, issue_summary, created_at, status)
      `)
      .eq('technician_id', technicianId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply date filters if provided
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // Apply SLA status filter if provided
    if (slaStatus === 'met') {
      query = query.eq('sla_met', true);
    } else if (slaStatus === 'breached') {
      query = query.eq('sla_met', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching SLA history:', error);
      return Response.json({ error: 'Failed to fetch SLA history' }, { status: 500 });
    }

    // Format the response with ticket information
    const formattedData = data.map(item => ({
      id: item.id,
      technician_id: item.technician_id,
      ticket_id: item.ticket_id,
      ticket_summary: item.tickets?.issue_summary || 'N/A',
      ticket_status: item.tickets?.status || 'N/A',
      ticket_created_at: item.tickets?.created_at,
      sla_target_minutes: item.sla_target_minutes,
      completion_minutes: item.completion_minutes,
      sla_met: item.sla_met,
      created_at: item.created_at,
    }));

    return Response.json(formattedData);
  } catch (error) {
    console.error('Error in GET /api/performance/history/[id]:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = getSupabaseClient();

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

    const { id: technicianId } = await params;
    const body = await request.json();

    // Verify user role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !['admin', 'manager'].includes(profile.role)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const validatedData = slaRecordSchema.safeParse({
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
      .from('technician_sla_history')
      .insert([validatedData.data]);

    if (error) {
      console.error('Error inserting SLA history:', error);
      return Response.json({ error: 'Failed to insert SLA history' }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    console.error('Error in POST /api/performance/history/[id]:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}