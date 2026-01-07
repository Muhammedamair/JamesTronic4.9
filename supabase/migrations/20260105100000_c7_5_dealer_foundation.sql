-- ============================================================================
-- C7.5 Dealer Engine: Foundation Migration
-- JamesTronic Platform
-- ============================================================================
-- Purpose: Establishes the core Dealer Engine for parts supply orchestration.
-- Creates tables for dealers, zones, part requests, quotes, and orders.
-- ============================================================================

-- ============================================================================
-- UTILITY FUNCTION (if not exists)
-- ============================================================================

-- This function is used by triggers to auto-update the updated_at column
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.part_request_status AS ENUM (
    'pending_approval',
    'open_for_quotes',
    'quote_received',
    'ordered',
    'in_transit',
    'delivered',
    'fulfilled',
    'cancelled'
);

CREATE TYPE public.stock_status AS ENUM (
    'in_stock',
    'can_procure',
    'out_of_stock'
);

CREATE TYPE public.dealer_status AS ENUM (
    'active',
    'inactive',
    'pending_kyc',
    'suspended'
);

CREATE TYPE public.order_status AS ENUM (
    'pending',
    'confirmed',
    'shipped',
    'delivered',
    'cancelled',
    'returned'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Dealers: Core profile for parts vendors
CREATE TABLE IF NOT EXISTS public.dealers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    contact_name text,
    phone text,
    email text,
    gst_number text,
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    pincode text,
    status public.dealer_status DEFAULT 'pending_kyc',
    kyc_verified_at timestamptz,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Dealer Zones: Which areas each dealer serves
CREATE TABLE IF NOT EXISTS public.dealer_zones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
    city text NOT NULL,
    pincodes text[], -- Array of pincodes served
    is_primary boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT unique_dealer_city UNIQUE (dealer_id, city)
);

-- Dealer Categories: Which appliance categories each dealer supports
CREATE TABLE IF NOT EXISTS public.dealer_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
    category text NOT NULL, -- TV, AC, Fridge, Laptop, etc.
    sub_categories text[], -- Backlight, Compressor, etc.
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT unique_dealer_category UNIQUE (dealer_id, category)
);

-- Part Requests: Demand raised by technicians
CREATE TABLE IF NOT EXISTS public.part_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
    requested_by uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    appliance_category text NOT NULL,
    brand text,
    model text,
    part_description text NOT NULL,
    specifications jsonb DEFAULT '{}', -- Structured specs (strips, LEDs, wattage, etc.)
    quantity integer DEFAULT 1,
    urgency text DEFAULT 'normal', -- low, normal, high, critical
    status public.part_request_status DEFAULT 'pending_approval',
    approved_by uuid REFERENCES public.profiles(user_id),
    approved_at timestamptz,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Dealer Quotes: Bids from dealers on part requests
CREATE TABLE IF NOT EXISTS public.dealer_quotes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    part_request_id uuid NOT NULL REFERENCES public.part_requests(id) ON DELETE CASCADE,
    dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
    price_per_unit numeric(10, 2) NOT NULL,
    gst_percentage numeric(4, 2) DEFAULT 18.00,
    total_price numeric(12, 2) GENERATED ALWAYS AS (
        price_per_unit * (1 + gst_percentage / 100)
    ) STORED,
    stock_status public.stock_status NOT NULL,
    lead_time_hours integer, -- Expected time to deliver
    warranty_months integer DEFAULT 0,
    conditions text,
    is_selected boolean DEFAULT false,
    quoted_at timestamptz DEFAULT now() NOT NULL,
    expires_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Part Orders: Finalized orders from selected quotes
CREATE TABLE IF NOT EXISTS public.part_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id uuid NOT NULL REFERENCES public.dealer_quotes(id) ON DELETE RESTRICT,
    part_request_id uuid NOT NULL REFERENCES public.part_requests(id) ON DELETE RESTRICT,
    dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
    order_status public.order_status DEFAULT 'pending',
    ordered_by uuid NOT NULL REFERENCES public.profiles(user_id),
    ordered_at timestamptz DEFAULT now() NOT NULL,
    expected_delivery_at timestamptz,
    actual_delivery_at timestamptz,
    tracking_id text,
    delivery_notes text,
    received_by uuid REFERENCES public.profiles(user_id),
    received_condition text, -- OK, Damaged, Wrong Part
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_dealers_status ON public.dealers(status);
CREATE INDEX idx_dealers_city ON public.dealers(city);
CREATE INDEX idx_dealer_zones_city ON public.dealer_zones(city);
CREATE INDEX idx_dealer_categories_category ON public.dealer_categories(category);
CREATE INDEX idx_part_requests_status ON public.part_requests(status);
CREATE INDEX idx_part_requests_ticket ON public.part_requests(ticket_id);
CREATE INDEX idx_dealer_quotes_request ON public.dealer_quotes(part_request_id);
CREATE INDEX idx_dealer_quotes_dealer ON public.dealer_quotes(dealer_id);
CREATE INDEX idx_part_orders_status ON public.part_orders(order_status);
CREATE INDEX idx_part_orders_dealer ON public.part_orders(dealer_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at trigger for dealers
CREATE TRIGGER set_dealers_updated_at
BEFORE UPDATE ON public.dealers
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

-- Updated_at trigger for part_requests
CREATE TRIGGER set_part_requests_updated_at
BEFORE UPDATE ON public.part_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

-- Updated_at trigger for part_orders
CREATE TRIGGER set_part_orders_updated_at
BEFORE UPDATE ON public.part_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.part_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.part_orders ENABLE ROW LEVEL SECURITY;

-- Dealers: Admin/Staff can manage
CREATE POLICY "Admin and staff can manage dealers"
ON public.dealers FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'staff', 'manager'));

-- Dealer Zones: Admin/Staff can manage
CREATE POLICY "Admin and staff can manage dealer_zones"
ON public.dealer_zones FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'staff', 'manager'));

-- Dealer Categories: Admin/Staff can manage
CREATE POLICY "Admin and staff can manage dealer_categories"
ON public.dealer_categories FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'staff', 'manager'));

-- Part Requests: Admins can manage all, Technicians can create and view own
CREATE POLICY "Admin can manage all part_requests"
ON public.part_requests FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'staff', 'manager'));

CREATE POLICY "Technicians can create part_requests"
ON public.part_requests FOR INSERT
TO authenticated
WITH CHECK (
    public.get_user_role_for_rls() = 'technician' 
    AND requested_by = auth.uid()
);

CREATE POLICY "Technicians can view own part_requests"
ON public.part_requests FOR SELECT
TO authenticated
USING (
    public.get_user_role_for_rls() = 'technician' 
    AND requested_by = auth.uid()
);

-- Dealer Quotes: Admin/Staff can manage all
CREATE POLICY "Admin can manage all dealer_quotes"
ON public.dealer_quotes FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'staff', 'manager'));

-- Part Orders: Admin/Staff can manage all
CREATE POLICY "Admin can manage all part_orders"
ON public.part_orders FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'staff', 'manager'));

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealer_zones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealer_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.part_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealer_quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.part_orders TO authenticated;

-- Service role has full access
GRANT ALL ON public.dealers TO service_role;
GRANT ALL ON public.dealer_zones TO service_role;
GRANT ALL ON public.dealer_categories TO service_role;
GRANT ALL ON public.part_requests TO service_role;
GRANT ALL ON public.dealer_quotes TO service_role;
GRANT ALL ON public.part_orders TO service_role;
