# C19 Phase 5 — Forecast Accuracy (MAPE)
- **Started:** 2026-01-26T00:00:00.000Z
- **Result:** ❌ FAIL

## Thresholds
- 7d HIGH ≤ 25%, 7d MID ≤ 40%
- 30d HIGH ≤ 30%, 30d MID ≤ 45%

## Results
| Tier | Window | Samples | MAPE | Threshold | Status |
|------|--------|---------|------|-----------|--------|
| high | 7d | 10 | 14.99% | ≤25% | ✅ |
| high | 30d | 10 | 3.84% | ≤30% | ✅ |
| medium | 7d | 11 | 109.99% | ≤40% | ❌ |
| medium | 30d | 11 | 104.02% | ≤45% | ❌ |
| low | 7d | 0 | 0.00% | N/A | ✅ |
| low | 30d | 0 | 0.00% | N/A | ✅ |

## Errors
- MAPE FAIL: medium 7d got 109.99% > 40%
- MAPE FAIL: medium 30d got 104.02% > 45%