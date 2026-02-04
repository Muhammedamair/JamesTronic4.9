-- ============================================================================
-- C19 Inventory Prediction Engine - Phase 1: Core Tables (V1.1 Hardened)
-- JamesTronic Platform
-- ============================================================================
-- Purpose:
-- 1. Create inventory ledger + current stock materialized view
-- 2. Create catalog and locations foundations
-- 3. Implement event_hash/idempotency_key pattern (C18 V1.1 proven)
-- 4. Enum-safe RBAC helper
-- 5. Negative stock prevention
-- ============================================================================
-- Job ID: C19_PHASE1_DB_V0
-- Priority: P0
-- Date: 2026-01-22
-- ============================================================================

-- ============================================================================
-- ENSURE CRYPTO EXTENSION
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- STEP 1: Inventory Locations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    city text NOT NULL,
    type text NOT NULL CHECK (type IN ('dark_store', 'service_center', 'hub')),
    address jsonb DEFAULT '{}',
    capacity_units integer, -- Storage capacity (optional)
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_locations_city ON inventory_locations(city);
CREATE INDEX IF NOT EXISTS idx_inventory_locations_type ON inventory_locations(type);
CREATE INDEX IF NOT EXISTS idx_inventory_locations_active ON inventory_locations(active) WHERE active = true;

COMMENT ON TABLE public.inventory_locations IS 'Dark stores, service centers, and hubs for inventory storage';

-- ============================================================================
-- STEP 2: Parts Catalog (Reuse existing inventory_parts if present)
-- ============================================================================

-- Check if inventory_parts exists from C29, if not create parts_catalog
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'public' AND table_name = 'inventory_parts') THEN
        -- Create parts_catalog (canonical SKU catalog)
        CREATE TABLE public.parts_catalog (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            sku text UNIQUE NOT NULL,
            name text NOT NULL,
            device_category text, -- e.g., 'smartphone', 'tablet', 'laptop'
            brand text,
            model text,
            attributes jsonb DEFAULT '{}', -- Flexible metadata
            cost_price numeric(10, 2),
            active boolean DEFAULT true,
            created_at timestamptz DEFAULT now() NOT NULL,
            updated_at timestamptz DEFAULT now()
        );

        CREATE INDEX idx_parts_catalog_sku ON parts_catalog(sku);
        CREATE INDEX idx_parts_catalog_category ON parts_catalog(device_category);
        CREATE INDEX idx_parts_catalog_active ON parts_catalog(active) WHERE active = true;
        
        RAISE NOTICE 'Created parts_catalog table';
    ELSE
        RAISE NOTICE 'Reusing existing inventory_parts table from C29';
    END IF;
END $$;

-- Create alias view if inventory_parts exists (for consistent naming)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'inventory_parts') AND
       NOT EXISTS (SELECT 1 FROM information_schema.views 
                   WHERE table_schema = 'public' AND table_name = 'parts_catalog') THEN
        -- Create view alias
        CREATE VIEW public.parts_catalog AS SELECT * FROM public.inventory_parts;
        RAISE NOTICE 'Created parts_catalog view as alias for inventory_parts';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Inventory Stock Ledger (Immutable with Event Hash)
-- ============================================================================

CREATE TABLE public.inventory_stock_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id uuid NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
    part_id uuid NOT NULL, -- References parts_catalog or inventory_parts
    movement_type text NOT NULL CHECK (movement_type IN ('receive', 'consume', 'transfer_in', 'transfer_out', 'adjust', 'return')),
    qty integer NOT NULL, -- Signed: positive for in, negative for out
    source_type text, -- 'dealer', 'internal', 'customer_return', 'other'
    source_id uuid, -- Reference to dealer, ticket, order, etc.
    occurred_at timestamptz NOT NULL,
    payload jsonb DEFAULT '{}', -- Additional context
    
    -- V1.1 Hardening: event_hash + idempotency_key (C18 pattern)
    event_hash text NOT NULL,
    idempotency_key text, -- Optional client-provided key
    
    created_at timestamptz DEFAULT now() NOT NULL,
    
    -- Qty sign validation (with explicit parentheses for correct logic)
    CONSTRAINT valid_qty CHECK (
        (movement_type IN ('receive', 'transfer_in', 'return') AND qty > 0) OR 
        (movement_type IN ('consume', 'transfer_out') AND qty < 0) OR
        (movement_type = 'adjust')
    )
);

CREATE INDEX idx_stock_ledger_location_part ON inventory_stock_ledger(location_id, part_id, occurred_at DESC);
CREATE INDEX idx_stock_ledger_part ON inventory_stock_ledger(part_id, occurred_at DESC);
CREATE INDEX idx_stock_ledger_source ON inventory_stock_ledger(source_type, source_id);
CREATE INDEX idx_stock_ledger_occurred ON inventory_stock_ledger(occurred_at DESC);

-- Deduplication indexes (C18 V1.1 pattern)
CREATE UNIQUE INDEX idx_stock_ledger_event_hash ON inventory_stock_ledger(event_hash);
CREATE UNIQUE INDEX idx_stock_ledger_idempotency ON inventory_stock_ledger(location_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

COMMENT ON TABLE public.inventory_stock_ledger IS 'Immutable ledger of all stock movements with event_hash/idempotency_key deduplication';
COMMENT ON COLUMN public.inventory_stock_ledger.event_hash IS 'SHA256 hash of movement attributes for deduplication';
COMMENT ON COLUMN public.inventory_stock_ledger.idempotency_key IS 'Optional client-provided key for stable retry protection';

-- ============================================================================
-- STEP 4: Inventory Stock Current (Materialized State)
-- ============================================================================

CREATE TABLE public.inventory_stock_current (
    location_id uuid NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
    part_id uuid NOT NULL, -- References parts_catalog or inventory_parts
    on_hand integer NOT NULL DEFAULT 0 CHECK (on_hand >= 0), -- Prevent negative stock
    reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0), -- Allocated to pending tickets
    available integer GENERATED ALWAYS AS (on_hand - reserved) STORED,
    last_movement_at timestamptz,
    updated_at timestamptz DEFAULT now() NOT NULL,
    
    PRIMARY KEY (location_id, part_id)
);

CREATE INDEX idx_stock_current_part ON inventory_stock_current(part_id);
CREATE INDEX idx_stock_current_location ON inventory_stock_current(location_id);
CREATE INDEX idx_stock_current_low_stock ON inventory_stock_current(available) WHERE available < 10;

COMMENT ON TABLE public.inventory_stock_current IS 'Materialized current stock state per location+part (derived from ledger)';
COMMENT ON COLUMN public.inventory_stock_current.available IS 'Computed: on_hand - reserved';

-- ============================================================================
-- STEP 5: Enum-Safe RBAC Permission Helper
-- ============================================================================

CREATE OR REPLACE FUNCTION public._c19_allow_admin_or_service()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    -- Allow service_role OR profiles with role 'admin' or 'manager'
    -- Critical: Cast enum to text to avoid invalid enum literal errors (C18 V1.1 pattern)
    SELECT 
        auth.role() = 'service_role' 
        OR 
        EXISTS (
            SELECT 1 
            FROM public.profiles 
            WHERE user_id = auth.uid() 
            AND role::text IN ('admin', 'manager')
        );
$$;

COMMENT ON FUNCTION public._c19_allow_admin_or_service() IS 
'Permission helper for C19 inventory. Returns true if caller is service_role or admin/manager user. Uses role::text casting for enum safety.';

GRANT EXECUTE ON FUNCTION public._c19_allow_admin_or_service() TO authenticated;

-- ============================================================================
-- STEP 6: RPC - Ingest Stock Movement (Hardened)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_inventory_ingest_movement(
    p_location_id uuid,
    p_part_id uuid,
    p_movement_type text,
    p_qty integer,
    p_source_type text DEFAULT NULL,
    p_source_id uuid DEFAULT NULL,
    p_occurred_at timestamptz DEFAULT now(),
    p_payload jsonb DEFAULT '{}',
    p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_movement_id uuid;
    v_event_hash text;
    v_current_stock integer;
    v_new_stock integer;
BEGIN
    -- Mandatory Patch 1: Permission gate
    IF NOT public._c19_allow_admin_or_service() THEN
        RAISE EXCEPTION 'Unauthorized: inventory movements require admin, manager, or service_role privileges';
    END IF;
    
    -- Mandatory Patch 2: Compute event_hash (delimiter-safe, null-safe, C18 V1.1 pattern)
    v_event_hash := encode(
        digest(
            COALESCE(p_location_id::text, 'NULL') || '|' ||
            COALESCE(p_part_id::text, 'NULL') || '|' ||
            COALESCE(p_movement_type, 'NULL') || '|' ||
            COALESCE(p_qty::text, 'NULL') || '|' ||
            COALESCE(p_occurred_at::text, 'NULL') || '|' ||
            COALESCE(p_source_type, 'NULL') || '|' ||
            COALESCE(p_source_id::text, 'NULL') || '|' ||
            COALESCE(p_payload::text, '{}'),
            'sha256'
        ),
        'hex'
    );
    
    -- Mandatory Patch 3: Insert with ON CONFLICT DO NOTHING (ledger immutable)
    INSERT INTO public.inventory_stock_ledger (
        location_id, part_id, movement_type, qty,
        source_type, source_id, occurred_at, payload,
        event_hash, idempotency_key
    )
    VALUES (
        p_location_id, p_part_id, p_movement_type, p_qty,
        p_source_type, p_source_id, p_occurred_at, p_payload,
        v_event_hash, p_idempotency_key
    )
    ON CONFLICT (event_hash) DO NOTHING
    RETURNING id INTO v_movement_id;
    
    -- If conflict occurred, return existing movement id
    IF v_movement_id IS NULL THEN
        SELECT id INTO v_movement_id 
        FROM public.inventory_stock_ledger
        WHERE event_hash = v_event_hash;
        
        -- Early return: ledger immutable, no stock update needed
        RETURN v_movement_id;
    END IF;
    
    -- Mandatory Patch 4: Update current stock with negative prevention
    -- Get current on_hand
    SELECT on_hand INTO v_current_stock
    FROM public.inventory_stock_current
    WHERE location_id = p_location_id AND part_id = p_part_id;
    
    -- Calculate new stock
    v_new_stock := COALESCE(v_current_stock, 0) + p_qty;
    
    -- Prevent negative stock (unless it's an 'adjust' movement which can correct errors)
    IF v_new_stock < 0 AND p_movement_type != 'adjust' THEN
        RAISE EXCEPTION 'Stock movement would result in negative inventory: current=%, movement=%, result=%', 
            v_current_stock, p_qty, v_new_stock;
    END IF;
    
    -- Upsert inventory_stock_current
    INSERT INTO public.inventory_stock_current (location_id, part_id, on_hand, last_movement_at, updated_at)
    VALUES (p_location_id, p_part_id, v_new_stock, p_occurred_at, now())
    ON CONFLICT (location_id, part_id)
    DO UPDATE SET
        on_hand = EXCLUDED.on_hand,
        last_movement_at = GREATEST(inventory_stock_current.last_movement_at, EXCLUDED.last_movement_at),
        updated_at = now();
    
    RETURN v_movement_id;
END;
$$;

COMMENT ON FUNCTION public.rpc_inventory_ingest_movement IS 
'V1.1 Hardened: Ingest stock movements with hash-based deduplication. Ledger immutable (ON CONFLICT DO NOTHING). Prevents negative stock. Requires admin/manager/service role.';

GRANT EXECUTE ON FUNCTION public.rpc_inventory_ingest_movement TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_inventory_ingest_movement TO service_role;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_current ENABLE ROW LEVEL SECURITY;

-- Admin/Manager read access
CREATE POLICY "Admin and manager can view locations"
ON public.inventory_locations FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role::text IN ('admin', 'manager'))
);

CREATE POLICY "Admin and manager can view stock ledger"
ON public.inventory_stock_ledger FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role::text IN ('admin', 'manager'))
);

CREATE POLICY "Admin and manager can view current stock"
ON public.inventory_stock_current FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role::text IN ('admin', 'manager'))
);

-- Service role full access (for scheduled jobs)
CREATE POLICY "Service role full access to locations"
ON public.inventory_locations FOR ALL
TO service_role
USING (true);

CREATE POLICY "Service role full access to ledger"
ON public.inventory_stock_ledger FOR ALL
TO service_role
USING (true);

CREATE POLICY "Service role full access to current stock"
ON public.inventory_stock_current FOR ALL
TO service_role
USING (true);

-- ============================================================================
-- SEED DATA (Optional - for testing)
-- ============================================================================

-- Seed a test location
INSERT INTO public.inventory_locations (name, city, type)
VALUES 
    ('Mumbai Central Hub', 'Mumbai', 'hub'),
    ('Delhi Service Center', 'Delhi', 'service_center')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'C19 Phase 1 migration completed successfully';
    RAISE NOTICE 'Created: inventory_locations, inventory_stock_ledger, inventory_stock_current';
    RAISE NOTICE 'Created: _c19_allow_admin_or_service(), rpc_inventory_ingest_movement()';
    RAISE NOTICE 'RLS enabled on all tables';
    RAISE NOTICE 'Idempotency: event_hash + optional idempotency_key';
    RAISE NOTICE 'Negative stock prevention active';
END $$;
