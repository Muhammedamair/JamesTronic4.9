import { createClient } from '@/utils/supabase/client';
import {
    FraudAlert,
    ActorRiskScore,
    InvestigationCase,
    SuspensionRecord,
    fraudAlertSchema,
    actorRiskScoreSchema,
    investigationCaseSchema,
    suspensionRecordSchema
} from '@/lib/types/fraud';
import { z } from 'zod';

const supabase = createClient();

export const fraudApi = {

    // =========================================================================
    // FRAUD ALERTS
    // =========================================================================

    getFraudAlerts: async (unresolvedOnly = true): Promise<FraudAlert[]> => {
        let query = supabase
            .from('fraud_alerts')
            .select('*')
            .order('detected_at', { ascending: false });

        if (unresolvedOnly) query = query.eq('is_resolved', false);

        const { data, error } = await query.limit(100);
        if (error) throw new Error(error.message);
        return z.array(fraudAlertSchema).parse(data);
    },

    getAlertsBySeverity: async (severity: string): Promise<FraudAlert[]> => {
        const { data, error } = await supabase
            .from('fraud_alerts')
            .select('*')
            .eq('severity', severity)
            .eq('is_resolved', false)
            .order('detected_at', { ascending: false });
        if (error) throw new Error(error.message);
        return z.array(fraudAlertSchema).parse(data);
    },

    acknowledgeAlert: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('fraud_alerts')
            .update({ is_acknowledged: true, acknowledged_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw new Error(error.message);
    },

    resolveAlert: async (id: string, notes: string): Promise<void> => {
        const { error } = await supabase
            .from('fraud_alerts')
            .update({
                is_resolved: true,
                resolution_notes: notes,
                resolved_at: new Date().toISOString()
            })
            .eq('id', id);
        if (error) throw new Error(error.message);
    },

    createFraudAlert: async (
        actorId: string,
        actorType: string,
        alertType: string,
        severity: string,
        title: string,
        description?: string
    ): Promise<string> => {
        const { data, error } = await supabase.rpc('rpc_create_fraud_alert', {
            p_actor_id: actorId,
            p_actor_type: actorType,
            p_alert_type: alertType,
            p_severity: severity,
            p_title: title,
            p_description: description || null
        });
        if (error) throw new Error(error.message);
        return data as string;
    },

    // =========================================================================
    // RISK SCORES
    // =========================================================================

    getRiskScores: async (): Promise<ActorRiskScore[]> => {
        const { data, error } = await supabase
            .from('actor_risk_scores')
            .select('*')
            .order('composite_risk_score', { ascending: false });
        if (error) throw new Error(error.message);
        return z.array(actorRiskScoreSchema).parse(data);
    },

    getHighRiskActors: async (): Promise<ActorRiskScore[]> => {
        const { data, error } = await supabase
            .from('actor_risk_scores')
            .select('*')
            .in('risk_tier', ['high', 'critical'])
            .order('composite_risk_score', { ascending: false });
        if (error) throw new Error(error.message);
        return z.array(actorRiskScoreSchema).parse(data);
    },

    calculateActorRisk: async (actorId: string, actorType: string): Promise<any> => {
        const { data, error } = await supabase.rpc('rpc_calculate_actor_risk', {
            p_actor_id: actorId,
            p_actor_type: actorType
        });
        if (error) throw new Error(error.message);
        return data;
    },

    // =========================================================================
    // INVESTIGATIONS
    // =========================================================================

    getInvestigations: async (activeOnly = true): Promise<InvestigationCase[]> => {
        let query = supabase.from('investigation_cases').select('*');

        if (activeOnly) {
            query = query.not('status', 'in', '("resolved_fraud_confirmed","resolved_false_positive","closed")');
        }

        const { data, error } = await query.order('opened_at', { ascending: false });
        if (error) throw new Error(error.message);
        return z.array(investigationCaseSchema).parse(data);
    },

    createInvestigation: async (
        actorId: string,
        actorType: string,
        title: string,
        description?: string,
        relatedAlertIds?: string[]
    ): Promise<InvestigationCase> => {
        const caseNumber = `CASE-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

        const { data, error } = await supabase
            .from('investigation_cases')
            .insert({
                case_number: caseNumber,
                actor_id: actorId,
                actor_type: actorType,
                title,
                description,
                related_alert_ids: relatedAlertIds || []
            })
            .select()
            .single();
        if (error) throw new Error(error.message);
        return investigationCaseSchema.parse(data);
    },

    // =========================================================================
    // SUSPENSIONS
    // =========================================================================

    getActiveSuspensions: async (): Promise<SuspensionRecord[]> => {
        const { data, error } = await supabase
            .from('suspension_records')
            .select('*')
            .eq('is_reinstated', false)
            .order('suspended_at', { ascending: false });
        if (error) throw new Error(error.message);
        return z.array(suspensionRecordSchema).parse(data);
    },

    suspendActor: async (
        actorId: string,
        actorType: string,
        reason: string,
        reasonDetails?: string
    ): Promise<string> => {
        const { data, error } = await supabase.rpc('rpc_suspend_actor', {
            p_actor_id: actorId,
            p_actor_type: actorType,
            p_reason: reason,
            p_reason_details: reasonDetails || null,
            p_is_automatic: false
        });
        if (error) throw new Error(error.message);
        return data as string;
    },

    reinstateActor: async (suspensionId: string, notes: string): Promise<void> => {
        const { error } = await supabase
            .from('suspension_records')
            .update({
                is_reinstated: true,
                reinstated_at: new Date().toISOString(),
                reinstatement_notes: notes
            })
            .eq('id', suspensionId);
        if (error) throw new Error(error.message);
    }
};
