import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { assignmentLogger } from '@/lib/utils/assignment-logger';

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

// Zod schema for request validation
const assignTicketSchema = z.object({
  ticketId: z.string().uuid('Ticket ID must be a valid UUID'),
  technicianId: z.string().uuid('Technician ID must be a valid UUID'),
});

// Type for validated input
type AssignTicketInput = z.infer<typeof assignTicketSchema>;

export async function POST(request: NextRequest) {
  try {
    // Validate the request body
    const body: unknown = await request.json();
    const { ticketId, technicianId } = assignTicketSchema.parse(body);

    // Get the authenticated user from the request
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get user session to verify role
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify user role (must be admin or staff)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Only admin or staff can assign tickets.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify ticket exists
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, status, assigned_technician_id')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return new Response(
        JSON.stringify({ error: 'Ticket not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if ticket is already closed
    if (['Closed', 'Cancelled', 'Completed'].includes(ticket.status)) {
      return new Response(
        JSON.stringify({ error: 'Cannot assign a closed ticket' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify technician exists and has correct role
    const { data: technician, error: techError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', technicianId)
      .eq('role', 'technician')
      .single();

    if (techError || !technician) {
      return new Response(
        JSON.stringify({ error: 'Technician not found or invalid role' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the current assigned technician for logging purposes
    const oldTechnicianId = ticket.assigned_technician_id;

    // Update the ticket with the assigned technician
    const { data: updatedTicket, error: updateError } = await supabase
      .from('tickets')
      .update({
        assigned_technician_id: technicianId,
        status: 'Assigned',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to assign ticket: ' + updateError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Write to ticket_status_history
    const { error: historyError } = await supabase
      .from('ticket_status_history')
      .insert({
        ticket_id: ticketId,
        status: 'Assigned',
        note: `Ticket assigned to technician ID: ${technicianId}`,
        changed_by: user.id,
        changed_at: new Date().toISOString(),
      });

    if (historyError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create status history entry: ' + historyError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Log the assignment
    await assignmentLogger.logAssignment({
      ticketId,
      oldTechnicianId,
      newTechnicianId: technicianId,
      assignedBy: user.id,
      timestamp: new Date().toISOString(),
      slaStatus: null, // Placeholder - SLA logic not implemented yet
    });

    // Return the updated ticket with technician information
    const { data: technicianInfo, error: techInfoError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', technicianId)
      .single();

    if (techInfoError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch technician info: ' + techInfoError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Combine ticket data with technician info
    const result = {
      ...updatedTicket,
      assigned_technician: technicianInfo,
    };

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

    console.error('Error assigning ticket:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}