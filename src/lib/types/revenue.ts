import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const LeakageSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const LeakageStatusSchema = z.enum([
    'detected', 'investigating', 'confirmed_loss', 'false_positive', 'recovered', 'resolved'
]);

// ============================================================================
// SCHEMAS
// ============================================================================

export const leakageRuleSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    severity: LeakageSeveritySchema,
    is_active: z.boolean()
});

export const leakageAlertSchema = z.object({
    id: z.string(), // Relaxed from uuid() to allow non-standard simulation IDs
    rule_id: z.string().nullable(),
    ticket_id: z.string().nullable(), // Relaxed validation
    severity: LeakageSeveritySchema,
    status: LeakageStatusSchema,
    detected_at: z.string(),
    estimated_loss_amount: z.number(), // INR
    resolution_notes: z.string().nullable(),

    // Joins (optional)
    rule: leakageRuleSchema.optional().nullable()
});

export type LeakageAlert = z.infer<typeof leakageAlertSchema>;

export const scanResultSchema = z.object({
    success: z.boolean(),
    alert_id: z.string().uuid().optional(),
    message: z.string()
});
