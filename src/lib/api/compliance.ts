import { createClient } from '@/utils/supabase/client';
import {
    CompliancePolicy, compliancePolicySchema,
    ComplianceViolation, complianceViolationSchema,
    AiAuditLog, aiAuditLogSchema,
    ComplianceOverview, complianceOverviewSchema
} from '@/lib/types/compliance';
import { z } from 'zod';

const supabase = createClient();

export const complianceApi = {

    // =========================================================================
    // READ
    // =========================================================================

    getOverview: async (): Promise<ComplianceOverview> => {
        const { data, error } = await supabase.rpc('rpc_get_compliance_overview');
        if (error) throw new Error(error.message);
        return complianceOverviewSchema.parse(data);
    },

    getPolicies: async (): Promise<CompliancePolicy[]> => {
        const { data, error } = await supabase
            .from('compliance_policies')
            .select('*')
            .order('category');

        if (error) throw new Error(error.message);
        return z.array(compliancePolicySchema).parse(data);
    },

    getViolations: async (limit = 30): Promise<ComplianceViolation[]> => {
        const { data, error } = await supabase
            .from('compliance_violations')
            .select(`
            *,
            policy:compliance_policies(*)
        `)
            .order('detected_at', { ascending: false })
            .limit(limit);

        if (error) throw new Error(error.message);
        return z.array(complianceViolationSchema).parse(data);
    },

    getAuditLogs: async (limit = 50): Promise<AiAuditLog[]> => {
        const { data, error } = await supabase
            .from('ai_audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw new Error(error.message);
        return z.array(aiAuditLogSchema).parse(data);
    },

    // =========================================================================
    // ACTIONS
    // =========================================================================

    resolveViolation: async (id: string, notes: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
            .from('compliance_violations')
            .update({
                status: 'resolved',
                resolution_notes: notes,
                resolved_at: new Date().toISOString(),
                resolved_by: user?.id
            })
            .eq('id', id);

        if (error) throw new Error(error.message);
    },

    togglePolicy: async (id: string, isActive: boolean) => {
        const { error } = await supabase
            .from('compliance_policies')
            .update({ is_active: isActive })
            .eq('id', id);

        if (error) throw new Error(error.message);
    },

    triggerAudit: async () => {
        const { error } = await supabase.rpc('rpc_trigger_auto_audit');
        if (error) throw new Error(error.message);
    }
};
