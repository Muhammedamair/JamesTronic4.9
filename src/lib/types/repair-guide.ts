import { z } from 'zod';

export const CautionTypeSchema = z.enum(['none', 'info', 'warning', 'critical']);

export const repairStepSchema = z.object({
    id: z.string().uuid(),
    guide_id: z.string().uuid(),
    order_index: z.number(),
    instruction: z.string(),
    caution_type: CautionTypeSchema,
    image_url: z.string().nullable().optional()
});

export type RepairStep = z.infer<typeof repairStepSchema>;

export const repairGuideSchema = z.object({
    id: z.string().uuid(),
    device_model: z.string(),
    title: z.string(),
    difficulty: z.enum(['Easy', 'Medium', 'Hard', 'Expert']),
    estim_time_mins: z.number(),
    steps: z.array(repairStepSchema).optional()
});

export type RepairGuide = z.infer<typeof repairGuideSchema>;

export const repairLogSchema = z.object({
    id: z.string().uuid(),
    ticket_id: z.string().uuid().optional(),
    guide_id: z.string().uuid(),
    step_index: z.number(),
    completed_at: z.string()
});
