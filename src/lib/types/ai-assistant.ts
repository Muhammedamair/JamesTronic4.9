import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const MessageSenderSchema = z.enum(['user', 'ai', 'system']);

// ============================================================================
// SCHEMAS
// ============================================================================

export const messageSchema = z.object({
    id: z.string().uuid(),
    conversation_id: z.string().uuid(),
    sender: MessageSenderSchema,
    content: z.string(),
    meta_data: z.any().nullable(), // JSONB
    created_at: z.string()
});

export type Message = z.infer<typeof messageSchema>;

export const conversationSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    updated_at: z.string()
});

export type Conversation = z.infer<typeof conversationSchema>;
