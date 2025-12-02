// API route for purchase orders
// /Users/mohammedamair/Downloads/JamesTronic_Prompt_Kit/james-tronic/src/app/api/parts/po/route.ts

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { getUserRole } from '@/lib/auth/auth-utils';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Zod schema for creating purchase orders
const poSchema = z.object({
  supplier_id: z.string().uuid(),
  po_number: z.string().min(1),
  status: z.enum(['draft', 'pending_approval', 'approved', 'rejected', 'sent', 'in_transit', 'delivered', 'partially_delivered', 'cancelled']).default('draft'),
  expected_delivery_date: z.string().datetime().optional(),
  total_amount: z.number().nonnegative(),
  currency: z.string().default('USD'),
  shipping_cost: z.number().nonnegative().default(0),
  tax_amount: z.number().nonnegative().default(0),
  discount_amount: z.number().nonnegative().default(0),
  notes: z.string().optional(),
  tracking_number: z.string().optional(),
  carrier_name: z.string().optional(),
  approval_status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  approval_notes: z.string().optional(),
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
    const supplierId = searchParams.get('supplier_id');
    const status = searchParams.get('status');
    const requestedBy = searchParams.get('requested_by');
    const sortBy = searchParams.get('sort') || 'created_at';
    const order = searchParams.get('order') || 'desc';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // Build query based on user role
    let query = supabase
      .from('supplier_po')
      .select(`
        *,
        supplier_list!supplier_po_supplier_id_fkey (name, email, phone),
        profiles!supplier_po_requested_by_fkey (full_name),
        profiles!supplier_po_approved_by_fkey (full_name)
      `)
      .order(sortBy as any, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    // Add filters based on role
    if (role === 'technician') {
      // Technicians can only see POs related to parts they requested
      // First get the part IDs for this technician's requests
      const { data: techPartRequests, error: techPartError } = await supabase
        .from('part_requests')
        .select('part_id')
        .eq('requested_by', user.id);

      if (techPartError) {
        console.error('Error fetching technician part requests:', techPartError);
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const partIds = techPartRequests.map(request => request.part_id);

      // Then get the PO IDs for those parts
      const { data: partsArrivals, error: partsArrivalsError } = await supabase
        .from('parts_arrivals')
        .select('po_id')
        .in('part_id', partIds);

      if (partsArrivalsError) {
        console.error('Error fetching parts arrivals:', partsArrivalsError);
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const poIds = partsArrivals.map(arrival => arrival.po_id);
      query = query.in('id', poIds);
    } else if (role === 'admin' || role === 'staff') {
      // Admins and staff can see all, but can apply additional filters
      if (supplierId) query = query.eq('supplier_id', supplierId);
      if (status) query = query.eq('status', status);
      if (requestedBy) query = query.eq('requested_by', requestedBy);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching purchase orders:', error);
      return Response.json({ error: 'Failed to fetch purchase orders' }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    console.error('Error in GET /api/parts/po:', error);
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

    // Verify user role - only admin/staff can create POs
    const role = await getUserRole();
    if (role !== 'admin' && role !== 'staff') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = poSchema.safeParse(body);

    if (!validatedData.success) {
      return Response.json(
        { error: 'Invalid data', details: validatedData.error.issues },
        { status: 400 }
      );
    }

    // Add the creator to the data
    const poData = {
      ...validatedData.data,
      requested_by: user.id,
    };

    // Insert the purchase order
    const { data, error } = await supabase
      .from('supplier_po')
      .insert([poData])
      .select()
      .single();

    if (error) {
      console.error('Error creating purchase order:', error);
      return Response.json({ error: 'Failed to create purchase order' }, { status: 500 });
    }

    // Log the activity
    await supabase
      .from('parts_activity_log')
      .insert([{
        part_id: null, // No specific part for PO creation
        activity_type: 'po_created',
        activity_description: 'Purchase order created',
        actor_id: user.id,
        po_id: data.id,
        metadata: { po_data: poData }
      }]);

    return Response.json(data);
  } catch (error) {
    console.error('Error in POST /api/parts/po:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}