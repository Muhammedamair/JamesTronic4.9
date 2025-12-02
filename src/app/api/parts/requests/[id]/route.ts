// API route for individual part requests
// /Users/mohammedamair/Downloads/JamesTronic_Prompt_Kit/james-tronic/src/app/api/parts/requests/[id]/route.ts

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { getUserRole } from '@/lib/auth/auth-utils'; // Assuming this contains role helper functions

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

// Zod schema for updating part requests
const updatePartRequestSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'fulfilled', 'cancelled']).optional(),
  rejection_reason: z.string().optional(),
  approver_id: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = getSupabaseClient();

    const { id: requestId } = await params;

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

    // Get the specific part request
    const { data, error } = await supabase
      .from('part_requests')
      .select(`
        *,
        parts_catalog!part_requests_part_id_fkey (part_number, name, category, brand, cost_price, selling_price),
        profiles!part_requests_requested_by_fkey (full_name, role),
        profiles!part_requests_approver_id_fkey (full_name, role),
        tickets!part_requests_ticket_id_fkey (id, status, issue_summary, device_category, brand, model)
      `)
      .eq('id', requestId)
      .single();

    if (error) {
      console.error('Error fetching part request:', error);
      return Response.json({ error: 'Failed to fetch part request' }, { status: 404 });
    }

    // Check authorization - users can only access their own requests, or admins/staff can access any
    if (role === 'technician' && data.requested_by !== user.id && data.approver_id !== user.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return Response.json(data);
  } catch (error) {
    console.error('Error in GET /api/parts/requests/[id]:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = getSupabaseClient();

    const { id: requestId } = await params;

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

    // Verify user role - only admin/staff can approve/reject, technicians can only update notes for pending requests
    const role = await getUserRole();
    if (!role || !['admin', 'staff', 'technician'].includes(role)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updatePartRequestSchema.safeParse(body);

    if (!validatedData.success) {
      return Response.json(
        { error: 'Invalid data', details: validatedData.error.issues },
        { status: 400 }
      );
    }

    // Check if the part request exists and get its current state
    const { data: existingRequest, error: fetchError } = await supabase
      .from('part_requests')
      .select('id, requested_by, status, ticket_id, part_id')
      .eq('id', requestId)
      .single();

    if (fetchError || !existingRequest) {
      return Response.json({ error: 'Part request not found' }, { status: 404 });
    }

    // Authorization checks
    if (role === 'technician' && existingRequest.requested_by !== user.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Technicians can only update notes for pending requests they created
    if (role === 'technician') {
      if (existingRequest.status !== 'pending') {
        return Response.json({ error: 'Cannot modify completed requests' }, { status: 400 });
      }
      if (validatedData.data.status && validatedData.data.status !== 'pending') {
        return Response.json({ error: 'Technicians cannot change request status' }, { status: 400 });
      }
    }

    // Prepare update data
    const updateData: any = { ...validatedData.data };

    // If status is being changed to approved or rejected, set the approver and timestamp
    if (updateData.status === 'approved') {
      updateData.approver_id = user.id;
      updateData.approved_at = new Date().toISOString();
    } else if (updateData.status === 'rejected') {
      updateData.approver_id = user.id;
      updateData.rejected_at = new Date().toISOString();
    } else if (updateData.status === 'fulfilled') {
      updateData.fulfilled_at = new Date().toISOString();
    }

    // Update the part request
    const { data, error } = await supabase
      .from('part_requests')
      .update(updateData)
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      console.error('Error updating part request:', error);
      return Response.json({ error: 'Failed to update part request' }, { status: 500 });
    }

    // Log the activity
    await supabase
      .from('parts_activity_log')
      .insert([{
        part_id: existingRequest.part_id,
        activity_type: 'approval',
        activity_description: `Part request status changed to ${updateData.status}`,
        actor_id: user.id,
        ticket_id: existingRequest.ticket_id,
        part_request_id: existingRequest.id,
        new_value: updateData,
        metadata: { request_id: requestId, updated_fields: Object.keys(updateData) }
      }]);

    return Response.json(data);
  } catch (error) {
    console.error('Error in PUT /api/parts/requests/[id]:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = getSupabaseClient();

    const { id: requestId } = await params;

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

    // Verify user role - only admin/staff can delete part requests
    const role = await getUserRole();
    if (role !== 'admin' && role !== 'staff') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if the part request exists
    const { data: existingRequest, error: fetchError } = await supabase
      .from('part_requests')
      .select('id, requested_by, status, ticket_id, part_id')
      .eq('id', requestId)
      .single();

    if (fetchError || !existingRequest) {
      return Response.json({ error: 'Part request not found' }, { status: 404 });
    }

    // Only allow deletion for pending requests
    if (existingRequest.status !== 'pending') {
      return Response.json({ error: 'Cannot delete non-pending requests' }, { status: 400 });
    }

    // Delete the part request
    const { error } = await supabase
      .from('part_requests')
      .delete()
      .eq('id', requestId);

    if (error) {
      console.error('Error deleting part request:', error);
      return Response.json({ error: 'Failed to delete part request' }, { status: 500 });
    }

    // Log the activity
    await supabase
      .from('parts_activity_log')
      .insert([{
        part_id: existingRequest.part_id,
        activity_type: 'deletion',
        activity_description: 'Part request deleted',
        actor_id: user.id,
        ticket_id: existingRequest.ticket_id,
        part_request_id: existingRequest.id,
        old_value: existingRequest,
        metadata: { request_id: requestId }
      }]);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/parts/requests/[id]:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}