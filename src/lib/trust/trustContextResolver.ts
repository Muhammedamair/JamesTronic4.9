import { Ticket } from '../types/ticket';

// Define more flexible ticket type for broader compatibility
interface FlexibleTicket {
  id: string;
  device_category?: string;
  brand?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  assigned_technician_id?: string | null;
  assigned_transporter_id?: string | null;
  customer_id?: string;
  model?: string | null;
  size_inches?: number | null;
  issue_summary?: string | null;
  issue_details?: string | null;
  quoted_price?: number | null;
  status_reason?: string | null;
  created_by?: string | null;
  customer?: any;
  assigned_technician?: any;
  assigned_transporter?: any;
  [key: string]: any; // Allow additional properties for compatibility
}

// Flexible SLA Snapshot type for broader compatibility
interface FlexibleSlaSnapshot {
  status: string; // Allow string type to accommodate customer API data
  promised_hours: number | null;
  elapsed_hours: number | null;
  [key: string]: any; // Allow additional properties
}

/**
 * Trust Context Resolver
 * Reads current state and resolves overall trust context
 */
export interface TrustContext {
  ticket: Ticket;
  slaStatus: 'on_track' | 'at_risk' | 'breached' | 'completed';
  partDependency: {
    required: boolean;
    status: 'not_needed' | 'ordered' | 'delayed' | 'available';
    estimatedWaitHours?: number;
  };
  technicianStatus: 'assigned' | 'not_assigned' | 'delayed';
  customerFeedbackState: 'not_requested' | 'pending' | 'completed';
  overallTrustLevel: 'high' | 'medium' | 'low' | 'critical';
}

// Flexible input interface to accept customer data
export interface TrustContextInput {
  ticket: FlexibleTicket;
  slaSnapshot?: FlexibleSlaSnapshot | null;
  partStatus?: {
    required: boolean;
    status: 'not_needed' | 'ordered' | 'delayed' | 'available';
    estimated_wait_hours?: number;
  };
  technicianStatus?: 'assigned' | 'not_assigned' | 'delayed';
  customerFeedbackState?: 'not_requested' | 'pending' | 'completed';
}

export const trustContextResolver = (input: TrustContextInput): TrustContext => {
  const { ticket, slaSnapshot, partStatus, technicianStatus: techStatus, customerFeedbackState } = input;

  // Determine SLA status
  let slaStatus: 'on_track' | 'at_risk' | 'breached' | 'completed' = 'on_track';
  if (ticket.status === 'Completed') {
    slaStatus = 'completed';
  } else if (slaSnapshot) {
    // Convert the string status to the expected enum values, handling nullable values
    const status = slaSnapshot.status?.toLowerCase();
    if (status === 'breached') {
      slaStatus = 'breached';
    } else if (slaSnapshot.elapsed_hours != null && slaSnapshot.promised_hours != null && slaSnapshot.promised_hours > 0 &&
               slaSnapshot.elapsed_hours >= slaSnapshot.promised_hours * 0.8) {
      // At risk if we're at 80% of the promised time
      slaStatus = 'at_risk';
    } else if (status === 'fulfilled') {
      slaStatus = 'completed';
    } else {
      slaStatus = 'on_track';
    }
  }

  // Determine part dependency
  const resolvedPartStatus = partStatus || {
    required: false,
    status: 'not_needed' as const
  };

  // Determine technician status
  const resolvedTechStatus = techStatus ||
    (ticket.assigned_technician_id ? 'assigned' : 'not_assigned');

  // Determine customer feedback state
  const resolvedFeedbackState = customerFeedbackState || 'not_requested';

  // Create a normalized ticket that conforms to the expected Ticket type
  const normalizedTicket: Ticket = {
    id: ticket.id,
    customer_id: ticket.customer_id || '',
    assigned_technician_id: ticket.assigned_technician_id || null,
    assigned_transporter_id: ticket.assigned_transporter_id || null,
    device_category: ticket.device_category || 'Device',
    brand: ticket.brand || null,
    model: ticket.model || null,
    size_inches: ticket.size_inches || null,
    issue_summary: ticket.issue_summary || null,
    issue_details: ticket.issue_details || null,
    quoted_price: ticket.quoted_price || null,
    status: ticket.status,
    status_reason: ticket.status_reason || null,
    created_by: ticket.created_by || null,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
    customer: ticket.customer || null,
    assigned_technician: ticket.assigned_technician || null,
    assigned_transporter: ticket.assigned_transporter || null
  };

  // Calculate overall trust level based on all factors
  let overallTrustLevel: 'high' | 'medium' | 'low' | 'critical' = 'high';

  // Trust level degrades based on multiple risk factors
  if (slaStatus === 'breached' || resolvedPartStatus.status === 'delayed') {
    overallTrustLevel = 'critical';
  } else if (slaStatus === 'at_risk' || resolvedTechStatus === 'not_assigned') {
    overallTrustLevel = 'low';
  } else if (resolvedPartStatus.status === 'ordered') {
    overallTrustLevel = 'medium';
  }

  return {
    ticket: normalizedTicket,
    slaStatus,
    partDependency: resolvedPartStatus,
    technicianStatus: resolvedTechStatus,
    customerFeedbackState: resolvedFeedbackState,
    overallTrustLevel
  };
};