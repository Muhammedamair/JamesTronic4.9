import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const DarkStoreStatusSchema = z.enum([
    'planning', 'under_construction', 'pilot', 'active', 'inactive', 'closed'
]);
export type DarkStoreStatus = z.infer<typeof DarkStoreStatusSchema>;

export const ExpansionPhaseSchema = z.enum(['phase_1', 'phase_2', 'phase_3', 'future']);
export type ExpansionPhase = z.infer<typeof ExpansionPhaseSchema>;

export const LocationGradeSchema = z.enum(['A', 'B', 'C', 'D']);
export type LocationGrade = z.infer<typeof LocationGradeSchema>;

// ============================================================================
// SCHEMAS & TYPES
// ============================================================================

// Dark Store
export const darkStoreSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    code: z.string().nullable(),
    city: z.string(),
    state: z.string().nullable(),
    address: z.string().nullable(),
    pincode: z.string().nullable(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    status: DarkStoreStatusSchema,
    max_daily_capacity: z.number(),
    current_technicians: z.number(),
    max_technicians: z.number(),
    service_radius_km: z.number(),
    estimated_population_served: z.number().nullable(),
    opened_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
});
export type DarkStore = z.infer<typeof darkStoreSchema>;

// Location Score
export const locationScoreSchema = z.object({
    id: z.string().uuid(),
    city: z.string(),
    area_name: z.string().nullable(),
    pincode: z.string().nullable(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    demand_density_score: z.number(),
    travel_efficiency_score: z.number(),
    competition_score: z.number(),
    infrastructure_score: z.number(),
    economic_viability_score: z.number(),
    composite_score: z.number(),
    grade: LocationGradeSchema,
    analyzed_at: z.string(),
    created_at: z.string()
});
export type LocationScore = z.infer<typeof locationScoreSchema>;

// Expansion Plan
export const expansionPlanSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    phase: ExpansionPhaseSchema,
    target_city: z.string(),
    target_stores: z.number(),
    target_technicians: z.number(),
    estimated_investment: z.number().nullable(),
    projected_monthly_revenue: z.number().nullable(),
    planned_start_date: z.string().nullable(),
    planned_launch_date: z.string().nullable(),
    status: z.string(),
    created_at: z.string(),
    updated_at: z.string()
});
export type ExpansionPlan = z.infer<typeof expansionPlanSchema>;

// Workload Distribution
export const workloadDistributionSchema = z.object({
    id: z.string().uuid(),
    dark_store_id: z.string().uuid(),
    distribution_date: z.string(),
    jobs_assigned: z.number(),
    jobs_completed: z.number(),
    jobs_pending: z.number(),
    technicians_active: z.number(),
    capacity_utilization: z.number(),
    is_overloaded: z.boolean(),
    overflow_jobs: z.number(),
    created_at: z.string()
});
export type WorkloadDistribution = z.infer<typeof workloadDistributionSchema>;

// ============================================================================
// AUDIT & COMPUTE RUN SCHEMAS (C20 Phase 3)
// ============================================================================

export const ExpansionAuditLogSchema = z.object({
    id: z.string().uuid(),
    ai_module: z.string(),
    event_type: z.string(),
    city_id: z.string().uuid().nullable(),
    payload: z.record(z.string(), z.unknown()).nullable(),
    user_id: z.string().uuid().nullable(),
    role: z.string().nullable(),
    details: z.record(z.string(), z.unknown()).nullable(),
    created_at: z.string()
});
export type ExpansionAuditLog = z.infer<typeof ExpansionAuditLogSchema>;

export const ComputeJobTypeSchema = z.enum(['build_demand_points', 'build_travel_matrix']);
export type ComputeJobType = z.infer<typeof ComputeJobTypeSchema>;

export const ComputeRunStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed']);
export type ComputeRunStatus = z.infer<typeof ComputeRunStatusSchema>;

export const ExpansionComputeRunSchema = z.object({
    id: z.string().uuid(),
    job_type: ComputeJobTypeSchema,
    city_id: z.string().uuid(),
    status: ComputeRunStatusSchema,
    started_at: z.string().nullable(),
    completed_at: z.string().nullable(),
    inputs_hash: z.string().nullable(),
    rows_affected: z.number().nullable(),
    warnings: z.array(z.string()).nullable(),
    error_message: z.string().nullable(),
    triggered_by: z.string().uuid().nullable(),
    created_at: z.string()
});
export type ExpansionComputeRun = z.infer<typeof ExpansionComputeRunSchema>;

// API Response schemas
export const AuditPaginationSchema = z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    hasMore: z.boolean()
});

export const AuditApiResponseSchema = z.object({
    success: z.boolean(),
    data: z.array(ExpansionAuditLogSchema),
    pagination: AuditPaginationSchema
});
export type AuditApiResponse = z.infer<typeof AuditApiResponseSchema>;
