-- ============================================================================
-- C36 Guided Repair AI: Database Infrastructure
-- JamesTronic Platform
-- ============================================================================

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. Repair Guides: High-level manuals
CREATE TABLE IF NOT EXISTS public.repair_guides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    device_model text NOT NULL, -- e.g. "iPhone 13"
    title text NOT NULL,        -- e.g. "Screen Replacement"
    difficulty text CHECK (difficulty IN ('Easy', 'Medium', 'Hard', 'Expert')),
    estim_time_mins integer DEFAULT 30,
    created_at timestamptz DEFAULT now()
);

-- 2. Repair Steps: Detailed instructions
CREATE TABLE IF NOT EXISTS public.repair_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guide_id uuid NOT NULL REFERENCES public.repair_guides(id) ON DELETE CASCADE,
    
    order_index integer NOT NULL,
    instruction text NOT NULL,
    caution_type text CHECK (caution_type IN ('none', 'info', 'warning', 'critical')) DEFAULT 'none',
    image_url text, -- Placeholder for diagram URL
    
    created_at timestamptz DEFAULT now(),
    UNIQUE(guide_id, order_index)
);

-- 3. Repair Logs: Tracking technician progress (simplified)
CREATE TABLE IF NOT EXISTS public.repair_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid REFERENCES public.tickets(id),
    technician_id uuid REFERENCES public.profiles(user_id),
    guide_id uuid REFERENCES public.repair_guides(id),
    
    step_index integer NOT NULL,
    completed_at timestamptz DEFAULT now()
);

-- ============================================================================
-- RPCs
-- ============================================================================

-- RPC: Search Guides
CREATE OR REPLACE FUNCTION public.rpc_search_guides(
    p_query text
)
RETURNS TABLE (
    id uuid,
    device_model text,
    title text,
    difficulty text,
    estim_time_mins integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT g.id, g.device_model, g.title, g.difficulty, g.estim_time_mins
    FROM public.repair_guides g
    WHERE g.device_model ILIKE '%' || p_query || '%'
       OR g.title ILIKE '%' || p_query || '%'
    ORDER BY g.device_model, g.title;
END;
$$;

-- ============================================================================
-- SEED DATA
-- ============================================================================

DO $$
DECLARE
    v_guide_id uuid;
BEGIN
    -- 1. iPhone 13 Screen Replacement
    INSERT INTO public.repair_guides (device_model, title, difficulty, estim_time_mins)
    VALUES ('iPhone 13', 'Screen Replacement', 'Medium', 45)
    RETURNING id INTO v_guide_id;

    INSERT INTO public.repair_steps (guide_id, order_index, instruction, caution_type) VALUES
    (v_guide_id, 1, 'Power off the device and remove the two bottom pentalobe screws.', 'none'),
    (v_guide_id, 2, 'Apply heat to the bottom edge to soften the adhesive.', 'info'),
    (v_guide_id, 3, 'Use a suction cup and pick to lift the display slightly. Do not insert pick too deep.', 'warning'),
    (v_guide_id, 4, 'Open the display like a book from the left side. CAUTION: Ribbon cables are on the right.', 'critical'),
    (v_guide_id, 5, 'Disconnect the battery connector before touching any other components.', 'critical'),
    (v_guide_id, 6, 'Disconnect the display and digitizer cables.', 'none'),
    (v_guide_id, 7, 'Install the new display and reverse these steps.', 'none');

    -- 2. Generic Battery Replacement
    INSERT INTO public.repair_guides (device_model, title, difficulty, estim_time_mins)
    VALUES ('Generic Android', 'Battery Replacement', 'Easy', 30)
    RETURNING id INTO v_guide_id;
    
    INSERT INTO public.repair_steps (guide_id, order_index, instruction, caution_type) VALUES
    (v_guide_id, 1, 'Remove back glass using heat gun and prying tool.', 'warning'),
    (v_guide_id, 2, 'Unscrew the battery shield.', 'none'),
    (v_guide_id, 3, 'Disconnect the battery flex cable.', 'none'),
    (v_guide_id, 4, 'Pull the adhesive tabs to release the battery. Do not puncture the battery.', 'critical'),
    (v_guide_id, 5, 'Insert new battery and reassemble.', 'none');

END $$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.repair_guides TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.repair_steps TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.repair_logs TO authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_search_guides TO authenticated;

GRANT ALL ON public.repair_guides TO service_role;
GRANT ALL ON public.repair_steps TO service_role;
GRANT ALL ON public.repair_logs TO service_role;
