import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const NotificationChannelSchema = z.enum(['whatsapp', 'sms', 'email', 'push', 'in_app']);
export const NotificationToneSchema = z.enum(['standard', 'professional', 'empathetic', 'urgent', 'celebratory']);
export const NotificationStageSchema = z.enum([
    'booking_confirmation', 'pickup_reminder', 'pickup_completed', 'repair_update',
    'sla_warning', 'delivery_scheduled', 'delivery_completed', 'payment_request', 'feedback_request'
]);
export const NotificationStatusSchema = z.enum(['pending', 'sent', 'delivered', 'read', 'failed', 'opted_out']);

// ============================================================================
// SCHEMAS & TYPES
// ============================================================================

// Template
export const notificationTemplateSchema = z.object({
    id: z.string().uuid(),
    stage: NotificationStageSchema,
    channel: NotificationChannelSchema,
    tone: NotificationToneSchema,
    template_name: z.string(),
    content_template: z.string(),
    is_active: z.boolean(),
    created_at: z.string()
});
export type NotificationTemplate = z.infer<typeof notificationTemplateSchema>;

// Log
export const notificationLogSchema = z.object({
    id: z.string().uuid(),
    ticket_id: z.string().uuid().nullable(),
    recipient_id: z.string().uuid().nullable(),
    template_id: z.string().uuid().nullable(),
    channel: NotificationChannelSchema,
    message_content: z.string(),
    status: NotificationStatusSchema,
    sent_at: z.string()
});
export type NotificationLog = z.infer<typeof notificationLogSchema>;

// Trust Event
export const trustEventSchema = z.object({
    id: z.string().uuid(),
    ticket_id: z.string().uuid().nullable(),
    event_type: z.string(),
    severity: z.string(),
    customer_sentiment_at_event: z.string().nullable(),
    triggered_at: z.string()
});
export type TrustEvent = z.infer<typeof trustEventSchema>;
