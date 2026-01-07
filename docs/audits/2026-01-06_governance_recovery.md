# JamesTronic Governance Recovery — 2026-01-06

## Context
- Project reached C40 foundation, but audit found governance gaps:
  - C40: RLS missing / grants too open (compliance tables)
  - C22: Punitive suspension RPC exposure risk (client-executable)

## Fixpacks Applied (Remote)
- FP-006: Normalize legacy RLS role tokens (manager/owner) to valid roles in live pg_policies
  - Migration: 20260106055000_fp006_normalize_legacy_rls_roles.sql
  - Verification: pg_policies contains no manager/owner tokens (PASS)

- FP-007: Revoke EXECUTE on suspension RPCs from PUBLIC/authenticated
  - Migration: 20260106056000_fp007_c22_revoke_execute_suspend_strict.sql
  - Verification: only postgres + service_role have EXECUTE (PASS)

## Evidence Commands (Remote)
### 1) Legacy role tokens removed from policies
Query:
SELECT * FROM pg_policies
WHERE schemaname='public'
  AND (qual ILIKE '%manager%' OR qual ILIKE '%owner%' OR coalesce(with_check::text,'') ILIKE '%manager%' OR coalesce(with_check::text,'') ILIKE '%owner%');

Expected: no rows.

### 2) Punitive RPCs are server-only
Query:
SELECT routine_name, grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_schema='public'
  AND routine_name ILIKE '%suspend%'
ORDER BY routine_name, grantee, privilege_type;

Expected:
- rpc_suspend_actor → EXECUTE: postgres, service_role only
- rpc_suspend_actor_strict → EXECUTE: postgres, service_role only

## Guardrails Added (Repo)
- scripts/migration_preflight.sh updated to block any *pending* migration that attempts:
  GRANT EXECUTE ON FUNCTION public.rpc_suspend_actor* TO authenticated/PUBLIC/anon

## Founder Access Bootstrap
- Founder profile row set to role=admin to access Admin Cockpit legitimately.

## Status
✅ Governance Recovery: COMPLETE  
✅ Security Invariants: HOLD  
