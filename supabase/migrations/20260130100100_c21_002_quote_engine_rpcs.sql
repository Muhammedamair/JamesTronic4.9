-- ============================================================================
-- C21 Dynamic Pricing Engine v1 - Quote Engine RPCs
-- JamesTronic Platform
-- ============================================================================
-- Purpose:
-- 1. rpc_c21_quote_price: Compute deterministic quote with guardrails
-- 2. rpc_c21_accept_quote: Lock and bind quote to ticket
-- 3. Audit event emission for all actions
-- ============================================================================
-- Job ID: C21_DYNAMIC_PRICING_V1_P2_RPCS
-- Date: 2026-01-30
-- ============================================================================

-- ============================================================================
-- HELPER: Generate Quote Key for Idempotency
-- ============================================================================

CREATE OR REPLACE FUNCTION public._c21_generate_quote_key(
  p_city_id UUID,
  p_service_code TEXT,
  p_parts_cost DECIMAL,
  p_urgency TEXT,
  p_complexity TEXT,
  p_promo_code TEXT
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT md5(concat_ws(':',
    p_city_id::text,
    p_service_code,
    COALESCE(p_parts_cost::text, '0'),
    COALESCE(p_urgency, 'standard'),
    COALESCE(p_complexity, 'standard'),
    COALESCE(p_promo_code, ''),
    -- Include date to allow new quotes daily
    to_char(now(), 'YYYY-MM-DD')
  ));
$$;

-- ============================================================================
-- HELPER: Emit Pricing Audit Event
-- ============================================================================

CREATE OR REPLACE FUNCTION public._c21_emit_audit(
  p_event_type TEXT,
  p_quote_id UUID,
  p_city_id UUID,
  p_payload JSONB,
  p_explanation TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.pricing_audit_log (
    event_type,
    quote_id,
    city_id,
    actor_id,
    actor_role,
    payload,
    explanation
  ) VALUES (
    p_event_type,
    p_quote_id,
    p_city_id,
    auth.uid(),
    public._c20_app_role(),
    p_payload,
    p_explanation
  );
END;
$$;

-- ============================================================================
-- RPC: rpc_c21_quote_price
-- ============================================================================
-- Computes a deterministic, guardrailed price quote
-- Returns: quote_id + breakdown JSON

CREATE OR REPLACE FUNCTION public.rpc_c21_quote_price(
  p_city_id UUID,
  p_service_code TEXT,
  p_customer_id UUID DEFAULT NULL,
  p_parts_cost DECIMAL DEFAULT 0,
  p_urgency TEXT DEFAULT 'standard',    -- 'same_day', 'next_day', 'standard'
  p_complexity TEXT DEFAULT 'standard', -- 'simple', 'standard', 'complex'
  p_promo_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_quote_key TEXT;
  v_existing_quote RECORD;
  v_base_rate RECORD;
  v_guardrail RECORD;
  v_ruleset RECORD;
  v_lock_key BIGINT;
  v_lock_acquired BOOLEAN;
  
  -- Computed amounts
  v_labor DECIMAL(10,2);
  v_parts DECIMAL(10,2);
  v_transport DECIMAL(10,2);
  v_diagnostic DECIMAL(10,2);
  v_urgency_surcharge DECIMAL(10,2) := 0;
  v_complexity_surcharge DECIMAL(10,2) := 0;
  v_discount DECIMAL(10,2) := 0;
  v_subtotal DECIMAL(10,2);
  v_tax DECIMAL(10,2);
  v_total DECIMAL(10,2);
  
  v_reason_codes TEXT[] := ARRAY['BASE_RATE'];
  v_explanation TEXT;
  v_quote_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- 1. Generate idempotent quote key
  v_quote_key := public._c21_generate_quote_key(
    p_city_id, p_service_code, p_parts_cost, p_urgency, p_complexity, p_promo_code
  );
  
  -- 2. Check for existing quote (idempotency)
  SELECT * INTO v_existing_quote
  FROM public.pricing_quotes
  WHERE quote_key = v_quote_key
    AND status IN ('pending', 'accepted')
    AND expires_at > now();
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'quote_id', v_existing_quote.id,
      'cached', true,
      'breakdown', jsonb_build_object(
        'labor', v_existing_quote.labor_amount,
        'parts', v_existing_quote.parts_amount,
        'transport', v_existing_quote.transport_amount,
        'diagnostic', v_existing_quote.diagnostic_amount,
        'urgency_surcharge', v_existing_quote.urgency_surcharge,
        'complexity_surcharge', v_existing_quote.complexity_surcharge,
        'discount', v_existing_quote.discount_amount,
        'tax', v_existing_quote.tax_amount,
        'total', v_existing_quote.total_amount
      ),
      'reason_codes', v_existing_quote.reason_codes,
      'explanation', v_existing_quote.customer_explanation,
      'expires_at', v_existing_quote.expires_at
    );
  END IF;
  
  -- 3. Acquire advisory lock to prevent duplicate generation
  v_lock_key := abs(hashtext(v_quote_key)::bigint);
  v_lock_acquired := pg_try_advisory_xact_lock(v_lock_key);
  
  IF NOT v_lock_acquired THEN
    -- Wait briefly and retry check
    PERFORM pg_sleep(0.1);
    SELECT * INTO v_existing_quote
    FROM public.pricing_quotes
    WHERE quote_key = v_quote_key
      AND status IN ('pending', 'accepted')
      AND expires_at > now();
    
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'quote_id', v_existing_quote.id,
        'cached', true,
        'breakdown', jsonb_build_object('total', v_existing_quote.total_amount),
        'expires_at', v_existing_quote.expires_at
      );
    END IF;
  END IF;
  
  -- 4. Fetch active ruleset
  SELECT * INTO v_ruleset
  FROM public.pricing_rulesets
  WHERE is_active = true
  LIMIT 1;
  
  IF NOT FOUND THEN
    -- Default ruleset if none active
    v_ruleset.version := 'default-v1';
    v_ruleset.rules := '{}'::jsonb;
  END IF;
  
  -- 5. Fetch base rate
  SELECT * INTO v_base_rate
  FROM public.pricing_base_rates
  WHERE service_code = p_service_code
    AND city_id = p_city_id
    AND (effective_to IS NULL OR effective_to > now())
  ORDER BY effective_from DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    -- Fallback: try city-agnostic default (first city match)
    SELECT * INTO v_base_rate
    FROM public.pricing_base_rates
    WHERE service_code = p_service_code
      AND (effective_to IS NULL OR effective_to > now())
    ORDER BY effective_from DESC
    LIMIT 1;
  END IF;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NO_BASE_RATE',
      'message', 'No base rate found for service: ' || p_service_code
    );
  END IF;
  
  -- 6. Fetch guardrails
  SELECT * INTO v_guardrail
  FROM public.pricing_guardrails
  WHERE service_code = p_service_code
    AND city_id = p_city_id
    AND is_enabled = true;
  
  -- 7. Compute breakdown
  v_labor := v_base_rate.labor_base;
  v_parts := COALESCE(p_parts_cost, 0) * (1 + v_base_rate.parts_markup_pct / 100);
  v_transport := v_base_rate.transport_base;
  v_diagnostic := v_base_rate.diagnostic_fee;
  
  -- Urgency surcharge
  IF p_urgency = 'same_day' THEN
    v_urgency_surcharge := v_labor * 0.5;  -- 50% surcharge
    v_reason_codes := array_append(v_reason_codes, 'URGENCY_SAME_DAY');
  ELSIF p_urgency = 'next_day' THEN
    v_urgency_surcharge := v_labor * 0.25; -- 25% surcharge
    v_reason_codes := array_append(v_reason_codes, 'URGENCY_NEXT_DAY');
  ELSE
    v_reason_codes := array_append(v_reason_codes, 'URGENCY_STANDARD');
  END IF;
  
  -- Complexity surcharge
  IF p_complexity = 'complex' THEN
    v_complexity_surcharge := v_labor * 0.3;  -- 30% surcharge
    v_reason_codes := array_append(v_reason_codes, 'COMPLEXITY_COMPLEX');
  ELSIF p_complexity = 'simple' THEN
    v_complexity_surcharge := -v_labor * 0.1; -- 10% discount for simple
    v_reason_codes := array_append(v_reason_codes, 'COMPLEXITY_SIMPLE');
  ELSE
    v_reason_codes := array_append(v_reason_codes, 'COMPLEXITY_STANDARD');
  END IF;
  
  -- Calculate subtotal
  v_subtotal := v_labor + v_parts + v_transport + v_diagnostic + v_urgency_surcharge + v_complexity_surcharge;
  
  -- 8. Apply guardrails
  IF v_guardrail IS NOT NULL THEN
    -- Check min
    IF v_subtotal < v_guardrail.min_total THEN
      v_subtotal := v_guardrail.min_total;
      v_reason_codes := array_append(v_reason_codes, 'GUARDRAIL_MIN_ENFORCED');
    END IF;
    
    -- Check max (BLOCK if exceeded - fail closed)
    IF v_subtotal > v_guardrail.max_total THEN
      -- Emit audit and return blocked
      PERFORM public._c21_emit_audit(
        'PRICE_QUOTE_BLOCKED_GUARDRAIL',
        NULL,
        p_city_id,
        jsonb_build_object(
          'service_code', p_service_code,
          'computed_total', v_subtotal,
          'max_allowed', v_guardrail.max_total
        ),
        'Quote blocked: exceeds maximum allowed price'
      );
      
      RETURN jsonb_build_object(
        'success', false,
        'error', 'GUARDRAIL_MAX_EXCEEDED',
        'message', 'Computed price exceeds maximum allowed',
        'computed', v_subtotal,
        'max_allowed', v_guardrail.max_total
      );
    END IF;
  END IF;
  
  -- Calculate tax (18% GST)
  v_tax := v_subtotal * 0.18;
  v_total := v_subtotal + v_tax;
  
  -- 9. Generate customer explanation
  v_explanation := 'Your service quote includes ';
  IF v_diagnostic > 0 THEN
    v_explanation := v_explanation || format('diagnostic fee (₹%s), ', v_diagnostic);
  END IF;
  v_explanation := v_explanation || format('labor (₹%s)', v_labor);
  IF v_parts > 0 THEN
    v_explanation := v_explanation || format(', parts (₹%s)', round(v_parts));
  END IF;
  IF v_urgency_surcharge > 0 THEN
    v_explanation := v_explanation || format(', priority service (₹%s)', round(v_urgency_surcharge));
  END IF;
  v_explanation := v_explanation || format(', and applicable taxes (₹%s).', round(v_tax));
  
  -- 10. Create quote record
  v_expires_at := now() + interval '24 hours';
  
  INSERT INTO public.pricing_quotes (
    quote_key,
    city_id,
    customer_id,
    service_code,
    labor_amount,
    parts_amount,
    parts_cost,
    transport_amount,
    diagnostic_amount,
    urgency_surcharge,
    complexity_surcharge,
    discount_amount,
    tax_amount,
    total_amount,
    ruleset_version,
    input_hash,
    reason_codes,
    customer_explanation,
    status,
    expires_at,
    created_by
  ) VALUES (
    v_quote_key,
    p_city_id,
    p_customer_id,
    p_service_code,
    v_labor,
    v_parts,
    COALESCE(p_parts_cost, 0),
    v_transport,
    v_diagnostic,
    v_urgency_surcharge,
    v_complexity_surcharge,
    v_discount,
    v_tax,
    v_total,
    v_ruleset.version,
    v_quote_key,
    v_reason_codes,
    v_explanation,
    'pending',
    v_expires_at,
    auth.uid()
  )
  RETURNING id INTO v_quote_id;
  
  -- 11. Emit audit
  PERFORM public._c21_emit_audit(
    'PRICE_QUOTE_CREATED',
    v_quote_id,
    p_city_id,
    jsonb_build_object(
      'service_code', p_service_code,
      'total', v_total,
      'ruleset_version', v_ruleset.version
    ),
    'Quote created successfully'
  );
  
  -- 12. Return result
  RETURN jsonb_build_object(
    'success', true,
    'quote_id', v_quote_id,
    'cached', false,
    'breakdown', jsonb_build_object(
      'labor', v_labor,
      'parts', round(v_parts, 2),
      'transport', v_transport,
      'diagnostic', v_diagnostic,
      'urgency_surcharge', round(v_urgency_surcharge, 2),
      'complexity_surcharge', round(v_complexity_surcharge, 2),
      'discount', v_discount,
      'subtotal', round(v_subtotal, 2),
      'tax', round(v_tax, 2),
      'total', round(v_total, 2)
    ),
    'reason_codes', v_reason_codes,
    'explanation', v_explanation,
    'expires_at', v_expires_at,
    'ruleset_version', v_ruleset.version
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_c21_quote_price IS
'C21: Compute deterministic quote with guardrails. Idempotent via quote_key.';

-- ============================================================================
-- RPC: rpc_c21_accept_quote
-- ============================================================================
-- Accepts and locks a quote, optionally binding to a ticket

CREATE OR REPLACE FUNCTION public.rpc_c21_accept_quote(
  p_quote_id UUID,
  p_ticket_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_quote RECORD;
  v_role TEXT;
BEGIN
  v_role := public._c20_app_role();
  
  -- 1. Fetch quote
  SELECT * INTO v_quote
  FROM public.pricing_quotes
  WHERE id = p_quote_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'QUOTE_NOT_FOUND',
      'message', 'Quote does not exist'
    );
  END IF;
  
  -- 2. Check ownership or role
  IF v_quote.customer_id IS NOT NULL AND v_quote.customer_id != auth.uid() THEN
    IF v_role NOT IN ('admin', 'super_admin', 'manager') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'UNAUTHORIZED',
        'message', 'Not authorized to accept this quote'
      );
    END IF;
    -- Manager must have city access
    IF v_role = 'manager' AND NOT public._c20_is_city_accessible(v_quote.city_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'CITY_ACCESS_DENIED',
        'message', 'Not authorized for this city'
      );
    END IF;
  END IF;
  
  -- 3. Check status
  IF v_quote.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_STATUS',
      'message', 'Quote status is: ' || v_quote.status
    );
  END IF;
  
  -- 4. Check expiry
  IF v_quote.expires_at < now() THEN
    UPDATE public.pricing_quotes SET status = 'expired' WHERE id = p_quote_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'QUOTE_EXPIRED',
      'message', 'Quote has expired'
    );
  END IF;
  
  -- 5. Accept and lock
  UPDATE public.pricing_quotes
  SET status = 'accepted',
      accepted_at = now(),
      ticket_id = COALESCE(p_ticket_id, ticket_id)
  WHERE id = p_quote_id;
  
  -- 6. Emit audit
  PERFORM public._c21_emit_audit(
    'PRICE_QUOTE_ACCEPTED',
    p_quote_id,
    v_quote.city_id,
    jsonb_build_object(
      'total', v_quote.total_amount,
      'ticket_id', p_ticket_id
    ),
    'Quote accepted by ' || v_role
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'quote_id', p_quote_id,
    'total', v_quote.total_amount,
    'accepted_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_c21_accept_quote IS
'C21: Accept and lock a pending quote. Validates ownership/role and expiry.';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public._c21_generate_quote_key(uuid, text, decimal, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._c21_emit_audit(text, uuid, uuid, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_c21_quote_price(uuid, text, uuid, decimal, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_c21_accept_quote(uuid, uuid) TO authenticated, service_role;

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'C21 Dynamic Pricing v1: RPCs created.';
  RAISE NOTICE 'Functions: rpc_c21_quote_price, rpc_c21_accept_quote';
  RAISE NOTICE 'Helpers: _c21_generate_quote_key, _c21_emit_audit';
END $$;
