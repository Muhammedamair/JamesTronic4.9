import { z } from 'zod';

export const PolicyTypeSchema = z.enum(['device_protection', 'repair_warranty', 'transit_insurance']);
export const ClaimStatusSchema = z.enum(['draft', 'submitted', 'under_review', 'approved', 'rejected', 'paid']);

export const providerSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    api_endpoint: z.string().nullable().optional(),
    is_active: z.boolean()
});

export const policySchema = z.object({
    id: z.string().uuid(),
    ticket_id: z.string().uuid().nullable().optional(),
    provider_id: z.string().uuid(),
    type: PolicyTypeSchema,
    policy_number: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    premium_amount: z.number(),
    liability_limit: z.number(),
    is_active: z.boolean(),

    // Joins
    provider: providerSchema.optional()
});

export type Policy = z.infer<typeof policySchema>;

export const claimSchema = z.object({
    id: z.string().uuid(),
    policy_id: z.string().uuid(),
    claim_type: z.string(),
    amount_claimed: z.number(),
    amount_approved: z.number().default(0),
    status: ClaimStatusSchema,
    description: z.string().nullable(),
    evidence_urls: z.array(z.string()).nullable().optional(),
    submitted_at: z.string().nullable(),
    resolved_at: z.string().nullable().optional(),
    created_at: z.string()
});

export type Claim = z.infer<typeof claimSchema>;

export const liabilityMetricsSchema = z.object({
    total_policies: z.number(),
    total_exposure: z.number(),
    active_claims_count: z.number(),
    pending_claims_amount: z.number()
});
