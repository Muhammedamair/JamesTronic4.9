-- ============================================================================
-- C24 Call Center Automation AI: Foundation Migration
-- JamesTronic Platform
-- ============================================================================
-- Purpose: AI-powered call center system with multilingual voice support,
-- auto-diagnosis, and sentiment analysis.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.call_status AS ENUM (
    'queued',
    'in_progress',
    'completed',
    'dropped',
    'escalated',
    'scheduled_callback'
);

CREATE TYPE public.call_direction AS ENUM (
    'inbound',
    'outbound'
);

CREATE TYPE public.call_language AS ENUM (
    'en', -- English
    'hi', -- Hindi
    'te', -- Telugu
    'mixed'
);

CREATE TYPE public.sentiment_label AS ENUM (
    'very_positive',
    'positive',
    'neutral',
    'negative',
    'very_negative',
    'frustrated'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Call Logs: Registry of all calls
CREATE TABLE IF NOT EXISTS public.call_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Participants
    customer_id uuid REFERENCES public.profiles(user_id),
    customer_phone text,
    agent_id uuid REFERENCES public.profiles(user_id), -- Null if handled by AI completely
    
    -- Call Info
    direction public.call_direction DEFAULT 'inbound',
    status public.call_status DEFAULT 'queued',
    language public.call_language DEFAULT 'en',
    
    -- Timing
    started_at timestamptz DEFAULT now() NOT NULL,
    ended_at timestamptz,
    duration_seconds integer,
    
    -- Outcomes
    intent_detected text, -- 'booking', 'complaint', 'status_check'
    resolution_status text, -- 'resolved', 'ticket_created', 'escalated'
    c24_ai_handled boolean DEFAULT true,
    
    related_ticket_id uuid REFERENCES public.tickets(id),
    
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Voice Interactions: Transcripts and segments
CREATE TABLE IF NOT EXISTS public.voice_interactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id uuid NOT NULL REFERENCES public.call_logs(id) ON DELETE CASCADE,
    
    segment_sequence integer NOT NULL,
    speaker text NOT NULL, -- 'customer', 'ai', 'agent'
    
    -- Content
    transcript_original text, -- In original language
    transcript_english text, -- Translated if needed
    audio_url text,
    
    -- Metadata
    language_detected public.call_language,
    confidence_score numeric(3, 2), -- 0.00 to 1.00
    
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Sentiment Logs: Sentiment analysis records
CREATE TABLE IF NOT EXISTS public.sentiment_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id uuid NOT NULL REFERENCES public.call_logs(id) ON DELETE CASCADE,
    interaction_id uuid REFERENCES public.voice_interactions(id),
    
    -- Analysis
    sentiment_label public.sentiment_label NOT NULL,
    sentiment_score numeric(3, 2), -- -1.00 (neg) to 1.00 (pos)
    
    -- Triggers
    triggered_escalation boolean DEFAULT false,
    
    detected_at timestamptz DEFAULT now() NOT NULL
);

-- Auto Diagnosis Logs: AI diagnostic suggestions
CREATE TABLE IF NOT EXISTS public.auto_diagnosis_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id uuid REFERENCES public.call_logs(id),
    customer_id uuid REFERENCES public.profiles(user_id),
    
    -- Input
    symptoms_described text,
    appliance_type text,
    brand text,
    
    -- AI Output
    suspected_issue text,
    suggested_solution text,
    confidence_score integer, -- 0-100
    
    -- Outcome
    is_accepted_by_customer boolean,
    converted_to_ticket boolean DEFAULT false,
    
    created_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_call_logs_customer ON public.call_logs(customer_id);
CREATE INDEX idx_call_logs_status ON public.call_logs(status);
CREATE INDEX idx_call_logs_started ON public.call_logs(started_at);
CREATE INDEX idx_voice_interactions_call ON public.voice_interactions(call_id);
CREATE INDEX idx_sentiment_logs_call ON public.sentiment_logs(call_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER set_call_logs_updated_at
BEFORE UPDATE ON public.call_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentiment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_diagnosis_logs ENABLE ROW LEVEL SECURITY;

-- Admins view all, Customers view own
CREATE POLICY "Admin view all calls"
ON public.call_logs FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner', 'staff'));

CREATE POLICY "Customer view own calls"
ON public.call_logs FOR SELECT
TO authenticated
USING (auth.uid() = customer_id);

-- Interactions
CREATE POLICY "Admin view interactions"
ON public.voice_interactions FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner', 'staff'));

CREATE POLICY "Customer view interactions"
ON public.voice_interactions FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.call_logs WHERE id = voice_interactions.call_id AND customer_id = auth.uid()));

-- Sentiment (Internal only)
CREATE POLICY "Admin view sentiment"
ON public.sentiment_logs FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner', 'staff'));

-- Diagnosis
CREATE POLICY "Admin view diagnosis"
ON public.auto_diagnosis_logs FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner', 'staff'));

CREATE POLICY "Customer view diagnosis"
ON public.auto_diagnosis_logs FOR SELECT
TO authenticated
USING (auth.uid() = customer_id);

-- ============================================================================
-- FUNCTIONS / RPCs
-- ============================================================================

-- RPC: Log Call Interaction
CREATE OR REPLACE FUNCTION public.rpc_log_call_interaction(
    p_call_id uuid,
    p_speaker text,
    p_transcript_original text,
    p_language text DEFAULT 'en',
    p_sentiment_label text DEFAULT 'neutral'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_interaction_id uuid;
    v_next_sequence integer;
BEGIN
    -- Get next sequence
    SELECT COALESCE(MAX(segment_sequence), 0) + 1 INTO v_next_sequence
    FROM public.voice_interactions
    WHERE call_id = p_call_id;
    
    -- Insert interaction
    INSERT INTO public.voice_interactions (
        call_id, segment_sequence, speaker,
        transcript_original, transcript_english,
        language_detected, confidence_score
    )
    VALUES (
        p_call_id, v_next_sequence, p_speaker,
        p_transcript_original, p_transcript_original, -- Assuming en for simplicity
        p_language::public.call_language, 0.95
    )
    RETURNING id INTO v_interaction_id;
    
    -- Log sentiment if provided
    IF p_sentiment_label IS NOT NULL THEN
        INSERT INTO public.sentiment_logs (
            call_id, interaction_id, sentiment_label, sentiment_score
        )
        VALUES (
            p_call_id, v_interaction_id,
            p_sentiment_label::public.sentiment_label,
            CASE p_sentiment_label 
                WHEN 'very_positive' THEN 0.9 
                WHEN 'positive' THEN 0.5 
                WHEN 'neutral' THEN 0.0 
                WHEN 'negative' THEN -0.5 
                WHEN 'frustrated' THEN -0.8 
                WHEN 'very_negative' THEN -0.9 
                ELSE 0 
            END
        );
    END IF;
    
    RETURN v_interaction_id;
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_interactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sentiment_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_diagnosis_logs TO authenticated;

GRANT ALL ON public.call_logs TO service_role;
GRANT ALL ON public.voice_interactions TO service_role;
GRANT ALL ON public.sentiment_logs TO service_role;
GRANT ALL ON public.auto_diagnosis_logs TO service_role;

GRANT EXECUTE ON FUNCTION public.rpc_log_call_interaction TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_log_call_interaction TO service_role;
