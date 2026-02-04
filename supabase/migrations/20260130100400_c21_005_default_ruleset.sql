-- ============================================================================
-- C21 Dynamic Pricing Engine v1 - Default Ruleset + Base Rates Seed
-- JamesTronic Platform
-- ============================================================================
-- Creates the initial active ruleset and sample base rates for testing
-- ============================================================================

-- ============================================================================
-- DEFAULT RULESET v1.0.0
-- ============================================================================

INSERT INTO public.pricing_rulesets (version, rules, is_active, activated_at)
VALUES (
  'v1.0.0-2026-01-30',
  '{
    "urgency": {
      "same_day": {"multiplier": 1.5, "label": "Same Day Service"},
      "next_day": {"multiplier": 1.25, "label": "Next Day Service"},
      "standard": {"multiplier": 1.0, "label": "Standard (2-3 days)"}
    },
    "complexity": {
      "simple": {"adjustment": -0.1, "label": "Simple Fix"},
      "standard": {"adjustment": 0, "label": "Standard Repair"},
      "complex": {"adjustment": 0.3, "label": "Complex Repair"}
    },
    "discount_rules": {
      "max_discount_pct": 25,
      "labor_only": true,
      "promo_codes": {}
    },
    "tax": {
      "gst_pct": 18
    }
  }'::jsonb,
  true,
  now()
)
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- SAMPLE BASE RATES (For Testing - City ID placeholder)
-- Note: In production, these would be populated per city
-- Using a default city_id that should exist in most test environments
-- ============================================================================

-- Get or create a default test city
DO $$
DECLARE
  v_city_id UUID;
BEGIN
  -- Try to get existing city
  SELECT id INTO v_city_id FROM public.cities LIMIT 1;
  
  IF v_city_id IS NULL THEN
    RAISE NOTICE 'No cities found. Base rates will be added when cities exist.';
    RETURN;
  END IF;
  
  -- Insert sample TV base rates
  INSERT INTO public.pricing_base_rates (service_code, city_id, labor_base, parts_markup_pct, transport_base, diagnostic_fee, ruleset_version)
  VALUES
    ('TV_INSTALL_WALL_24_32', v_city_id, 299, 15, 0, 0, 'v1.0.0-2026-01-30'),
    ('TV_INSTALL_WALL_32_43', v_city_id, 299, 15, 0, 0, 'v1.0.0-2026-01-30'),
    ('TV_INSTALL_WALL_46_55', v_city_id, 299, 15, 0, 0, 'v1.0.0-2026-01-30'),
    ('TV_INSTALL_WALL_65', v_city_id, 299, 15, 0, 0, 'v1.0.0-2026-01-30'),
    ('TV_REPAIR_BACKLIGHT_24_32', v_city_id, 400, 15, 100, 299, 'v1.0.0-2026-01-30'),
    ('TV_REPAIR_BACKLIGHT_40_43', v_city_id, 500, 15, 100, 299, 'v1.0.0-2026-01-30'),
    ('TV_REPAIR_MOBO_24_32', v_city_id, 500, 15, 100, 299, 'v1.0.0-2026-01-30'),
    ('TV_REPAIR_MOBO_40_43', v_city_id, 600, 15, 100, 299, 'v1.0.0-2026-01-30')
  ON CONFLICT DO NOTHING;
  
  -- Insert sample MW base rates
  INSERT INTO public.pricing_base_rates (service_code, city_id, labor_base, parts_markup_pct, transport_base, diagnostic_fee, ruleset_version)
  VALUES
    ('MW_POWER_PCB_NEW', v_city_id, 400, 15, 100, 299, 'v1.0.0-2026-01-30'),
    ('MW_POWER_PCB_REPAIR', v_city_id, 350, 15, 100, 299, 'v1.0.0-2026-01-30'),
    ('MW_HEATING_MAGNETRON', v_city_id, 400, 15, 100, 299, 'v1.0.0-2026-01-30'),
    ('MW_HEATING_CAPACITOR', v_city_id, 300, 15, 100, 299, 'v1.0.0-2026-01-30')
  ON CONFLICT DO NOTHING;
  
  -- Insert sample Laptop base rates
  INSERT INTO public.pricing_base_rates (service_code, city_id, labor_base, parts_markup_pct, transport_base, diagnostic_fee, ruleset_version)
  VALUES
    ('LAPTOP_BATTERY_COMPAT_STD', v_city_id, 349, 15, 0, 299, 'v1.0.0-2026-01-30'),
    ('LAPTOP_BATTERY_OEM_STD', v_city_id, 349, 15, 0, 299, 'v1.0.0-2026-01-30'),
    ('LAPTOP_DISPLAY_15_LED', v_city_id, 349, 15, 0, 299, 'v1.0.0-2026-01-30'),
    ('LAPTOP_MOBO_REPAIR_STD', v_city_id, 349, 15, 0, 299, 'v1.0.0-2026-01-30')
  ON CONFLICT DO NOTHING;
  
  -- Insert sample guardrails
  INSERT INTO public.pricing_guardrails (city_id, service_code, min_total, max_total, max_discount_pct, max_surge_pct, floor_margin_pct)
  VALUES
    (v_city_id, 'TV_INSTALL_WALL_24_32', 200, 1000, 25, 50, 10),
    (v_city_id, 'TV_INSTALL_WALL_32_43', 200, 1200, 25, 50, 10),
    (v_city_id, 'TV_REPAIR_BACKLIGHT_24_32', 1500, 5000, 20, 40, 15),
    (v_city_id, 'MW_HEATING_MAGNETRON', 1200, 3500, 20, 40, 15),
    (v_city_id, 'LAPTOP_BATTERY_COMPAT_STD', 1800, 4500, 20, 30, 15)
  ON CONFLICT (city_id, service_code) DO NOTHING;
  
  RAISE NOTICE 'C21 Sample base rates and guardrails created for city: %', v_city_id;
END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
DECLARE
  v_rates INTEGER;
  v_guardrails INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_rates FROM public.pricing_base_rates;
  SELECT COUNT(*) INTO v_guardrails FROM public.pricing_guardrails;
  RAISE NOTICE 'C21 Sample Data: % base rates, % guardrails loaded.', v_rates, v_guardrails;
END $$;
