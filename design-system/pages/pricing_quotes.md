# Page Spec: Quote History
**Route:** `/manager/pricing/quotes`

## Header
- **Title**: Quote History
- **Summary**: Total Value (This Month), Conversion Rate

## Content Flow
1. **Filters**:
   - Status: All / Pending / Accepted / Expired / Blocked
   - Date Range
   - Search: Quote ID or Service Code

2. **Data Table**:
   - Quote ID (truncated), Date, Customer, Service, Total (₹), Status
   - Status Badge colors:
     - Pending: Blue
     - Accepted: Green
     - Expired: Gray
     - Blocked: Red (Tooltip shows reason)

3. **Detail View (Drawer)**:
   - **Quote Info**: Full ID, Dates
   - **Breakdown**: Labor/Parts/Tax table
   - **Audit Trail**: Small list of events for this specific quote
   - **Reason Codes**: Tags (e.g., URGENCY_HIGH)

## Interactions
- Click row -> Open Drawer
