import { supabase } from '@/lib/supabase/supabase';
import { Ticket, NewTicket, ticketSchema, newTicketSchema } from '@/lib/types/ticket';
import { z } from 'zod';

// Technician for assignment
const technicianForAssignmentSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  full_name: z.string().nullable(),
  role: z.enum(['admin', 'staff', 'technician', 'transporter']),
  category_id: z.string().uuid().nullable(), // For technician specialization
});

export type TechnicianForAssignment = z.infer<typeof technicianForAssignmentSchema>;

// API wrapper for tickets
export const ticketApi = {
  // Fetch all tickets
  fetchAll: async (): Promise<Ticket[]> => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          id,
          customer_id,
          assigned_technician_id,
          assigned_transporter_id,
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
          customers (name, phone_e164)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      // Transform the data to match the expected ticket format
      const transformedData = data.map(item => ({
        ...item,
        customer: item.customers?.[0] || null, // Convert array to single object
        assigned_technician: null, // Will be populated if available in the full select
        assigned_transporter: null, // Will be populated if available in the full select
      })) as Ticket[];

      return transformedData;
    } catch (error) {
      console.error('Error fetching tickets:', error);
      throw error;
    }
  },

  // Fetch ticket by ID
  fetchById: async (id: string): Promise<Ticket | null> => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          id,
          customer_id,
          assigned_technician_id,
          assigned_transporter_id,
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
          customers (name, phone_e164)
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Record not found, return null
          return null;
        }
        throw new Error(error.message);
      }

      // Transform the data to match the expected ticket format
      const transformedData = {
        ...data,
        customer: data.customers?.[0] || null, // Convert array to single object
        assigned_technician: null, // Will be null since not in select
        assigned_transporter: null, // Will be null since not in select
      } as Ticket;

      return transformedData;
    } catch (error) {
      console.error('Error fetching ticket by ID:', error);
      throw error;
    }
  },

  // Create a new ticket
  create: async (ticketData: NewTicket): Promise<Ticket> => {
    try {
      // Validate input with Zod
      const validatedInput = newTicketSchema.parse(ticketData);

      const { data, error } = await supabase
        .from('tickets')
        .insert([validatedInput])
        .select(`
          id,
          customer_id,
          assigned_technician_id,
          assigned_transporter_id,
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
          customers (name, phone_e164)
        `)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Transform the data to match the expected ticket format
      const transformedData = {
        ...data,
        customer: data.customers?.[0] || null, // Convert array to single object
        assigned_technician: null, // Will be null since not in select
        assigned_transporter: null, // Will be null since not in select
      } as Ticket;

      return transformedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Zod validation error in create ticket:', error.issues);
        throw new Error('Input validation failed');
      }
      console.error('Error creating ticket:', error);
      throw error;
    }
  },

  // Update a ticket
  update: async (id: string, updates: Partial<NewTicket>): Promise<Ticket> => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .update(updates)
        .eq('id', id)
        .select(`
          id,
          customer_id,
          assigned_technician_id,
          assigned_transporter_id,
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
          customers (name, phone_e164)
        `)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Transform the data to match the expected ticket format
      const transformedData = {
        ...data,
        customer: data.customers?.[0] || null, // Convert array to single object
        assigned_technician: null, // Will be null since not in select
        assigned_transporter: null, // Will be null since not in select
      } as Ticket;

      return transformedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Zod validation error in update ticket:', error.issues);
        throw new Error('Input validation failed');
      }
      console.error('Error updating ticket:', error);
      throw error;
    }
  },

  // Delete a ticket
  delete: async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(error.message);
      }

      return true;
    } catch (error) {
      console.error('Error deleting ticket:', error);
      throw error;
    }
  },

  // Assign a ticket to a technician
  assignTicket: async (ticketId: string, technicianId: string): Promise<Ticket> => {
    try {
      // Validate inputs with Zod
      z.string().uuid().parse(ticketId);
      z.string().uuid().parse(technicianId);

      // Call the API route to assign the ticket
      const response = await fetch('/api/tickets/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await supabase.auth.getSession().then(result => result.data?.session?.access_token || '')}`,
        },
        body: JSON.stringify({
          ticketId,
          technicianId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to assign ticket');
      }

      const data = await response.json();

      // Since assignTicket returns from the API route which should have the proper structure
      return data as Ticket;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Zod validation error in assignTicket:', error.issues);
        throw new Error('Input validation failed');
      }
      console.error('Error assigning ticket:', error);
      throw error;
    }
  },

  // Get technicians that can be assigned to tickets
  getAssignableTechnicians: async (zone?: string): Promise<TechnicianForAssignment[]> => {
    try {
      let query = supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          full_name,
          role,
          category_id
        `)
        .eq('role', 'technician');

      if (zone) {
        // We would join with a zones table or technician zones table if we had one
        // For now, we'll just select all technicians
        // This is a placeholder implementation
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(error.message);
      }

      // Validate data with Zod
      const validatedData = z.array(technicianForAssignmentSchema).parse(data);
      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Zod validation error in getAssignableTechnicians:', error.issues);
        throw new Error('Data validation failed');
      }
      console.error('Error fetching assignable technicians:', error);
      throw error;
    }
  },
};