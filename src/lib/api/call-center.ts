import { createClient } from '@/utils/supabase/client';
import {
    CallLog,
    VoiceInteraction,
    SentimentLog,
    callLogSchema,
    voiceInteractionSchema,
    sentimentLogSchema
} from '@/lib/types/call-center';
import { z } from 'zod';

const supabase = createClient();

export const callCenterApi = {

    // =========================================================================
    // CALL MANAGEMENT
    // =========================================================================

    getActiveCalls: async (): Promise<CallLog[]> => {
        const { data, error } = await supabase
            .from('call_logs')
            .select('*')
            .in('status', ['in_progress', 'queued'])
            .order('started_at', { ascending: false });
        if (error) throw new Error(error.message);
        return z.array(callLogSchema).parse(data);
    },

    getRecentCalls: async (): Promise<CallLog[]> => {
        const { data, error } = await supabase
            .from('call_logs')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(20);
        if (error) throw new Error(error.message);
        return z.array(callLogSchema).parse(data);
    },

    // =========================================================================
    // INTERACTIONS (Simulator)
    // =========================================================================

    getCallTranscripts: async (callId: string): Promise<VoiceInteraction[]> => {
        const { data, error } = await supabase
            .from('voice_interactions')
            .select('*')
            .eq('call_id', callId)
            .order('segment_sequence', { ascending: true });
        if (error) throw new Error(error.message);
        return z.array(voiceInteractionSchema).parse(data);
    },

    logInteraction: async (
        callId: string,
        speaker: string,
        transcript: string,
        language: string,
        sentiment: string
    ): Promise<string> => {
        const { data, error } = await supabase.rpc('rpc_log_call_interaction', {
            p_call_id: callId,
            p_speaker: speaker,
            p_transcript_original: transcript,
            p_language: language,
            p_sentiment_label: sentiment
        });
        if (error) throw new Error(error.message);
        return data as string;
    },

    // =========================================================================
    // SENTIMENT & METRICS
    // =========================================================================

    getCallSentimentTrend: async (callId: string): Promise<SentimentLog[]> => {
        const { data, error } = await supabase
            .from('sentiment_logs')
            .select('*')
            .eq('call_id', callId)
            .order('detected_at', { ascending: true });
        if (error) throw new Error(error.message);
        return z.array(sentimentLogSchema).parse(data);
    },

    // Simulator helper: Create a dummy call
    simulateIncomingCall: async (phone: string, language: string): Promise<CallLog> => {
        const { data, error } = await supabase
            .from('call_logs')
            .insert({
                customer_phone: phone,
                status: 'in_progress',
                direction: 'inbound',
                language: language,
                c24_ai_handled: true
            })
            .select()
            .single();
        if (error) throw new Error(error.message);
        return callLogSchema.parse(data);
    }
};
