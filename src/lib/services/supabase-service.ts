import { supabase, Customer, TicketStatusHistory, ActionLog } from '@/lib/supabase/supabase';
import { Ticket } from '@/lib/types/ticket';
import { dispatchNotificationEvent, handleTicketCreatedNotification, handleTechnicianAssignedNotification, handleJobCompletedNotification } from '@/lib/services/eventDispatcher';

// Customer service
export const customerService = {
  // Get all customers
  getAll: async (): Promise<Customer[]> => {
    const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching customers:', error);
      throw error;
    }

    return data || [];
  },

  // Get customer by ID
  getById: async (id: string): Promise<Customer | null> => {
    const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();

    if (error) {
      console.error('Error fetching customer:', error);
      throw error;
    }

    return data || null;
  },

  // Create a new customer
  create: async (customer: Omit<Customer, 'id' | 'created_at'>): Promise<Customer> => {
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { error } = await supabase.from('customers').delete().eq('id', id);

    if (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  },
};

// Ticket service
export const ticketService = {
  // Get all tickets
  getAll: async (): Promise<Ticket[]> => {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        customer:customers (name, phone_e164)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tickets:', error);
      throw error;
    }

    return data || [];
  },

  // Get ticket by ID
  getById: async (id: string): Promise<Ticket | null> => {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        customer:customers (name, phone_e164)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching ticket:', error);
      throw error;
    }

    return data || null;
  },

  // Create a new ticket
  create: async (ticket: Omit<Ticket, 'id' | 'created_at' | 'updated_at'>): Promise<Ticket> => {
    const { data, error } = await supabase
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

    // Add to status history
    try {
      await supabase
        .from('ticket_status_history')
        .insert([{
          ticket_id: data.id,
          status: 'pending',
          note: 'Ticket created',
        }]);
    } catch (historyError) {
      console.error('Error adding to status history:', historyError);
    }

    // Add to action logs
    try {
      await supabase
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
    const { data, error } = await supabase
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
    if ('technician_id' in updates && updates.technician_id) {
      try {
        await handleTechnicianAssignedNotification(data.id);
      } catch (notificationError) {
        console.error('Error triggering technician assigned notification:', notificationError);
      }
    }

    return data;
  },

  // Delete a ticket
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('tickets').delete().eq('id', id);

    if (error) {
      console.error('Error deleting ticket:', error);
      throw error;
    }
  },

  // Update ticket status
  updateStatus: async (id: string, status: string, reason?: string): Promise<Ticket> => {
    const { data, error } = await supabase
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
      await supabase
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
};

// Status history service
export const statusHistoryService = {
  // Get status history for a ticket
  getByTicketId: async (ticketId: string): Promise<TicketStatusHistory[]> => {
    const { data, error } = await supabase
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
};