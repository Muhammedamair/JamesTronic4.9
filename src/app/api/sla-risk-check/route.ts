// src/app/api/sla-risk-check/route.ts
// API route to check SLA risks and trigger notifications for all tickets

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { checkAndTriggerSLARiskNotification, PauseResumeLog, VendorDelay } from '@/lib/utils/enhanced-sla-utils';
import { PartRequest } from '@/lib/api/parts';

// Define types for our data
interface TicketWithCustomer {
  id: string;
  customer_id: string;
  device_category: string;
  created_at: string;
  completed_at?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin/staff access
    // In a real implementation, you would verify the user has the right role
    // For now, we'll just proceed for testing purposes

    const supabase = await createClient();

    // Fetch all active tickets (not completed)
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('id, customer_id, device_category, created_at, completed_at')
      .is('completed_at', null) // Only non-completed tickets
      .gt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

    if (ticketsError) {
      console.error('Error fetching tickets:', ticketsError);
      return Response.json({ error: 'Failed to fetch tickets' }, { status: 500 });
    }

    let notificationsTriggered = 0;

    // Check each ticket for SLA risk and trigger notifications if needed
    for (const ticket of tickets || []) {
      try {
        // Fetch related data for this ticket
        const { data: pauseResumeLogs } = await supabase
          .from('ticket_pause_resume_logs')
          .select('*')
          .eq('ticket_id', ticket.id);

        const { data: partRequests } = await supabase
          .from('part_requests')
          .select('*')
          .eq('ticket_id', ticket.id);

        const { data: vendorDelays } = await supabase
          .from('vendor_delays')
          .select('*')
          .eq('ticket_id', ticket.id);

        // Check and trigger SLA risk notification
        const triggered = await checkAndTriggerSLARiskNotification(
          ticket as any,
          pauseResumeLogs as PauseResumeLog[] || [],
          partRequests as PartRequest[] || [],
          vendorDelays as VendorDelay[] || []
        );

        if (triggered) {
          notificationsTriggered++;
        }
      } catch (ticketError) {
        console.error(`Error processing ticket ${ticket.id}:`, ticketError);
        // Continue with the next ticket even if one fails
      }
    }

    return Response.json({
      message: 'SLA risk check completed',
      notificationsTriggered,
      ticketsChecked: tickets?.length || 0
    });
  } catch (error) {
    console.error('Error in SLA risk check API:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';