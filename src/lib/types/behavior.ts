import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const LTVBandSchema = z.enum(['low', 'medium', 'high', 'vip', 'strategic']);
export const ChurnRiskSchema = z.enum(['safe', 'low_risk', 'medium_risk', 'high_risk', 'imminent_churn']);
export const BehaviorTagSchema = z.enum([
    'price_sensitive', 'quality_seeker', 'time_sensitive', 'high_trust',
    'frequent_disputer', 'brand_loyalist', 'new_customer'
]);

// ============================================================================
// SCHEMAS & TYPES
// ============================================================================

// Behavior Profile
export const behaviorProfileSchema = z.object({
    user_id: z.string().uuid(),
    ltv_score: z.number().nullable(),
    ltv_band: LTVBandSchema.nullable(),
    churn_score: z.number().nullable(),
    churn_risk: ChurnRiskSchema.nullable(),
    behavior_tags: z.array(BehaviorTagSchema).nullable(),
    ai_summary: z.string().nullable(),
    last_analyzed_at: z.string()
});
export type BehaviorProfile = z.infer<typeof behaviorProfileSchema>;

// Metrics
export const interactionMetricsSchema = z.object({
    user_id: z.string().uuid(),
    total_spend: z.number(),
    total_bookings: z.number(),
    avg_order_value: z.number(),
    last_updated_at: z.string()
});
export type InteractionMetrics = z.infer<typeof interactionMetricsSchema>;

// Combined Insight
export const customerInsightSchema = z.object({
    profile: behaviorProfileSchema.nullable(),
    metrics: interactionMetricsSchema.nullable()
});
export type CustomerInsight = z.infer<typeof customerInsightSchema>;
