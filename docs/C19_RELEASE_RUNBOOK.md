# C19 Release Runbook: Production & UAT Readiness

**Module:** Inventory Prediction Engine (C19)
**Version:** 1.0.0
**Date:** 2026-01-25

---

## 1. CI Pipeline Configuration

Add the following commands to your CI release gate (e.g., GitHub Actions `test` job). These must run **after** database migrations are applied.

**Required Environment Variables:**

Configure these in your GitHub Repository settings:

*   **Repository Secrets** (Protected):
    *   `SUPABASE_SERVICE_ROLE_KEY`
    *   `SUPABASE_DB_URL`
*   **Repository Variables** (Public/Fork-safe):
    *   `NEXT_PUBLIC_SUPABASE_URL`
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    *   `C19_TEST_MODE=ci`

> **CI Database Hygiene:** Ensure `SUPABASE_DB_URL` points to a **dedicated CI project**, NOT your staging or production database. Since CI applies migrations and wipes test data, a shared environment would be destructive.


**Commands:**
```bash
# 1. E2E Simulation (Full Lifecycle)
C19_TEST_MODE=ci npx tsx scripts/verify_c19_phase5_e2e_simulation.ts

# 2. Forecast Accuracy (MAPE Gates)
C19_TEST_MODE=ci npx tsx scripts/test_c19_forecast_accuracy.ts

# 3. Confidence Calibration (Monotonicity Check)
C19_TEST_MODE=ci npx tsx scripts/test_c19_confidence_calibration.ts

# 4. Performance Budgets (Latency)
C19_TEST_MODE=ci npx tsx scripts/test_c19_performance_budgets.ts

# 5. Conflict Safety (Offline Replay)
C19_TEST_MODE=ci npx tsx scripts/test_c19_offline_replay_conflicts.ts
```

> **Gate Policy:** CI must FAIL if any script exits with non-zero code. Do not allow "SKIPPED" gates in production pipelines.
>
> **Best Practice:** Pin your Supabase CLI version in CI (e.g., `npm i -g supabase@1.226.0`) to prevent unexpected breakage from upstream updates.

---

## 2. Operational Scheduling

The C19 engine relies on periodic RPC calls to generate fresh data. Configure these jobs in your scheduler (e.g., `pg_cron`, temporal, or external cron).

| Job Name | RPC Function | Frequency | Purpose |
|----------|--------------|-----------|---------|
| **Compute Demand** | `rpc_compute_part_demand` | **Every 1 Hour** | Aggregates sales/ledger history into daily buckets. |
| **Generate Forecasts** | `rpc_compute_inventory_forecast` | **Daily (00:00 UTC)** | Runs forecasting model (VFL) for 7/30/90 days. |
| **Generate Reorders** | `rpc_generate_reorder_recommendations` | **Daily (01:00 UTC)** | Creates proposed recommendations based on new forecasts. |
| **Performance Stats** | `rpc_inventory_dashboard_summary` | **On Demand** | Called by UI (Admin Dashboard). |

> **Note:** Ensure `Compute Demand` runs *before* `Generate Forecasts`, and `Generate Forecasts` runs *before* `Generate Reorders`.

---

## 3. UAT Smoke Test (Manual)

Perform these steps in Staging/Production UI to verify end-to-end functionality.

### A. Dashboard Access
1. Log in as **Admin** or **Manager**.
2. Navigate to `/admin/inventory`.
3. Verify dashboard loads without errors (Summary cards, Alerts list).

### B. Recommendation Workflow
1. Navigate to `/admin/inventory/reorders`.
2. Select a "Proposed" recommendation (or generate one via CLI if empty).
3. Click **Approve**. Verify status changes to "Approved" and UI updates immediately.
4. Verify Audit Log (if visible) or DB: `approved_by` is your user ID.

### C. Deep Dive Views
1. Click on a Part SKU. Verify `/admin/inventory/parts/[id]` loads demand charts.
2. Click on a Location name. Verify `/admin/inventory/locations/[id]` loads stock summary.

### D. Alert Resolution
1. Navigate to Alerts tab.
2. Click **Resolve** on an active alert.
3. Enter resolution note (e.g., "UAT Test").
4. Verify alert moves to Resolved history.

---

## 4. Rollout Strategy

1. **Monitor Mode (Day 1-3):**
   - Deploy code and migrations.
   - Enable scheduled jobs.
   - Users view Dashboard/Alerts but do **not** action Reorders (or action is non-binding).
   - Verify `Post-Launch KPI` (Forecast Freshness > 24h).

2. **Active Pilot (Day 4+):**
   - Enable Approval workflow for specific locations (if feasible) or globally.
   - Monitor `Real MAPE` drift.

3. **Full Release:**
   - Sign-off on stability.
