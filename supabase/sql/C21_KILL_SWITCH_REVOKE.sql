-- C21 Kill Switch: REVOKE
-- Execution: Run via Supabase SQL Editor or Admin Client
-- Purpose: Immediately stop all quote creation and acceptance by revoking execute permissions.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.create_pricing_quote(uuid, text, numeric, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_pricing_quote(uuid, text, numeric, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_pricing_quote(uuid, text, numeric, jsonb) FROM public;

REVOKE EXECUTE ON FUNCTION public.accept_pricing_quote(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_pricing_quote(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_pricing_quote(uuid, uuid) FROM public;

-- Also revoke Share functions 
REVOKE EXECUTE ON FUNCTION public.create_quote_share_token(uuid, text, interval, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_quote_share_token(text, text) FROM authenticated;

-- Audit
INSERT INTO public.pricing_audit_log(
    event_type, scope, payload, explanation
) VALUES (
    'KILL_SWITCH_ACTIVATED', 
    'global', 
    '{"action": "REVOKE", "target": "RPCs"}', 
    'Emergency Kill Switch Level 3 Activated via SQL'
);

COMMIT;
