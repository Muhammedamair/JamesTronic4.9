import { z } from 'zod';

export const ComplianceSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const ViolationStatusSchema = z.enum(['open', 'investigating', 'resolved', 'dismissed']);

export const compliancePolicySchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable().optional(),
    category: z.string(),
    severity: ComplianceSeveritySchema,
    is_active: z.boolean(),
    metadata: z.any().optional(),
    created_at: z.string()
});

export type CompliancePolicy = z.infer<typeof compliancePolicySchema>;

export const complianceViolationSchema = z.object({
    id: z.string().uuid(),
    policy_id: z.string().uuid().nullable().optional(),
    detected_at: z.string(),
    severity: ComplianceSeveritySchema,
    status: ViolationStatusSchema,
    description: z.string(),
    reference_id: z.string().nullable().optional(),
    evidence_meta: z.any().optional(),
    resolved_at: z.string().nullable().optional(),
    resolved_by: z.string().uuid().nullable().optional(),
    resolution_notes: z.string().nullable().optional(),
    created_at: z.string(),

    // Joined
    policy: compliancePolicySchema.optional()
});

export type ComplianceViolation = z.infer<typeof complianceViolationSchema>;

export const aiAuditLogSchema = z.object({
    id: z.string().uuid(),
    ai_module: z.string(),
    action_taken: z.string(),
    data_points: z.any().optional(),
    result_meta: z.any().optional(),
    confidence_score: z.coerce.number().nullable().optional(),
    ethical_check_passed: z.boolean(),
    fairness_score: z.coerce.number().nullable().optional(),
    user_id: z.string().uuid().nullable().optional(),
    created_at: z.string()
});

export type AiAuditLog = z.infer<typeof aiAuditLogSchema>;

export const complianceOverviewSchema = z.object({
    critical_violations: z.number(),
    active_violations: z.number(),
    policy_adherence_rate: z.number(),
    last_audit_date: z.string()
});

export type ComplianceOverview = z.infer<typeof complianceOverviewSchema>;
