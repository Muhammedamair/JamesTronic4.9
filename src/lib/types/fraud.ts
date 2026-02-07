import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const ActorTypeSchema = z.enum([
    'technician', 'transporter', 'dealer', 'customer', 'staff', 'system'
]);
export type ActorType = z.infer<typeof ActorTypeSchema>;

export const FraudAlertSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type FraudAlertSeverity = z.infer<typeof FraudAlertSeveritySchema>;

export const FraudAlertTypeSchema = z.enum([
    'behavioral_anomaly', 'financial_irregularity', 'parts_authenticity',
    'time_manipulation', 'gps_manipulation', 'quality_concern', 'comeback_rate',
    'suspicious_pattern', 'identity_fraud', 'collusion_suspected'
]);
export type FraudAlertType = z.infer<typeof FraudAlertTypeSchema>;

export const InvestigationStatusSchema = z.enum([
    'pending', 'in_progress', 'evidence_gathered', 'awaiting_review',
    'resolved_fraud_confirmed', 'resolved_false_positive', 'escalated', 'closed'
]);
export type InvestigationStatus = z.infer<typeof InvestigationStatusSchema>;

// ============================================================================
// SCHEMAS & TYPES
// ============================================================================

// Fraud Alert
export const fraudAlertSchema = z.object({
    id: z.string().uuid(),
    actor_id: z.string().uuid(),
    actor_type: ActorTypeSchema,
    actor_name: z.string().nullable(),
    alert_type: FraudAlertTypeSchema,
    severity: FraudAlertSeveritySchema,
    title: z.string(),
    description: z.string().nullable(),
    evidence: z.any(),
    risk_score: z.number(),
    confidence_score: z.number(),
    is_acknowledged: z.boolean(),
    is_resolved: z.boolean(),
    detected_at: z.string(),
    created_at: z.string()
});
export type FraudAlert = z.infer<typeof fraudAlertSchema>;

// Actor Risk Score
export const actorRiskScoreSchema = z.object({
    id: z.string().uuid(),
    actor_id: z.string().uuid(),
    actor_type: ActorTypeSchema,
    actor_name: z.string().nullable(),
    behavioral_anomaly_score: z.number(),
    pattern_inconsistency_score: z.number(),
    historical_risk_score: z.number(),
    network_anomaly_score: z.number(),
    external_risk_score: z.number(),
    composite_risk_score: z.number(),
    risk_tier: z.string(),
    total_alerts: z.number(),
    unresolved_alerts: z.number(),
    last_calculated_at: z.string(),
    created_at: z.string()
});
export type ActorRiskScore = z.infer<typeof actorRiskScoreSchema>;

// Investigation Case
export const investigationCaseSchema = z.object({
    id: z.string().uuid(),
    case_number: z.string().nullable(),
    actor_id: z.string().uuid(),
    actor_type: ActorTypeSchema,
    actor_name: z.string().nullable(),
    title: z.string(),
    description: z.string().nullable(),
    status: InvestigationStatusSchema,
    priority: FraudAlertSeveritySchema,
    estimated_loss: z.number().nullable(),
    recovered_amount: z.number().nullable(),
    opened_at: z.string(),
    created_at: z.string()
});
export type InvestigationCase = z.infer<typeof investigationCaseSchema>;

// Suspension Record
export const suspensionRecordSchema = z.object({
    id: z.string().uuid(),
    actor_id: z.string().uuid(),
    actor_type: ActorTypeSchema,
    actor_name: z.string().nullable(),
    reason: z.string(),
    reason_details: z.string().nullable(),
    is_automatic: z.boolean(),
    suspended_at: z.string(),
    suspended_until: z.string().nullable(),
    is_reinstated: z.boolean(),
    created_at: z.string()
});
export type SuspensionRecord = z.infer<typeof suspensionRecordSchema>;
