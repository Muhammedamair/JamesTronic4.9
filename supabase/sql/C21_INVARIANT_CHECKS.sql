-- C21 Invariant Checks
-- Usage: Run periodically to verify system health.

-- 1. Check Active Ruleset Count (MUST BE 1)
SELECT 
    CASE 
        WHEN count(*) = 1 THEN 'PASS' 
        ELSE 'FAIL: Active Ruleset Count is ' || count(*) 
    END as ruleset_invariant_check
FROM public.pricing_rulesets 
WHERE is_active = true;

-- 2. Check Orphaned Quotes (accepted but no accepted_at/by)
SELECT 
    count(*) as corrupt_accepted_quotes 
FROM public.pricing_quotes 
WHERE status = 'accepted' AND (accepted_at IS NULL OR accepted_by IS NULL);

-- 3. Check Audit Log Integrity (Recent events present)
SELECT 
    count(*) as recent_audit_events 
FROM public.pricing_audit_log 
WHERE created_at > now() - interval '24 hours';

-- 4. Check Guardrails Exist
SELECT 
    count(*) as active_guardrails 
FROM public.pricing_guardrails 
WHERE now() BETWEEN effective_from AND effective_to;
