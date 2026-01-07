-- ============================================================================
-- Seed Migration: Professional Demo Data for Dealers & Inventory
-- Purpose: Populate JamesTronic Intelligence Engines for visual verification.
-- ============================================================================

-- 1. Seed Dealers
INSERT INTO public.dealers (id, name, contact_name, phone, email, city, status)
VALUES 
('d1111111-1111-1111-1111-111111111111', 'Apex Electronics Spares', 'Rajiv Mehta', '+919876543210', 'rajiv@apexspares.com', 'Mumbai', 'active'),
('d2222222-2222-2222-2222-222222222222', 'Global Parts Network', 'Sarah Khan', '+919876543211', 'sarah@globalparts.in', 'Delhi', 'active'),
('d3333333-3333-3333-3333-333333333333', 'Metro Tech Solutions', 'Amit Singh', '+919876543212', 'amit@metrotech.com', 'Bangalore', 'pending_kyc')
ON CONFLICT (id) DO NOTHING;

-- 2. Seed Dealer Reliability Scores
INSERT INTO public.dealer_reliability_scores (dealer_id, score_date, availability_score, delivery_speed_score, quality_score, orders_fulfilled, orders_total)
VALUES 
('d1111111-1111-1111-1111-111111111111', CURRENT_DATE, 95, 88, 92, 145, 150),
('d2222222-2222-2222-2222-222222222222', CURRENT_DATE, 72, 65, 80, 80, 110)
ON CONFLICT DO NOTHING;

-- 3. Seed Demand Forecasts
INSERT INTO public.parts_demand_forecasts (part_category, brand, city, forecast_date, horizon, predicted_demand, confidence, confidence_score)
VALUES 
('AC Compressor', 'Samsung', 'Mumbai', CURRENT_DATE + interval '1 month', 'monthly', 150, 'high', 85),
('Washing Machine Tub', 'LG', 'Delhi', CURRENT_DATE + interval '1 month', 'monthly', 80, 'medium', 70),
('Display Panel', 'Sony', 'Bangalore', CURRENT_DATE + interval '1 day', 'daily', 12, 'very_high', 95)
ON CONFLICT DO NOTHING;

-- 4. Seed Safety Stock Levels
INSERT INTO public.safety_stock_levels (part_category, brand, city, current_stock, safety_stock, reorder_point, max_stock, avg_daily_demand, lead_time_days, service_level_target)
VALUES 
('AC Compressor', 'Samsung', 'Mumbai', 45, 30, 40, 100, 5, 5, 98),
('Display Panel', 'Sony', 'Bangalore', 8, 15, 20, 50, 2, 7, 95),
('Washing Machine Tub', 'LG', 'Delhi', 35, 20, 25, 60, 3, 4, 95)
ON CONFLICT DO NOTHING;

-- 5. Seed Technician Performance Scores (Recovery)
-- Ensure our technicians have some visible performance data
INSERT INTO public.technician_performance_scores (technician_id, score_date, period_type, repair_quality_score, sla_compliance_score, overall_score, jobs_completed)
SELECT user_id, CURRENT_DATE, 'daily', 85, 90, 88, 25 
FROM public.profiles 
WHERE role = 'technician' 
LIMIT 2
ON CONFLICT DO NOTHING;
