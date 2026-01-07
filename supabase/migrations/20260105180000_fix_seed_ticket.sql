-- ============================================================================
-- Fix: Seed Ticket for Revenue Leakage Simulation (Branch ID Fixed)
-- JamesTronic Platform
-- ============================================================================

DO $$
DECLARE
    v_cust_id uuid;
    -- Use a valid V4 UUID (Version 4, Variant 8) to satisfy strict validators
    v_ticket_id uuid := '00000000-0000-4000-8000-000000000001';
    v_old_ticket_id uuid := '00000000-0000-0000-0000-000000000001';
    v_branch_id uuid;
BEGIN
    -- Cleanup old invalid UUID if it exists to prevent future errors
    DELETE FROM public.revenue_leakage_alerts WHERE ticket_id = v_old_ticket_id;
    DELETE FROM public.tickets WHERE id = v_old_ticket_id;

    -- 1. Try to find ANY existing customer
    SELECT id INTO v_cust_id FROM public.customers LIMIT 1;
    
    -- 2. Try to find ANY existing branch
    SELECT id INTO v_branch_id FROM public.branches LIMIT 1;

    IF v_cust_id IS NOT NULL AND v_branch_id IS NOT NULL THEN
        -- 3. Create or Update Dummy Ticket
        INSERT INTO public.tickets (
            id, 
            customer_id, 
            branch_id, -- REQUIRED
            status, 
            device_category,
            issue_summary, 
            issue_details,
            quoted_price -- simulation price (low)
        )
        VALUES (
            v_ticket_id, 
            v_cust_id,
            v_branch_id,
            'open', 
            'Simulation Device',
            'Revenue Simulation Ticket', 
            'Testing revenue leakage alerts. Price is 500 but cost is 800.',
            500.00
        )
        ON CONFLICT (id) DO UPDATE SET 
            issue_summary = 'Refreshed Revenue Simulation',
            branch_id = v_branch_id,
            updated_at = now();
        
        RAISE NOTICE 'Seed Ticket Created/Updated: % (Branch: %)', v_ticket_id, v_branch_id;
    ELSE
        RAISE NOTICE 'Missing data. Customer: %, Branch: %. Please ensure seeded data exists.', v_cust_id, v_branch_id;
    END IF;

END $$;
