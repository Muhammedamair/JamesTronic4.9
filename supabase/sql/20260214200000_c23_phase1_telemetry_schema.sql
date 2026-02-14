-- ============================================================
-- C23 Phase 1: Telemetry & Data Contracts
-- Technician Performance AI — Trajectory Intelligence
-- ============================================================
-- GOVERNANCE: No public leaderboard. No auto-penalties.
--             Human review required for negative actions.
--             Controllable vs Uncontrollable mandatory.
-- ============================================================

-- ===================== ENUMS ================================

-- Telemetry event types
DO $$ BEGIN
  CREATE TYPE public.c23_event_type AS ENUM (
    'DIAG_START',
    'DIAG_END',
    'REPAIR_START',
    'REPAIR_END',
    'QC_START',
    'QC_END',
    'CUSTOMER_CALL',
    'PARTS_REQUEST',
    'PARTS_RECEIVED',
    'TRANSPORT_PICKUP',
    'TRANSPORT_DELIVERY',
    'ADMIN_HOLD_START',
    'ADMIN_HOLD_END',
    'CUSTOMER_UNRESPONSIVE',
    'REWORK_START',
    'REWORK_END',
    'ESCALATION',
    'COMPLETION'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Controllability classification
DO $$ BEGIN
  CREATE TYPE public.c23_controllability AS ENUM (
    'CONTROLLABLE',
    'UNCONTROLLABLE',
    'PENDING_REVIEW'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Uncontrollable reason codes
DO $$ BEGIN
  CREATE TYPE public.c23_uncontrollable_reason AS ENUM (
    'PARTS_DELAY',
    'TRANSPORT_DELAY',
    'ADMIN_HOLD',
    'CUSTOMER_UNRESPONSIVE',
    'OTHER_APPROVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Telemetry source
DO $$ BEGIN
  CREATE TYPE public.c23_event_source AS ENUM (
    'PWA',
    'ADMIN',
    'SYSTEM'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Signal types
DO $$ BEGIN
  CREATE TYPE public.c23_signal_type AS ENUM (
    'QUALITY',
    'EFFICIENCY',
    'BEHAVIOR'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Performance status labels
DO $$ BEGIN
  CREATE TYPE public.c23_perf_status AS ENUM (
    'GOOD',
    'WARNING',
    'NEEDS_REVIEW'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Performance trend labels
DO $$ BEGIN
  CREATE TYPE public.c23_perf_trend AS ENUM (
    'IMPROVING',
    'STABLE',
    'DEGRADING'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Review state
DO $$ BEGIN
  CREATE TYPE public.c23_review_state AS ENUM (
    'NOT_REQUIRED',
    'PENDING',
    'APPROVED',
    'FLAGGED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Coaching task status
DO $$ BEGIN
  CREATE TYPE public.c23_coaching_status AS ENUM (
    'ASSIGNED',
    'IN_PROGRESS',
    'COMPLETED',
    'OVERDUE',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===================== TABLES ===============================

-- 1. Telemetry Events (ingestion table)
CREATE TABLE IF NOT EXISTS public.c23_telemetry_events (
  event_id        UUID PRIMARY KEY,                     -- idempotency key (client-generated)
  ticket_id       UUID NOT NULL,                        -- references tickets
  tech_id         UUID NOT NULL,                        -- references profiles (technician)
  branch_id       UUID NOT NULL,                        -- references branches
  event_type      public.c23_event_type NOT NULL,
  event_ts        TIMESTAMPTZ NOT NULL,                 -- client timestamp
  received_ts     TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- server timestamp
  controllability public.c23_controllability NOT NULL DEFAULT 'PENDING_REVIEW',
  uncontrollable_reason public.c23_uncontrollable_reason,
  source          public.c23_event_source NOT NULL DEFAULT 'PWA',
  device_id       TEXT,                                 -- for device-lock audit
  metadata        JSONB DEFAULT '{}',                   -- extensible payload
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.c23_telemetry_events IS 'C23: Raw telemetry events for technician performance tracking. Idempotent insert via event_id.';

-- 2. Technician Performance Packets (snapshots)
CREATE TABLE IF NOT EXISTS public.c23_technician_performance_packets (
  packet_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tech_id         UUID NOT NULL,
  branch_id       UUID NOT NULL,
  window_start    DATE NOT NULL,
  window_end      DATE NOT NULL,
  packet_json     JSONB NOT NULL,                       -- full packet (signals + evidence + explainability)
  status          public.c23_perf_status NOT NULL,
  trend           public.c23_perf_trend NOT NULL,
  confidence      NUMERIC(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  engine_version  TEXT NOT NULL DEFAULT '1.0.0',
  -- Governance
  review_required BOOLEAN NOT NULL DEFAULT false,
  review_state    public.c23_review_state NOT NULL DEFAULT 'NOT_REQUIRED',
  reviewed_by     UUID,                                 -- manager/HR who reviewed
  reviewed_at     TIMESTAMPTZ,
  -- Audit
  created_by      TEXT NOT NULL DEFAULT 'system',       -- always 'system' (batch job)
  source_job_id   TEXT,                                 -- job run identifier
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.c23_technician_performance_packets IS 'C23: 30/90-day performance snapshots. GOVERNANCE: No client API exposure. Service-role write only.';

-- 3. Performance Signals (granular metrics)
CREATE TABLE IF NOT EXISTS public.c23_performance_signals (
  signal_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tech_id         UUID NOT NULL,
  ticket_id       UUID,                                 -- nullable (aggregate signals may not have ticket)
  branch_id       UUID NOT NULL,
  window_ref      TEXT,                                 -- e.g., '2026-01_30d' or '2026-Q1_90d'
  signal_type     public.c23_signal_type NOT NULL,
  metric_key      TEXT NOT NULL,                        -- e.g., 'rework_rate', 'avg_cycle_time_mins'
  metric_value    NUMERIC NOT NULL,
  evidence_refs   UUID[] DEFAULT '{}',                  -- array of ticket_ids / event_ids
  controllability public.c23_controllability NOT NULL DEFAULT 'CONTROLLABLE',
  reason_enum     public.c23_uncontrollable_reason,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.c23_performance_signals IS 'C23: Granular performance signals. Audit-safe: only store what can be justified in HR review.';

-- 4. Coaching Tasks
CREATE TABLE IF NOT EXISTS public.c23_coaching_tasks (
  task_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tech_id              UUID NOT NULL,
  created_by_manager_id UUID NOT NULL,
  branch_id            UUID NOT NULL,
  packet_id            UUID,                            -- optional link to performance packet
  ticket_evidence_id   UUID,                            -- optional link to specific ticket
  task_text            TEXT NOT NULL,
  status               public.c23_coaching_status NOT NULL DEFAULT 'ASSIGNED',
  due_date             DATE,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.c23_coaching_tasks IS 'C23: Coaching tasks linked to evidence. Technician sees task_text + linked ticket ONLY, never the packet.';

-- ===================== INDEXES ==============================

-- Telemetry Events
CREATE INDEX IF NOT EXISTS idx_c23_telemetry_tech_id ON public.c23_telemetry_events(tech_id);
CREATE INDEX IF NOT EXISTS idx_c23_telemetry_ticket_id ON public.c23_telemetry_events(ticket_id);
CREATE INDEX IF NOT EXISTS idx_c23_telemetry_branch_id ON public.c23_telemetry_events(branch_id);
CREATE INDEX IF NOT EXISTS idx_c23_telemetry_event_ts ON public.c23_telemetry_events(event_ts);
CREATE INDEX IF NOT EXISTS idx_c23_telemetry_type ON public.c23_telemetry_events(event_type);

-- Performance Packets
CREATE INDEX IF NOT EXISTS idx_c23_packets_tech_id ON public.c23_technician_performance_packets(tech_id);
CREATE INDEX IF NOT EXISTS idx_c23_packets_branch_id ON public.c23_technician_performance_packets(branch_id);
CREATE INDEX IF NOT EXISTS idx_c23_packets_window ON public.c23_technician_performance_packets(window_start, window_end);
CREATE INDEX IF NOT EXISTS idx_c23_packets_status ON public.c23_technician_performance_packets(status);

-- Performance Signals
CREATE INDEX IF NOT EXISTS idx_c23_signals_tech_id ON public.c23_performance_signals(tech_id);
CREATE INDEX IF NOT EXISTS idx_c23_signals_branch_id ON public.c23_performance_signals(branch_id);
CREATE INDEX IF NOT EXISTS idx_c23_signals_ticket_id ON public.c23_performance_signals(ticket_id);
CREATE INDEX IF NOT EXISTS idx_c23_signals_type ON public.c23_performance_signals(signal_type);

-- Coaching Tasks
CREATE INDEX IF NOT EXISTS idx_c23_coaching_tech_id ON public.c23_coaching_tasks(tech_id);
CREATE INDEX IF NOT EXISTS idx_c23_coaching_branch_id ON public.c23_coaching_tasks(branch_id);
CREATE INDEX IF NOT EXISTS idx_c23_coaching_status ON public.c23_coaching_tasks(status);
