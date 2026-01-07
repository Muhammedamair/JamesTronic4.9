-- ============================================================================
-- C23 Technician Performance AI: Foundation Migration
-- JamesTronic Platform
-- ============================================================================
-- Purpose: AI-driven scoring engine for technicians evaluating repair quality,
-- honesty, SLA compliance, and training needs.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.performance_trend AS ENUM (
    'improving',
    'stable',
    'declining',
    'volatile'
);

CREATE TYPE public.skill_level AS ENUM (
    'novice',
    'competent',
    'proficient',
    'expert',
    'master'
);

CREATE TYPE public.feedback_sentiment AS ENUM (
    'positive',
    'neutral',
    'negative'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Technician Performance Scores: Daily/Weekly/Monthly aggregates
CREATE TABLE IF NOT EXISTS public.technician_performance_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id uuid NOT NULL REFERENCES public.profiles(user_id),
    
    -- Period
    score_date date NOT NULL DEFAULT CURRENT_DATE,
    period_type text DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
    
    -- Component Scores (0-100)
    repair_quality_score integer DEFAULT 0,
    sla_compliance_score integer DEFAULT 0,
    part_usage_honesty_score integer DEFAULT 0,
    customer_satisfaction_score integer DEFAULT 0,
    learning_application_score integer DEFAULT 0,
    
    -- Composite Score
    overall_score integer DEFAULT 0,
    trend public.performance_trend DEFAULT 'stable',
    
    -- Metrics
    jobs_completed integer DEFAULT 0,
    comeback_count integer DEFAULT 0,
    avg_rating numeric(3, 2),
    
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    
    CONSTRAINT unique_tech_period UNIQUE (technician_id, score_date, period_type)
);

-- Repair Quality Metrics: Job-level quality data
CREATE TABLE IF NOT EXISTS public.repair_quality_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id uuid NOT NULL REFERENCES public.profiles(user_id),
    ticket_id uuid REFERENCES public.tickets(id),
    
    -- Quality Indicators
    is_first_time_fix boolean DEFAULT true,
    comeback_within_30_days boolean DEFAULT false,
    diagnosis_accuracy_score integer, -- 0-100
    repair_completeness_score integer, -- 0-100
    
    -- Feedback
    customer_rating integer,
    customer_feedback text,
    sentiment public.feedback_sentiment,
    
    -- Verification
    verified_by uuid REFERENCES public.profiles(user_id),
    verified_at timestamptz,
    
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Skill Gap Analysis: Detected training needs
CREATE TABLE IF NOT EXISTS public.skill_gap_analysis (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id uuid NOT NULL REFERENCES public.profiles(user_id),
    
    -- Category
    category text NOT NULL, -- e.g., 'AC PCB Repair'
    current_skill_level public.skill_level DEFAULT 'novice',
    target_skill_level public.skill_level DEFAULT 'competent',
    
    -- Detection
    gaps_detected text[], -- ['slow_diagnosis', 'frequent_comebacks']
    confidence_score integer DEFAULT 80,
    
    is_active boolean DEFAULT true,
    detected_at timestamptz DEFAULT now(),
    
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Training Recommendations: AI suggested interventions
CREATE TABLE IF NOT EXISTS public.training_recommendations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id uuid NOT NULL REFERENCES public.profiles(user_id),
    skill_gap_id uuid REFERENCES public.skill_gap_analysis(id),
    
    -- Recommendation
    title text NOT NULL,
    description text,
    priority text DEFAULT 'medium', -- low, medium, high
    
    -- Status
    status text DEFAULT 'pending', -- pending, assigned, in_progress, completed
    assigned_at timestamptz,
    completed_at timestamptz,
    
    -- Effectiveness
    improvement_score integer, -- Score improvement after training
    
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_perf_scores_tech ON public.technician_performance_scores(technician_id);
CREATE INDEX idx_perf_scores_date ON public.technician_performance_scores(score_date);
CREATE INDEX idx_quality_tech ON public.repair_quality_metrics(technician_id);
CREATE INDEX idx_quality_comeback ON public.repair_quality_metrics(comeback_within_30_days);
CREATE INDEX idx_skill_gap_tech ON public.skill_gap_analysis(technician_id);
CREATE INDEX idx_training_rec_tech ON public.training_recommendations(technician_id);
CREATE INDEX idx_training_rec_status ON public.training_recommendations(status);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER set_tech_scores_updated_at
BEFORE UPDATE ON public.technician_performance_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER set_skill_gaps_updated_at
BEFORE UPDATE ON public.skill_gap_analysis
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER set_training_recs_updated_at
BEFORE UPDATE ON public.training_recommendations
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.technician_performance_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_quality_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_gap_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_recommendations ENABLE ROW LEVEL SECURITY;

-- Admins can view all, Technicians view own
CREATE POLICY "Admin view all scores"
ON public.technician_performance_scores FOR SELECT
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

CREATE POLICY "Technician view own scores"
ON public.technician_performance_scores FOR SELECT
TO authenticated
USING (auth.uid() = technician_id);

CREATE POLICY "Admin manage scores"
ON public.technician_performance_scores FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

-- Same pattern for other tables
CREATE POLICY "Admin view all quality metrics"
ON public.repair_quality_metrics FOR SELECT
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

CREATE POLICY "Technician view own quality metrics"
ON public.repair_quality_metrics FOR SELECT
TO authenticated
USING (auth.uid() = technician_id);

CREATE POLICY "Admin manage quality metrics"
ON public.repair_quality_metrics FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

CREATE POLICY "Admin view all skill gaps"
ON public.skill_gap_analysis FOR SELECT
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

CREATE POLICY "Technician view own skill gaps"
ON public.skill_gap_analysis FOR SELECT
TO authenticated
USING (auth.uid() = technician_id);

CREATE POLICY "Admin manage skill gaps"
ON public.skill_gap_analysis FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

CREATE POLICY "Admin view all training recs"
ON public.training_recommendations FOR SELECT
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

CREATE POLICY "Technician view own training recs"
ON public.training_recommendations FOR SELECT
TO authenticated
USING (auth.uid() = technician_id);

CREATE POLICY "Admin manage training recs"
ON public.training_recommendations FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));


-- ============================================================================
-- FUNCTIONS / RPCs
-- ============================================================================

-- RPC: Calculate Technician Score
CREATE OR REPLACE FUNCTION public.rpc_calculate_technician_score(
    p_technician_id uuid,
    p_period_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_quality integer := 0;
    v_sla integer := 0;
    v_honesty integer := 0;
    v_satisfaction integer := 0;
    v_composite integer := 0;
    v_jobs integer := 0;
    v_result jsonb;
BEGIN
    -- This is a simplified simulation since we don't have full history populated
    -- In production, this would query aggregated historical data
    
    -- Simulate random but realistic scores for demo
    v_quality := floor(random() * (100-70+1) + 70);
    v_sla := floor(random() * (100-80+1) + 80);
    v_honesty := floor(random() * (100-90+1) + 90);
    v_satisfaction := floor(random() * (100-60+1) + 60);
    v_jobs := floor(random() * 50);
    
    v_composite := (v_quality * 25 + v_sla * 20 + v_satisfaction * 20 + v_honesty * 20 + 80 * 15) / 100;
    
    -- Upsert score
    INSERT INTO public.technician_performance_scores (
        technician_id, score_date, period_type,
        repair_quality_score, sla_compliance_score, part_usage_honesty_score,
        customer_satisfaction_score, learning_application_score,
        overall_score, jobs_completed
    )
    VALUES (
        p_technician_id, p_period_date, 'daily',
        v_quality, v_sla, v_honesty,
        v_satisfaction, 80,
        v_composite, v_jobs
    )
    ON CONFLICT (technician_id, score_date, period_type)
    DO UPDATE SET
        repair_quality_score = EXCLUDED.repair_quality_score,
        sla_compliance_score = EXCLUDED.sla_compliance_score,
        part_usage_honesty_score = EXCLUDED.part_usage_honesty_score,
        customer_satisfaction_score = EXCLUDED.customer_satisfaction_score,
        overall_score = EXCLUDED.overall_score,
        jobs_completed = EXCLUDED.jobs_completed,
        updated_at = now();
        
    v_result := jsonb_build_object(
        'technician_id', p_technician_id,
        'overall_score', v_composite,
        'quality', v_quality,
        'sla', v_sla,
        'honesty', v_honesty,
        'satisfaction', v_satisfaction
    );
    
    RETURN v_result;
END;
$$;


-- RPC: Identify Skill Gaps (Stub for simplicity)
CREATE OR REPLACE FUNCTION public.rpc_identify_skill_gaps(
    p_technician_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- In a real system, this would analyze specific job category failures
    -- Inserting dummy gap for demonstration
    INSERT INTO public.skill_gap_analysis (
        technician_id, category, current_skill_level, gaps_detected
    )
    VALUES (
        p_technician_id, 'Inverter AC Sync', 'novice', ARRAY['diagnosis_error']
    )
    ON CONFLICT DO NOTHING;
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.technician_performance_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repair_quality_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skill_gap_analysis TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_recommendations TO authenticated;

GRANT ALL ON public.technician_performance_scores TO service_role;
GRANT ALL ON public.repair_quality_metrics TO service_role;
GRANT ALL ON public.skill_gap_analysis TO service_role;
GRANT ALL ON public.training_recommendations TO service_role;

GRANT EXECUTE ON FUNCTION public.rpc_calculate_technician_score TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_identify_skill_gaps TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_calculate_technician_score TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_identify_skill_gaps TO service_role;
