export type AiContext = 'admin_cockpit' | 'technician_mentor' | 'transporter_dispatch';

export interface AiBrainResponse {
  summary: string;
  opportunities: string[];
  risks: string[];
  metrics_used: string[];
  confidence_score: number; // 0-100
  action_items?: {
    action: string;
    priority: 'high' | 'medium' | 'low';
    target_engine?: string;
  }[];
}

export interface AiRequestPayload {
  context: AiContext;
  user_role: string;
  question?: string;
  metrics_snapshot?: Record<string, any>;
  entity_type?: string; // C15.1: Optional entity context for value function scoring
  entity_id?: string; // C15.1: Optional entity ID for context building
}

export interface BrainPack {
  name: string;
  persona_override?: string;
  system_prompt_template: string;
  required_metrics: string[];
}
