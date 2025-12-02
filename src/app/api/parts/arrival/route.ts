// API route for parts arrivals
// /Users/mohammedamair/Downloads/JamesTronic_Prompt_Kit/james-tronic/src/app/api/parts/arrival/route.ts

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

// Zod schema for creating parts arrivals
const partsArrivalSchema = z.object({
  po_id: z.string().uuid(),
  part_id: z.string().uuid(),
  quantity_received: z.number().int().positive(),
  quantity_ordered: z.number().int().positive(),
  status: z.enum(['pending', 'verified', 'rejected', 'damaged']).default('verified'),
  batch_number: z.string().optional(),
  expiry_date: z.string().datetime().optional(),
  condition_notes: z.string().optional(),
  damage_report: z.string().optional(),
  inspection_report: z.string().optional(),
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
    const poId = searchParams.get('po_id');
    const partId = searchParams.get('part_id');
    const status = searchParams.get('status');
    const receivedBy = searchParams.get('received_by');
    const sortBy = searchParams.get('sort') || 'received_at';
    const order = searchParams.get('order') || 'desc';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // Build query based on user role
    let query = supabase
      .from('parts_arrivals')
      .select(`
        *,
        parts_catalog!parts_arrivals_part_id_fkey (part_number, name, category, brand),
        profiles!parts_arrivals_received_by_fkey (full_name),
        supplier_po!parts_arrivals_po_id_fkey (po_number, supplier_id)
      `)
      .order(sortBy as any, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    // Add filters based on role
    if (role === 'technician') {
      // Technicians can only see arrivals for parts they have access to
      // First get the part IDs that are active
      const { data: activeParts, error: partsError } = await supabase
        .from('parts_catalog')
        .select('id')
        .eq('is_active', true);

      if (partsError) {
        console.error('Error fetching active parts:', partsError);
        return Response.json({ error: 'Failed to fetch active parts' }, { status: 500 });
      }

      const activePartIds = activeParts.map(part => part.id);
      query = query.in('part_id', activePartIds);
    } else if (role === 'admin' || role === 'staff') {
      // Admins and staff can see all, but can apply additional filters
      if (poId) query = query.eq('po_id', poId);
      if (partId) query = query.eq('part_id', partId);
      if (status) query = query.eq('status', status);
      if (receivedBy) query = query.eq('received_by', receivedBy);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching parts arrivals:', error);
      return Response.json({ error: 'Failed to fetch parts arrivals' }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    console.error('Error in GET /api/parts/arrival:', error);
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

    // Verify user role - only admin/staff can record parts arrivals
    const role = await getUserRole();
    if (role !== 'admin' && role !== 'staff') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = partsArrivalSchema.safeParse(body);

    if (!validatedData.success) {
      return Response.json(
        { error: 'Invalid data', details: validatedData.error.issues },
        { status: 400 }
      );
    }

    // Add the receiver to the data
    const arrivalData = {
      ...validatedData.data,
      received_by: user.id,
    };

    // Begin transaction to update part stock and insert arrival
    const { data, error } = await supabase.rpc('update_part_stock_and_record_arrival', {
      p_po_id: arrivalData.po_id,
      p_part_id: arrivalData.part_id,
      p_quantity_received: arrivalData.quantity_received,
      p_quantity_ordered: arrivalData.quantity_ordered,
      p_status: arrivalData.status,
      p_batch_number: arrivalData.batch_number || null,
      p_expiry_date: arrivalData.expiry_date || null,
      p_condition_notes: arrivalData.condition_notes || null,
      p_damage_report: arrivalData.damage_report || null,
      p_inspection_report: arrivalData.inspection_report || null,
      p_received_by: user.id
    });

    if (error) {
      console.error('Error creating parts arrival:', error);
      return Response.json({ error: 'Failed to record parts arrival' }, { status: 500 });
    }

    // If the RPC doesn't return data, manually fetch the created record
    if (!data) {
      const { data: fetchedArrivalData, error: fetchError } = await supabase
        .from('parts_arrivals')
        .select('*')
        .eq('po_id', arrivalData.po_id)
        .eq('part_id', arrivalData.part_id)
        .order('received_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError) {
        console.error('Error fetching created arrival:', fetchError);
        return Response.json({ error: 'Failed to fetch created arrival' }, { status: 500 });
      }

      // Log the activity
      await supabase
        .from('parts_activity_log')
        .insert([{
          part_id: fetchedArrivalData.part_id,
          activity_type: 'arrival',
          activity_description: `Part arrival recorded: ${fetchedArrivalData.quantity_received} units`,
          actor_id: user.id,
          po_id: fetchedArrivalData.po_id,
          arrival_id: fetchedArrivalData.id,
          metadata: { arrival_data: fetchedArrivalData }
        }]);

      return Response.json(fetchedArrivalData);
    }

    // Log the activity
    await supabase
      .from('parts_activity_log')
      .insert([{
        part_id: data.part_id,
        activity_type: 'arrival',
        activity_description: `Part arrival recorded: ${data.quantity_received} units`,
        actor_id: user.id,
        po_id: data.po_id,
        arrival_id: data.id,
        metadata: { arrival_data: data }
      }]);

    return Response.json(data);
  } catch (error) {
    console.error('Error in POST /api/parts/arrival:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}