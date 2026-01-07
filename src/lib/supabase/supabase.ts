import { createClient } from '@supabase/supabase-js';

// Define the Supabase URL and anonymous key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Re-export createClient so other modules can use it
export { createClient };

// Type definitions for our data models
export interface Customer {
  id: string;
  name: string;
  phone_e164: string;
  area?: string;
  created_at: string;
}

// We'll import the main Ticket type from the types file to ensure consistency
// and remove the local interface to avoid conflicts

export interface TicketStatusHistory {
  id: string;
  ticket_id: string;
  status: string;
  note?: string;
  changed_by?: string;
  changed_at: string;
}

export interface ActionLog {
  id: string;
  ticket_id?: string;
  action: string;
  meta?: Record<string, any>;
  actor?: string;
  created_at: string;
}