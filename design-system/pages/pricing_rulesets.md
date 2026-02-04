# Page Spec: Ruleset Manager
**Route:** `/manager/pricing/rulesets`

## Header
- **Title**: Ruleset Versions
- **Actions**: [Create Draft Ruleset]

## Content Flow
1. **Active Ruleset Card**:
   - Version, Activation Date, Activated By
   - "JSON Configuration" (Collapsible view of rules blob)

2. **History List**:
   - Sorted by Created Date
   - Active / Inactive status
   - Actions: [View Rules] [Clone to Draft] [Rollback to This]

3. **Rollback/Activate Requirements**:
   - Warning Modal: "This will immediately affect all new quotes."
   - Requirement: Must enter reason.
   - Requirement: Must be Manager of *all* cities (Admin only?) OR city-specific rules?
   - Wait, `pricing_rulesets` is global. So only Admin should edit?
   - **Correction**: Rulesets are global. Base rates are city-specific.
   - **Constraint**: Only Admin/Super Admin can activate rulesets. Managers can VIEW.

## Interactions
- Manager: View Only.
- Admin: Create/Activate/Rollback.
