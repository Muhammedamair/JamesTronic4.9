import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const PerformanceTrendSchema = z.enum(['improving', 'stable', 'declining', 'volatile']);
export type PerformanceTrend = z.infer<typeof PerformanceTrendSchema>;

export const SkillLevelSchema = z.enum(['novice', 'competent', 'proficient', 'expert', 'master']);
export type SkillLevel = z.infer<typeof SkillLevelSchema>;

export const FeedbackSentimentSchema = z.enum(['positive', 'neutral', 'negative']);
export type FeedbackSentiment = z.infer<typeof FeedbackSentimentSchema>;

// ============================================================================
// SCHEMAS & TYPES
// ============================================================================

// Technician Performance Score
export const performanceScoreSchema = z.object({
    id: z.string().uuid(),
    technician_id: z.string().uuid(),
    score_date: z.string(),
    period_type: z.string(),
    repair_quality_score: z.number(),
    sla_compliance_score: z.number(),
    part_usage_honesty_score: z.number(),
    customer_satisfaction_score: z.number(),
    learning_application_score: z.number(),
    overall_score: z.number(),
    trend: PerformanceTrendSchema,
    jobs_completed: z.number(),
    created_at: z.string()
});
export type PerformanceScore = z.infer<typeof performanceScoreSchema>;

// Repair Quality Metric
export const repairQualityMetricSchema = z.object({
    id: z.string().uuid(),
    technician_id: z.string().uuid(),
    ticket_id: z.string().uuid().nullable(),
    is_first_time_fix: z.boolean(),
    comeback_within_30_days: z.boolean(),
    diagnosis_accuracy_score: z.number().nullable(),
    repair_completeness_score: z.number().nullable(),
    customer_rating: z.number().nullable(),
    sentiment: FeedbackSentimentSchema.nullable(),
    created_at: z.string()
});
export type RepairQualityMetric = z.infer<typeof repairQualityMetricSchema>;

// Skill Gap Analysis
export const skillGapSchema = z.object({
    id: z.string().uuid(),
    technician_id: z.string().uuid(),
    category: z.string(),
    current_skill_level: SkillLevelSchema,
    target_skill_level: SkillLevelSchema,
    gaps_detected: z.array(z.string()).nullable(),
    confidence_score: z.number(),
    is_active: z.boolean(),
    created_at: z.string()
});
export type SkillGap = z.infer<typeof skillGapSchema>;

// Training Recommendation
export const trainingRecommendationSchema = z.object({
    id: z.string().uuid(),
    technician_id: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    priority: z.string(),
    status: z.string(),
    assigned_at: z.string().nullable(),
    completed_at: z.string().nullable(),
    improvement_score: z.number().nullable(),
    created_at: z.string()
});
export type TrainingRecommendation = z.infer<typeof trainingRecommendationSchema>;
