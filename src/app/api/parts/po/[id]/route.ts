// API route for individual purchase orders
// /Users/mohammedamair/Downloads/JamesTronic_Prompt_Kit/james-tronic/src/app/api/parts/po/[id]/route.ts

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

// Zod schema for updating purchase orders
const updatePoSchema = z.object({
  status: z.enum(['draft', 'pending_approval', 'approved', 'rejected', 'sent', 'in_transit', 'delivered', 'partially_delivered', 'cancelled']).optional(),
  expected_delivery_date: z.string().datetime().optional(),
  actual_delivery_date: z.string().datetime().optional(),
  estimated_delivery_eta: z.string().datetime().optional(),
  total_amount: z.number().nonnegative().optional(),
  shipping_cost: z.number().nonnegative().optional(),
  tax_amount: z.number().nonnegative().optional(),
  discount_amount: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  tracking_number: z.string().optional(),
  carrier_name: z.string().optional(),
  approval_status: z.enum(['pending', 'approved', 'rejected']).optional(),
  approval_notes: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = getSupabaseClient();

    const { id: poId } = await params;

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

    // Get the specific purchase order
    const { data, error } = await supabase
      .from('supplier_po')
      .select(`
        *,
        supplier_list!supplier_po_supplier_id_fkey (name, contact_person, email, phone, address, city, state, country),
        profiles!supplier_po_requested_by_fkey (full_name, role),
        profiles!supplier_po_approved_by_fkey (full_name, role)
      `)
      .eq('id', poId)
      .single();

    if (error) {
      console.error('Error fetching purchase order:', error);
      return Response.json({ error: 'Failed to fetch purchase order' }, { status: 404 });
    }

    // Check authorization
    if (role === 'technician') {
      // Technicians can only access POs related to parts they requested
      const { data: relatedPartRequests, error: checkError } = await supabase
        .from('parts_arrivals')
        .select('part_id')
        .eq('po_id', poId);

      if (checkError) {
        console.error('Error checking PO access:', checkError);
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Check if any of the parts in this PO were requested by this technician
      if (relatedPartRequests && relatedPartRequests.length > 0) {
        const partIds = relatedPartRequests.map(item => item.part_id);
        const { data: techRequests, error: techRequestError } = await supabase
          .from('part_requests')
          .select('id')
          .in('part_id', partIds)
          .eq('requested_by', user.id);

        if (techRequestError || !techRequests || techRequests.length === 0) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
      } else {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    return Response.json(data);
  } catch (error) {
    console.error('Error in GET /api/parts/po/[id]:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = getSupabaseClient();

    const { id: poId } = await params;

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

    // Verify user role - only admin/staff can modify POs
    const role = await getUserRole();
    if (role !== 'admin' && role !== 'staff') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updatePoSchema.safeParse(body);

    if (!validatedData.success) {
      return Response.json(
        { error: 'Invalid data', details: validatedData.error.issues },
        { status: 400 }
      );
    }

    // Check if the purchase order exists and get its current state
    const { data: existingPo, error: fetchError } = await supabase
      .from('supplier_po')
      .select('id, status, supplier_id, requested_by')
      .eq('id', poId)
      .single();

    if (fetchError || !existingPo) {
      return Response.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = { ...validatedData.data };

    // If status is being changed to approved, set the approver
    if (updateData.approval_status === 'approved') {
      updateData.approved_by = user.id;
      updateData.approved_at = new Date().toISOString();
    }

    // Update the purchase order
    const { data, error } = await supabase
      .from('supplier_po')
      .update(updateData)
      .eq('id', poId)
      .select()
      .single();

    if (error) {
      console.error('Error updating purchase order:', error);
      return Response.json({ error: 'Failed to update purchase order' }, { status: 500 });
    }

    // Log the activity
    await supabase
      .from('parts_activity_log')
      .insert([{
        part_id: null, // No specific part associated
        activity_type: 'po_updated',
        activity_description: `Purchase order status changed to ${updateData.status || existingPo.status}`,
        actor_id: user.id,
        po_id: existingPo.id,
        new_value: updateData,
        metadata: { po_id: poId, updated_fields: Object.keys(updateData) }
      }]);

    return Response.json(data);
  } catch (error) {
    console.error('Error in PUT /api/parts/po/[id]:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}