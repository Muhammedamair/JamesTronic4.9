-- ============================================================================
-- C30 Technician Skill Evolution AI: Foundation Migration
-- JamesTronic Platform
-- ============================================================================
-- Purpose: Gamify technician growth with Skills, XP, Levels, and Achievements.
-- Turns JamesTronic into a "Skill Factory".
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.skill_category AS ENUM (
    'appliance_repair',
    'soft_skills',
    'safety',
    'sales',
    'advanced_diagnostics'
);

CREATE TYPE public.achievement_tier AS ENUM (
    'bronze',
    'silver',
    'gold',
    'platinum',
    'diamond'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Skill Definitions: The Master Skill Tree
CREATE TABLE IF NOT EXISTS public.skill_definitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE, -- e.g. "Inverter AC Repair"
    category public.skill_category DEFAULT 'appliance_repair',
    description text,
    
    max_level integer DEFAULT 5,
    xp_per_level_base integer DEFAULT 100, -- XP needed for L1->L2. Maybe L2->L3 is calculated via multiplier.
    
    icon_name text, -- Lucide icon name
    
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Technician Skills: User's progress per skill
CREATE TABLE IF NOT EXISTS public.technician_skills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(user_id) NOT NULL,
    skill_id uuid REFERENCES public.skill_definitions(id) NOT NULL,
    
    current_level integer DEFAULT 0,
    current_xp integer DEFAULT 0,
    
    is_certified boolean DEFAULT false, -- If manual certification required
    certified_at timestamptz,
    certified_by uuid REFERENCES public.profiles(user_id),
    
    last_practiced_at timestamptz, -- Last time used on a job
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    
    CONSTRAINT unique_tech_skill UNIQUE (user_id, skill_id)
);

-- Skill Progression Logs: History of XP gains
CREATE TABLE IF NOT EXISTS public.skill_progression_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(user_id) NOT NULL,
    skill_id uuid REFERENCES public.skill_definitions(id), -- Can be null if general XP
    
    xp_amount integer NOT NULL,
    reason text, -- "5-Star Repair on Ticket #123"
    
    related_ticket_id uuid, -- Optional link to job
    awarded_at timestamptz DEFAULT now() NOT NULL
);

-- Achievements: Badges / Trophies
CREATE TABLE IF NOT EXISTS public.achievements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    tier public.achievement_tier DEFAULT 'bronze',
    
    icon_name text,
    criteria jsonb DEFAULT '{}', -- e.g. { "repairs_count": 100 }
    
    xp_reward integer DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Technician Achievements: Unlocked badges
CREATE TABLE IF NOT EXISTS public.technician_achievements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(user_id) NOT NULL,
    achievement_id uuid REFERENCES public.achievements(id) NOT NULL,
    
    unlocked_at timestamptz DEFAULT now() NOT NULL,
    
    CONSTRAINT unique_tech_achievement UNIQUE (user_id, achievement_id)
);

-- Global Level / Rank (Derived from total XP? Or stored on profile? Let's use profile metadata or a separate stats table.
-- For simplicity, let's create a wrapper table for Tech Summary Stats if not exists in C23.
-- C23 has `technician_performance_scores`. We can add level there later or just compute dynamic here.
-- Let's stick to C30 specific aggregate table for "RPG Stats".

CREATE TABLE IF NOT EXISTS public.technician_rpg_stats (
    user_id uuid PRIMARY KEY REFERENCES public.profiles(user_id),
    total_xp integer DEFAULT 0,
    global_level integer DEFAULT 1,
    
    skill_points_available integer DEFAULT 0, -- If we want them to "spend" points to unlock skills
    
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- SEED DATA
-- ============================================================================

INSERT INTO public.skill_definitions (name, category, description, icon_name)
VALUES 
    ('HVAC Diagnostics', 'appliance_repair', 'Diagnose complex AC issues', 'Thermometer'),
    ('PCB Soldering', 'advanced_diagnostics', 'Repair circuit boards at component level', 'Cpu'),
    ('Customer Empathy', 'soft_skills', 'Handle difficult conversations', 'Heart'),
    ('Electrical Safety', 'safety', 'Safe handling of high voltage equipment', 'Zap'),
    ('Compressor Replacement', 'appliance_repair', 'Replace hermetic compressors safely', 'Wrench')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.achievements (name, description, tier, xp_reward, icon_name)
VALUES 
    ('First Fix', 'Complete your first repair successfully', 'bronze', 100, 'Award'),
    ('Speed Demon', 'Complete 5 jobs in one day', 'silver', 500, 'Zap'),
    ('5-Star General', 'Maintain 5.0 rating for 30 days', 'gold', 1000, 'Star'),
    ('Master of Cold', 'Fix 100 AC units', 'platinum', 2000, 'Snowflake')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_tech_skills_user ON public.technician_skills(user_id);
CREATE INDEX idx_progression_user ON public.skill_progression_logs(user_id);
CREATE INDEX idx_tech_achievements_user ON public.technician_achievements(user_id);

-- ============================================================================
-- FUNCTIONS / RPCs
-- ============================================================================

-- RPC: Award XP and Check Level Up
CREATE OR REPLACE FUNCTION public.rpc_award_xp(
    p_user_id uuid,
    p_amount integer,
    p_reason text,
    p_skill_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_total_xp integer;
    v_current_level integer;
    v_new_level integer;
    v_leveled_up boolean := false;
    v_result jsonb;
BEGIN
    -- 1. Log the XP Event
    INSERT INTO public.skill_progression_logs (user_id, skill_id, xp_amount, reason)
    VALUES (p_user_id, p_skill_id, p_amount, p_reason);

    -- 2. Update Global Stats
    INSERT INTO public.technician_rpg_stats (user_id, total_xp, global_level)
    VALUES (p_user_id, p_amount, 1)
    ON CONFLICT (user_id) DO UPDATE SET
        total_xp = technician_rpg_stats.total_xp + p_amount,
        updated_at = now()
    RETURNING total_xp, global_level INTO v_new_total_xp, v_current_level;

    -- 3. Calculate New Level (Simple formula: Level = sqrt(XP / 100))
    -- Or stepping: 0-1000=L1, 1000-3000=L2, etc.
    -- Let's use simple linear for now: Every 1000 XP = 1 Level
    v_new_level := (v_new_total_xp / 1000) + 1;

    IF v_new_level > v_current_level THEN
        v_leveled_up := true;
        UPDATE public.technician_rpg_stats 
        SET global_level = v_new_level
        WHERE user_id = p_user_id;
    END IF;

    -- 4. Update Specific Skill XP if provided
    IF p_skill_id IS NOT NULL THEN
        INSERT INTO public.technician_skills (user_id, skill_id, current_xp, current_level)
        VALUES (p_user_id, p_skill_id, p_amount, 0) -- Start at L0
        ON CONFLICT (user_id, skill_id) DO UPDATE SET
            current_xp = technician_skills.current_xp + p_amount,
            updated_at = now();
            
        -- Check and update skill level logic separate or here
        -- Keeping simple: Just tracking XP for skill now
    END IF;

    v_result := jsonb_build_object(
        'new_total_xp', v_new_total_xp,
        'old_level', v_current_level,
        'new_level', v_new_level,
        'leveled_up', v_leveled_up
    );
    
    RETURN v_result;
END;
$$;

-- RPC: Get Full Skill Tree
CREATE OR REPLACE FUNCTION public.rpc_get_technician_skill_tree(
    p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_skills jsonb;
    v_stats record;
    v_badges jsonb;
    v_result jsonb;
BEGIN
    -- Get Stats
    SELECT * INTO v_stats FROM public.technician_rpg_stats WHERE user_id = p_user_id;
    
    -- If no stats, return defaults
    IF v_stats IS NULL THEN
        SELECT 0, 1 INTO v_stats.total_xp, v_stats.global_level;
    END IF;

    -- Get Skills with User Progress
    SELECT jsonb_agg(
        jsonb_build_object(
            'skill_id', sd.id,
            'name', sd.name,
            'category', sd.category,
            'max_level', sd.max_level,
            'icon', sd.icon_name,
            'user_level', COALESCE(ts.current_level, 0),
            'user_xp', COALESCE(ts.current_xp, 0),
            'is_certified', COALESCE(ts.is_certified, false)
        )
    ) INTO v_skills
    FROM public.skill_definitions sd
    LEFT JOIN public.technician_skills ts ON ts.skill_id = sd.id AND ts.user_id = p_user_id;

    -- Get Unlocked Achievements
    SELECT jsonb_agg(
        jsonb_build_object(
            'achievement_id', a.id,
            'name', a.name,
            'tier', a.tier,
            'icon', a.icon_name,
            'unlocked_at', ta.unlocked_at
        )
    ) INTO v_badges
    FROM public.technician_achievements ta
    JOIN public.achievements a ON a.id = ta.achievement_id
    WHERE ta.user_id = p_user_id;

    v_result := jsonb_build_object(
        'user_id', p_user_id,
        'global_level', v_stats.global_level,
        'total_xp', v_stats.total_xp,
        'skills', COALESCE(v_skills, '[]'::jsonb),
        'achievements', COALESCE(v_badges, '[]'::jsonb)
    );
    
    RETURN v_result;
END;
$$;


-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT ALL ON public.skill_definitions TO authenticated;
GRANT ALL ON public.technician_skills TO authenticated;
GRANT ALL ON public.skill_progression_logs TO authenticated;
GRANT ALL ON public.achievements TO authenticated;
GRANT ALL ON public.technician_achievements TO authenticated;
GRANT ALL ON public.technician_rpg_stats TO authenticated;

GRANT ALL ON public.skill_definitions TO service_role;
GRANT ALL ON public.technician_skills TO service_role;
GRANT ALL ON public.skill_progression_logs TO service_role;
GRANT ALL ON public.achievements TO service_role;
GRANT ALL ON public.technician_achievements TO service_role;
GRANT ALL ON public.technician_rpg_stats TO service_role;

GRANT EXECUTE ON FUNCTION public.rpc_award_xp TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_technician_skill_tree TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_award_xp TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_technician_skill_tree TO service_role;
