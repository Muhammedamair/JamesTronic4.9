-- ============================================================================
-- Fix: Seed Dark Store for Simulation
-- JamesTronic Platform
-- ============================================================================

INSERT INTO public.dark_stores (name, code, city, status, max_daily_capacity)
VALUES 
    ('HyperLocal Store - HSR Layout', 'DS-BLR-HSR', 'Bangalore', 'active', 50)
ON CONFLICT (code) DO NOTHING;
