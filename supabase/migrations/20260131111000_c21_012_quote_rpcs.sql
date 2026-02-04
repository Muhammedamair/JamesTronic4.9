-- Migration: C21.12 Quote Compute RPCs
-- Purpose: Implement create_pricing_quote + accept_pricing_quote with governance.

BEGIN;

-- ============================================================================
-- 1. create_pricing_quote()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_pricing_quote(
  p_city_id UUID,
  p_service_code TEXT,
  p_customer_id UUID DEFAULT NULL,
  p_ticket_id UUID DEFAULT NULL,
  p_urgency TEXT DEFAULT 'standard',
  p_complexity TEXT DEFAULT 'standard',
  p_parts_cost DECIMAL DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_role TEXT := coalesce((auth.jwt() -> 'app_metadata' ->> 'app_role'), '');
  v_actor_city_id UUID := (auth.jwt() -> 'app_metadata' ->> 'city_id')::UUID;
  
  -- Ruleset
  v_ruleset RECORD;
  -- Base Rate
  v_base_rate RECORD;
  -- Guardrail
  v_guardrail RECORD;
  
  -- Computed amounts
  v_labor_amount DECIMAL := 0;
  v_parts_amount DECIMAL := 0;
  v_transport_amount DECIMAL := 0;
  v_diagnostic_amount DECIMAL := 0;
  v_urgency_surcharge DECIMAL := 0;
  v_complexity_surcharge DECIMAL := 0;
  v_total_amount DECIMAL := 0;
  
  -- Multipliers from ruleset
  v_urgency_mult DECIMAL := 1.0;
  v_complexity_mult DECIMAL := 1.0;
  
  -- Reason codes
  v_reason_codes TEXT[] := '{}';
  
  -- Output quote
  v_quote_id UUID;
  v_quote_key TEXT;
  v_expires_at TIMESTAMPTZ;
  v_breakdown JSONB;
BEGIN
  -- ========== A. Authorization ==========
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  
  -- Role gate: admin can quote any city, manager only their assigned city
  IF v_role = 'manager' THEN
    IF v_actor_city_id IS NULL OR v_actor_city_id != p_city_id THEN
      RAISE EXCEPTION 'forbidden: manager can only create quotes for assigned city';
    END IF;
  ELSIF v_role NOT IN ('admin', 'super_admin', 'staff') THEN
    RAISE EXCEPTION 'forbidden: only staff/manager/admin can create quotes';
  END IF;
  
  -- ========== B. Fetch Active Ruleset ==========
  SELECT id, version, rules INTO v_ruleset
  FROM public.pricing_rulesets
  WHERE is_active = true
  LIMIT 1;
  
  IF v_ruleset.id IS NULL THEN
    RAISE EXCEPTION 'no_active_ruleset';
  END IF;
  
  -- Extract multipliers from ruleset rules JSONB
  v_urgency_mult := CASE 
    WHEN p_urgency = 'same_day' THEN coalesce((v_ruleset.rules ->> 'urgency_same_day')::DECIMAL, 1.5)
    WHEN p_urgency = 'next_day' THEN coalesce((v_ruleset.rules ->> 'urgency_next_day')::DECIMAL, 1.2)
    ELSE 1.0 
  END;
  
  v_complexity_mult := CASE 
    WHEN p_complexity = 'complex' THEN coalesce((v_ruleset.rules ->> 'complexity_complex')::DECIMAL, 1.5)
    WHEN p_complexity = 'simple' THEN coalesce((v_ruleset.rules ->> 'complexity_simple')::DECIMAL, 0.8)
    ELSE 1.0 
  END;
  
  -- ========== C. Fetch Base Rate ==========
  SELECT * INTO v_base_rate
  FROM public.pricing_base_rates
  WHERE city_id = p_city_id 
    AND service_code = p_service_code
    AND (effective_to IS NULL OR effective_to > now())
  ORDER BY effective_from DESC
  LIMIT 1;
  
  IF v_base_rate.id IS NULL THEN
    RAISE EXCEPTION 'base_rate_not_found: % / %', p_city_id, p_service_code;
  END IF;
  
  -- ========== D. Fetch Guardrail ==========
  SELECT * INTO v_guardrail
  FROM public.pricing_guardrails
  WHERE city_id = p_city_id 
    AND service_code = p_service_code
    AND is_enabled = true
    AND (effective_to IS NULL OR effective_to > now())
  ORDER BY effective_from DESC
  LIMIT 1;
  
  -- Guardrail may not exist; proceed with defaults
  
  -- ========== E. Compute Breakdown ==========
  v_labor_amount := v_base_rate.labor_base * v_complexity_mult;
  v_transport_amount := coalesce(v_base_rate.transport_base, 0);
  v_diagnostic_amount := coalesce(v_base_rate.diagnostic_fee, 0);
  v_urgency_surcharge := v_base_rate.labor_base * (v_urgency_mult - 1);
  v_complexity_surcharge := v_base_rate.labor_base * (v_complexity_mult - 1);
  v_parts_amount := p_parts_cost * (1 + coalesce(v_base_rate.parts_markup_pct, 15) / 100);
  
  -- Add reason codes for surcharges
  IF p_urgency != 'standard' THEN
    v_reason_codes := array_append(v_reason_codes, 'URGENCY_' || upper(p_urgency));
  END IF;
  IF p_complexity != 'standard' THEN
    v_reason_codes := array_append(v_reason_codes, 'COMPLEXITY_' || upper(p_complexity));
  END IF;
  
  v_total_amount := v_labor_amount + v_parts_amount + v_transport_amount + v_diagnostic_amount + v_urgency_surcharge;
  
  -- ========== F. Apply Guardrails ==========
  IF v_guardrail.id IS NOT NULL THEN
    IF v_total_amount < v_guardrail.min_total THEN
      v_total_amount := v_guardrail.min_total;
      v_reason_codes := array_append(v_reason_codes, 'GUARDRAIL_MIN_ENFORCED');
    END IF;
    IF v_total_amount > v_guardrail.max_total THEN
      v_total_amount := v_guardrail.max_total;
      v_reason_codes := array_append(v_reason_codes, 'GUARDRAIL_MAX_ENFORCED');
    END IF;
  END IF;
  
  -- ========== G. Generate Idempotency Key ==========
  v_quote_key := encode(
    sha256(
      (p_city_id::text || p_service_code || coalesce(p_customer_id::text, '') || 
       coalesce(p_ticket_id::text, '') || p_urgency || p_complexity || 
       p_parts_cost::text || v_actor_id::text)::bytea
    ), 'hex'
  );
  
  -- Check for existing quote with same key (idempotency)
  SELECT id INTO v_quote_id FROM public.pricing_quotes WHERE quote_key = v_quote_key;
  IF v_quote_id IS NOT NULL THEN
    -- Return existing quote
    SELECT jsonb_build_object(
      'quote_id', id,
      'total_amount', total_amount,
      'breakdown', breakdown,
      'expires_at', expires_at,
      'reason_codes', reason_codes,
      'idempotent', true
    ) INTO v_breakdown FROM public.pricing_quotes WHERE id = v_quote_id;
    RETURN v_breakdown;
  END IF;
  
  v_expires_at := now() + interval '24 hours';
  
  -- ========== H. Build Breakdown JSONB ==========
  v_breakdown := jsonb_build_object(
    'labor', v_labor_amount,
    'parts', v_parts_amount,
    'transport', v_transport_amount,
    'diagnostic', v_diagnostic_amount,
    'urgency_surcharge', v_urgency_surcharge,
    'complexity_surcharge', v_complexity_surcharge,
    'subtotal_before_guardrails', v_labor_amount + v_parts_amount + v_transport_amount + v_diagnostic_amount + v_urgency_surcharge
  );
  
  -- ========== I. Insert Quote ==========
  INSERT INTO public.pricing_quotes (
    quote_key, city_id, customer_id, ticket_id, service_code,
    labor_amount, parts_amount, parts_cost, transport_amount, diagnostic_amount,
    urgency_surcharge, complexity_surcharge, total_amount,
    ruleset_id, ruleset_version, reason_codes, breakdown,
    base_rate_ref, guardrail_ref,
    status, expires_at, created_by
  ) VALUES (
    v_quote_key, p_city_id, p_customer_id, p_ticket_id, p_service_code,
    v_labor_amount, v_parts_amount, p_parts_cost, v_transport_amount, v_diagnostic_amount,
    v_urgency_surcharge, v_complexity_surcharge, v_total_amount,
    v_ruleset.id, v_ruleset.version, v_reason_codes, v_breakdown,
    jsonb_build_object('id', v_base_rate.id, 'effective_from', v_base_rate.effective_from),
    CASE WHEN v_guardrail.id IS NOT NULL THEN jsonb_build_object('id', v_guardrail.id, 'effective_from', v_guardrail.effective_from) ELSE '{}'::jsonb END,
    'pending', v_expires_at, v_actor_id
  ) RETURNING id INTO v_quote_id;
  
  -- ========== J. Audit Log ==========
  INSERT INTO public.pricing_audit_log (
    event_type, scope, city_id, actor_id, actor_role, quote_id, payload, explanation
  ) VALUES (
    'PRICE_QUOTE_CREATED', 'city', p_city_id, v_actor_id, v_role, v_quote_id,
    jsonb_build_object(
      'service_code', p_service_code,
      'urgency', p_urgency,
      'complexity', p_complexity,
      'total', v_total_amount,
      'reason_codes', v_reason_codes
    ),
    format('Quote %s created for %s @ %s', v_quote_id, p_service_code, v_total_amount)
  );
  
  RETURN jsonb_build_object(
    'quote_id', v_quote_id,
    'total_amount', v_total_amount,
    'breakdown', v_breakdown,
    'expires_at', v_expires_at,
    'reason_codes', v_reason_codes,
    'idempotent', false
  );
END;
$$;

-- ============================================================================
-- 2. accept_pricing_quote()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.accept_pricing_quote(
  p_quote_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_role TEXT := coalesce((auth.jwt() -> 'app_metadata' ->> 'app_role'), '');
  v_quote RECORD;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  
  -- Lock the quote row
  SELECT * INTO v_quote
  FROM public.pricing_quotes
  WHERE id = p_quote_id
  FOR UPDATE;
  
  IF v_quote.id IS NULL THEN
    RAISE EXCEPTION 'quote_not_found';
  END IF;
  
  -- Authorization: customer can accept own quote, manager/admin can accept any in their scope
  IF v_role = 'customer' THEN
    IF v_quote.customer_id IS NULL OR v_quote.customer_id != v_actor_id THEN
      RAISE EXCEPTION 'forbidden: customer can only accept their own quotes';
    END IF;
  ELSIF v_role NOT IN ('admin', 'super_admin', 'manager', 'staff') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  
  -- Status check
  IF v_quote.status != 'pending' THEN
    RAISE EXCEPTION 'invalid_status: quote is %', v_quote.status;
  END IF;
  
  -- Expiry check
  IF v_quote.expires_at <= now() THEN
    -- Update status to expired
    UPDATE public.pricing_quotes SET status = 'expired' WHERE id = p_quote_id;
    RAISE EXCEPTION 'quote_expired';
  END IF;
  
  -- Accept
  UPDATE public.pricing_quotes
  SET status = 'accepted',
      accepted_at = now(),
      accepted_by = v_actor_id
  WHERE id = p_quote_id;
  
  -- Audit
  INSERT INTO public.pricing_audit_log (
    event_type, scope, city_id, actor_id, actor_role, quote_id, payload, explanation
  ) VALUES (
    'PRICE_QUOTE_ACCEPTED', 'city', v_quote.city_id, v_actor_id, v_role, p_quote_id,
    jsonb_build_object('total', v_quote.total_amount, 'reason', p_reason),
    format('Quote %s accepted @ %s', p_quote_id, v_quote.total_amount)
  );
  
  RETURN jsonb_build_object('success', true, 'quote_id', p_quote_id, 'accepted_at', now());
END;
$$;

-- ============================================================================
-- 3. Permissions
-- ============================================================================
REVOKE ALL ON FUNCTION public.create_pricing_quote(UUID, TEXT, UUID, UUID, TEXT, TEXT, DECIMAL) FROM public;
GRANT EXECUTE ON FUNCTION public.create_pricing_quote(UUID, TEXT, UUID, UUID, TEXT, TEXT, DECIMAL) TO authenticated;

REVOKE ALL ON FUNCTION public.accept_pricing_quote(UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.accept_pricing_quote(UUID, TEXT) TO authenticated;

COMMIT;
