-- ============================================================================
-- C19 Phase 5: Add p_as_of parameter to forecast RPCs for CI determinism
-- ============================================================================
-- This migration adds an optional p_as_of parameter to the forecast RPCs
-- so CI pipelines can compute forecasts "as of" a specific time, ensuring
-- evaluable samples exist within the test window.
--
-- Without this, CI seeding produces snapshots with computed_at = now(),
-- which may be outside the evaluable window (computed_at + window_days > FROZEN_NOW).
-- ============================================================================

-- ============================================================================
-- 1. Update rpc_compute_part_demand to accept p_as_of
-- ============================================================================

-- ============================================================================
-- 1. Update rpc_compute_part_demand to accept p_as_of
-- ============================================================================

-- Robust cleanup: Drop BOTH potential signatures to ensure clean slate
DROP FUNCTION IF EXISTS public.rpc_compute_part_demand(integer, timestamptz); -- Drop new signature if partially applied
DROP FUNCTION IF EXISTS public.rpc_compute_part_demand(integer);              -- Drop old signature

CREATE OR REPLACE FUNCTION public.rpc_compute_part_demand(
    p_days_back integer DEFAULT 90,
    p_as_of timestamptz DEFAULT NULL  -- NEW: Optional "as of" timestamp for CI
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rows_inserted integer := 0;
    v_start_date date;
    v_end_date date;
BEGIN
    -- Permission gate: service_role only
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: demand computation requires service_role privileges';
    END IF;
    
    -- Use p_as_of if provided, otherwise CURRENT_DATE
    v_end_date := COALESCE(p_as_of::date, CURRENT_DATE);
    v_start_date := v_end_date - p_days_back;
    
    -- Aggregate demand from inventory_stock_ledger (C19 canonical source for consumption)
    INSERT INTO public.part_demand_rollups_daily (location_id, part_id, day, demand_count, fulfilled_count, unfulfilled_count, computed_at)
    SELECT 
        isl.location_id,
        isl.part_id,
        isl.occurred_at::date as day,
        SUM(ABS(isl.qty)) as demand_count,
        SUM(ABS(isl.qty)) as fulfilled_count,
        0 as unfulfilled_count,
        COALESCE(p_as_of, now()) as computed_at  -- Use p_as_of for computed_at too
    FROM public.inventory_stock_ledger isl
    WHERE isl.occurred_at::date >= v_start_date
      AND isl.occurred_at::date <= v_end_date
      AND isl.movement_type IN ('consume', 'transfer_out')
    GROUP BY isl.location_id, isl.part_id, isl.occurred_at::date
    ON CONFLICT (location_id, part_id, day)
    DO UPDATE SET
        demand_count = EXCLUDED.demand_count,
        fulfilled_count = EXCLUDED.fulfilled_count,
        unfulfilled_count = EXCLUDED.unfulfilled_count,
        computed_at = EXCLUDED.computed_at;
    
    GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
    
    RETURN jsonb_build_object(
        'success', true,
        'rows_processed', v_rows_inserted,
        'start_date', v_start_date,
        'end_date', v_end_date,
        'as_of', COALESCE(p_as_of::text, 'now()')
    );
END;
$$;

COMMENT ON FUNCTION public.rpc_compute_part_demand(integer, timestamptz) IS 'V1.1: Aggregate demand with optional p_as_of for CI determinism.';

GRANT EXECUTE ON FUNCTION public.rpc_compute_part_demand(integer, timestamptz) TO service_role;

-- ============================================================================
-- 2. Update rpc_compute_inventory_forecast to accept p_as_of
-- ============================================================================

-- ============================================================================
-- 2. Update rpc_compute_inventory_forecast to accept p_as_of
-- ============================================================================

-- Robust cleanup: Drop BOTH potential signatures
DROP FUNCTION IF EXISTS public.rpc_compute_inventory_forecast(timestamptz); -- Drop new signature
DROP FUNCTION IF EXISTS public.rpc_compute_inventory_forecast();            -- Drop old signature

CREATE OR REPLACE FUNCTION public.rpc_compute_inventory_forecast(
    p_as_of timestamptz DEFAULT NULL  -- NEW: Optional "as of" timestamp for CI
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_location RECORD;
    v_part RECORD;
    v_window integer;
    v_forecast_qty numeric;
    v_confidence integer;
    v_drivers jsonb;
    v_primary_reason text;
    v_sample_size integer;
    v_avg_demand numeric;
    v_snapshots_created integer := 0;
    v_as_of_date date;
    v_as_of_ts timestamptz;
BEGIN
    -- Permission gate: service_role only
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: forecast computation requires service_role privileges';
    END IF;
    
    -- Use p_as_of if provided, otherwise CURRENT_DATE/now()
    v_as_of_date := COALESCE(p_as_of::date, CURRENT_DATE);
    v_as_of_ts := COALESCE(p_as_of, now());
    
    -- For each active location
    FOR v_location IN SELECT * FROM inventory_locations WHERE active = true
    LOOP
        -- For each part with demand history
        FOR v_part IN 
            SELECT DISTINCT part_id 
            FROM part_demand_rollups_daily 
            WHERE location_id = v_location.id
        LOOP
            -- Compute forecasts for 7/30/90 windows
            FOREACH v_window IN ARRAY ARRAY[7, 30, 90]
            LOOP
                -- Calculate average demand over window (lookback from as_of_date)
                SELECT 
                    COUNT(*) as sample_size,
                    COALESCE(AVG(demand_count), 0) as avg_demand
                INTO v_sample_size, v_avg_demand
                FROM part_demand_rollups_daily
                WHERE location_id = v_location.id
                  AND part_id = v_part.part_id
                  AND day >= v_as_of_date - v_window
                  AND day <= v_as_of_date;  -- Added upper bound for as_of correctness
                
                -- Forecast = avg_demand * window_days (simple linear projection)
                v_forecast_qty := v_avg_demand * v_window;
                
                -- Confidence based on sample size (VFL pattern)
                v_confidence := CASE
                    WHEN v_sample_size >= v_window * 0.7 THEN 90
                    WHEN v_sample_size >= v_window * 0.3 THEN 70
                    WHEN v_sample_size > 0 THEN 50
                    ELSE 30
                END;
                
                -- Primary reason
                v_primary_reason := CASE
                    WHEN v_sample_size = 0 THEN 'Insufficient Data'
                    WHEN v_avg_demand > 5 THEN 'High Demand Pattern'
                    WHEN v_avg_demand > 1 THEN 'Moderate Demand'
                    ELSE 'Low Demand'
                END;
                
                -- Drivers
                v_drivers := jsonb_build_object(
                    'sample_size', v_sample_size,
                    'avg_daily_demand', v_avg_demand,
                    'window_days', v_window,
                    'trend', 'stable',
                    'as_of', v_as_of_date::text
                );
                
                -- Insert forecast snapshot with as_of timestamp for computed_at
                INSERT INTO inventory_forecast_snapshots (
                    location_id, part_id, window_days,
                    forecast_qty, confidence_score,
                    drivers, primary_reason, computed_at
                )
                VALUES (
                    v_location.id, v_part.part_id, v_window,
                    v_forecast_qty, v_confidence,
                    v_drivers, v_primary_reason, v_as_of_ts  -- Use as_of for computed_at
                );
                
                v_snapshots_created := v_snapshots_created + 1;
            END LOOP; -- windows
        END LOOP; -- parts
    END LOOP; -- locations
    
    RETURN jsonb_build_object(
        'success', true,
        'snapshots_created', v_snapshots_created,
        'as_of', v_as_of_ts::text
    );
END;
$$;

COMMENT ON FUNCTION public.rpc_compute_inventory_forecast(timestamptz) IS 'V1.1: Compute forecasts with optional p_as_of for CI determinism.';

GRANT EXECUTE ON FUNCTION public.rpc_compute_inventory_forecast(timestamptz) TO service_role;

-- ============================================================================
-- 3. Log the migration
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'C19 Phase 5: Added p_as_of parameter to rpc_compute_part_demand and rpc_compute_inventory_forecast for CI determinism';
END;
$$;
