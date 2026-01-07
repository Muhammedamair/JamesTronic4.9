-- Migration: C17 Workforce HR Foundation
-- Creates core tables for technician and transporter behaviour tracking.
-- Decisions: 0-100 scoring scale, shift-based attendance.

-- ============================================================================
-- 1. ENUM TYPES
-- ============================================================================

-- Incident severity levels
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_severity') THEN
        CREATE TYPE incident_severity AS ENUM ('low', 'medium', 'high', 'critical');
    END IF;
END$$;

-- Incident types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_type') THEN
        CREATE TYPE incident_type AS ENUM (
            'late_arrival',
            'early_departure',
            'missed_shift',
            'customer_complaint',
            'sla_breach',
            'device_violation',
            'location_anomaly',
            'quality_issue',
            'fraud_flag',
            'other'
        );
    END IF;
END$$;

-- ============================================================================
-- 2. WORKFORCE SHIFTS (Reference table for expected schedules)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workforce_shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shift_date date NOT NULL,
    expected_start time NOT NULL,
    expected_end time NOT NULL,
    branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, shift_date)
);

COMMENT ON TABLE public.workforce_shifts IS 'Defines expected work schedules for technicians and transporters.';

-- ============================================================================
-- 3. WORKFORCE ATTENDANCE (Actual check-in/check-out)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workforce_attendance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shift_id uuid REFERENCES public.workforce_shifts(id) ON DELETE SET NULL,
    check_in_at timestamptz,
    check_in_lat numeric(10, 7),
    check_in_lng numeric(10, 7),
    check_out_at timestamptz,
    check_out_lat numeric(10, 7),
    check_out_lng numeric(10, 7),
    actual_duration_minutes integer GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (check_out_at - check_in_at)) / 60
    ) STORED,
    late_minutes integer DEFAULT 0,
    early_departure_minutes integer DEFAULT 0,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workforce_attendance IS 'Records actual attendance with location verification.';

-- ============================================================================
-- 4. WORKFORCE INCIDENTS (Logged issues)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workforce_incidents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    incident_type incident_type NOT NULL,
    severity incident_severity NOT NULL DEFAULT 'low',
    description text NOT NULL,
    ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
    transport_job_id uuid,  -- Reference to transport_jobs if applicable
    reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at timestamptz,
    resolution_notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workforce_incidents IS 'Logs incidents affecting workforce reliability scores.';

-- ============================================================================
-- 5. WORKFORCE BEHAVIOUR SCORES (Daily composite scores)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workforce_behaviour_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    score_date date NOT NULL,
    -- Individual component scores (0-100)
    reliability_score integer NOT NULL DEFAULT 100 CHECK (reliability_score >= 0 AND reliability_score <= 100),
    punctuality_score integer NOT NULL DEFAULT 100 CHECK (punctuality_score >= 0 AND punctuality_score <= 100),
    quality_score integer NOT NULL DEFAULT 100 CHECK (quality_score >= 0 AND quality_score <= 100),
    incident_factor integer NOT NULL DEFAULT 0 CHECK (incident_factor >= 0 AND incident_factor <= 100),
    -- Composite score (weighted average)
    composite_score integer GENERATED ALWAYS AS (
        (reliability_score * 35 + punctuality_score * 25 + quality_score * 25 + (100 - incident_factor) * 15) / 100
    ) STORED,
    -- Metadata
    jobs_counted integer DEFAULT 0,
    incidents_counted integer DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, score_date)
);

COMMENT ON TABLE public.workforce_behaviour_scores IS 'Daily behaviour scores for workforce reliability tracking.';

-- ============================================================================
-- 6. WORKFORCE PERFORMANCE DAILY (Aggregated job metrics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workforce_performance_daily (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    performance_date date NOT NULL,
    jobs_completed integer DEFAULT 0,
    jobs_failed integer DEFAULT 0,
    jobs_reassigned integer DEFAULT 0,
    avg_job_duration_minutes integer,
    customer_rating_sum numeric(5, 2) DEFAULT 0,
    customer_rating_count integer DEFAULT 0,
    customer_rating_avg numeric(3, 2) GENERATED ALWAYS AS (
        CASE WHEN customer_rating_count > 0 THEN customer_rating_sum / customer_rating_count ELSE NULL END
    ) STORED,
    sla_compliant_jobs integer DEFAULT 0,
    sla_breached_jobs integer DEFAULT 0,
    sla_compliance_rate numeric(5, 2) GENERATED ALWAYS AS (
        CASE WHEN (sla_compliant_jobs + sla_breached_jobs) > 0 
        THEN (sla_compliant_jobs::numeric / (sla_compliant_jobs + sla_breached_jobs)) * 100 
        ELSE 100 END
    ) STORED,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, performance_date)
);

COMMENT ON TABLE public.workforce_performance_daily IS 'Aggregated daily performance metrics for workforce members.';

-- ============================================================================
-- 7. INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_workforce_shifts_user_date ON public.workforce_shifts(user_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_workforce_attendance_user_date ON public.workforce_attendance(user_id, check_in_at);
CREATE INDEX IF NOT EXISTS idx_workforce_incidents_user_date ON public.workforce_incidents(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_workforce_incidents_type ON public.workforce_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_workforce_behaviour_scores_user_date ON public.workforce_behaviour_scores(user_id, score_date);
CREATE INDEX IF NOT EXISTS idx_workforce_performance_daily_user_date ON public.workforce_performance_daily(user_id, performance_date);

-- ============================================================================
-- 8. RLS POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.workforce_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_behaviour_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_performance_daily ENABLE ROW LEVEL SECURITY;

-- Helper function for role checking
CREATE OR REPLACE FUNCTION public.get_user_role_for_rls()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role::text FROM public.profiles WHERE user_id = auth.uid();
$$;

-- ============================================================================
-- 8.1 workforce_shifts Policies
-- ============================================================================

-- Admins and staff can read all shifts
CREATE POLICY "Admin and staff can read all shifts"
ON public.workforce_shifts FOR SELECT
TO authenticated
USING (
    public.get_user_role_for_rls() IN ('admin', 'staff')
);

-- Workers can read their own shifts
CREATE POLICY "Workers can read own shifts"
ON public.workforce_shifts FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Only admin and staff can manage shifts
CREATE POLICY "Admin and staff can manage shifts"
ON public.workforce_shifts FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'staff'))
WITH CHECK (public.get_user_role_for_rls() IN ('admin', 'staff'));

-- ============================================================================
-- 8.2 workforce_attendance Policies
-- ============================================================================

-- Admin and staff can read all attendance
CREATE POLICY "Admin and staff can read all attendance"
ON public.workforce_attendance FOR SELECT
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'staff'));

-- Workers can read their own attendance
CREATE POLICY "Workers can read own attendance"
ON public.workforce_attendance FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Workers can check in (insert their own)
CREATE POLICY "Workers can check in"
ON public.workforce_attendance FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Workers can check out (update their own)
CREATE POLICY "Workers can update own attendance"
ON public.workforce_attendance FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admin can correct any attendance
CREATE POLICY "Admin can manage all attendance"
ON public.workforce_attendance FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() = 'admin')
WITH CHECK (public.get_user_role_for_rls() = 'admin');

-- ============================================================================
-- 8.3 workforce_incidents Policies
-- ============================================================================

-- Admin and staff can read all incidents
CREATE POLICY "Admin and staff can read all incidents"
ON public.workforce_incidents FOR SELECT
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'staff'));

-- Admin and staff can manage incidents
CREATE POLICY "Admin and staff can manage incidents"
ON public.workforce_incidents FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'staff'))
WITH CHECK (public.get_user_role_for_rls() IN ('admin', 'staff'));

-- ============================================================================
-- 8.4 workforce_behaviour_scores Policies
-- ============================================================================

-- Admin and staff can read all scores
CREATE POLICY "Admin and staff can read all scores"
ON public.workforce_behaviour_scores FOR SELECT
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'staff'));

-- Workers can read their own scores
CREATE POLICY "Workers can read own scores"
ON public.workforce_behaviour_scores FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Only service role can write scores (system-managed)
-- No public INSERT/UPDATE policies - managed via service role

-- ============================================================================
-- 8.5 workforce_performance_daily Policies
-- ============================================================================

-- Admin and staff can read all performance
CREATE POLICY "Admin and staff can read all performance"
ON public.workforce_performance_daily FOR SELECT
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'staff'));

-- Workers can read their own performance
CREATE POLICY "Workers can read own performance"
ON public.workforce_performance_daily FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Only service role can write performance (system-managed)
-- No public INSERT/UPDATE policies - managed via service role

-- ============================================================================
-- 9. UPDATED_AT TRIGGERS
-- ============================================================================

-- Generic updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to workforce tables
DROP TRIGGER IF EXISTS set_updated_at ON public.workforce_shifts;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.workforce_shifts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.workforce_attendance;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.workforce_attendance
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.workforce_behaviour_scores;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.workforce_behaviour_scores
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.workforce_performance_daily;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.workforce_performance_daily
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 10. GRANTS FOR SERVICE ROLE
-- ============================================================================

GRANT ALL ON public.workforce_shifts TO service_role;
GRANT ALL ON public.workforce_attendance TO service_role;
GRANT ALL ON public.workforce_incidents TO service_role;
GRANT ALL ON public.workforce_behaviour_scores TO service_role;
GRANT ALL ON public.workforce_performance_daily TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON SCHEMA public IS 'C17 Workforce HR Foundation applied. Tables: workforce_shifts, workforce_attendance, workforce_incidents, workforce_behaviour_scores, workforce_performance_daily.';
