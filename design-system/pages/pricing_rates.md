# Page Spec: Base Rates Editor
**Route:** `/manager/pricing/base-rates`

## Header
- **Title**: Base Rates
- **Actions**: [Create New Rate]

## Content Flow
1. **Filter Bar**:
   - Search by `service_code`
   - Filter by Category (TV, MW, Laptop)

2. **Data Table**:
   - Columns: Service Code, Description, Labor (₹), Parts Markup (%), Transport (₹), Effective From
   - Row Actions: [Edit/Override] -> Opens Drawer

3. **Edit Drawer (Append-Only)**:
   - **Title**: Update Rate for [Service Code]
   - **Form**:
     - Labor Base (Input)
     - Parts Markup (Input)
     - Transport Base (Input)
     - Diagnostic Fee (Input)
     - Effective From (Date Picker - default Now)
     - Reason (Textarea - Required)
   - **Preview Panel**:
     - "Simulated Quote": Show total vs Current Total
   - **Actions**: [Publish Update] (POST to create new row)

## Validation
- `parts_markup` must be 0-200%
- `effective_from` cannot be in past
