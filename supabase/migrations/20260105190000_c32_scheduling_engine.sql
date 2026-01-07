-- ============================================================================
-- C32 AI Scheduling Engine: Foundation Migration
-- JamesTronic Platform
-- ============================================================================
-- Purpose: "Traffic Controller" for managing technician slots and assigning jobs.
-- Optimizes for distance and availability.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.slot_status AS ENUM (
    'available',
    'booked',
    'blocked', -- e.g. break, meeting
    'transit'
);

CREATE TYPE public.assignment_status AS ENUM (
    'proposed',
    'accepted',
    'rejected',
    'completed',
    'failed'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Schedule Slots: Discretized time blocks for technicians
CREATE TABLE IF NOT EXISTS public.schedule_slots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id uuid NOT NULL REFERENCES public.profiles(user_id),
    
    start_time timestamptz NOT NULL,
    end_time timestamptz NOT NULL,
    
    status public.slot_status DEFAULT 'available',
    
    -- If booked, link to ticket? Or keep loose?
    -- Better to link via 'job_assignments' table for many-to-many flexibility (e.g. 2 techs 1 job),
    -- but usually 1 slot = 1 job. Let's keep it simple: strict linking not here.
    
    created_at timestamptz DEFAULT now() NOT NULL,
    
    UNIQUE(technician_id, start_time) -- Prevent double booking overlap (simplistic)
);

-- Job Assignments: The decision log
CREATE TABLE IF NOT EXISTS public.job_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES public.tickets(id),
    
    technician_id uuid REFERENCES public.profiles(user_id),
    transporter_id uuid REFERENCES public.profiles(user_id),
    
    slot_id uuid REFERENCES public.schedule_slots(id),
    
    status public.assignment_status DEFAULT 'proposed',
    
    -- AI Scoring Metadata
    match_score integer, -- 0-100 fit score
    distance_km numeric(10, 2),
    estimated_travel_time_mins integer,
    
    assigned_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Optimization Runs: Logging when the AI "thinks"
CREATE TABLE IF NOT EXISTS public.optimization_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_at timestamptz DEFAULT now(),
    
    triggered_by uuid REFERENCES public.profiles(user_id), -- Admin who clicked button
    scope text, -- 'single_ticket', 'daily_batch'
    
    tickets_processed integer DEFAULT 0,
    assignments_created integer DEFAULT 0,
    
    logs text
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_slots_tech_time ON public.schedule_slots(technician_id, start_time);
CREATE INDEX idx_slots_status ON public.schedule_slots(status);
CREATE INDEX idx_assignments_ticket ON public.job_assignments(ticket_id);
CREATE INDEX idx_assignments_tech ON public.job_assignments(technician_id);

-- ============================================================================
-- FUNCTIONS / RPCs
-- ============================================================================

-- RPC: Generate Slots for a Technician (Utility)
-- Can be called by UI manually or by cron.
CREATE OR REPLACE FUNCTION public.rpc_generate_schedule_slots(
    p_technician_id uuid,
    p_date date,
    p_start_hour integer DEFAULT 9,
    p_end_hour integer DEFAULT 18,
    p_slot_duration_mins integer DEFAULT 60
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start timestamptz;
    v_end timestamptz;
    v_slots_created integer := 0;
    v_curr timestamptz;
BEGIN
    -- Construct start time for that date (assuming UTC or server time for simplicity)
    v_start := (p_date || ' ' || p_start_hour || ':00:00')::timestamptz;
    v_end := (p_date || ' ' || p_end_hour || ':00:00')::timestamptz;
    
    v_curr := v_start;
    
    WHILE v_curr < v_end LOOP
        -- Insert slot if not exists
        BEGIN
            INSERT INTO public.schedule_slots (technician_id, start_time, end_time, status)
            VALUES (
                p_technician_id, 
                v_curr, 
                v_curr + (p_slot_duration_mins || ' minutes')::interval, 
                'available'
            );
            v_slots_created := v_slots_created + 1;
        EXCEPTION WHEN unique_violation THEN
            -- Skip if exists
        END;
        
        v_curr := v_curr + (p_slot_duration_mins || ' minutes')::interval;
    END LOOP;
    
    RETURN v_slots_created;
END;
$$;

-- RPC: Find Best Technician (Heuristic)
-- 1. Must use C30 'technician_skills' to check skill? (Omitted for simplicity in V1, assumed all techs generalist OR filter in UI)
-- 2. Sort by distance (simulated) + availability
CREATE OR REPLACE FUNCTION public.rpc_find_best_technician(
    p_lat numeric,
    p_lng numeric,
    p_required_time timestamptz
)
RETURNS TABLE (
    technician_id uuid,
    full_name text,
    current_lat numeric,
    current_lng numeric,
    distance_km numeric,
    match_score integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Heuristic:
    -- Find techs who have specific Role
    -- Mock distance calculation since we don't have PostGIS enabled yet in this script context.
    -- We will return random mock availability for the demo UI.
    
    RETURN QUERY
    SELECT 
        p.user_id as technician_id,
        p.full_name,
        wa.check_in_lat as current_lat, -- Use actual data if avail
        wa.check_in_lng as current_lng,
        (
            -- Dummy distance calc: simple pythagoras-ish on degrees * 111km
            -- If lat/lng missing, assume far away (999km)
            COALESCE(
                 SQRT(POWER(COALESCE(wa.check_in_lat, 0) - p_lat, 2) + POWER(COALESCE(wa.check_in_lng, 0) - p_lng, 2)) * 111,
                 999
            )
        )::numeric(10,2) as distance_km,
        
        (
             -- Score: 100 - distance (clamped to 0) + random factor
             GREATEST(0, 100 - (
                COALESCE(
                     SQRT(POWER(COALESCE(wa.check_in_lat, 0) - p_lat, 2) + POWER(COALESCE(wa.check_in_lng, 0) - p_lng, 2)) * 111,
                     50
                )::integer
             )) 
        )::integer as match_score
        
    FROM public.profiles p
    -- Join latest attendance for location
    LEFT JOIN LATERAL (
        SELECT check_in_lat, check_in_lng 
        FROM public.workforce_attendance 
        WHERE user_id = p.user_id 
        ORDER BY created_at DESC LIMIT 1
    ) wa ON true
    
    WHERE p.role = 'technician'
    
    ORDER BY match_score DESC
    LIMIT 10;
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_slots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.optimization_runs TO authenticated;

GRANT ALL ON public.schedule_slots TO service_role;
GRANT ALL ON public.job_assignments TO service_role;
GRANT ALL ON public.optimization_runs TO service_role;

GRANT EXECUTE ON FUNCTION public.rpc_generate_schedule_slots TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_find_best_technician TO authenticated;
