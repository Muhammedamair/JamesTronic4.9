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

export async function GET(request: NextRequest) {
  try {
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

    // Fetch customer's tickets with related information
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select(`
        *,
        assigned_technician:profiles(full_name, id),
        customer:customers(name, phone_e164)
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch tickets: ' + error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // For each ticket, fetch the associated SLA snapshot
    const ticketsWithSLA = await Promise.all(tickets.map(async (ticket) => {
      try {
        const { data: slaData, error: slaError } = await supabase
          .from('customer_sla_snapshot')
          .select('*')
          .eq('ticket_id', ticket.id)
          .single();

        return {
          ...ticket,
          sla_snapshot: slaData || null
        };
      } catch (error) {
        console.error(`Error fetching SLA for ticket ${ticket.id}:`, error);
        return {
          ...ticket,
          sla_snapshot: null
        };
      }
    }));

    return new Response(JSON.stringify(ticketsWithSLA), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching customer tickets:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}