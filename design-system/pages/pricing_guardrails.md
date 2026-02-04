# Page Spec: Guardrails Editor
**Route:** `/manager/pricing/guardrails`

## Header
- **Title**: Pricing Guardrails
- **Actions**: [Add Guardrail]

## Content Flow
1. **Summary Cards**:
   - Global Defaults vs Service Overrides count

2. **Data Table**:
   - Columns: Service Code, Min Total (₹), Max Total (₹), Floor Margin (%), Max Discount (%), Status
   - Visuals: Progress bar for "Tightness" (Min vs Max)

3. **Edit Modal**:
   - **Title**: Configure Guardrail
   - **Inputs**: Min, Max, Surge Cap, Discount Cap
   - **Validation**: Min <= Max
   - **Preview**: "Block anything above ₹[Max]"

## Safety
- **Warning**: If Max < Market Benchmark (Low confidence ignored)
- **Audit**: Reason code required for changes
