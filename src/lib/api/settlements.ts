import { supabase } from '@/lib/supabase/supabase';
import { z } from 'zod';

// Define Zod schemas for validation
const settlementSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  period_start: z.string(), // ISO date string
  period_end: z.string(), // ISO date string
  total_earnings: z.number(),
  commission_amount: z.number(),
  bonus_amount: z.number().nullable(),
  deduction_amount: z.number().nullable(),
  net_payout: z.number(),
  status: z.enum(['pending', 'processed', 'paid', 'cancelled']),
  processed_at: z.string().nullable(),
  processed_by: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const newSettlementSchema = z.object({
  user_id: z.string().uuid(),
  period_start: z.string(), // ISO date string
  period_end: z.string(), // ISO date string
  total_earnings: z.number().min(0),
  commission_amount: z.number().min(0),
  bonus_amount: z.number().optional().nullable(),
  deduction_amount: z.number().optional().nullable(),
  net_payout: z.number().min(0),
  status: z.enum(['pending', 'processed', 'paid', 'cancelled']).default('pending'),
  processed_at: z.string().optional().nullable(),
  processed_by: z.string().uuid().optional().nullable(),
});

// Type definitions
export type Settlement = z.infer<typeof settlementSchema>;
export type NewSettlement = z.infer<typeof newSettlementSchema>;

// API wrapper for settlements
export const settlementsApi = {
  // Fetch all settlements
  fetchAll: async (): Promise<Settlement[]> => {
    try {
      const { data, error } = await supabase
        .from('settlements') // Assuming a settlements table exists or will be created
        .select(`
          id,
          user_id,
          period_start,
          period_end,
          total_earnings,
          commission_amount,
          bonus_amount,
          deduction_amount,
          net_payout,
          status,
          processed_at,
          processed_by,
          created_at,
          updated_at
        `)
        .order('period_end', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      // Validate data with Zod
      const validatedData = z.array(settlementSchema).parse(data);
      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Zod validation error in fetchAll settlements:', error.issues);
        throw new Error('Data validation failed');
      }
      console.error('Error fetching settlements:', error);
      throw error;
    }
  },

  // Fetch settlement by ID
  fetchById: async (id: string): Promise<Settlement | null> => {
    try {
      const { data, error } = await supabase
        .from('settlements')
        .select(`
          id,
          user_id,
          period_start,
          period_end,
          total_earnings,
          commission_amount,
          bonus_amount,
          deduction_amount,
          net_payout,
          status,
          processed_at,
          processed_by,
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
      const validatedData = settlementSchema.parse(data);
      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Zod validation error in fetchById settlements:', error.issues);
        throw new Error('Data validation failed');
      }
      console.error('Error fetching settlement by ID:', error);
      throw error;
    }
  },

  // Create new settlement
  create: async (settlementData: NewSettlement): Promise<Settlement> => {
    try {
      // Validate input with Zod
      const validatedInput = newSettlementSchema.parse(settlementData);

      const { data, error } = await supabase
        .from('settlements')
        .insert([validatedInput])
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Validate returned data with Zod
      const validatedData = settlementSchema.parse(data);
      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Zod validation error in create settlement:', error.issues);
        throw new Error('Input validation failed');
      }
      console.error('Error creating settlement:', error);
      throw error;
    }
  },

  // Update settlement
  update: async (id: string, updates: Partial<NewSettlement>): Promise<Settlement> => {
    try {
      const { data, error } = await supabase
        .from('settlements')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Validate returned data with Zod
      const validatedData = settlementSchema.parse(data);
      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Zod validation error in update settlement:', error.issues);
        throw new Error('Input validation failed');
      }
      console.error('Error updating settlement:', error);
      throw error;
    }
  },

  // Delete settlement
  delete: async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('settlements')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(error.message);
      }

      return true;
    } catch (error) {
      console.error('Error deleting settlement:', error);
      throw error;
    }
  },
};