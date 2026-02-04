-- C21.8 Governance Hardening
-- 1. Patch accept_pricing_quote to enforce city scope for managers/staff
-- 2. Update create_pricing_quote to include context in quote_key and validate FKs

-- 1. Patch accept_pricing_quote
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
  v_actor_city_id UUID := NULLIF((auth.jwt() -> 'app_metadata' ->> 'city_id'), '')::UUID;
  v_quote RECORD;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_quote
  FROM public.pricing_quotes
  WHERE id = p_quote_id
  FOR UPDATE;

  IF v_quote.id IS NULL THEN
    RAISE EXCEPTION 'quote_not_found';
  END IF;

  -- Customer can accept only own quote
  IF v_role = 'customer' THEN
    IF v_quote.customer_id IS NULL OR v_quote.customer_id != v_actor_id THEN
      RAISE EXCEPTION 'forbidden: customer can only accept their own quotes';
    END IF;

  -- Manager/Staff must be city-scoped (admin remains global)
  ELSIF v_role IN ('manager','staff') THEN
    IF v_actor_city_id IS NULL OR v_quote.city_id != v_actor_city_id THEN
      RAISE EXCEPTION 'forbidden: out_of_scope_city';
    END IF;

  ELSIF v_role NOT IN ('admin','super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_quote.status != 'pending' THEN
    RAISE EXCEPTION 'invalid_status: quote is %', v_quote.status;
  END IF;

  IF v_quote.expires_at <= now() THEN
    UPDATE public.pricing_quotes SET status = 'expired' WHERE id = p_quote_id;

    -- Audit expiry
    INSERT INTO public.pricing_audit_log (
      event_type, scope, city_id, actor_id, actor_role, quote_id, payload, explanation
    ) VALUES (
      'PRICE_QUOTE_EXPIRED', 'city', v_quote.city_id, v_actor_id, v_role, p_quote_id,
      jsonb_build_object('total', v_quote.total_amount),
      format('Quote %s expired @ %s', p_quote_id, v_quote.total_amount)
    );

    RAISE EXCEPTION 'quote_expired';
  END IF;

  UPDATE public.pricing_quotes
  SET status = 'accepted',
      accepted_at = now(),
      accepted_by = v_actor_id
  WHERE id = p_quote_id;

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

-- 2. Update create_pricing_quote (Replaces previous version from c21_002)
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
    v_ruleset RECORD;
    v_base_rate RECORD;
    v_guardrail RECORD;
    v_labor_base DECIMAL;
    v_transport_base DECIMAL;
    v_total DECIMAL;
    v_quote_key TEXT;
    v_quote_id UUID;
    v_reason_codes TEXT[] := ARRAY[]::TEXT[];
    v_breakdown JSONB;
    v_complexity_mult DECIMAL := 1.0;
    v_urgency_mult DECIMAL := 0.0;
    v_parts_markup DECIMAL := 0.0;
    
    -- Granular components
    v_labor_final DECIMAL;
    v_transport_final DECIMAL;
    v_parts_final DECIMAL; 
    v_surcharge_urgency DECIMAL;
    v_complexity_surcharge DECIMAL;
    v_subtotal DECIMAL;
    v_payload JSONB;


    -- Validated IDs
    v_valid_customer_id UUID := p_customer_id;
    v_valid_ticket_id UUID := p_ticket_id;
BEGIN
    -- 0. Input Validation & FK Checks
    -- If customer_id provided but not found, set to NULL to prevent 500 error
    IF p_customer_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_customer_id) THEN
             -- Optionally log warning?
             v_valid_customer_id := NULL;
        END IF;
    END IF;

    -- Same for ticket_id if tickets table exists (assuming public.tickets)
    -- If table doesn't exist or logic differs, we might skip or check generic existence.
    -- For now, we'll assume soft-check or just let it be NULL if we can't validate easily without deps.
    -- But to prevent FK error, we MUST ensure it exists if proper FK is set.
    -- Assuming foreign key exists to tickets table.
    -- Checking system catalog to see if tickets table exists before checking row? 
    -- Too complex for this RPC, better to assume if FK exists, we must respect it.
    -- Let's just set to NULL if validation fails, safe fallback.
    IF p_ticket_id IS NOT NULL THEN
       IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tickets') THEN
          EXECUTE 'SELECT id FROM public.tickets WHERE id = $1' INTO v_valid_ticket_id USING p_ticket_id;
          IF v_valid_ticket_id IS NULL THEN
             v_valid_ticket_id := NULL; -- Id not found
          END IF;
       ELSE
          -- If tickets table doesn't exist yet (maybe strictly separate module), keep as is or set NULL?
          -- Safest to keep as is if no table implies no FK (unlikely if we defined FK).
          -- If FK exists, table exists.
          -- Let's check simply:
          NULL; 
       END IF;
       -- Actually, safer strategy: if we catch specific FK violation exception, we could retry? 
       -- No, better to validate. 
       -- For this patch, we will assume tickets check is needed if we want to avoid 500s.
       -- Let's stick to customer_id validation for now as that was the observed crash.
    END IF;

    -- 1. Fetch Active Ruleset
    SELECT * INTO v_ruleset
    FROM public.pricing_rulesets
    WHERE is_active = true
    LIMIT 1;

    IF v_ruleset.id IS NULL THEN
        RAISE EXCEPTION 'no_active_ruleset';
    END IF;

    -- 2. Fetch Base Rate
    SELECT * INTO v_base_rate
    FROM public.pricing_base_rates
    WHERE city_id = p_city_id 
      AND service_code = p_service_code 
      AND effective_from <= now()
      AND (effective_to IS NULL OR effective_to > now())
    ORDER BY effective_from DESC
    LIMIT 1;

    IF v_base_rate.id IS NULL THEN
         RAISE EXCEPTION 'base_rate_not_found: %', p_service_code;
    END IF;

    -- 3. Fetch Guardrails
    -- Logic: specific scope (city+service) > city scope > global service > global
    SELECT * INTO v_guardrail
    FROM public.pricing_guardrails
    WHERE (city_id = p_city_id OR city_id IS NULL)
      AND (service_code = p_service_code OR service_code IS NULL)
      AND is_enabled = true
    ORDER BY city_id NULLS LAST, service_code NULLS LAST
    LIMIT 1;

    -- 4. Compute Components
    v_labor_base := v_base_rate.labor_base;
    v_transport_base := v_base_rate.transport_base;

    -- Complexity Multiplier
    IF p_complexity = 'simple' THEN v_complexity_mult := v_ruleset.rules->'multipliers'->>'complexity_simple';
    ELSIF p_complexity = 'complex' THEN v_complexity_mult := v_ruleset.rules->'multipliers'->>'complexity_complex';
    END IF; 
    -- Coalesce to 1.0 if null
    v_complexity_mult := COALESCE(v_complexity_mult, 1.0);

    -- Urgency Multiplier
    IF p_urgency = 'same_day' THEN v_urgency_mult := (v_ruleset.rules->'multipliers'->>'urgency_same_day')::DECIMAL;
    ELSIF p_urgency = 'next_day' THEN v_urgency_mult := (v_ruleset.rules->'multipliers'->>'urgency_next_day')::DECIMAL;
    END IF;
    v_urgency_mult := COALESCE(v_urgency_mult, 0.0);

    -- Parts Markup
    v_parts_markup := (v_ruleset.rules->'multipliers'->>'parts_markup_pct')::DECIMAL;
    v_parts_markup := COALESCE(v_parts_markup, 0.0);

    -- Calculate Totals
    v_labor_final := v_labor_base * v_complexity_mult;
    v_transport_final := v_transport_base; -- Could add distance logic later
    v_parts_final := p_parts_cost * (1 + v_parts_markup / 100.0);
    v_surcharge_urgency := v_labor_base * v_urgency_mult;
    v_complexity_surcharge := (v_labor_base * v_complexity_mult) - v_labor_base;
    
    v_subtotal := v_labor_final + v_transport_final + v_parts_final + v_surcharge_urgency;
    
    -- Reason codes
    IF p_complexity != 'standard' THEN v_reason_codes := array_append(v_reason_codes, 'COMPLEXITY_' || upper(p_complexity)); END IF;
    IF p_urgency != 'standard' THEN v_reason_codes := array_append(v_reason_codes, 'URGENCY_' || upper(p_urgency)); END IF;

    -- 5. Guardrails
    v_total := v_subtotal;
    IF v_guardrail.id IS NOT NULL THEN
        IF v_total < v_guardrail.min_total THEN
            v_total := v_guardrail.min_total;
            v_reason_codes := array_append(v_reason_codes, 'GUARDRAIL_MIN_ENFORCED');
        ELSIF v_total > v_guardrail.max_total THEN
             -- Soft or hard block? Spec said block manually, but engine can clamp or flag.
             -- Let's flag as ANOMALY/BLOCKED but persist for audit?
             -- User spec: "If total > max_total -> set total = max_total, add reason GUARDRAIL_MAX_ENFORCED"
             v_total := v_guardrail.max_total;
             v_reason_codes := array_append(v_reason_codes, 'GUARDRAIL_MAX_ENFORCED');
        END IF;
    END IF;

    v_breakdown := jsonb_build_object(
        'labor', v_labor_final,
        'transport', v_transport_final,
        'parts', v_parts_final,
        'complexity_surcharge', v_complexity_surcharge,
        'urgency_surcharge', v_surcharge_urgency,
        'diagnostic', 0,
        'subtotal_before_guardrails', v_subtotal
    );

    -- 6. Updated Idempotency (Context Aware)
    -- Hash: City + Service + Customer + Ticket + Urgency + Complexity + Parts + RulesetVer + BaseRateID + GuardrailID
    v_quote_key := md5(
        p_city_id::text || 
        p_service_code || 
        COALESCE(v_valid_customer_id::text, '') || 
        COALESCE(v_valid_ticket_id::text, '') || 
        p_urgency || 
        p_complexity || 
        p_parts_cost::text ||
        v_ruleset.version ||
        v_base_rate.id::text ||
        COALESCE(v_guardrail.id::text, '')
    );

    -- Check overlap
    SELECT id INTO v_quote_id
    FROM public.pricing_quotes
    WHERE quote_key = v_quote_key
      AND expires_at > now()
      AND status = 'pending';
    
    IF v_quote_id IS NOT NULL THEN
        -- Return existing
        DECLARE
           v_existing_quote RECORD;
        BEGIN
           SELECT * INTO v_existing_quote FROM public.pricing_quotes WHERE id = v_quote_id;
           RETURN jsonb_build_object(
              'quote_id', v_existing_quote.id,
              'total_amount', v_existing_quote.total_amount,
              'breakdown', v_existing_quote.breakdown,
              'reason_codes', v_existing_quote.reason_codes,
              'expires_at', v_existing_quote.expires_at,
              'idempotent', true
           );
        END;
    END IF;

    -- 7. Insert
    -- 7. Insert via JSONB to avoid mysterious positional misalignment
    v_quote_id := gen_random_uuid();
    v_payload := jsonb_build_object(
        'id', v_quote_id,
        'created_at', now(),
        'updated_at', now(),
        'city_id', p_city_id,
        'service_code', p_service_code,
        'customer_id', v_valid_customer_id,
        'ticket_id', v_valid_ticket_id,
        'ruleset_id', v_ruleset.id,
        'base_rate_ref', to_jsonb(v_base_rate),
        'guardrail_ref', to_jsonb(v_guardrail),
        'ruleset_version', v_ruleset.version,
        'labor_amount', v_labor_final,
        'transport_amount', v_transport_final,
        'parts_amount', v_parts_final,
        'complexity_surcharge', v_complexity_surcharge,
        'urgency_surcharge', v_surcharge_urgency,
        'total_amount', v_total,
        'breakdown', v_breakdown,
        'status', 'pending',
        'reason_codes', v_reason_codes,
        'quote_key', v_quote_key,
        'expires_at', (now() + interval '24 hours')
    );

    INSERT INTO public.pricing_quotes
    SELECT * FROM jsonb_populate_record(NULL::public.pricing_quotes, v_payload);
    -- RETURNING id, expires_at INTO v_quote_id, v_total; -- we already have v_quote_id. expires_at is in payload.
    
    -- Need explicit select for return values if RETURNING doesn't map cleanly to JSON (it doesn't direct)
    -- Let's just use the known values.
    
    -- 8. Audit
    INSERT INTO public.pricing_audit_log (
        event_type, scope, city_id, actor_id, actor_role, quote_id, payload, explanation
    ) VALUES (
        'PRICE_QUOTE_CREATED',
        'city',
        p_city_id,
        auth.uid(),
        (auth.jwt() -> 'app_metadata' ->> 'app_role'),
        v_quote_id,
        v_breakdown || jsonb_build_object('total', v_total),
        format('Created quote %s for %s', v_quote_id, p_service_code)
    );

    RETURN jsonb_build_object(
        'quote_id', v_quote_id,
        'total_amount', v_total,
        'breakdown', v_breakdown,
        'reason_codes', v_reason_codes,
        'expires_at', (now() + interval '24 hours'),
        'idempotent', false
    );
END;
$$;
