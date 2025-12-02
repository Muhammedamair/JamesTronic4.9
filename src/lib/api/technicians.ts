import { supabase } from '@/lib/supabase/supabase';
import { z } from 'zod';

// Define Zod schemas for validation
const technicianSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  full_name: z.string().nullable(),
  role: z.enum(['admin', 'staff', 'technician', 'transporter']),
  created_at: z.string(),
  updated_at: z.string(),
  category_id: z.string().uuid().nullable(), // For technician specialization
});

const newTechnicianSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().nullable(),
  role: z.enum(['admin', 'staff', 'technician', 'transporter']).default('technician'),
  category_id: z.string().uuid().optional().nullable(), // For technician specialization
});

// Type definitions
export type Technician = z.infer<typeof technicianSchema>;
export type NewTechnician = z.infer<typeof newTechnicianSchema>;

// API wrapper for technicians
export const technicianApi = {
  // Fetch all technicians
  fetchAll: async (): Promise<Technician[]> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          full_name,
          role,
          created_at,
          updated_at,
          category_id
        `)
        .eq('role', 'technician')
        .order('full_name', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      // Validate data with Zod
      const validatedData = z.array(technicianSchema).parse(data);
      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Zod validation error in fetchAll technicians:', error.issues);
        throw new Error('Data validation failed');
      }
      console.error('Error fetching technicians:', error);
      throw error;
    }
  },

  // Fetch technician by ID
  fetchById: async (id: string): Promise<Technician | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          full_name,
          role,
          created_at,
          updated_at,
          category_id
        `)
        .eq('id', id)
        .eq('role', 'technician')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Record not found, return null
          return null;
        }
        throw new Error(error.message);
      }

      // Validate data with Zod
      const validatedData = technicianSchema.parse(data);
      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Zod validation error in fetchById technicians:', error.issues);
        throw new Error('Data validation failed');
      }
      console.error('Error fetching technician by ID:', error);
      throw error;
    }
  },

  // Create a new technician
  create: async (technicianData: NewTechnician): Promise<Technician> => {
    try {
      // Validate input with Zod
      const validatedInput = newTechnicianSchema.parse(technicianData);

      const { data, error } = await supabase
        .from('profiles')
        .insert([validatedInput])
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Validate returned data with Zod
      const validatedData = technicianSchema.parse(data);
      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Zod validation error in create technician:', error.issues);
        throw new Error('Input validation failed');
      }
      console.error('Error creating technician:', error);
      throw error;
    }
  },

  // Update a technician
  update: async (id: string, updates: Partial<NewTechnician>): Promise<Technician> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .eq('role', 'technician')
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Validate returned data with Zod
      const validatedData = technicianSchema.parse(data);
      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Zod validation error in update technician:', error.issues);
        throw new Error('Input validation failed');
      }
      console.error('Error updating technician:', error);
      throw error;
    }
  },

  // Delete a technician
  delete: async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id)
        .eq('role', 'technician');

      if (error) {
        throw new Error(error.message);
      }

      return true;
    } catch (error) {
      console.error('Error deleting technician:', error);
      throw error;
    }
  },
};