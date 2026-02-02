import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const BinTypeSchema = z.enum(['fast_moving', 'standard', 'bulk', 'secure']);
export const BinStatusSchema = z.enum(['empty', 'partial', 'full', 'blocked']);

// ============================================================================
// SCHEMAS
// ============================================================================

export const binSchema = z.object({
    id: z.string().uuid(),
    branch_id: z.string().uuid(),
    bin_code: z.string(),
    type: BinTypeSchema,
    status: BinStatusSchema,
    capacity_units: z.number(),
    current_load_units: z.number(),
    last_audited_at: z.string().nullable()
});

export type Bin = z.infer<typeof binSchema>;

export const storeMetricsSchema = z.object({
    total_bins: z.number(),
    full_bins: z.number(),
    utilization: z.number(),
    active_techs: z.number(),
    queue_depth: z.number()
});

export type StoreMetrics = z.infer<typeof storeMetricsSchema>;

export const technicianQueueSchema = z.object({
    id: z.string().uuid(),
    technician_id: z.string().uuid(),
    branch_id: z.string().uuid(),
    current_ticket_count: z.number(),
    status: z.string(),
    technician_name: z.string().optional() // Computed or joined
});

export type TechnicianQueue = z.infer<typeof technicianQueueSchema>;
