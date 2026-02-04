import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const SlotStatusSchema = z.enum(['available', 'booked', 'blocked', 'transit']);
export const AssignmentStatusSchema = z.enum(['proposed', 'accepted', 'rejected', 'completed', 'failed']);

// ============================================================================
// SCHEMAS
// ============================================================================

export const scheduleSlotSchema = z.object({
    id: z.string().uuid(),
    technician_id: z.string().uuid(),
    start_time: z.string(), // ISO
    end_time: z.string(),   // ISO
    status: SlotStatusSchema
});

export type ScheduleSlot = z.infer<typeof scheduleSlotSchema>;

export const techCandidateSchema = z.object({
    technician_id: z.string().uuid(),
    full_name: z.string().nullable(),
    current_lat: z.number().nullable(),
    current_lng: z.number().nullable(),
    distance_km: z.number(),
    match_score: z.number()
});

export type TechCandidate = z.infer<typeof techCandidateSchema>;

export const jobAssignmentSchema = z.object({
    id: z.string().uuid(),
    ticket_id: z.string().uuid(),
    technician_id: z.string().uuid().nullable(),
    status: AssignmentStatusSchema,
    match_score: z.number().nullable(),
    distance_km: z.number().nullable()
});

export type JobAssignment = z.infer<typeof jobAssignmentSchema>;
