// API route for part requests
// /Users/mohammedamair/Downloads/JamesTronic_Prompt_Kit/james-tronic/src/app/api/parts/requests/route.ts

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { getUserRole } from '@/lib/auth/auth-utils'; // Assuming this contains role helper functions

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Zod schemas for validation
const partRequestSchema = z.object({
  ticket_id: z.string().uuid(),
  part_id: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
  request_reason: z.string().optional(),
  urgency_level: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  notes: z.string().optional(),
});

const updatePartRequestSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'fulfilled', 'cancelled']).optional(),
  rejection_reason: z.string().optional(),
  approver_id: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
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

    // Verify user role
    const role = await getUserRole();
    if (!role || !['admin', 'staff', 'technician'].includes(role)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticket_id');
    const status = searchParams.get('status');
    const requestedBy = searchParams.get('requested_by');
    const sortBy = searchParams.get('sort') || 'created_at';
    const order = searchParams.get('order') || 'desc';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // Build query based on user role
    let query = supabase
      .from('part_requests')
      .select(`
        *,
        parts_catalog!part_requests_part_id_fkey (part_number, name, category, brand, cost_price, selling_price),
        profiles!part_requests_requested_by_fkey (full_name),
        profiles!part_requests_approver_id_fkey (full_name),
        tickets!part_requests_ticket_id_fkey (id, status, issue_summary)
      `)
      .order(sortBy as any, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    // Add filters based on role
    if (role === 'technician') {
      // Technicians can only see their own requests
      query = query.eq('requested_by', user.id);
    } else if (role === 'admin' || role === 'staff') {
      // Admins and staff can see all, but can apply additional filters
      if (status) query = query.eq('status', status);
      if (requestedBy) query = query.eq('requested_by', requestedBy);
      if (ticketId) query = query.eq('ticket_id', ticketId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching part requests:', error);
      return Response.json({ error: 'Failed to fetch part requests' }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    console.error('Error in GET /api/parts/requests:', error);
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

    // Verify user role - only technicians can create part requests
    const role = await getUserRole();
    if (role !== 'technician') {
      return Response.json({ error: 'Unauthorized - only technicians can create part requests' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = partRequestSchema.safeParse(body);

    if (!validatedData.success) {
      return Response.json(
        { error: 'Invalid data', details: validatedData.error.issues },
        { status: 400 }
      );
    }

    // Add the requesting user to the data
    const partRequestData = {
      ...validatedData.data,
      requested_by: user.id,
      status: 'pending' // Default status for new requests
    };

    // Insert the part request
    const { data, error } = await supabase
      .from('part_requests')
      .insert([partRequestData])
      .select()
      .single();

    if (error) {
      console.error('Error creating part request:', error);
      return Response.json({ error: 'Failed to create part request' }, { status: 500 });
    }

    // Log the activity
    await supabase
      .from('parts_activity_log')
      .insert([{
        part_id: partRequestData.part_id,
        activity_type: 'request',
        activity_description: 'Part request created',
        actor_id: user.id,
        ticket_id: partRequestData.ticket_id,
        part_request_id: data.id,
        metadata: { request_data: partRequestData }
      }]);

    return Response.json(data);
  } catch (error) {
    console.error('Error in POST /api/parts/requests:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}