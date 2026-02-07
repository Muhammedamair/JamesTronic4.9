
import { createClient as createBrowserClient } from '@/utils/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AiModule =
    | 'policy_guard'
    | 'value_function'
    | 'ai_processor'
    | 'ai_orchestrator'
    | 'action_dispatcher'
    | 'admin'
    | 'ai_brain';

/**
 * Canonical keys for data_points in ai_audit_logs.
 * All new audit logs SHOULD use these keys for consistency.
 * The UI helper provides backward compatibility for legacy keys.
 */
export interface CanonicalDataPoints {
    /** Entity type (e.g., 'ticket', 'user', 'transaction') */
    entity_type?: string | null;
    /** Entity ID (UUID or identifier) */
    entity_id?: string | null;
    /** Related AI event ID */
    event_id?: string | null;
    /** Related recommendation ID */
    recommendation_id?: string | null;
    /** Previous status before action */
    old_status?: string | null;
    /** New status after action */
    new_status?: string | null;
    /** Admin review notes */
    review_notes?: string | null;
    /** User ID who performed the action */
    reviewed_by?: string | null;
    /** Human-readable reviewer name */
    reviewer_name?: string | null;
    /** Reviewer email */
    reviewer_email?: string | null;
    /** Allow additional keys for flexibility */
    [key: string]: any;
}

export interface AuditLogParams {
    ai_module: AiModule;
    action_taken: string;
    data_points?: CanonicalDataPoints;
    result_meta?: Record<string, any>;
    confidence_score?: number | null;
    user_id?: string | null;
    ethical_check_passed?: boolean | null;
    fairness_score?: number | null;
}

export class AuditLoggerService {
    /**
     * Logs an action to the central ai_audit_logs table.
     * @param params The audit log details
     * @param client Optional Supabase client (required for server-side usage to maintain auth context)
     */
    static async log(params: AuditLogParams, client?: SupabaseClient): Promise<void> {
        // Use provided client (server authenticated) or fall back to browser client (anon/current session)
        const supabase = client || createBrowserClient();

        const { error } = await supabase
            .from('ai_audit_logs')
            .insert({
                ai_module: params.ai_module,
                action_taken: params.action_taken,
                data_points: params.data_points || {},
                result_meta: params.result_meta || {},
                confidence_score: params.confidence_score ?? null,
                user_id: params.user_id ?? null,
                ethical_check_passed: params.ethical_check_passed ?? null,
                fairness_score: params.fairness_score ?? null,
                // created_at is handled by DB default
            });

        if (error) {
            console.error('[AuditLogger] Failed to log audit entry:', error);
            // We do not throw here to prevent disrupting the main flow
        }
    }
}

