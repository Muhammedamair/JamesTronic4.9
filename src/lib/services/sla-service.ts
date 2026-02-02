// SLA Service for interacting with SLA data
import { SupabaseClient } from '@supabase/supabase-js';

export interface TicketSLAState {
  ticket_id: string;
  branch_id: string;
  technician_id?: string;
  customer_id: string;
  eta_at: string; // ISO string
  eta_window_minutes: number;
  confidence: number;
  allocated_minutes: number;
  elapsed_minutes: number;
  progress_pct: number;
  risk_score: number;
  risk_level: number;
  burn_rate: number;
  blocker_code?: string;
  clock_paused: boolean;
  clock_pause_reason?: string;
  clock_pause_until?: string;
  last_recalc_at: string; // ISO string
  updated_at: string; // ISO string
}

export interface TicketSLALedger {
  id: string;
  ticket_id: string;
  changed_at: string; // ISO string
  old_eta_at?: string; // ISO string
  new_eta_at: string; // ISO string
  old_confidence?: number;
  new_confidence: number;
  old_risk_score?: number;
  new_risk_score: number;
  reason_code: string;
  reason_meta: any;
  actor_id?: string;
  actor_role?: string;
  source: 'system' | 'manual';
  signature?: string;
}

export interface SLAPolicy {
  id: string;
  name: string;
  scope: 'global' | 'branch' | 'category' | 'service';
  branch_id?: string;
  device_category?: string;
  service_type?: string;
  base_minutes: number;
  logic: any;
  active: boolean;
  created_at: string; // ISO string
  updated_at: string; // ISO string
}

export interface SLAAlert {
  id: string;
  ticket_id: string;
  branch_id: string;
  created_at: string; // ISO string
  risk_level: number;
  alert_code: string;
  message: string;
  targets: string[];
  acknowledged_at?: string; // ISO string
  acknowledged_by?: string;
  meta: any;
}

export interface RiskSnapshot {
  id: string;
  ticket_id: string;
  branch_id: string;
  technician_id?: string;
  captured_at: string; // ISO string
  risk_score: number;
  risk_level: number;
  burn_rate: number;
  progress_pct: number;
  blocker_code?: string;
  meta: any;
}

export interface SLAService {
  getTicketSLAState(ticketId: string): Promise<TicketSLAState | null>;
  getTicketSLALedger(ticketId: string): Promise<TicketSLALedger[]>;
  getSLAPolicies(scope?: string, branchId?: string, category?: string): Promise<SLAPolicy[]>;
  getSLAAlerts(ticketId?: string, branchId?: string): Promise<SLAAlert[]>;
  getRiskSnapshots(ticketId?: string, branchId?: string): Promise<RiskSnapshot[]>;
  getTicketsAtRisk(branchId?: string): Promise<TicketSLAState[]>;
}

export const createSLAService = (supabase: SupabaseClient) => {
  const service: SLAService = {
    async getTicketSLAState(ticketId: string): Promise<TicketSLAState | null> {
      const { data, error } = await supabase
        .from('ticket_sla_state')
        .select('*')
        .eq('ticket_id', ticketId)
        .single();

      if (error) {
        console.error('Error fetching ticket SLA state:', error);
        throw error;
      }

      return data;
    },

    async getTicketSLALedger(ticketId: string): Promise<TicketSLALedger[]> {
      const { data, error } = await supabase
        .from('ticket_sla_ledger')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('changed_at', { ascending: false });

      if (error) {
        console.error('Error fetching ticket SLA ledger:', error);
        throw error;
      }

      return data || [];
    },

    async getSLAPolicies(scope?: string, branchId?: string, category?: string): Promise<SLAPolicy[]> {
      let query = supabase.from('sla_policies').select('*').eq('active', true);
      
      if (scope) {
        query = query.eq('scope', scope);
      }
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      if (category) {
        query = query.eq('device_category', category);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching SLA policies:', error);
        throw error;
      }

      return data || [];
    },

    async getSLAAlerts(ticketId?: string, branchId?: string): Promise<SLAAlert[]> {
      let query = supabase.from('sla_alerts').select('*');
      
      if (ticketId) {
        query = query.eq('ticket_id', ticketId);
      }
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching SLA alerts:', error);
        throw error;
      }

      return data || [];
    },

    async getRiskSnapshots(ticketId?: string, branchId?: string): Promise<RiskSnapshot[]> {
      let query = supabase.from('risk_snapshots').select('*');
      
      if (ticketId) {
        query = query.eq('ticket_id', ticketId);
      }
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query.order('captured_at', { ascending: false }).limit(50); // Limit for performance

      if (error) {
        console.error('Error fetching risk snapshots:', error);
        throw error;
      }

      return data || [];
    },

    async getTicketsAtRisk(branchId?: string): Promise<TicketSLAState[]> {
      let query = supabase.from('ticket_sla_state').select('*').gt('risk_level', 0);
      
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query.order('risk_score', { ascending: false });

      if (error) {
        console.error('Error fetching tickets at risk:', error);
        throw error;
      }

      return data || [];
    }
  };

  return service;
};