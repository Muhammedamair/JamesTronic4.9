import { z } from 'zod';

export const TerritoryStatusSchema = z.enum([
    'analyzing',
    'open_for_franchise',
    'assigned',
    'active',
    'saturated'
]);

export const ApplicationStatusSchema = z.enum([
    'new',
    'screening',
    'interview',
    'approved',
    'rejected',
    'onboarding'
]);

export const territorySchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    city: z.string(),
    status: TerritoryStatusSchema,
    density_score: z.coerce.number().default(0),
    estimated_revenue_potential: z.coerce.number().optional().default(0),
    required_investment: z.coerce.number().optional().default(0)
});

export type Territory = z.infer<typeof territorySchema>;

export const applicationSchema = z.object({
    id: z.string().uuid(),
    territory_id: z.string().uuid().nullable().optional(),

    applicant_name: z.string(),
    email: z.string().email(),
    phone: z.string().nullable().optional(),

    status: ApplicationStatusSchema,

    financial_score: z.number(),
    experience_score: z.number(),
    location_score: z.number(),

    territory: territorySchema.optional() // Joined
});

export type Application = z.infer<typeof applicationSchema>;
