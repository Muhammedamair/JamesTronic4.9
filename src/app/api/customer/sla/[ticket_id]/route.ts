import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Create a Supabase client instance function
function getSupabaseClient() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
    },
  });
}

// Helper function to get customer ID from authenticated user
async function getCustomerIdFromAuth(token: string) {
  const supabase = getSupabaseClient();

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
  { params }: { params: Promise<{ ticket_id: string }> }
) {
  try {
    const { ticket_id: ticketId } = await params;

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

    const supabase = getSupabaseClient();

    // Check if the ticket belongs to the authenticated customer
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id')
      .eq('id', ticketId)
      .eq('customer_id', customerId)
      .single();

    if (ticketError || !ticket) {
      return new Response(
        JSON.stringify({ error: 'Ticket not found or unauthorized' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch SLA snapshot for the ticket
    const { data: slaSnapshot, error } = await supabase
      .from('customer_sla_snapshot')
      .select('*')
      .eq('ticket_id', ticketId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No SLA snapshot found, return a default response
        return new Response(
          JSON.stringify({
            ticket_id: ticketId,
            promised_hours: null,
            elapsed_hours: null,
            status: 'not_available',
            last_updated: null
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Failed to fetch SLA: ' + error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(slaSnapshot), {
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

    console.error('Error fetching customer SLA:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}