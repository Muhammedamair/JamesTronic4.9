-- C15: AI Brain Logs for Audit & Governance
-- Created at: 2026-01-03
-- Purpose: Store AI inputs and outputs for compliance (C40) and training (C15)

CREATE TABLE IF NOT EXISTS public.ai_brain_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    context_type VARCHAR(50) NOT NULL, -- e.g., 'admin_cockpit', 'tech_mentor'
    prompt_summary TEXT, -- Summary of what was asked (exclude PII if possible)
    ai_response_summary TEXT, -- The structured output from AI
    confidence_score INTEGER, -- 0-100
    meta_data JSONB DEFAULT '{}'::jsonb, -- Any extra tags
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Admin Dashboard performance
CREATE INDEX IF NOT EXISTS idx_ai_logs_user ON public.ai_brain_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_context ON public.ai_brain_logs(context_type);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created ON public.ai_brain_logs(created_at DESC);

-- RLS: Strict Access Control
ALTER TABLE public.ai_brain_logs ENABLE ROW LEVEL SECURITY;

-- Policy 1: Admins can view ALL logs (Audit)
CREATE POLICY "Admins can view all AI logs"
ON public.ai_brain_logs
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Policy 2: Users can view THEIR OWN logs (Reference)
CREATE POLICY "Users can view own AI logs"
ON public.ai_brain_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Policy 3: Service Role can INSERT logs (System Action)
-- Note: Subapase Service Role bypasses RLS, but if inserting via client:
CREATE POLICY "Users can insert own AI logs"
ON public.ai_brain_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);
