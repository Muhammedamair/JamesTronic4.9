-- Migration: Create missing technician_performance table
-- This table was documented in architecture but never created.
-- It provides backward compatibility for the performance dashboard.

-- ============================================================================
-- 1. TECHNICIAN PERFORMANCE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.technician_performance (
    technician_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    total_jobs integer DEFAULT 0,
    jobs_completed integer DEFAULT 0,
    avg_completion_time_minutes integer DEFAULT 0,
    sla_met integer DEFAULT 0,
    sla_breached integer DEFAULT 0,
    rating_avg numeric(3, 2) DEFAULT 0,
    score integer DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.technician_performance IS 'Performance summary for technicians. Used by admin dashboard.';

-- ============================================================================
-- 2. TECHNICIAN SLA HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.technician_sla_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
    ticket_summary text,
    ticket_status text,
    ticket_created_at timestamptz,
    sla_target_minutes integer NOT NULL,
    completion_minutes integer,
    sla_met boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.technician_sla_history IS 'Daily SLA record for tracking SLA compliance per technician.';

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_technician_performance_score ON public.technician_performance(score DESC);
CREATE INDEX IF NOT EXISTS idx_technician_sla_history_technician ON public.technician_sla_history(technician_id);
CREATE INDEX IF NOT EXISTS idx_technician_sla_history_created ON public.technician_sla_history(created_at);

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

ALTER TABLE public.technician_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_sla_history ENABLE ROW LEVEL SECURITY;

-- Admin and staff can read all performance data
CREATE POLICY "Admin and staff can read all performance"
ON public.technician_performance FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'staff', 'manager')
    )
);

-- Technicians can read their own performance
CREATE POLICY "Technicians can read own performance"
ON public.technician_performance FOR SELECT
TO authenticated
USING (technician_id = auth.uid());

-- Admin and staff can manage performance
CREATE POLICY "Admin and staff can manage performance"
ON public.technician_performance FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'staff', 'manager')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'staff', 'manager')
    )
);

-- SLA History policies
CREATE POLICY "Admin and staff can read all SLA history"
ON public.technician_sla_history FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'staff', 'manager')
    )
);

CREATE POLICY "Technicians can read own SLA history"
ON public.technician_sla_history FOR SELECT
TO authenticated
USING (technician_id = auth.uid());

-- ============================================================================
-- 5. UPDATED_AT TRIGGER
-- ============================================================================

DROP TRIGGER IF EXISTS set_updated_at ON public.technician_performance;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.technician_performance
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 6. GRANTS
-- ============================================================================

GRANT ALL ON public.technician_performance TO service_role;
GRANT ALL ON public.technician_sla_history TO service_role;

-- ============================================================================
-- 7. SEED SAMPLE DATA (for testing)
-- ============================================================================

-- Insert sample performance data for existing technicians
INSERT INTO public.technician_performance (technician_id, total_jobs, jobs_completed, avg_completion_time_minutes, sla_met, sla_breached, rating_avg, score)
SELECT 
    p.user_id,
    10,  -- total_jobs
    8,   -- jobs_completed
    120, -- avg_completion_time_minutes
    7,   -- sla_met
    1,   -- sla_breached
    4.2, -- rating_avg
    85   -- score
FROM public.profiles p
WHERE p.role = 'technician'
ON CONFLICT (technician_id) DO NOTHING;
