# C21 Closeout Runbook - Dynamic Pricing Engine v1

## 1. Overview
This runbook defines the operational procedures for managing the C21 Dynamic Pricing Engine in production.

## 2. System Components
- **Core Tables**: `pricing_quotes`, `pricing_rulesets`, `pricing_base_rates`, `pricing_guardrails`.
- **RPCs**: `create_pricing_quote`, `accept_pricing_quote`.
- **APIs**: `/api/pricing/quote`, `/api/pricing/accept`.

## 3. Operational Procedures

### A. Routine Monitoring
- Check `active_ruleset_count` daily (Must be 1).
- Monitor `pricing_audit_log` for anomalies (spikes in blocked quotes).

### B. Ruleset Activation
- **Authorized Role**: Admin / Super Admin only.
- **Procedure**:
  1. Create new ruleset (Draft).
  2. Verify base rates and guardrails.
  3. Use `activate_pricing_ruleset(id, reason)` RPC.
  4. Verify audit log entry.

### C. Issue Escalation
- **L1 (UI Issue)**: Use Feature Flag `dynamic_pricing_v1` to disable UI access.
- **L2 (API Logic Error)**: Use Kill Switch Level 1 (API Denylist).
- **L3 (Data Corruption/Security)**: Use Kill Switch Level 3 (DB Revoke).

## 4. Invariant Checks
Run `sql/C21_INVARIANT_CHECKS.sql` to verify system health.
- Active Ruleset Count = 1
- Base Rates present for all active Service Codes
- No orphaned Quotes

## 5. Rollback
In case of critical failure after ruleset activation:
- Activate previous known-good ruleset version immediately.
- If engine logic is flawed, REVOKE RPC access via Kill Switch.
