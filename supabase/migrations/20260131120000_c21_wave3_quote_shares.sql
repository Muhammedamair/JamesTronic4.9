-- C21 Wave 3 PR1: Quote Share Tokens (Hash-only, TTL, Max-Use, Identity-bound)
BEGIN;

-- 1) Share token table (hash-only; single-use by default)
CREATE TABLE IF NOT EXISTS public.pricing_quote_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.pricing_quotes(id) ON DELETE CASCADE,

  token_hash text NOT NULL UNIQUE,         -- sha256(hex(token))
  purpose text NOT NULL DEFAULT 'customer_view',
  expires_at timestamptz NOT NULL,
  max_uses int NOT NULL DEFAULT 1,
  used_count int NOT NULL DEFAULT 0,

  -- Bind token to intended identity (at least one required)
  intended_customer_id uuid NULL,
  intended_phone_e164 text NULL,

  -- Governance
  revoked_at timestamptz NULL,
  revoked_by uuid NULL,

  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NULL,
  last_used_by uuid NULL,

  CONSTRAINT pricing_quote_share_tokens_max_uses_chk CHECK (max_uses BETWEEN 1 AND 5),
  CONSTRAINT pricing_quote_share_tokens_used_count_chk CHECK (used_count >= 0),
  CONSTRAINT pricing_quote_share_tokens_identity_chk CHECK (
    intended_customer_id IS NOT NULL OR (intended_phone_e164 IS NOT NULL AND length(trim(intended_phone_e164)) >= 8)
  )
);

CREATE INDEX IF NOT EXISTS idx_pqst_quote_id ON public.pricing_quote_share_tokens(quote_id);
CREATE INDEX IF NOT EXISTS idx_pqst_expires_at ON public.pricing_quote_share_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_pqst_intended_customer_id ON public.pricing_quote_share_tokens(intended_customer_id);

-- RLS: do not expose tokens via client queries
ALTER TABLE public.pricing_quote_share_tokens ENABLE ROW LEVEL SECURITY;

-- No policies added intentionally: access only via SECURITY DEFINER RPCs.

-- 2) RPC: create_quote_share_token
CREATE OR REPLACE FUNCTION public.create_quote_share_token(
  p_quote_id uuid,
  p_ttl_minutes int DEFAULT 120,
  p_max_uses int DEFAULT 1,
  p_intended_customer_id uuid DEFAULT NULL,
  p_intended_phone_e164 text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_role text := coalesce((auth.jwt() -> 'app_metadata' ->> 'app_role'), '');
  v_actor_city_id uuid := NULLIF((auth.jwt() -> 'app_metadata' ->> 'city_id'), '')::uuid;

  v_quote record;
  v_token text;
  v_hash text;
  v_expires timestamptz;
  v_ttl int;
  v_uses int;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF v_role NOT IN ('staff','manager','admin','super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_intended_customer_id IS NULL AND (p_intended_phone_e164 IS NULL OR length(trim(p_intended_phone_e164)) < 8) THEN
    RAISE EXCEPTION 'intended_identity_required';
  END IF;

  SELECT * INTO v_quote
  FROM public.pricing_quotes
  WHERE id = p_quote_id
  FOR UPDATE;

  IF v_quote.id IS NULL THEN
    RAISE EXCEPTION 'quote_not_found';
  END IF;

  -- Optional: only share pending quotes
  IF v_quote.status <> 'pending' AND v_role <> 'super_admin' THEN
    -- Allow admins to share old quotes for history? Let's stick to spec: "Invalid Status" if not pending.
    -- Assuming stricter rule as per user request.
    IF v_quote.status <> 'accepted' THEN -- Wait, usually only PENDING is shared for acceptance.
       IF v_quote.status <> 'pending' THEN
          RAISE EXCEPTION 'invalid_status: %', v_quote.status;
       END IF;
    END IF;
     -- actually user spec said: "IF v_quote.status <> 'pending' THEN RAISE EXCEPTION 'invalid_status'; END IF;"
     -- I will follow spec exactly.
  END IF;
  
  -- Correction: Strict adhere to spec from prompt
  IF v_quote.status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  -- City scoping: manager/staff only within their city
  IF v_role IN ('manager','staff') THEN
    IF v_actor_city_id IS NULL OR v_quote.city_id <> v_actor_city_id THEN
      RAISE EXCEPTION 'forbidden: out_of_scope_city';
    END IF;
  END IF;

  v_ttl := greatest(5, least(coalesce(p_ttl_minutes, 120), 1440));
  v_uses := greatest(1, least(coalesce(p_max_uses, 1), 5));

  v_expires := least(now() + make_interval(mins => v_ttl), v_quote.expires_at);

  -- token: 32 bytes hex (high entropy)
  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(sha256(v_token::bytea), 'hex');

  INSERT INTO public.pricing_quote_share_tokens (
    quote_id, token_hash, expires_at, max_uses,
    intended_customer_id, intended_phone_e164,
    created_by
  ) VALUES (
    p_quote_id, v_hash, v_expires, v_uses,
    p_intended_customer_id, p_intended_phone_e164,
    v_actor_id
  );

  INSERT INTO public.pricing_audit_log (
    event_type, scope, city_id, actor_id, actor_role, quote_id, payload, explanation
  ) VALUES (
    'PRICE_QUOTE_SHARED', 'city', v_quote.city_id, v_actor_id, v_role, p_quote_id,
    jsonb_build_object(
      'expires_at', v_expires, 
      'max_uses', v_uses,
      'intended_customer_id', p_intended_customer_id,
      'intended_phone_e164', p_intended_phone_e164
    ),
    format('Quote %s shared (expires %s, max_uses %s)', p_quote_id, v_expires, v_uses)
  );

  RETURN jsonb_build_object(
    'success', true,
    'token', v_token,
    'expires_at', v_expires,
    'max_uses', v_uses
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_quote_share_token(uuid,int,int,uuid,text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_quote_share_token(uuid,int,int,uuid,text) TO authenticated;

-- 3) RPC: redeem_quote_share_token (OTP session required; customer only)
CREATE OR REPLACE FUNCTION public.redeem_quote_share_token(
  p_token text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_role text := coalesce((auth.jwt() -> 'app_metadata' ->> 'app_role'), '');
  v_hash text := encode(sha256(p_token::bytea), 'hex');

  v_tok record;
  v_quote record;
  v_profile_phone text;
  v_claimed boolean := false;
BEGIN
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

  -- Intended identity enforcement
  IF v_tok.intended_customer_id IS NOT NULL AND v_tok.intended_customer_id <> v_actor_id THEN
    RAISE EXCEPTION 'forbidden: wrong_customer';
  END IF;

  IF v_tok.intended_phone_e164 IS NOT NULL THEN
    SELECT phone INTO v_profile_phone FROM public.profiles WHERE id = v_actor_id;
    -- Profile phone normalization might be needed, assuming standard E.164 match
    -- Or just straight comparison as per spec
    IF v_profile_phone IS NULL OR v_profile_phone <> v_tok.intended_phone_e164 THEN
      RAISE EXCEPTION 'forbidden: wrong_phone';
    END IF;
  END IF;

  SELECT * INTO v_quote
  FROM public.pricing_quotes
  WHERE id = v_tok.quote_id
  FOR UPDATE;

  IF v_quote.id IS NULL THEN
    RAISE EXCEPTION 'quote_not_found';
  END IF;

  -- Claim/ownership enforcement for customer acceptance
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

  -- Return sanitized DTO (no ruleset/base_rate refs)
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

REVOKE ALL ON FUNCTION public.redeem_quote_share_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.redeem_quote_share_token(text) TO authenticated;

COMMIT;
