import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const IncidentSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>;

export const IncidentTypeSchema = z.enum([
    'late_arrival',
    'early_departure',
    'missed_shift',
    'customer_complaint',
    'sla_breach',
    'device_violation',
    'location_anomaly',
    'quality_issue',
    'fraud_flag',
    'other'
]);
export type IncidentType = z.infer<typeof IncidentTypeSchema>;

// ============================================================================
// SCHEMAS & TYPES
// ============================================================================

// Workforce Shift
export const workforceShiftSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    shift_date: z.string(), // YYYY-MM-DD
    expected_start: z.string(), // HH:MM:SS
    expected_end: z.string(), // HH:MM:SS
    branch_id: z.string().uuid().nullable(),
    notes: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
});
export type WorkforceShift = z.infer<typeof workforceShiftSchema>;

// Workforce Attendance
export const workforceAttendanceSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    shift_id: z.string().uuid().nullable(),
    check_in_at: z.string().nullable(), // ISO timestamp
    check_in_lat: z.number().nullable(),
    check_in_lng: z.number().nullable(),
    check_out_at: z.string().nullable(), // ISO timestamp
    check_out_lat: z.number().nullable(),
    check_out_lng: z.number().nullable(),
    actual_duration_minutes: z.number().nullable(),
    late_minutes: z.number().default(0),
    early_departure_minutes: z.number().default(0),
    notes: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
});
export type WorkforceAttendance = z.infer<typeof workforceAttendanceSchema>;

// Workforce Incident
export const workforceIncidentSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    incident_type: IncidentTypeSchema,
    severity: IncidentSeveritySchema,
    description: z.string(),
    ticket_id: z.string().uuid().nullable().optional(),
    transport_job_id: z.string().uuid().nullable().optional(),
    reported_by: z.string().uuid().nullable(),
    resolved_at: z.string().nullable(),
    resolution_notes: z.string().nullable(),
    created_at: z.string()
});
export type WorkforceIncident = z.infer<typeof workforceIncidentSchema>;

// Workforce Behaviour Score
export const workforceBehaviourScoreSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    score_date: z.string(), // YYYY-MM-DD
    reliability_score: z.number().min(0).max(100),
    punctuality_score: z.number().min(0).max(100),
    quality_score: z.number().min(0).max(100),
    incident_factor: z.number().min(0).max(100),
    composite_score: z.number().min(0).max(100),
    jobs_counted: z.number(),
    incidents_counted: z.number(),
    created_at: z.string(),
    updated_at: z.string()
});
export type WorkforceBehaviourScore = z.infer<typeof workforceBehaviourScoreSchema>;

// Workforce Performance Daily
export const workforcePerformanceDailySchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    performance_date: z.string(), // YYYY-MM-DD
    jobs_completed: z.number(),
    jobs_failed: z.number(),
    jobs_reassigned: z.number(),
    avg_job_duration_minutes: z.number().nullable(),
    customer_rating_avg: z.number().nullable(),
    sla_compliance_rate: z.number().nullable(),
    created_at: z.string(),
    updated_at: z.string()
});
export type WorkforcePerformanceDaily = z.infer<typeof workforcePerformanceDailySchema>;

// RPC Return Type for Daily Score
export const workforceDailyScoreResultSchema = z.object({
    user_id: z.string().uuid(),
    score_date: z.string(),
    reliability_score: z.number(),
    punctuality_score: z.number(),
    quality_score: z.number(),
    incident_factor: z.number(),
    composite_score: z.number()
});
export type WorkforceDailyScoreResult = z.infer<typeof workforceDailyScoreResultSchema>;
