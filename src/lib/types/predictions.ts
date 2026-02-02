import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const PredictionTypeSchema = z.enum([
    'success_probability', 'comeback_risk', 'warranty_claim_risk', 'repair_complexity'
]);
export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export const PredictionStatusSchema = z.enum(['pending', 'calculated', 'validated', 'incorrect']);

// ============================================================================
// SCHEMAS & TYPES
// ============================================================================

// Prediction Log
export const predictionLogSchema = z.object({
    id: z.string().uuid(),
    ticket_id: z.string().uuid(),
    model_id: z.string().uuid().nullable(),
    prediction_type: PredictionTypeSchema,
    predicted_value: z.number().nullable(),
    risk_level: RiskLevelSchema.nullable(),
    confidence_score: z.number().nullable(),
    explanation_text: z.string().nullable(),
    actual_outcome_value: z.number().nullable(),
    status: PredictionStatusSchema,
    created_at: z.string()
});
export type PredictionLog = z.infer<typeof predictionLogSchema>;

// Simulation Result
export const predictionResultSchema = z.object({
    success_probability: z.number(),
    risk_level: RiskLevelSchema,
    explanation: z.string(),
    comeback_probability: z.number()
});
export type PredictionResult = z.infer<typeof predictionResultSchema>;
