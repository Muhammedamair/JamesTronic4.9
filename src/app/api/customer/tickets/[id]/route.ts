import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Initialize Supabase client using environment variables
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
);

// Helper function to get customer ID from authenticated user
async function getCustomerIdFromAuth(token: string) {
  // Get user session to verify role
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return null;
  }

  // Get customer from phone number (since customers log in with phone)
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('phone_e164', user.phone)
    .single();

  if (customerError || !customer) {
    return null;
  }

  return customer.id;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params;

    // Validate ticket ID format
    const uuidSchema = z.string().uuid('Ticket ID must be a valid UUID');
    uuidSchema.parse(ticketId);

    // Get the authenticated user from the request
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get customer ID from authenticated user
    const customerId = await getCustomerIdFromAuth(token);
    if (!customerId) {
      return new Response(
        JSON.stringify({ error: 'Customer not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch specific ticket with related information
    const { data: ticket, error } = await supabase
      .from('tickets')
      .select(`
        *,
        assigned_technician:profiles(full_name, id),
        customer:customers(name, phone_e164),
        status_history:ticket_status_history(*)
      `)
      .eq('id', ticketId)
      .eq('customer_id', customerId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return new Response(
          JSON.stringify({ error: 'Ticket not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Failed to fetch ticket: ' + error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the associated SLA snapshot
    let slaSnapshot = null;
    try {
      const { data: slaData, error: slaError } = await supabase
        .from('customer_sla_snapshot')
        .select('*')
        .eq('ticket_id', ticketId)
        .single();

      if (slaData) {
        slaSnapshot = slaData;
      }
    } catch (error) {
      // If no SLA snapshot exists, that's fine - we just return null
      console.error(`Error fetching SLA for ticket ${ticketId}:`, error);
    }

    // Return ticket with SLA snapshot
    const ticketWithSLA = {
      ...ticket,
      sla_snapshot: slaSnapshot
    };

    return new Response(JSON.stringify(ticketWithSLA), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          details: error.issues.map((issue: any) => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.error('Error fetching customer ticket:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}