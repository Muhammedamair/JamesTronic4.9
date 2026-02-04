import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSupabaseClient, getCustomerIdFromAuth } from '@/lib/api/customer-auth-helpers';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters for pagination
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100); // Max 100 per page
    const offset = (page - 1) * limit;

    // Get the authenticated user from the request (header or cookies)
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const authContext = await getCustomerIdFromAuth(token);

    if (!authContext) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { customerId, supabase } = authContext;

    // Fetch paginated ticket events for tickets belonging to this customer
    const { data: events, error, count } = await supabase
      .from('ticket_events')
      .select(`
        *,
        ticket:tickets!ticket_events_ticket_id_fkey (id, device_category, brand, model)
      `, { count: 'exact' })
      .eq('tickets.customer_id', customerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch timeline events: ' + error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Transform the data to match the expected format
    const transformedEvents = events.map((event: any) => ({
      id: event.id,
      ticket_id: event.ticket_id,
      event_type: event.event_type,
      title: event.title,
      description: event.description,
      created_at: event.created_at,
      ticket: event.ticket ? {
        id: event.ticket.id,
        device_category: event.ticket.device_category,
        brand: event.ticket.brand,
        model: event.ticket.model
      } : null
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil((count || 0) / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const response = {
      events: transformedEvents,
      pagination: {
        currentPage: page,
        totalPages,
        totalEvents: count,
        hasNextPage,
        hasPrevPage,
        pageSize: limit
      }
    };

    return new Response(JSON.stringify(response), {
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

    console.error('Error fetching customer timeline events:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}