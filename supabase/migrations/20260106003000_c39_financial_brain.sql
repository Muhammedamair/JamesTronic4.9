-- ============================================================================
-- C39 Financial Brain & Revenue Intelligence: Database Infrastructure
-- JamesTronic Platform
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.transaction_type AS ENUM (
    'revenue',
    'expense',
    'payout',
    'adjustment'
);

CREATE TYPE public.financial_category AS ENUM (
    'pickup_fee',
    'repair_labor',
    'parts_sale',
    'parts_purchase',
    'warranty_premium',
    'claim_payout',
    'sla_penalty',
    'marketing',
    'operational_cost',
    'tax',
    'misc'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. Financial Transactions: Central Unified Ledger
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type public.transaction_type NOT NULL,
    category public.financial_category NOT NULL,
    amount numeric(12, 2) NOT NULL,
    description text,
    
    branch_id uuid REFERENCES public.branches(id), -- Optional, filters by branch
    reference_id text, -- ID from other tables (ticket_id, part_id, claim_id)
    metadata jsonb DEFAULT '{}',
    
    transaction_date timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

-- 2. Financial Summaries: Aggregated stats for charts and forecasting
CREATE TABLE IF NOT EXISTS public.financial_summaries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_date date UNIQUE NOT NULL,
    
    total_revenue numeric(12, 2) DEFAULT 0.00,
    total_expenses numeric(12, 2) DEFAULT 0.00,
    gross_margin_percent numeric(5, 2) DEFAULT 0.00,
    
    forecast_revenue numeric(12, 2), -- Predicted by AI
    actual_vs_forecast_diff numeric(12, 2),
    
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- RPCs
-- ============================================================================

-- RPC: Sync Daily Ledger
-- Aggregates transactions into summaries (Simulated)
CREATE OR REPLACE FUNCTION public.rpc_sync_daily_ledger(p_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rev numeric;
    v_exp numeric;
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_rev 
    FROM public.financial_transactions 
    WHERE transaction_date::date = p_date AND type = 'revenue';

    SELECT COALESCE(SUM(amount), 0) INTO v_exp 
    FROM public.financial_transactions 
    WHERE transaction_date::date = p_date AND type IN ('expense', 'payout');

    INSERT INTO public.financial_summaries (summary_date, total_revenue, total_expenses, gross_margin_percent)
    VALUES (
        p_date, 
        v_rev, 
        v_exp, 
        CASE WHEN v_rev > 0 THEN ((v_rev - v_exp) / v_rev) * 100 ELSE 0 END
    )
    ON CONFLICT (summary_date) DO UPDATE
    SET 
        total_revenue = EXCLUDED.total_revenue,
        total_expenses = EXCLUDED.total_expenses,
        gross_margin_percent = EXCLUDED.gross_margin_percent;
END;
$$;

-- RPC: Get Financial KPIs
CREATE OR REPLACE FUNCTION public.rpc_get_financial_kpis()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_rev numeric;
    v_total_exp numeric;
    v_avg_margin numeric;
    v_daily_burn numeric;
    v_result jsonb;
BEGIN
    SELECT COALESCE(SUM(total_revenue), 0), COALESCE(SUM(total_expenses), 0), COALESCE(AVG(gross_margin_percent), 0)
    INTO v_total_rev, v_total_exp, v_avg_margin
    FROM public.financial_summaries
    WHERE summary_date > now() - interval '30 days';

    v_daily_burn := v_total_exp / 30;

    v_result := jsonb_build_object(
        'monthly_revenue', v_total_rev,
        'monthly_expenses', v_total_exp,
        'average_margin', v_avg_margin,
        'daily_burn', v_daily_burn,
        'health_score', CASE WHEN v_total_rev > v_total_exp THEN 85 ELSE 45 END
    );

    RETURN v_result;
END;
$$;

-- ============================================================================
-- SEED DATA (30 Days History + Sample Transactions)
-- ============================================================================

DO $$
DECLARE
    v_date date;
    v_rev numeric;
    v_exp numeric;
BEGIN
    -- Seed 30 days of summaries
    FOR i IN 1..30 LOOP
        v_date := (now() - (i || ' days')::interval)::date;
        v_rev := random() * 5000 + 3000;
        v_exp := random() * 2000 + 1000;
        
        INSERT INTO public.financial_summaries (summary_date, total_revenue, total_expenses, gross_margin_percent, forecast_revenue)
        VALUES (
            v_date,
            v_rev,
            v_exp,
            ((v_rev - v_exp) / v_rev) * 100,
            v_rev * (0.9 + random() * 0.2) -- Random forecast around actuals
        );
    END LOOP;

    -- Add current day transactions
    INSERT INTO public.financial_transactions (type, category, amount, description)
    VALUES 
    ('revenue', 'repair_labor', 1200.00, 'AC Repair Service #T-101'),
    ('revenue', 'parts_sale', 450.00, 'iPhone 13 Battery Replacement'),
    ('expense', 'parts_purchase', 300.00, 'Bulk Battery Sourcing'),
    ('payout', 'claim_payout', 120.00, 'Warranty Claim WP-001 Approval');
END $$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.financial_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.financial_summaries TO authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_sync_daily_ledger TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_financial_kpis TO authenticated;

GRANT ALL ON public.financial_transactions TO service_role;
GRANT ALL ON public.financial_summaries TO service_role;
