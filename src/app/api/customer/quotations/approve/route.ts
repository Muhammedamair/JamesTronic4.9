import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCustomerIdFromAuth } from '@/lib/api/customer-auth-helpers';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
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

    // Parse request body
    const body = await request.json();
    const { ticket_id } = body;

    // Validate ticket_id
    const uuidSchema = z.string().uuid('Ticket ID must be a valid UUID');
    uuidSchema.parse(ticket_id);

    // Verify that the ticket belongs to the authenticated customer
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id')
      .eq('id', ticket_id)
      .eq('customer_id', customerId)
      .single();

    if (ticketError || !ticket) {
      return new Response(
        JSON.stringify({ error: 'Ticket not found or unauthorized' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the most recent quotation for this ticket
    const { data: quotation, error: quotationError } = await supabase
      .from('ticket_quotations')
      .select('*')
      .eq('ticket_id', ticket_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (quotationError || !quotation) {
      return new Response(
        JSON.stringify({ error: 'No quotation found for this ticket' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update the quotation status to approved
    const { error: updateError } = await supabase
      .from('ticket_quotations')
      .update({
        approved_by_customer: true,
        approved_at: new Date().toISOString(),
        status: 'approved'
      })
      .eq('id', quotation.id);

    if (updateError) {
      console.error('Error updating quotation:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to approve quotation' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update the ticket with the approved quotation reference
    const { error: ticketUpdateError } = await supabase
      .from('tickets')
      .update({
        current_quotation_id: quotation.id,
        status: 'in_progress', // Change status to reflect that work can now begin
      })
      .eq('id', ticket_id);

    if (ticketUpdateError) {
      console.error('Error updating ticket:', ticketUpdateError);
      // Note: This is not critical to the quotation approval, so we don't return an error here
    }

    // Add an event to the ticket timeline
    await supabase
      .from('ticket_events')
      .insert({
        ticket_id: ticket_id,
        event_type: 'quotation_approved',
        title: 'Quotation Approved',
        description: `Customer approved the quotation of ₹${quotation.quoted_price}`,
        created_by: null, // For customer events, we'll leave created_by as null
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Quotation approved successfully',
        quotation_id: quotation.id
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
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

    console.error('Error approving customer quotation:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}