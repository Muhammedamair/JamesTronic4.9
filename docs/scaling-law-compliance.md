# Scaling Law Compliance

**Last Updated:** 2026-02-11
**Status:** Active & Enforced

## Overview
As the JamesTronic platform scales, we must ensure performance remains optimal. This document defines the compliance rules enforced by our CI pipeline.

## Enforced Limits

We enforce these limits via `scripts/verify_scaling.sh` after every build:

| Metric | Limit | Description |
|--------|-------|-------------|
| **Total Static Build Size** | **20 MB** | The total size of all files in `.next/static`. Prevents massive asset bloat. |
| **Largest Single Chunk** | **800 KB** | The largest individual JS file. Enforces code splitting. |
| **First Load JS (Per Route)** | **500 KB** | Estimated JS payload for any single route. (Opportunistic check based on manifest availability). |

## Enforcement
- **Local:** Run `npm run verify:scaling`
- **CI:** Runs as a gating step in `ci.yml`.

## Remediation
If the build fails compliance:
1. **Analyze:** Check the build output to see which chunk or route is too large.
2. **Optimize:**
   - Use dynamic imports (`next/dynamic`) to split code.
   - Optimize images/assets.
   - Remove unused dependencies.
3. **Adjust:** If the growth is legitimate (e.g., a major feature addition), update the thresholds in `scripts/verify_scaling.sh` and document the reason here.
