import { supabase } from '@/lib/supabase/supabase';
import { z } from 'zod';

// Define Zod schemas for validation
const zoneSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  pincodes: z.array(z.string()).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const newZoneSchema = z.object({
  name: z.string(),
  description: z.string().optional().nullable(),
  pincodes: z.array(z.string()).optional().nullable(),
});

// Type definitions
export type Zone = z.infer<typeof zoneSchema>;
export type NewZone = z.infer<typeof newZoneSchema>;

// API wrapper for zones
export const zoneApi = {
  // Fetch all zones
  fetchAll: async (): Promise<Zone[]> => {
    try {
      const { data, error } = await supabase
        .from('zones')
        .select(`
          id,
          name,
          description,
          pincodes,
          created_at,
          updated_at
        `)
        .order('name', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      // Validate data with Zod
      const validatedData = z.array(zoneSchema).parse(data);
      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Zod validation error in fetchAll zones:', error.issues);
        throw new Error('Data validation failed');
      }
      console.error('Error fetching zones:', error);
      throw error;
    }
  },

  // Fetch zone by ID
  fetchById: async (id: string): Promise<Zone | null> => {
    try {
      const { data, error } = await supabase
        .from('zones')
        .select(`
          id,
          name,
          description,
          pincodes,
          created_at,
          updated_at
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

      // Validate data with Zod
      const validatedData = zoneSchema.parse(data);
      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Zod validation error in fetchById zones:', error.issues);
        throw new Error('Data validation failed');
      }
      console.error('Error fetching zone by ID:', error);
      throw error;
    }
  },

  // Create a new zone
  create: async (zoneData: NewZone): Promise<Zone> => {
    try {
      // Validate input with Zod
      const validatedInput = newZoneSchema.parse(zoneData);

      const { data, error } = await supabase
        .from('zones')
        .insert([validatedInput])
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Validate returned data with Zod
      const validatedData = zoneSchema.parse(data);
      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Zod validation error in create zone:', error.issues);
        throw new Error('Input validation failed');
      }
      console.error('Error creating zone:', error);
      throw error;
    }
  },

  // Update a zone
  update: async (id: string, updates: Partial<NewZone>): Promise<Zone> => {
    try {
      const { data, error } = await supabase
        .from('zones')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Validate returned data with Zod
      const validatedData = zoneSchema.parse(data);
      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Zod validation error in update zone:', error.issues);
        throw new Error('Input validation failed');
      }
      console.error('Error updating zone:', error);
      throw error;
    }
  },

  // Delete a zone
  delete: async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('zones')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(error.message);
      }

      return true;
    } catch (error) {
      console.error('Error deleting zone:', error);
      throw error;
    }
  },
};