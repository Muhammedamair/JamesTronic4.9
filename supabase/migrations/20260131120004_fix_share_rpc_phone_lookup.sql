-- C21 Wave 3 PR1 Fix: Update RPC to look up phone from auth.users instead of profiles
CREATE OR REPLACE FUNCTION public.redeem_quote_share_token(
  p_token text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_role text := coalesce((auth.jwt() -> 'app_metadata' ->> 'app_role'), '');
  v_hash text;

  v_tok record;
  v_quote record;
  v_user_phone text;
  v_claimed boolean := false;
BEGIN
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF v_role <> 'customer' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_tok
  FROM public.pricing_quote_share_tokens
  WHERE token_hash = v_hash
  FOR UPDATE;

  IF v_tok.id IS NULL THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  IF v_tok.revoked_at IS NOT NULL THEN
     RAISE EXCEPTION 'token_revoked';
  END IF;

  IF v_tok.expires_at <= now() THEN
    RAISE EXCEPTION 'token_expired';
  END IF;

  IF v_tok.used_count >= v_tok.max_uses THEN
    RAISE EXCEPTION 'token_consumed';
  END IF;

  IF v_tok.intended_customer_id IS NOT NULL AND v_tok.intended_customer_id <> v_actor_id THEN
    RAISE EXCEPTION 'forbidden: wrong_customer';
  END IF;

  IF v_tok.intended_phone_e164 IS NOT NULL THEN
    -- Lookup phone from auth.users
    SELECT phone INTO v_user_phone FROM auth.users WHERE id = v_actor_id;
    
    -- Check if null or mismatch
    IF v_user_phone IS NULL OR v_user_phone <> v_tok.intended_phone_e164 THEN
      RAISE EXCEPTION 'forbidden: wrong_phone (expected %, got %)', v_tok.intended_phone_e164, v_user_phone;
    END IF;
  END IF;

  SELECT * INTO v_quote
  FROM public.pricing_quotes
  WHERE id = v_tok.quote_id
  FOR UPDATE;

  IF v_quote.id IS NULL THEN
    RAISE EXCEPTION 'quote_not_found';
  END IF;

  IF v_quote.customer_id IS NULL THEN
    UPDATE public.pricing_quotes SET customer_id = v_actor_id WHERE id = v_quote.id;
    v_claimed := true;
    
    INSERT INTO public.pricing_audit_log (
      event_type, scope, city_id, actor_id, actor_role, quote_id, payload, explanation
    ) VALUES (
      'PRICE_QUOTE_CLAIMED', 'city', v_quote.city_id, v_actor_id, v_role, v_quote.id,
      jsonb_build_object('via', 'share_token'),
      format('Quote %s claimed by customer', v_quote.id)
    );

  ELSIF v_quote.customer_id <> v_actor_id THEN
    RAISE EXCEPTION 'forbidden: quote_owned_by_other_customer';
  END IF;

  UPDATE public.pricing_quote_share_tokens
  SET used_count = used_count + 1,
      last_used_at = now(),
      last_used_by = v_actor_id
  WHERE id = v_tok.id;

  INSERT INTO public.pricing_audit_log (
    event_type, scope, city_id, actor_id, actor_role, quote_id, payload, explanation
  ) VALUES (
    'PRICE_QUOTE_VIEWED', 'city', v_quote.city_id, v_actor_id, v_role, v_quote.id,
    jsonb_build_object('via', 'share_token', 'claimed', v_claimed),
    format('Quote %s viewed by customer', v_quote.id)
  );

  RETURN jsonb_build_object(
    'quote', jsonb_build_object(
      'id', v_quote.id,
      'service_code', v_quote.service_code,
      'status', v_quote.status,
      'total_amount', v_quote.total_amount,
      'expires_at', v_quote.expires_at,
      'breakdown', v_quote.breakdown,
      'reason_codes', v_quote.reason_codes
    ),
    'can_accept', (v_quote.status = 'pending' AND v_quote.expires_at > now())
  );
END;
$$;
