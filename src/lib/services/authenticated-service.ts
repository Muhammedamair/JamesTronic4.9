
import { Customer, TicketStatusHistory, ActionLog } from '@/lib/supabase/supabase';
import { Ticket } from '@/lib/types/ticket';
import { dispatchNotificationEvent, handleTicketCreatedNotification, handleTechnicianAssignedNotification, handleJobCompletedNotification } from '@/lib/services/eventDispatcher';

// Define the ticket type with joined customer data
export interface TicketWithCustomer extends Omit<Ticket, 'customer_id'> {
  customer: Pick<Customer, 'name' | 'phone_e164' | 'area'> | null;
}

// Customer service that accepts an authenticated client
export const createCustomerService = (client: any) => ({
  // Get all customers
  getAll: async (): Promise<Customer[]> => {
    const { data, error } = await client.from('customers').select('*').order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching customers:', error);
      throw error;
    }

    return data || [];
  },

  // Get customer by ID
  getById: async (id: string): Promise<Customer | null> => {
    const { data, error } = await client.from('customers').select('*').eq('id', id).single();

    if (error) {
      console.error('Error fetching customer:', error);
      throw error;
    }

    return data || null;
  },

  // Create a new customer
  create: async (customer: Omit<Customer, 'id' | 'created_at'>): Promise<Customer> => {
    const { data, error } = await client
      .from('customers')
      .insert([{ ...customer }])
      .select()
      .single();

    if (error) {
      console.error('Error creating customer:', error);
      throw error;
    }

    return data;
  },

  // Update a customer
  update: async (id: string, updates: Partial<Customer>): Promise<Customer> => {
    const { data, error } = await client
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating customer:', error);
      throw error;
    }

    return data;
  },

  // Delete a customer
  delete: async (id: string): Promise<void> => {
    const { error } = await client.from('customers').delete().eq('id', id);

    if (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  },
});

// Input type for creating tickets - without relations that are only for display
type CreateTicketInput = {
  customer_id: string;
  device_category: string;
  brand?: string | null;
  model?: string | null;
  size_inches?: number | null;
  issue_summary?: string | null;
  issue_details?: string | null;
  quoted_price?: number | null;
  status: string;
  status_reason?: string | null;
  created_by?: string | null;
  assigned_technician_id?: string | null;
  assigned_transporter_id?: string | null;
  branch_id?: string | null;
};

// Ticket service that accepts an authenticated client
export const createTicketService = (client: any) => ({
  // Get all tickets (with pagination)
  getAll: async (page: number = 1, pageSize: number = 20): Promise<{ data: TicketWithCustomer[], hasMore: boolean }> => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize;

    // Using a single query with joins to avoid N+1 problem
    const { data, error, count } = await client
      .from('tickets')
      .select(`
        id,
        customer_id,
        assigned_technician_id,
        device_category,
        brand,
        model,
        size_inches,
        issue_summary,
        issue_details,
        quoted_price,
        status,
        status_reason,
        created_by,
        created_at,
        updated_at,
        customers!inner (
          id,
          name,
          phone_e164,
          area
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching tickets:', error);
      throw error;
    }

    // Transform the data to match the expected TicketWithCustomer interface
    const transformedData = data.map((ticket: any) => ({
      ...ticket,
      customer: ticket.customers,
    }));

    const hasMore = count ? count > page * pageSize : false;
    return { data: transformedData, hasMore };
  },

  // Get all tickets without pagination (for backward compatibility) - optimized to avoid N+1
  getAllUnpaginated: async (): Promise<TicketWithCustomer[]> => {
    // Using a single query with joins to avoid N+1 problem
    // Note: RLS policies will automatically filter tickets based on user role
    const { data, error } = await client
      .from('tickets')
      .select(`
        id,
        customer_id,
        assigned_technician_id,
        device_category,
        brand,
        model,
        size_inches,
        issue_summary,
        issue_details,
        quoted_price,
        status,
        status_reason,
        created_by,
        created_at,
        updated_at,
        customers!inner (
          id,
          name,
          phone_e164,
          area
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tickets:', error);
      throw error;
    }

    // Transform the data to match the expected TicketWithCustomer interface
    return data.map((ticket: any) => ({
      ...ticket,
      customer: ticket.customers,
    }));
  },

  // Get tickets by technician ID (for technician view) - optimized to avoid N+1
  getByTechnicianId: async (technicianId: string, page: number = 1, pageSize: number = 20): Promise<{ data: TicketWithCustomer[], hasMore: boolean }> => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize;

    // Using a single query with joins to avoid N+1 problem
    // Note: The actual filtering is handled by RLS policies. For technicians,
    // they can see tickets assigned to them OR unassigned tickets.
    // We'll fetch using the client which will respect RLS policies.
    const { data, error, count } = await client
      .from('tickets')
      .select(`
        id,
        customer_id,
        assigned_technician_id,
        device_category,
        brand,
        model,
        size_inches,
        issue_summary,
        issue_details,
        quoted_price,
        status,
        status_reason,
        created_by,
        created_at,
        updated_at,
        customers!inner (
          id,
          name,
          phone_e164,
          area
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching tickets for technician:', error);
      throw error;
    }

    // Transform the data to match the expected TicketWithCustomer interface
    const transformedData = data.map((ticket: any) => ({
      ...ticket,
      customer: ticket.customers,
    }));

    const hasMore = count ? count > page * pageSize : false;
    return { data: transformedData, hasMore };
  },

  // Get ticket by ID
  getById: async (id: string): Promise<TicketWithCustomer | null> => {
    const { data, error } = await client
      .from('tickets')
      .select(`
        id,
        customer_id,
        assigned_technician_id,
        device_category,
        brand,
        model,
        size_inches,
        issue_summary,
        issue_details,
        quoted_price,
        status,
        status_reason,
        created_by,
        created_at,
        updated_at,
        customers!inner (
          id,
          name,
          phone_e164,
          area
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching ticket:', error);
      throw error;
    }

    if (!data) return null;

    return {
      ...data,
      customer: data.customers,
    };
  },

  // Create a new ticket
  create: async (ticket: CreateTicketInput): Promise<Ticket> => {
    const { data, error } = await client
      .from('tickets')
      .insert([{
        ...ticket,
        // Add any default values if needed
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating ticket:', error);
      throw error;
    }

    // Add to action logs
    try {
      await client
        .from('action_logs')
        .insert([{
          ticket_id: data.id,
          action: 'create',
          meta: { ticket_data: data },
        }]);
    } catch (logError) {
      console.error('Error creating action log:', logError);
    }

    // Trigger notification for ticket creation
    try {
      await handleTicketCreatedNotification(data.id);
    } catch (notificationError) {
      console.error('Error triggering ticket created notification:', notificationError);
    }

    return data;
  },

  // Update a ticket
  update: async (id: string, updates: Partial<Ticket>): Promise<Ticket> => {
    const { data, error } = await client
      .from('tickets')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating ticket:', error);
      throw error;
    }

    // Trigger notification for technician assignment
    if ('assigned_technician_id' in updates && updates.assigned_technician_id) {
      try {
        await handleTechnicianAssignedNotification(data.id);
      } catch (notificationError) {
        console.error('Error triggering technician assigned notification:', notificationError);
      }
    }

    return data;
  },

  // Assign a ticket to a technician
  assignToTechnician: async (ticketId: string, technicianId: string): Promise<Ticket> => {
    const { data, error } = await client
      .from('tickets')
      .update({ assigned_technician_id: technicianId })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) {
      console.error('Error assigning ticket to technician:', error);
      throw error;
    }

    // Trigger notification for technician assignment
    try {
      await handleTechnicianAssignedNotification(ticketId);
    } catch (notificationError) {
      console.error('Error triggering technician assigned notification:', notificationError);
    }

    return data;
  },

  // Unassign a ticket from a technician
  unassignFromTechnician: async (ticketId: string): Promise<Ticket> => {
    const { data, error } = await client
      .from('tickets')
      .update({ assigned_technician_id: null })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) {
      console.error('Error unassigning ticket from technician:', error);
      throw error;
    }

    return data;
  },

  // Delete a ticket
  delete: async (id: string): Promise<void> => {
    const { error } = await client.from('tickets').delete().eq('id', id);

    if (error) {
      console.error('Error deleting ticket:', error);
      throw error;
    }
  },

  // Update ticket status
  updateStatus: async (id: string, status: string, reason?: string): Promise<Ticket> => {
    const { data, error } = await client
      .from('tickets')
      .update({
        status,
        status_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating ticket status:', error);
      throw error;
    }

    // Add to status history
    try {
      await client
        .from('ticket_status_history')
        .insert([{
          ticket_id: id,
          status,
          note: reason,
        }]);
    } catch (historyError) {
      console.error('Error adding to status history:', historyError);
    }

    // Trigger notification for job completion
    if (status === 'completed') {
      try {
        await handleJobCompletedNotification(id);
      } catch (notificationError) {
        console.error('Error triggering job completed notification:', notificationError);
      }
    }

    return data;
  },
});

// Status history service that accepts an authenticated client
export const createStatusHistoryService = (client: any) => ({
  // Get status history for a ticket
  getByTicketId: async (ticketId: string): Promise<TicketStatusHistory[]> => {
    const { data, error } = await client
      .from('ticket_status_history')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('changed_at', { ascending: false });

    if (error) {
      console.error('Error fetching status history:', error);
      throw error;
    }

    return data || [];
  },
});
