-- FP-007: C22 Anti-AutoPunish hardening
-- Goal: No client role (PUBLIC/authenticated) can EXECUTE suspension RPCs.
-- Only service_role (server-side) and postgres should execute.

-- 1) Revoke from PUBLIC (default grant) and authenticated
REVOKE ALL ON FUNCTION public.rpc_suspend_actor_strict(
  text, uuid, uuid, text, boolean, boolean
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.rpc_suspend_actor_strict(
  text, uuid, uuid, text, boolean, boolean
) FROM authenticated;

-- 2) Explicitly grant to service_role only (server-side)
GRANT EXECUTE ON FUNCTION public.rpc_suspend_actor_strict(
  text, uuid, uuid, text, boolean, boolean
) TO service_role;

-- Optional: ensure the legacy rpc_suspend_actor remains service_role/postgres only
REVOKE ALL ON FUNCTION public.rpc_suspend_actor(
  uuid, text, text, text, boolean
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.rpc_suspend_actor(
  uuid, text, text, text, boolean
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_suspend_actor(
  uuid, text, text, text, boolean
) TO service_role;
