-- ============================================================================
-- C21 Dynamic Pricing Engine: Foundation Migration
-- JamesTronic Platform
-- ============================================================================
-- Purpose: Transparent & fair pricing system for jobs, parts, labour,
-- transportation with surge control and SLA penalty calculations.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.pricing_category AS ENUM (
    'tv_repair',
    'ac_repair',
    'refrigerator_repair',
    'washing_machine_repair',
    'laptop_repair',
    'mobile_repair',
    'diagnostics',
    'transportation',
    'installation',
    'warranty',
    'other'
);

CREATE TYPE public.modifier_type AS ENUM (
    'urgency',
    'complexity',
    'geographic',
    'seasonal',
    'surge',
    'discount',
    'loyalty'
);

CREATE TYPE public.quote_status AS ENUM (
    'draft',
    'pending_approval',
    'approved',
    'sent_to_customer',
    'accepted',
    'rejected',
    'expired'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Pricing Rules: Base pricing by category
CREATE TABLE IF NOT EXISTS public.pricing_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category public.pricing_category NOT NULL,
    name text NOT NULL,
    description text,
    
    -- Base Prices
    base_diagnostic_fee numeric(10, 2) DEFAULT 199.00,
    base_labour_per_hour numeric(10, 2) DEFAULT 350.00,
    base_transport_fee numeric(10, 2) DEFAULT 149.00,
    min_charge numeric(10, 2) DEFAULT 299.00,
    
    -- Part Markup
    part_markup_percentage numeric(4, 2) DEFAULT 15.00, -- 15% markup on parts
    
    -- Validity
    is_active boolean DEFAULT true,
    valid_from date DEFAULT CURRENT_DATE,
    valid_until date,
    
    -- Metadata
    created_by uuid REFERENCES public.profiles(user_id),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    
    CONSTRAINT unique_active_pricing_category UNIQUE (category, is_active)
);

-- Pricing Modifiers: Dynamic factors
CREATE TABLE IF NOT EXISTS public.pricing_modifiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    modifier_type public.modifier_type NOT NULL,
    name text NOT NULL,
    description text,
    
    -- Multiplier (1.0 = no change, 1.5 = 50% increase)
    multiplier numeric(4, 2) DEFAULT 1.00,
    
    -- Conditions (when to apply)
    applies_to_categories public.pricing_category[],
    applies_to_cities text[],
    min_ticket_value numeric(10, 2),
    max_ticket_value numeric(10, 2),
    
    -- Validity
    is_active boolean DEFAULT true,
    priority integer DEFAULT 1, -- Higher = applied first
    
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Surge Pricing Events: Time-limited surge windows
CREATE TABLE IF NOT EXISTS public.surge_pricing_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    city text,
    
    -- Surge Details
    surge_multiplier numeric(4, 2) NOT NULL DEFAULT 1.25, -- 25% increase
    reason text, -- "High Demand", "Festival Season", etc.
    
    -- Time Window
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    
    -- Controls
    max_multiplier numeric(4, 2) DEFAULT 2.00, -- Cap at 2x
    is_active boolean DEFAULT true,
    
    -- Approval
    approved_by uuid REFERENCES public.profiles(user_id),
    approved_at timestamptz,
    
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Price Quotes: Generated price breakdowns for tickets
CREATE TABLE IF NOT EXISTS public.price_quotes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
    
    -- Quote Status
    status public.quote_status DEFAULT 'draft',
    
    -- Base Amounts
    diagnostic_fee numeric(10, 2) DEFAULT 0,
    labour_cost numeric(10, 2) DEFAULT 0,
    labour_hours numeric(4, 2) DEFAULT 0,
    parts_cost numeric(10, 2) DEFAULT 0,
    parts_markup numeric(10, 2) DEFAULT 0,
    transport_fee numeric(10, 2) DEFAULT 0,
    
    -- Calculated Subtotal
    subtotal numeric(12, 2) DEFAULT 0,
    
    -- Modifiers Applied
    modifiers_applied jsonb DEFAULT '[]', -- Array of {name, type, multiplier, amount}
    modifiers_total numeric(10, 2) DEFAULT 0,
    
    -- Discounts
    discount_code text,
    discount_amount numeric(10, 2) DEFAULT 0,
    
    -- Taxes
    gst_percentage numeric(4, 2) DEFAULT 18.00,
    gst_amount numeric(10, 2) DEFAULT 0,
    
    -- Final Amount
    grand_total numeric(12, 2) DEFAULT 0,
    
    -- Customer Facing
    customer_breakdown jsonb, -- Formatted for customer display
    
    -- Validity
    valid_until timestamptz,
    
    -- Approval
    approved_by uuid REFERENCES public.profiles(user_id),
    approved_at timestamptz,
    
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- SLA Penalty Records: Breach compensation
CREATE TABLE IF NOT EXISTS public.sla_penalty_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    
    -- Breach Details
    breach_type text NOT NULL, -- 'response_time', 'resolution_time', 'quality'
    breached_at timestamptz NOT NULL DEFAULT now(),
    expected_value text, -- "24 hours"
    actual_value text, -- "36 hours"
    
    -- Penalty Calculation
    penalty_percentage numeric(5, 2) DEFAULT 10.00, -- 10% of ticket value
    base_amount numeric(10, 2) NOT NULL,
    penalty_amount numeric(10, 2) NOT NULL,
    
    -- Compensation
    compensation_type text DEFAULT 'discount', -- 'discount', 'refund', 'credit'
    is_applied boolean DEFAULT false,
    applied_at timestamptz,
    applied_by uuid REFERENCES public.profiles(user_id),
    
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_pricing_rules_category ON public.pricing_rules(category);
CREATE INDEX idx_pricing_rules_active ON public.pricing_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_modifiers_type ON public.pricing_modifiers(modifier_type);
CREATE INDEX idx_modifiers_active ON public.pricing_modifiers(is_active) WHERE is_active = true;
CREATE INDEX idx_surge_active ON public.surge_pricing_events(is_active) WHERE is_active = true;
CREATE INDEX idx_surge_window ON public.surge_pricing_events(starts_at, ends_at);
CREATE INDEX idx_quotes_ticket ON public.price_quotes(ticket_id);
CREATE INDEX idx_quotes_status ON public.price_quotes(status);
CREATE INDEX idx_sla_penalties_ticket ON public.sla_penalty_records(ticket_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER set_pricing_rules_updated_at
BEFORE UPDATE ON public.pricing_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER set_pricing_modifiers_updated_at
BEFORE UPDATE ON public.pricing_modifiers
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER set_price_quotes_updated_at
BEFORE UPDATE ON public.price_quotes
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surge_pricing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_penalty_records ENABLE ROW LEVEL SECURITY;

-- Admin/Manager can manage pricing
CREATE POLICY "Admin can manage pricing_rules"
ON public.pricing_rules FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

CREATE POLICY "Admin can manage pricing_modifiers"
ON public.pricing_modifiers FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

CREATE POLICY "Admin can manage surge_pricing"
ON public.surge_pricing_events FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

CREATE POLICY "Admin can manage price_quotes"
ON public.price_quotes FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner', 'staff'));

CREATE POLICY "Admin can manage sla_penalties"
ON public.sla_penalty_records FOR ALL
TO authenticated
USING (public.get_user_role_for_rls() IN ('admin', 'manager', 'owner'));

-- Staff can view pricing rules
CREATE POLICY "Staff can view pricing_rules"
ON public.pricing_rules FOR SELECT
TO authenticated
USING (public.get_user_role_for_rls() = 'staff');

-- ============================================================================
-- FUNCTIONS / RPCs
-- ============================================================================

-- RPC: Calculate Service Price
CREATE OR REPLACE FUNCTION public.rpc_calculate_service_price(
    p_category text,
    p_labour_hours numeric DEFAULT 1.0,
    p_parts_cost numeric DEFAULT 0,
    p_city text DEFAULT NULL,
    p_urgency text DEFAULT 'normal'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rule record;
    v_diagnostic numeric := 199;
    v_labour numeric := 0;
    v_parts_with_markup numeric := 0;
    v_transport numeric := 149;
    v_subtotal numeric := 0;
    v_modifiers_total numeric := 0;
    v_modifiers_applied jsonb := '[]'::jsonb;
    v_surge_multiplier numeric := 1.0;
    v_urgency_multiplier numeric := 1.0;
    v_gst_amount numeric := 0;
    v_grand_total numeric := 0;
    v_result jsonb;
BEGIN
    -- Get base pricing rule
    SELECT * INTO v_rule
    FROM public.pricing_rules
    WHERE category = p_category::public.pricing_category
      AND is_active = true
    LIMIT 1;
    
    IF v_rule IS NOT NULL THEN
        v_diagnostic := v_rule.base_diagnostic_fee;
        v_labour := v_rule.base_labour_per_hour * p_labour_hours;
        v_parts_with_markup := p_parts_cost * (1 + v_rule.part_markup_percentage / 100);
        v_transport := v_rule.base_transport_fee;
    ELSE
        v_labour := 350 * p_labour_hours;
        v_parts_with_markup := p_parts_cost * 1.15;
    END IF;
    
    v_subtotal := v_diagnostic + v_labour + v_parts_with_markup + v_transport;
    
    -- Check for active surge pricing
    SELECT surge_multiplier INTO v_surge_multiplier
    FROM public.surge_pricing_events
    WHERE is_active = true
      AND (city = p_city OR city IS NULL)
      AND now() BETWEEN starts_at AND ends_at
    ORDER BY surge_multiplier DESC
    LIMIT 1;
    
    IF v_surge_multiplier > 1.0 THEN
        v_modifiers_total := v_modifiers_total + (v_subtotal * (v_surge_multiplier - 1));
        v_modifiers_applied := v_modifiers_applied || jsonb_build_object(
            'name', 'Surge Pricing',
            'type', 'surge',
            'multiplier', v_surge_multiplier,
            'amount', v_subtotal * (v_surge_multiplier - 1)
        );
    END IF;
    
    -- Urgency multiplier
    v_urgency_multiplier := CASE p_urgency
        WHEN 'critical' THEN 1.50
        WHEN 'high' THEN 1.25
        WHEN 'low' THEN 0.95
        ELSE 1.0
    END;
    
    IF v_urgency_multiplier != 1.0 THEN
        v_modifiers_total := v_modifiers_total + (v_subtotal * (v_urgency_multiplier - 1));
        v_modifiers_applied := v_modifiers_applied || jsonb_build_object(
            'name', 'Urgency: ' || p_urgency,
            'type', 'urgency',
            'multiplier', v_urgency_multiplier,
            'amount', v_subtotal * (v_urgency_multiplier - 1)
        );
    END IF;
    
    -- Calculate GST (18%)
    v_gst_amount := (v_subtotal + v_modifiers_total) * 0.18;
    
    -- Grand Total
    v_grand_total := v_subtotal + v_modifiers_total + v_gst_amount;
    
    v_result := jsonb_build_object(
        'category', p_category,
        'diagnostic_fee', v_diagnostic,
        'labour_cost', v_labour,
        'labour_hours', p_labour_hours,
        'parts_cost', p_parts_cost,
        'parts_with_markup', v_parts_with_markup,
        'transport_fee', v_transport,
        'subtotal', v_subtotal,
        'modifiers_applied', v_modifiers_applied,
        'modifiers_total', v_modifiers_total,
        'gst_percentage', 18,
        'gst_amount', v_gst_amount,
        'grand_total', v_grand_total
    );
    
    RETURN v_result;
END;
$$;

-- RPC: Apply Surge Pricing
CREATE OR REPLACE FUNCTION public.rpc_apply_surge_pricing(
    p_city text,
    p_multiplier numeric,
    p_reason text,
    p_hours integer DEFAULT 4
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_id uuid;
BEGIN
    INSERT INTO public.surge_pricing_events (
        name, city, surge_multiplier, reason,
        starts_at, ends_at, is_active
    )
    VALUES (
        'Surge: ' || COALESCE(p_city, 'All Cities'),
        p_city,
        LEAST(p_multiplier, 2.0), -- Cap at 2x
        p_reason,
        now(),
        now() + (p_hours * interval '1 hour'),
        true
    )
    RETURNING id INTO v_event_id;
    
    RETURN v_event_id;
END;
$$;

-- RPC: Calculate SLA Penalty
CREATE OR REPLACE FUNCTION public.rpc_calculate_sla_penalty(
    p_ticket_id uuid,
    p_breach_type text,
    p_expected_value text,
    p_actual_value text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_quote record;
    v_base_amount numeric := 0;
    v_penalty_percentage numeric := 10.0;
    v_penalty_amount numeric := 0;
    v_penalty_id uuid;
    v_result jsonb;
BEGIN
    -- Get the quote for this ticket
    SELECT grand_total INTO v_base_amount
    FROM public.price_quotes
    WHERE ticket_id = p_ticket_id
      AND status = 'accepted'
    LIMIT 1;
    
    IF v_base_amount IS NULL OR v_base_amount = 0 THEN
        v_base_amount := 500; -- Default base for penalty calculation
    END IF;
    
    -- Calculate penalty (10% default, can vary by breach type)
    v_penalty_percentage := CASE p_breach_type
        WHEN 'resolution_time' THEN 15.0
        WHEN 'quality' THEN 20.0
        ELSE 10.0
    END;
    
    v_penalty_amount := v_base_amount * (v_penalty_percentage / 100);
    
    -- Record the penalty
    INSERT INTO public.sla_penalty_records (
        ticket_id, breach_type, expected_value, actual_value,
        penalty_percentage, base_amount, penalty_amount
    )
    VALUES (
        p_ticket_id, p_breach_type, p_expected_value, p_actual_value,
        v_penalty_percentage, v_base_amount, v_penalty_amount
    )
    RETURNING id INTO v_penalty_id;
    
    v_result := jsonb_build_object(
        'penalty_id', v_penalty_id,
        'ticket_id', p_ticket_id,
        'breach_type', p_breach_type,
        'base_amount', v_base_amount,
        'penalty_percentage', v_penalty_percentage,
        'penalty_amount', v_penalty_amount,
        'compensation_type', 'discount'
    );
    
    RETURN v_result;
END;
$$;

-- ============================================================================
-- SEED DATA: Default Pricing Rules
-- ============================================================================

INSERT INTO public.pricing_rules (category, name, description, base_diagnostic_fee, base_labour_per_hour, base_transport_fee)
VALUES
    ('tv_repair', 'TV Repair Standard', 'Standard pricing for TV repairs', 299, 400, 149),
    ('ac_repair', 'AC Repair Standard', 'Standard pricing for AC repairs', 349, 450, 199),
    ('refrigerator_repair', 'Refrigerator Repair Standard', 'Standard pricing for refrigerator repairs', 299, 400, 199),
    ('washing_machine_repair', 'Washing Machine Standard', 'Standard pricing for washing machine repairs', 299, 400, 149),
    ('laptop_repair', 'Laptop Repair Standard', 'Standard pricing for laptop repairs', 399, 500, 99),
    ('mobile_repair', 'Mobile Repair Standard', 'Standard pricing for mobile repairs', 199, 350, 0)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_modifiers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surge_pricing_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_penalty_records TO authenticated;

GRANT ALL ON public.pricing_rules TO service_role;
GRANT ALL ON public.pricing_modifiers TO service_role;
GRANT ALL ON public.surge_pricing_events TO service_role;
GRANT ALL ON public.price_quotes TO service_role;
GRANT ALL ON public.sla_penalty_records TO service_role;

GRANT EXECUTE ON FUNCTION public.rpc_calculate_service_price TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_apply_surge_pricing TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_calculate_sla_penalty TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_calculate_service_price TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_apply_surge_pricing TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_calculate_sla_penalty TO service_role;
