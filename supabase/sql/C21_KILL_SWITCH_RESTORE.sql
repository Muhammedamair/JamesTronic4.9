-- C21 Kill Switch: RESTORE
-- Execution: Run via Supabase SQL Editor or Admin Client
-- Purpose: Restore execute permissions to authorized roles.

BEGIN;

-- Restore create_pricing_quote
GRANT EXECUTE ON FUNCTION public.create_pricing_quote(uuid, text, numeric, jsonb) TO authenticated;
-- Note: Further RLS/Role checks are inside the function

-- Restore accept_pricing_quote
GRANT EXECUTE ON FUNCTION public.accept_pricing_quote(uuid, uuid) TO authenticated;

-- Restore Share functions
GRANT EXECUTE ON FUNCTION public.create_quote_share_token(uuid, text, interval, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_quote_share_token(text, text) TO authenticated;

-- Audit
INSERT INTO public.pricing_audit_log(
    event_type, scope, payload, explanation
) VALUES (
    'KILL_SWITCH_RESTORED', 
    'global', 
    '{"action": "GRANT", "target": "RPCs"}', 
    'Emergency Kill Switch Level 3 Deactivated - Service Restored'
);

COMMIT;
