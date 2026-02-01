# C21 Kill Switch Protocol

## Level 1: UI Disable (Soft)
- **Action**: Set `NEXT_PUBLIC_DYNAMIC_PRICING_V1 = false` (env var) or disable via Admin Settings.
- **Effect**: Hides Pricing from Sidebar. APIs still active for in-flight quotes.

## Level 2: API Route Block (Medium)
- **Action**: Add middleware or route config to return 503 for `/api/pricing/*`.
- **Effect**: Stops all new quote generation and acceptance via API.

## Level 3: Database Revoke (Hard)
- **Action**: Run `sql/C21_KILL_SWITCH_REVOKE.sql`.
- **Effect**: Revokes `EXECUTE` permission on `create_pricing_quote` and `accept_pricing_quote` for all roles.
- **Recovery**: Run `sql/C21_KILL_SWITCH_RESTORE.sql`.

## Level 4: Feature Flag Kill
- **Action**: Set `dynamic_pricing_v1` flag to OFF in remote config.
