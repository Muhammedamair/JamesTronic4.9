-- C21 Wave 3 PR1 Fix: Update audit log check constraint (NOT VALID mode)
ALTER TABLE public.pricing_audit_log DROP CONSTRAINT IF EXISTS pricing_audit_log_event_type_check;

ALTER TABLE public.pricing_audit_log ADD CONSTRAINT pricing_audit_log_event_type_check
CHECK (event_type IN (
  'PRICE_QUOTE_CREATED',
  'PRICE_QUOTE_UPDATED',
  'PRICE_QUOTE_ACCEPTED',
  'PRICE_QUOTE_REJECTED',
  'PRICE_QUOTE_EXPIRED',
  'PRICE_QUOTE_SHARED',
  'PRICE_QUOTE_VIEWED',
  'PRICE_QUOTE_CLAIMED'
)) NOT VALID;
