import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const MonitorStatusSchema = z.enum(['operational', 'degraded', 'down', 'maintenance']);
export const MonitorTypeSchema = z.enum(['database', 'api', 'auth', 'storage', 'external_service', 'worker']);
export const IncidentSeveritySchema = z.enum(['minor', 'major', 'critical']);
export const IncidentStatusSchema = z.enum(['investigating', 'identified', 'monitoring', 'resolved']);

// ============================================================================
// SCHEMAS
// ============================================================================

export const monitorSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    type: MonitorTypeSchema,
    endpoint: z.string().nullable(),
    current_status: MonitorStatusSchema,
    last_checked_at: z.string(),
    last_latency_ms: z.number().nullable(),
    uptime_percentage_24h: z.number().nullable()
});

export type Monitor = z.infer<typeof monitorSchema>;

export const systemIncidentSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    severity: IncidentSeveritySchema.nullable(),
    status: IncidentStatusSchema.nullable(),
    started_at: z.string().nullable(),
    resolved_at: z.string().nullable(),
    created_at: z.string()
});

export type SystemIncident = z.infer<typeof systemIncidentSchema>;
