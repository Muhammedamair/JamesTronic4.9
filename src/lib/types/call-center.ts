import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const CallStatusSchema = z.enum(['queued', 'in_progress', 'completed', 'dropped', 'escalated', 'scheduled_callback']);
export const CallDirectionSchema = z.enum(['inbound', 'outbound']);
export const CallLanguageSchema = z.enum(['en', 'hi', 'te', 'mixed']);
export const SentimentLabelSchema = z.enum(['very_positive', 'positive', 'neutral', 'negative', 'very_negative', 'frustrated']);

// ============================================================================
// SCHEMAS & TYPES
// ============================================================================

// Call Log
export const callLogSchema = z.object({
    id: z.string().uuid(),
    customer_id: z.string().uuid().nullable(),
    customer_phone: z.string().nullable(),
    agent_id: z.string().uuid().nullable(),
    direction: CallDirectionSchema,
    status: CallStatusSchema,
    language: CallLanguageSchema,
    started_at: z.string(),
    ended_at: z.string().nullable(),
    duration_seconds: z.number().nullable(),
    intent_detected: z.string().nullable(),
    resolution_status: z.string().nullable(),
    c24_ai_handled: z.boolean(),
    created_at: z.string()
});
export type CallLog = z.infer<typeof callLogSchema>;

// Voice Interaction
export const voiceInteractionSchema = z.object({
    id: z.string().uuid(),
    call_id: z.string().uuid(),
    segment_sequence: z.number(),
    speaker: z.string(),
    transcript_original: z.string().nullable(),
    transcript_english: z.string().nullable(),
    audio_url: z.string().nullable(),
    language_detected: CallLanguageSchema.nullable(),
    confidence_score: z.number().nullable(),
    created_at: z.string()
});
export type VoiceInteraction = z.infer<typeof voiceInteractionSchema>;

// Sentiment Log
export const sentimentLogSchema = z.object({
    id: z.string().uuid(),
    call_id: z.string().uuid(),
    interaction_id: z.string().uuid().nullable(),
    sentiment_label: SentimentLabelSchema,
    sentiment_score: z.number().nullable(),
    triggered_escalation: z.boolean(),
    detected_at: z.string()
});
export type SentimentLog = z.infer<typeof sentimentLogSchema>;

// Auto Diagnosis Log
export const autoDiagnosisLogSchema = z.object({
    id: z.string().uuid(),
    call_id: z.string().uuid().nullable(),
    customer_id: z.string().uuid().nullable(),
    symptoms_described: z.string().nullable(),
    appliance_type: z.string().nullable(),
    brand: z.string().nullable(),
    suspected_issue: z.string().nullable(),
    suggested_solution: z.string().nullable(),
    confidence_score: z.number().nullable(),
    is_accepted_by_customer: z.boolean().nullable(),
    converted_to_ticket: z.boolean(),
    created_at: z.string()
});
export type AutoDiagnosisLog = z.infer<typeof autoDiagnosisLogSchema>;
