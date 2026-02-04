# Page Spec: Audit Log
**Route:** `/manager/pricing/audit`

## Header
- **Title**: Pricing Audit Log
- **Subtitle**: Immutable Record

## Content Flow
1. **Filters**:
   - Event Type (Quote Created, Guardrail Blocked, etc.)
   - Actor (User email)
   - Date Range

2. **Feed / Table**:
   - Timestamp, Event Type, Actor, Description
   - "Payload" column: "View JSON" button

3. **Payload Viewer (Modal)**:
   - Pretty-printed JSON of the event payload
   - Shows inputs/outputs/violations

## Security
- Query is city-scoped for Manager via RLS.
- Admin sees all.
