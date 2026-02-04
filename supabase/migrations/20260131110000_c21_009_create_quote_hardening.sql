-- C21.9 Create Quote Hardening (P0 Patch)
-- 1. Enforce Role & City Scope in create_pricing_quote (SECURITY DEFINER fix)
-- 2. Fix Multiplier/Delta semantics and casting
-- 3. Upgrade quote_key to SHA256

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
    -- Auth & Scope
    v_actor_id UUID := auth.uid();
    v_role TEXT := coalesce((auth.jwt() -> 'app_metadata' ->> 'app_role'), '');
    v_actor_city_id UUID := NULLIF((auth.jwt() -> 'app_metadata' ->> 'city_id'), '')::UUID;

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
    v_urgency_mult DECIMAL := 1.0; -- Default to 1.0 (no multiplier)
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
    -- 0. Authorization & Scope Enforcement
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'unauthorized';
    END IF;

    -- Only staff/manager/admin can create quotes
    IF v_role NOT IN ('staff','manager','admin','super_admin') THEN
        RAISE EXCEPTION 'forbidden: role_cannot_create_quote';
    END IF;

    -- Manager/Staff must be city-scoped
    IF v_role IN ('manager','staff') THEN
        IF v_actor_city_id IS NULL OR v_actor_city_id != p_city_id THEN
            RAISE EXCEPTION 'forbidden: out_of_scope_city';
        END IF;
    END IF;

    -- 0.b Input Validation & FK Checks
    IF p_customer_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_customer_id) THEN
             v_valid_customer_id := NULL;
        END IF;
    END IF;

    IF p_ticket_id IS NOT NULL THEN
       IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tickets') THEN
          EXECUTE 'SELECT id FROM public.tickets WHERE id = $1' INTO v_valid_ticket_id USING p_ticket_id;
          IF v_valid_ticket_id IS NULL THEN
             v_valid_ticket_id := NULL; -- Id not found
          END IF;
       ELSE
          NULL; 
       END IF;
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

    -- Complexity Multiplier (Explicit Cast + Logic)
    IF p_complexity = 'simple' THEN 
        v_complexity_mult := COALESCE((v_ruleset.rules->'multipliers'->>'complexity_simple')::DECIMAL, 1.0);
    ELSIF p_complexity = 'complex' THEN 
        v_complexity_mult := COALESCE((v_ruleset.rules->'multipliers'->>'complexity_complex')::DECIMAL, 1.0);
    ELSE
        v_complexity_mult := 1.0;
    END IF; 

    -- Urgency Multiplier (Explicit Cast + Logic)
    IF p_urgency = 'same_day' THEN 
        v_urgency_mult := COALESCE((v_ruleset.rules->'multipliers'->>'urgency_same_day')::DECIMAL, 1.0);
    ELSIF p_urgency = 'next_day' THEN 
        v_urgency_mult := COALESCE((v_ruleset.rules->'multipliers'->>'urgency_next_day')::DECIMAL, 1.0);
    ELSE
        v_urgency_mult := 1.0;
    END IF;

    -- Parts Markup
    v_parts_markup := COALESCE((v_ruleset.rules->'multipliers'->>'parts_markup_pct')::DECIMAL, 0.0);

    -- Calculate Totals
    -- Surcharges computed as delta from 1.0
    v_complexity_surcharge := v_labor_base * (v_complexity_mult - 1.0);
    v_surcharge_urgency := v_labor_base * (v_urgency_mult - 1.0);
    
    v_labor_final := (v_labor_base * v_complexity_mult); -- Base * Mult includes surcharge
    -- Wait, if labor_final includes complexity, do we add surcharge again?
    -- Convention: Breakdown shows components. 
    -- User logic: "v_surcharge_urgency := v_labor_base * (v_urgency_mult - 1.0);"
    -- Standard: Labor = Base. Surcharges are separate line items.
    -- Or: Labor = Base adjusted.
    -- Let's stick to the previous breakdown logic but updated calculation:
    -- v_labor_final IS the base adjusted by complexity? 
    -- Previous logic: v_labor_final := v_labor_base * v_complexity_mult;
    -- Previous logic: v_complexity_surcharge := (v_labor_base * v_complexity_mult) - v_labor_base;
    -- So Labor Final includes complexity.
    -- Subtotal = Labor Final + Transport + Parts + Urgency.
    -- Urgency is separate.
    -- Complexity is absorbed into Labor Final in line item, but shown as surcharge in breakdown?
    -- Let's keep v_surcharge_urgency as separate line item.
    
    v_labor_final := v_labor_base * v_complexity_mult; -- Includes complexity
    v_transport_final := v_transport_base;
    v_parts_final := p_parts_cost * (1 + v_parts_markup / 100.0);
    
    -- Subtotal calculation
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

    -- 6. Updated Idempotency (SHA256 Upgrade)
    v_quote_key := encode(
      sha256(
        (
          p_city_id::text ||
          p_service_code ||
          COALESCE(v_valid_customer_id::text,'') ||
          COALESCE(v_valid_ticket_id::text,'') ||
          p_urgency ||
          p_complexity ||
          to_char(p_parts_cost::numeric, 'FM9999999990.00') ||
          v_ruleset.version ||
          v_base_rate.id::text ||
          COALESCE(v_guardrail.id::text,'')
        )::bytea
      ),
      'hex'
    );

    -- Check overlap
    SELECT id INTO v_quote_id
    FROM public.pricing_quotes
    WHERE quote_key = v_quote_key
      AND expires_at > now()
      AND status = 'pending';
    
    IF v_quote_id IS NOT NULL THEN
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
