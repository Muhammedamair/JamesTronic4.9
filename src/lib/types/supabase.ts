// Type definitions for our data models
export interface Customer {
  id: string;
  name: string;
  phone_e164: string;
  area?: string;
  created_at: string;
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