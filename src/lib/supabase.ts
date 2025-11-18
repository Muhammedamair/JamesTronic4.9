import { createClient } from '@supabase/supabase-js';

// Define the Supabase URL and anonymous key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions for our data models
export interface Customer {
  id: string;
  name: string;
  phone_e164: string;
  area?: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  customer_id: string;
  assigned_technician_id?: string; // ID of the technician assigned to this ticket
  device_category: string;
  brand?: string;
  model?: string;
  size_inches?: number;
  issue_summary: string;
  issue_details?: string;
  quoted_price?: number;
  status: string;
  status_reason?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

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