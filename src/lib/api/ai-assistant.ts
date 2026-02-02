import { createClient } from '@/utils/supabase/client';
import {
    Message, messageSchema,
    Conversation, conversationSchema
} from '@/lib/types/ai-assistant';

const supabase = createClient();

// ============================================================================
// MOCKED INTELLIGENCE
// ============================================================================

const determineResponse = (input: string): string => {
    const lower = input.toLowerCase();

    if (lower.includes('revenue') || lower.includes('money') || lower.includes('sales')) {
        return "Based on C31 Revenue Shield data: Current potential leakage is ₹45,000. 3 alerts are active regarding negative margins.";
    }

    if (lower.includes('server') || lower.includes('status') || lower.includes('down')) {
        return "System Status (C33): All systems operational. 99.99% uptime in the last 24h. Database latency is 45ms.";
    }

    if (lower.includes('technician') || lower.includes('schedule')) {
        return "Dispatch Center (C32): 12 technicians are active. 2 jobs are currently unassigned in Indiranagar.";
    }

    if (lower.includes('hello') || lower.includes('hi')) {
        return "Hello! I am James, your AI Operational Assistant. How can I help you today?";
    }

    return "I'm not sure about that yet. I can currently help with Revenue, System Status, and Technician Scheduling.";
};

export const aiAssistantApi = {

    // =========================================================================
    // ACTIONS
    // =========================================================================

    createConversation: async (title: string = 'New Chat'): Promise<string> => {
        const { data, error } = await supabase.rpc('rpc_create_conversation', { p_title: title });
        if (error) throw new Error(error.message);
        return data as string; // returns uuid
    },

    getHistory: async (conversationId: string): Promise<Message[]> => {
        const { data, error } = await supabase.rpc('rpc_get_chat_messages', { p_conversation_id: conversationId });
        if (error) throw new Error(error.message);
        return data.map((d: any) => messageSchema.parse(d));
    },

    sendMessage: async (conversationId: string, content: string): Promise<Message> => {
        // 1. Save User Message
        const { error: userMsgError } = await supabase.from('ai_messages').insert({
            conversation_id: conversationId,
            sender: 'user',
            content: content
        });
        if (userMsgError) throw new Error(userMsgError.message);

        // 2. "Think" (Mock AI Delay)
        await new Promise(r => setTimeout(r, 600));
        const aiResponse = determineResponse(content);

        // 3. Save AI Message
        const { data, error: aiMsgError } = await supabase.from('ai_messages').insert({
            conversation_id: conversationId,
            sender: 'ai',
            content: aiResponse
        }).select().single();

        if (aiMsgError) throw new Error(aiMsgError.message);
        return messageSchema.parse(data);
    }
};
