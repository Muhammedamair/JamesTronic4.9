# Page Spec: Pricing Overview
**Route:** `/manager/pricing`

## Header
- **Title**: Dynamic Pricing Engine
- **Subtitle**: City: [City Name]
- **Actions**: [View Audit Log]

## Content Flow
1. **Stats Row**:
   - **Active Ruleset**: [Version Badge] (Green = Active)
   - **Quotes Today**: [Count] (Trend vs yesterday)
   - **Acceptance Rate**: [%] (Trend)
   - **Guardrail Blocks**: [Count] (Red if > 0)

2. **Recent Activity (Chart)**:
   - Line chart: Quote Value vs Time (last 24h)
   - Overlay: Acceptance events

3. **Status Cards (Grid)**:
   - **Service Catalog**: [Active Items Count] / [Total]
   - **Base Rates**: [Last Updated]
   - **Guardrails**: [Enabled/Disabled]

## Interactions
- Click "View Audit Log" -> Navigate `/manager/pricing/audit`
- Click Ruleset Badge -> Navigate `/manager/pricing/rulesets`
