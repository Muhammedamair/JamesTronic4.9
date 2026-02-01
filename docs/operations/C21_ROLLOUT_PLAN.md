# C21 Rollout Plan

## 1. Deployment Strategy
- **Phase 1: Pilot Cities**
  - Enable `dynamic_pricing_city_enabled` for specific City IDs.
  - Monitor Quote Creation Rate & Acceptance Rate.

- **Phase 2: General Availability**
  - Enable globally after 1 week pilot.

## 2. Feature Flags
- `NEXT_PUBLIC_DYNAMIC_PRICING_V1`: Controls UI visibility (Sidebar).
- `dynamic_pricing_city_enabled` (DB/Config): Controls quote generation per city.

## 3. Verification Steps
1. **Build**: Ensure Next.js build passes.
2. **Smoke Test**: Run `verify_pricing_ci.sh`.
3. **Flow Test**: Verify Manager Share -> Customer Accept.

## 4. Rollback Plan
- **Trigger**: Error rate > 1% or Security Incident.
- **Action**: 
  1. Disable Feature Flag.
  2. Run `C21_KILL_SWITCH_REVOKE.sql` if API is compromised.
