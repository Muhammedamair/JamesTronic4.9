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

// Zod schema for feedback validation
const feedbackSchema = z.object({
  ticket_id: z.string().uuid('Ticket ID must be a valid UUID'),
  rating: z.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
  review: z.string().max(1000, 'Review must be less than 1000 characters').optional().nullable(),
});

// Type for validated input
type FeedbackInput = z.infer<typeof feedbackSchema>;

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

export async function POST(request: NextRequest) {
  try {
    // Validate the request body
    const body: unknown = await request.json();
    const { ticket_id, rating, review } = feedbackSchema.parse(body);

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
      .eq('id', ticket_id)
      .eq('customer_id', customerId)
      .single();

    if (ticketError || !ticket) {
      return new Response(
        JSON.stringify({ error: 'Ticket not found or unauthorized' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if feedback already exists for this ticket
    const { data: existingFeedback, error: existingFeedbackError } = await supabase
      .from('customer_feedback')
      .select('ticket_id')
      .eq('ticket_id', ticket_id)
      .single();

    let result;
    if (existingFeedback) {
      // Update existing feedback
      const { data, error } = await supabase
        .from('customer_feedback')
        .update({
          rating,
          review: review || null,
          created_at: new Date().toISOString()
        })
        .eq('ticket_id', ticket_id)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to update feedback: ' + error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      result = data;
    } else {
      // Insert new feedback
      const { data, error } = await supabase
        .from('customer_feedback')
        .insert({
          ticket_id,
          rating,
          review: review || null
        })
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to submit feedback: ' + error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      result = data;
    }

    return new Response(JSON.stringify(result), {
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

    console.error('Error submitting customer feedback:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}