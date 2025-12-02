// API route for suppliers
// /Users/mohammedamair/Downloads/JamesTronic_Prompt_Kit/james-tronic/src/app/api/parts/supplier/route.ts

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

// Zod schema for creating/updating suppliers
const supplierSchema = z.object({
  name: z.string().min(1),
  contact_person: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  zip_code: z.string().optional(),
  tax_id: z.string().optional(),
  payment_terms: z.string().optional(),
  delivery_terms: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
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

    // Verify user role - all authenticated users can read suppliers
    const role = await getUserRole();
    if (!role || !['admin', 'staff', 'technician'].includes(role)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('active');
    const sortBy = searchParams.get('sort') || 'name';
    const order = searchParams.get('order') || 'asc';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // Build query
    let query = supabase
      .from('supplier_list')
      .select('*')
      .order(sortBy as any, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    // Add filters
    if (isActive) {
      query = query.eq('is_active', isActive === 'true');
    } else {
      // By default, only show active suppliers
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching suppliers:', error);
      return Response.json({ error: 'Failed to fetch suppliers' }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    console.error('Error in GET /api/parts/supplier:', error);
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

    // Verify user role - only admin/staff can create suppliers
    const role = await getUserRole();
    if (role !== 'admin' && role !== 'staff') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = supplierSchema.safeParse(body);

    if (!validatedData.success) {
      return Response.json(
        { error: 'Invalid data', details: validatedData.error.issues },
        { status: 400 }
      );
    }

    // Add the creator to the data
    const supplierData = {
      ...validatedData.data,
      created_by: user.id,
    };

    // Insert the supplier
    const { data, error } = await supabase
      .from('supplier_list')
      .insert([supplierData])
      .select()
      .single();

    if (error) {
      console.error('Error creating supplier:', error);
      return Response.json({ error: 'Failed to create supplier' }, { status: 500 });
    }

    // Log the activity
    await supabase
      .from('parts_activity_log')
      .insert([{
        part_id: null, // No specific part associated
        activity_type: 'supplier_creation',
        activity_description: 'New supplier added',
        actor_id: user.id,
        metadata: { supplier_data: supplierData }
      }]);

    return Response.json(data);
  } catch (error) {
    console.error('Error in POST /api/parts/supplier:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}