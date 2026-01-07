-- ============================================================================
-- C34 James AI Assistant: Database Infrastructure
-- JamesTronic Platform
-- ============================================================================
-- Purpose: Store chat history for the Admin Copilot.
-- ============================================================================

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. AI Conversations: Threads of chat
CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL DEFAULT 'New Conversation',
    
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- 2. AI Messages: Individual messages within a thread
CREATE TABLE IF NOT EXISTS public.ai_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
    
    sender text CHECK (sender IN ('user', 'ai', 'system')),
    content text NOT NULL,
    
    -- Optional JSON blobb for rich responses (e.g. charts, ticket links)
    meta_data jsonb DEFAULT '{}'::jsonb,
    
    created_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_conversations_user ON public.ai_conversations(user_id, updated_at DESC);
CREATE INDEX idx_messages_conversation ON public.ai_messages(conversation_id, created_at ASC);

-- ============================================================================
-- RPCs
-- ============================================================================

-- RPC: Create Conversation
CREATE OR REPLACE FUNCTION public.rpc_create_conversation(
    p_title text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO public.ai_conversations (user_id, title)
    VALUES (auth.uid(), p_title)
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

-- RPC: Get Chat History (with messages)
-- Simplified: Just gets messages for a conversation if user owns it
CREATE OR REPLACE FUNCTION public.rpc_get_chat_messages(
    p_conversation_id uuid
)
RETURNS TABLE (
    id uuid,
    sender text,
    content text,
    meta_data jsonb,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Auth check: Ensure user owns the conversation
    IF NOT EXISTS (SELECT 1 FROM public.ai_conversations WHERE id = p_conversation_id AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    RETURN QUERY
    SELECT m.id, m.sender, m.content, m.meta_data, m.created_at
    FROM public.ai_messages m
    WHERE m.conversation_id = p_conversation_id
    ORDER BY m.created_at ASC;
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT SELECT, INSERT ON public.ai_messages TO authenticated;

GRANT ALL ON public.ai_conversations TO service_role;
GRANT ALL ON public.ai_messages TO service_role;

GRANT EXECUTE ON FUNCTION public.rpc_create_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_chat_messages TO authenticated;
