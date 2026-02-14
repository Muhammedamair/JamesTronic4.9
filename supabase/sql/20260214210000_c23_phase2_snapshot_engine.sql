-- ============================================================
-- C23 Phase 2: Snapshot Engine
-- Generates 30d/90d performance packets per technician
-- GOVERNANCE: No side-effects. No notifications. No penalties.
--             Evidence-first. Fairness-first.
-- Engine Version: 1.0.0
-- ============================================================

-- ===================== HELPER: UNIQUE CONSTRAINT ============
-- Upsert key for packets: one packet per (tech, branch, window)
DO $$ BEGIN
  ALTER TABLE public.c23_technician_performance_packets
    ADD CONSTRAINT c23_packets_upsert_key
    UNIQUE (tech_id, branch_id, window_start, window_end);
EXCEPTION WHEN duplicate_table THEN NULL;
          WHEN duplicate_object THEN NULL;
END $$;

-- ===================== THRESHOLD CONFIG ======================
-- Versioned threshold bands. Stored in a config table so changes
-- are auditable and don't require code deploys.
CREATE TABLE IF NOT EXISTS public.c23_engine_config (
  config_key    TEXT PRIMARY KEY,
  config_value  JSONB NOT NULL,
  engine_version TEXT NOT NULL DEFAULT '1.0.0',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    TEXT NOT NULL DEFAULT 'system'
);

COMMENT ON TABLE public.c23_engine_config IS 'C23: Versioned engine thresholds and config. Changes are auditable.';

-- RLS: only admin can read/write config
ALTER TABLE public.c23_engine_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY c23_config_admin_only
  ON public.c23_engine_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Seed default thresholds
INSERT INTO public.c23_engine_config (config_key, config_value, engine_version)
VALUES (
  'status_thresholds_v1',
  '{
    "rework_rate": {
      "GOOD":          {"max": 0.08},
      "WARNING":       {"max": 0.15},
      "NEEDS_REVIEW":  {"max": 1.0}
    },
    "avg_cycle_time_deviation": {
      "GOOD":          {"max": 1.2},
      "WARNING":       {"max": 1.5},
      "NEEDS_REVIEW":  {"max": 999}
    },
    "min_tickets_for_confidence": 5,
    "trend_deadband_pct": 0.05,
    "min_confidence_for_good": 0.6
  }'::JSONB,
  '1.0.0'
)
ON CONFLICT (config_key) DO NOTHING;

-- ===================== GENERATOR FUNCTION ====================

CREATE OR REPLACE FUNCTION public.c23_generate_packets(
  p_as_of TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_days     INT[] := ARRAY[30, 90];
  v_window          INT;
  v_window_start    DATE;
  v_window_end      DATE;
  v_prev_start      DATE;
  v_prev_end        DATE;
  v_tech            RECORD;
  v_config          JSONB;
  v_packets_count   INT := 0;

  -- Metrics
  v_tickets_completed       INT;
  v_total_cycle_mins        NUMERIC;
  v_controllable_cycle_mins NUMERIC;
  v_uncontrollable_mins     NUMERIC;
  v_avg_cycle_time          NUMERIC;
  v_rework_count            INT;
  v_rework_rate             NUMERIC;
  v_exception_parts         INT;
  v_exception_transport     INT;
  v_exception_admin         INT;
  v_exception_customer      INT;

  -- Previous window metrics (for trend)
  v_prev_rework_rate        NUMERIC;
  v_prev_avg_cycle          NUMERIC;
  v_prev_packet             RECORD;

  -- Derived
  v_confidence              NUMERIC;
  v_trend                   public.c23_perf_trend;
  v_status                  public.c23_perf_status;
  v_review_required         BOOLEAN;
  v_evidence_refs           UUID[];
  v_packet_json             JSONB;
  v_source_job_id           TEXT;

  -- Config thresholds
  v_min_tickets             INT;
  v_deadband                NUMERIC;
  v_min_conf_good           NUMERIC;
  v_rework_good_max         NUMERIC;
  v_rework_warn_max         NUMERIC;
BEGIN
  -- Load config
  SELECT config_value INTO v_config
  FROM public.c23_engine_config
  WHERE config_key = 'status_thresholds_v1';

  IF v_config IS NULL THEN
    RAISE EXCEPTION 'C23 Engine config not found (status_thresholds_v1)';
  END IF;

  v_min_tickets   := (v_config->>'min_tickets_for_confidence')::INT;
  v_deadband      := (v_config->>'trend_deadband_pct')::NUMERIC;
  v_min_conf_good := (v_config->>'min_confidence_for_good')::NUMERIC;
  v_rework_good_max := (v_config->'rework_rate'->'GOOD'->>'max')::NUMERIC;
  v_rework_warn_max := (v_config->'rework_rate'->'WARNING'->>'max')::NUMERIC;

  v_source_job_id := 'gen_' || to_char(p_as_of, 'YYYYMMDD_HH24MISS');

  -- Iterate windows
  FOREACH v_window IN ARRAY v_window_days LOOP
    v_window_end   := (p_as_of AT TIME ZONE 'UTC')::DATE;
    v_window_start := v_window_end - v_window;
    v_prev_end     := v_window_start;
    v_prev_start   := v_prev_end - v_window;

    -- Find candidate technicians: those with events in this window
    FOR v_tech IN
      SELECT DISTINCT tech_id, branch_id
      FROM public.c23_telemetry_events
      WHERE event_ts >= v_window_start::TIMESTAMPTZ
        AND event_ts < (v_window_end + 1)::TIMESTAMPTZ
    LOOP

      -- =======================================================
      -- METRIC 1: Tickets completed (COMPLETION events)
      -- =======================================================
      SELECT
        COUNT(DISTINCT ticket_id),
        ARRAY_AGG(DISTINCT ticket_id)
      INTO v_tickets_completed, v_evidence_refs
      FROM public.c23_telemetry_events
      WHERE tech_id = v_tech.tech_id
        AND branch_id = v_tech.branch_id
        AND event_type = 'COMPLETION'
        AND event_ts >= v_window_start::TIMESTAMPTZ
        AND event_ts < (v_window_end + 1)::TIMESTAMPTZ;

      IF v_evidence_refs IS NULL THEN
        v_evidence_refs := '{}';
      END IF;

      -- =======================================================
      -- METRIC 2: Cycle time (controllable only = fairness)
      -- Total span minus uncontrollable segments
      -- =======================================================

      -- Total time across all events
      SELECT
        COALESCE(
          EXTRACT(EPOCH FROM (MAX(event_ts) - MIN(event_ts))) / 60.0,
          0
        )
      INTO v_total_cycle_mins
      FROM public.c23_telemetry_events
      WHERE tech_id = v_tech.tech_id
        AND branch_id = v_tech.branch_id
        AND event_ts >= v_window_start::TIMESTAMPTZ
        AND event_ts < (v_window_end + 1)::TIMESTAMPTZ;

      -- Uncontrollable duration: sum of time spans for UNCONTROLLABLE events
      -- We estimate by counting uncontrollable events × average event duration
      SELECT
        COALESCE(COUNT(*) * 30.0, 0)  -- baseline 30 mins per uncontrollable event
      INTO v_uncontrollable_mins
      FROM public.c23_telemetry_events
      WHERE tech_id = v_tech.tech_id
        AND branch_id = v_tech.branch_id
        AND controllability = 'UNCONTROLLABLE'
        AND event_ts >= v_window_start::TIMESTAMPTZ
        AND event_ts < (v_window_end + 1)::TIMESTAMPTZ;

      v_controllable_cycle_mins := GREATEST(v_total_cycle_mins - v_uncontrollable_mins, 0);

      IF v_tickets_completed > 0 THEN
        v_avg_cycle_time := v_controllable_cycle_mins / v_tickets_completed;
      ELSE
        v_avg_cycle_time := 0;
      END IF;

      -- =======================================================
      -- METRIC 3: Rework rate
      -- =======================================================
      SELECT COUNT(DISTINCT ticket_id)
      INTO v_rework_count
      FROM public.c23_telemetry_events
      WHERE tech_id = v_tech.tech_id
        AND branch_id = v_tech.branch_id
        AND event_type IN ('REWORK_START', 'REWORK_END')
        AND event_ts >= v_window_start::TIMESTAMPTZ
        AND event_ts < (v_window_end + 1)::TIMESTAMPTZ;

      IF v_tickets_completed > 0 THEN
        v_rework_rate := v_rework_count::NUMERIC / v_tickets_completed;
      ELSE
        v_rework_rate := 0;
      END IF;

      -- =======================================================
      -- METRIC 4: Exception breakdown
      -- =======================================================
      SELECT
        COUNT(*) FILTER (WHERE uncontrollable_reason = 'PARTS_DELAY'),
        COUNT(*) FILTER (WHERE uncontrollable_reason = 'TRANSPORT_DELAY'),
        COUNT(*) FILTER (WHERE uncontrollable_reason = 'ADMIN_HOLD'),
        COUNT(*) FILTER (WHERE uncontrollable_reason = 'CUSTOMER_UNRESPONSIVE')
      INTO
        v_exception_parts, v_exception_transport,
        v_exception_admin, v_exception_customer
      FROM public.c23_telemetry_events
      WHERE tech_id = v_tech.tech_id
        AND branch_id = v_tech.branch_id
        AND controllability = 'UNCONTROLLABLE'
        AND event_ts >= v_window_start::TIMESTAMPTZ
        AND event_ts < (v_window_end + 1)::TIMESTAMPTZ;

      -- =======================================================
      -- CONFIDENCE (sample size + completeness)
      -- =======================================================
      IF v_tickets_completed >= v_min_tickets * 3 THEN
        v_confidence := 0.95;
      ELSIF v_tickets_completed >= v_min_tickets * 2 THEN
        v_confidence := 0.85;
      ELSIF v_tickets_completed >= v_min_tickets THEN
        v_confidence := 0.70;
      ELSIF v_tickets_completed >= 2 THEN
        v_confidence := 0.45;
      ELSE
        v_confidence := 0.20;
      END IF;

      -- =======================================================
      -- STATUS (from threshold bands)
      -- =======================================================
      IF v_confidence < v_min_conf_good THEN
        v_status := 'NEEDS_REVIEW';  -- low confidence = can't judge
      ELSIF v_rework_rate <= v_rework_good_max THEN
        v_status := 'GOOD';
      ELSIF v_rework_rate <= v_rework_warn_max THEN
        v_status := 'WARNING';
      ELSE
        v_status := 'NEEDS_REVIEW';
      END IF;

      -- =======================================================
      -- TREND (vs previous window, with deadband)
      -- =======================================================
      v_trend := 'STABLE';

      SELECT rework_rate_val, avg_cycle_val
      INTO v_prev_rework_rate, v_prev_avg_cycle
      FROM (
        SELECT
          (packet_json->'signals'->'quality'->>'rework_rate')::NUMERIC AS rework_rate_val,
          (packet_json->'signals'->'efficiency'->>'avg_cycle_time_mins')::NUMERIC AS avg_cycle_val
        FROM public.c23_technician_performance_packets
        WHERE tech_id = v_tech.tech_id
          AND branch_id = v_tech.branch_id
          AND window_start = v_prev_start
          AND window_end = v_prev_end
        LIMIT 1
      ) prev;

      IF v_prev_rework_rate IS NOT NULL THEN
        IF v_rework_rate < v_prev_rework_rate * (1 - v_deadband) THEN
          v_trend := 'IMPROVING';
        ELSIF v_rework_rate > v_prev_rework_rate * (1 + v_deadband) THEN
          v_trend := 'DEGRADING';
        END IF;
      END IF;

      -- =======================================================
      -- GOVERNANCE: review_required if not GOOD
      -- =======================================================
      v_review_required := (v_status != 'GOOD');

      -- =======================================================
      -- BUILD PACKET JSON (evidence-first)
      -- =======================================================
      v_packet_json := jsonb_build_object(
        'tech_id', v_tech.tech_id,
        'branch_id', v_tech.branch_id,
        'window', jsonb_build_object(
          'start', v_window_start,
          'end', v_window_end,
          'days', v_window
        ),
        'summary', jsonb_build_object(
          'status', v_status::TEXT,
          'trend', v_trend::TEXT,
          'confidence', v_confidence,
          'tickets_completed', v_tickets_completed
        ),
        'signals', jsonb_build_object(
          'quality', jsonb_build_object(
            'rework_rate', v_rework_rate,
            'rework_count', v_rework_count,
            'evidence', to_jsonb(v_evidence_refs)
          ),
          'efficiency', jsonb_build_object(
            'avg_cycle_time_mins', ROUND(v_avg_cycle_time, 2),
            'total_controllable_mins', ROUND(v_controllable_cycle_mins, 2),
            'uncontrollable_delay_mins', ROUND(v_uncontrollable_mins, 2)
          ),
          'exceptions', jsonb_build_object(
            'parts_delay', v_exception_parts,
            'transport_delay', v_exception_transport,
            'admin_hold', v_exception_admin,
            'customer_unresponsive', v_exception_customer
          )
        ),
        'explainability', jsonb_build_object(
          'controllable_factors', CASE
            WHEN v_rework_rate > v_rework_good_max
            THEN '["Elevated rework rate detected"]'::JSONB
            ELSE '[]'::JSONB
          END,
          'uncontrollable_factors', CASE
            WHEN v_uncontrollable_mins > 0
            THEN jsonb_build_array(
              'Uncontrollable delays: ' || ROUND(v_uncontrollable_mins,0) || ' mins '
              || '(parts=' || v_exception_parts
              || ', transport=' || v_exception_transport
              || ', admin=' || v_exception_admin
              || ', customer=' || v_exception_customer || ')'
            )
            ELSE '[]'::JSONB
          END
        ),
        'governance', jsonb_build_object(
          'review_required', v_review_required,
          'engine_version', '1.0.0',
          'generated_at', p_as_of
        )
      );

      -- =======================================================
      -- UPSERT PACKET
      -- =======================================================
      INSERT INTO public.c23_technician_performance_packets (
        tech_id, branch_id, window_start, window_end,
        packet_json, status, trend, confidence,
        generated_at, engine_version,
        review_required, review_state,
        created_by, source_job_id
      ) VALUES (
        v_tech.tech_id, v_tech.branch_id,
        v_window_start, v_window_end,
        v_packet_json, v_status, v_trend, v_confidence,
        p_as_of, '1.0.0',
        v_review_required,
        CASE WHEN v_review_required THEN 'PENDING'::public.c23_review_state
             ELSE 'NOT_REQUIRED'::public.c23_review_state END,
        'system', v_source_job_id
      )
      ON CONFLICT (tech_id, branch_id, window_start, window_end)
      DO UPDATE SET
        packet_json     = EXCLUDED.packet_json,
        status          = EXCLUDED.status,
        trend           = EXCLUDED.trend,
        confidence      = EXCLUDED.confidence,
        generated_at    = EXCLUDED.generated_at,
        engine_version  = EXCLUDED.engine_version,
        review_required = EXCLUDED.review_required,
        review_state    = CASE
          WHEN c23_technician_performance_packets.review_state IN ('APPROVED', 'FLAGGED')
          THEN c23_technician_performance_packets.review_state  -- don't overwrite completed reviews
          ELSE EXCLUDED.review_state
        END,
        source_job_id   = EXCLUDED.source_job_id;

      -- =======================================================
      -- WRITE SIGNALS (metric-level rows)
      -- =======================================================
      INSERT INTO public.c23_performance_signals
        (tech_id, branch_id, window_ref, signal_type, metric_key, metric_value,
         evidence_refs, controllability)
      VALUES
        (v_tech.tech_id, v_tech.branch_id,
         v_window_start || '_' || v_window || 'd',
         'QUALITY', 'rework_rate', v_rework_rate,
         v_evidence_refs, 'CONTROLLABLE'),
        (v_tech.tech_id, v_tech.branch_id,
         v_window_start || '_' || v_window || 'd',
         'EFFICIENCY', 'avg_cycle_time_mins', ROUND(v_avg_cycle_time, 2),
         v_evidence_refs, 'CONTROLLABLE'),
        (v_tech.tech_id, v_tech.branch_id,
         v_window_start || '_' || v_window || 'd',
         'EFFICIENCY', 'uncontrollable_delay_mins', ROUND(v_uncontrollable_mins, 2),
         v_evidence_refs, 'UNCONTROLLABLE')
      ON CONFLICT DO NOTHING;

      v_packets_count := v_packets_count + 1;

    END LOOP; -- tech loop
  END LOOP; -- window loop

  RETURN v_packets_count;
END;
$$;

COMMENT ON FUNCTION public.c23_generate_packets IS
'C23 Snapshot Engine v1.0.0: Generates 30d/90d performance packets.
 - Server-only (SECURITY DEFINER, service role).
 - Fairness: excludes uncontrollable time from efficiency.
 - Evidence-first: WARNING/NEEDS_REVIEW packets include evidence IDs.
 - Trend: deadband comparison vs previous equal window.
 - No side-effects: no notifications, no penalties, no escalations.';
