-- ============================================================================
-- C25 Transporter Logistics Engine: Foundation Migration
-- JamesTronic Platform
-- ============================================================================
-- Purpose: Hybrid fleet management (Internal + External) with vehicle matching,
-- route optimization, and tracking.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.transporter_provider_type AS ENUM (
    'internal',
    'external_rapido',
    'external_porter',
    'external_dunzo',
    'external_manual'
);

CREATE TYPE public.vehicle_type AS ENUM (
    'motorbike',
    'scooter',
    'three_wheeler',
    'small_van', -- Tata Ace
    'large_van', -- Bolero Pickup
    'truck'
);

CREATE TYPE public.delivery_status AS ENUM (
    'pending_assignment',
    'assigned',
    'pickup_in_progress',
    'picked_up',
    'in_transit',
    'delivery_attempted',
    'delivered',
    'cancelled',
    'returned'
);

CREATE TYPE public.assignment_strategy AS ENUM (
    'manual',
    'auto_internal_first',
    'auto_cheapest',
    'auto_fastest'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Transporter Fleets: Internal vehicles and drivers
CREATE TABLE IF NOT EXISTS public.transporter_fleets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Profile Link
    driver_id uuid REFERENCES public.profiles(user_id), -- Can be null if just a vehicle entry
    
    -- Vehicle Details
    vehicle_plate text UNIQUE,
    vehicle_type public.vehicle_type NOT NULL,
    vehicle_model text,
    capacity_kg integer,
    capacity_cft numeric(5, 2), -- Cubic feet
    
    -- Provider Info
    provider_type public.transporter_provider_type DEFAULT 'internal',
    external_provider_id text, -- ID in Rapido/Porter system
    
    -- Status
    is_active boolean DEFAULT true,
    current_location geography(Point, 4326),
    last_location_update timestamptz,
    current_status text DEFAULT 'idle', -- 'idle', 'busy', 'offline'
    
    -- Performance
    reliability_score integer DEFAULT 80,
    total_deliveries integer DEFAULT 0,
    
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Logistics Deliveries: The actual jobs
CREATE TABLE IF NOT EXISTS public.logistics_deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Linked Entities
    ticket_id uuid REFERENCES public.tickets(id),
    part_request_id uuid, -- If moving parts
    
    -- Locations
    pickup_address text NOT NULL,
    pickup_geo geography(Point, 4326),
    delivery_address text NOT NULL,
    delivery_geo geography(Point, 4326),
    
    -- Item Details
    items_description text,
    items_weight_kg numeric(6, 2),
    is_fragile boolean DEFAULT false,
    requires_installation boolean DEFAULT false,
    
    -- Assignment
    assigned_transporter_id uuid REFERENCES public.transporter_fleets(id),
    provider_type public.transporter_provider_type,
    
    -- Status
    status public.delivery_status DEFAULT 'pending_assignment',
    status_notes text,
    
    -- Costs
    estimated_cost numeric(10, 2),
    actual_cost numeric(10, 2),
    
    -- Timing
    scheduled_pickup timestamptz,
    actual_pickup timestamptz,
    actual_delivery timestamptz,
    
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Route Plans: Group of deliveries for efficient routing
CREATE TABLE IF NOT EXISTS public.route_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transporter_id uuid REFERENCES public.transporter_fleets(id),
    
    plan_date date NOT NULL DEFAULT CURRENT_DATE,
    
    -- Sequence of delivery IDs
    delivery_sequence uuid[],
    
    total_distance_km numeric(6, 2),
    total_duration_minutes integer,
    
    status text DEFAULT 'planned', -- 'planned', 'in_progress', 'completed'
    
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Vehicle Tracking Logs: Historical GPS data
CREATE TABLE IF NOT EXISTS public.vehicle_tracking_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transporter_id uuid NOT NULL REFERENCES public.transporter_fleets(id),
    
    location geography(Point, 4326) NOT NULL,
    speed_kmh numeric(5, 2),
    battery_level integer,
    
    recorded_at timestamptz DEFAULT now() NOT NULL
);

-- External Provider Logs: API interactions with Rapido/Porter
CREATE TABLE IF NOT EXISTS public.external_provider_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id uuid REFERENCES public.logistics_deliveries(id),
    
    provider public.transporter_provider_type NOT NULL,
    
    request_payload jsonb,
    response_payload jsonb,
    
    external_order_id text,
    status_code text,
    
    created_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_transporter_provider ON public.transporter_fleets(provider_type);
CREATE INDEX idx_transporter_status ON public.transporter_fleets(current_status);
CREATE INDEX idx_deliveries_status ON public.logistics_deliveries(status);
CREATE INDEX idx_deliveries_transporter ON public.logistics_deliveries(assigned_transporter_id);
CREATE INDEX idx_tracking_transporter_time ON public.vehicle_tracking_logs(transporter_id, recorded_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER set_transporter_updated_at
BEFORE UPDATE ON public.transporter_fleets
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER set_deliveries_updated_at
BEFORE UPDATE ON public.logistics_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.transporter_fleets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_tracking_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_provider_logs ENABLE ROW LEVEL SECURITY;

-- Admins manage all
CREATE POLICY "Admin manage fleets"
ON public.transporter_fleets FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

CREATE POLICY "Admin manage deliveries"
ON public.logistics_deliveries FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

CREATE POLICY "Admin manage routes"
ON public.route_plans FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

CREATE POLICY "Admin view tracking"
ON public.vehicle_tracking_logs FOR SELECT
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

-- Drivers see their own
CREATE POLICY "Driver view own profile"
ON public.transporter_fleets FOR SELECT
TO authenticated
USING (driver_id = auth.uid());

CREATE POLICY "Driver view own deliveries"
ON public.logistics_deliveries FOR SELECT
TO authenticated
USING (assigned_transporter_id IN (SELECT id FROM public.transporter_fleets WHERE driver_id = auth.uid()));

-- ============================================================================
-- FUNCTIONS / RPCs
-- ============================================================================

-- RPC: Assign Transporter (Auto-Assign Mockup)
CREATE OR REPLACE FUNCTION public.rpc_assign_transporter(
    p_delivery_id uuid,
    p_strategy text DEFAULT 'auto_internal_first'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_transporter_id uuid;
    v_provider_type text;
    v_result jsonb;
BEGIN
    -- 1. Try to find an available internal transporter
    SELECT id, provider_type 
    INTO v_transporter_id, v_provider_type
    FROM public.transporter_fleets
    WHERE provider_type = 'internal'
      AND current_status = 'idle'
      AND is_active = true
    LIMIT 1;

    -- 2. If no internal, simulate external assignment (if strategy allows)
    IF v_transporter_id IS NULL AND p_strategy != 'manual' THEN
        -- In reality, this would likely create a pending external request
        -- For now, we simulate forcing assignment to a dummy external provider entry if exists
        -- Or just return null indicating manual intervention needed
        v_provider_type := 'external_rapido';
    END IF;

    IF v_transporter_id IS NOT NULL THEN
        UPDATE public.logistics_deliveries
        SET 
            assigned_transporter_id = v_transporter_id,
            provider_type = v_provider_type::public.transporter_provider_type,
            status = 'assigned',
            updated_at = now()
        WHERE id = p_delivery_id;
        
        UPDATE public.transporter_fleets
        SET current_status = 'busy'
        WHERE id = v_transporter_id;
        
        v_result := jsonb_build_object(
            'success', true,
            'transporter_id', v_transporter_id,
            'provider', v_provider_type
        );
    ELSE
        -- Fallback: If no internal available and we need to trigger external,
        -- we might mark it status 'pending_external' or similar. 
        -- Here we just say assignment failed.
        v_result := jsonb_build_object(
            'success', false,
            'message', 'No internal transporters available'
        );
    END IF;

    RETURN v_result;
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transporter_fleets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.logistics_deliveries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_tracking_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_provider_logs TO authenticated;

GRANT ALL ON public.transporter_fleets TO service_role;
GRANT ALL ON public.logistics_deliveries TO service_role;
GRANT ALL ON public.route_plans TO service_role;
GRANT ALL ON public.vehicle_tracking_logs TO service_role;
GRANT ALL ON public.external_provider_logs TO service_role;

GRANT EXECUTE ON FUNCTION public.rpc_assign_transporter TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_assign_transporter TO service_role;
