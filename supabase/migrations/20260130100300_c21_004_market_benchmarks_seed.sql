-- ============================================================================
-- C21 Dynamic Pricing Engine v1 - Market Benchmarks Seed
-- JamesTronic Platform
-- ============================================================================
-- Normalized competitor pricing data for guardrail computation
-- Source: Founder-provided competitor rate cards
-- Rules:
--   - ₹1/₹0 values marked as LOW confidence (excluded from guardrail calc)
--   - Service charge + labour split into separate fields
-- ============================================================================

-- ============================================================================
-- TV INSTALLATION BENCHMARKS
-- ============================================================================

INSERT INTO public.market_benchmarks (category, service_code, size_band, description, competitor_total, competitor_labor, source_confidence) VALUES
('TV', 'TV_INSTALL_WALL_24_32', '24-32', 'Installation - wall mount 24" ~ 32"', 399, 299, 'HIGH'),
('TV', 'TV_INSTALL_WALL_32_43', '32-43', 'Installation - wall mount 32" ~ 43"', 300, 299, 'HIGH'),
('TV', 'TV_INSTALL_WALL_46_55', '46-55', 'Installation - wall mount 46" ~ 55"', 450, 299, 'HIGH'),
('TV', 'TV_INSTALL_WALL_65', '65', 'Installation - wall mount 65"', 650, 299, 'HIGH'),
('TV', 'TV_INSTALL_WALL_68_75', '68-75', 'Installation - Wall Mount 68" ~ 75"', 1300, 299, 'HIGH'),
('TV', 'TV_INSTALL_WALL_76_85', '76-85', 'Installation - Wall Mount 76" ~ 85"', 1800, 299, 'HIGH'),

-- Rotating mounts
('TV', 'TV_INSTALL_ROTATE_24_32', '24-32', 'Rotating Wall Mount Stand 24" ~ 26"', 1000, NULL, 'HIGH'),
('TV', 'TV_INSTALL_ROTATE_32_43', '32-43', 'Rotating Wall Mount Stand 32" ~ 43"', 1500, NULL, 'HIGH'),
('TV', 'TV_INSTALL_ROTATE_46_55', '46-55', 'Rotating Wall Mount Stand 46" ~ 55"', 1800, NULL, 'HIGH'),
('TV', 'TV_INSTALL_ROTATE_65', '65', 'Rotating Wall Mount Stand 65"', 2000, NULL, 'HIGH'),

-- Uninstallation
('TV', 'TV_UNINSTALL_24_43', '24-43', 'Uninstallation below 46"', 50, 299, 'HIGH'),
('TV', 'TV_UNINSTALL_46_55', '46-55', 'Uninstallation 46" ~ 55"', 100, 299, 'HIGH'),
('TV', 'TV_UNINSTALL_65', '65', 'Uninstallation 65"', 300, 299, 'HIGH'),
('TV', 'TV_UNINSTALL_75_85', '75-85', 'Uninstallation 75" ~85"', 500, 299, 'HIGH')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TV REPAIR BENCHMARKS (24-32")
-- ============================================================================

INSERT INTO public.market_benchmarks (category, service_code, size_band, description, competitor_total, source_confidence) VALUES
('TV', 'TV_REPAIR_BACKLIGHT_24_32', '24-32', 'Backlight Set 24" ~ 32"', 2550, 'HIGH'),
('TV', 'TV_REPAIR_MOBO_24_32', '24-32', 'Motherboard Repair 24" ~ 32"', 2350, 'HIGH'),
('TV', NULL, '24-32', 'Motherboard Non-smart Replace (Universal) 24" ~ 32"', 2700, 'HIGH'),
('TV', NULL, '24-32', 'Motherboard Smart Replace (Universal) 24" ~ 32"', 3750, 'HIGH'),
('TV', 'TV_REPAIR_PANEL_24_32', '24-32', 'Panel Repair 24" ~ 32"', 3800, 'HIGH'),
('TV', 'TV_REPAIR_PSU_24_32', '24-32', 'Power Supply Board Repair 24" ~ 32"', 2000, 'HIGH'),
('TV', NULL, '24-32', 'Power Supply Board Replace (Universal) 24" ~ 32"', 2650, 'HIGH')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TV REPAIR BENCHMARKS (40-43")
-- ============================================================================

INSERT INTO public.market_benchmarks (category, service_code, size_band, description, competitor_total, source_confidence) VALUES
('TV', 'TV_REPAIR_BACKLIGHT_40_43', '40-43', 'Backlight Set 40" ~ 43"', 4600, 'HIGH'),
('TV', 'TV_REPAIR_MOBO_40_43', '40-43', 'Motherboard Repair 40" ~ 43"', 3060, 'HIGH'),
('TV', 'TV_REPAIR_PANEL_40_43', '40-43', 'Panel Repair 40" ~ 43"', 5310, 'HIGH'),
('TV', 'TV_REPAIR_PSU_40_43', '40-43', 'Power Supply Board Repair 40" ~ 43"', 2650, 'HIGH'),
('TV', 'TV_REPAIR_TCON_32_43', '40-43', 'T-con repair 43"', 2350, 'HIGH')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TV REPAIR BENCHMARKS (46-55")
-- ============================================================================

INSERT INTO public.market_benchmarks (category, service_code, size_band, description, competitor_total, source_confidence) VALUES
('TV', 'TV_REPAIR_BACKLIGHT_46_55', '46-55', 'Backlight Set 46" ~ 55"', 7650, 'HIGH'),
('TV', 'TV_REPAIR_MOBO_46_55', '46-55', 'Mother Board Repair 46" ~ 55"', 4800, 'HIGH'),
('TV', 'TV_REPAIR_PANEL_46_55', '46-55', 'Panel Repair 55"', 7650, 'HIGH'),
('TV', 'TV_REPAIR_PSU_46_55', '46-55', 'Power Supply Board (Repair) 46" ~ 55"', 4200, 'HIGH'),
('TV', 'TV_REPAIR_TCON_46_55', '46-55', 'T-Con Repair 46" ~ 55"', 4800, 'HIGH')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TV REPAIR BENCHMARKS (65-75")
-- ============================================================================

INSERT INTO public.market_benchmarks (category, service_code, size_band, description, competitor_total, source_confidence) VALUES
('TV', 'TV_REPAIR_BACKLIGHT_65_75', '65-75', 'Backlight Set 65" ~ 75"', 13250, 'HIGH'),
('TV', 'TV_REPAIR_MOBO_65_75', '65-75', 'Mother Board Repair 65" ~ 75"', 5300, 'HIGH'),
('TV', 'TV_REPAIR_PANEL_65_75', '65-75', 'Panel Repair 65" ~ 75"', 12950, 'HIGH'),
('TV', 'TV_REPAIR_PSU_65_75', '65-75', 'Power Supply Board Repair 65" ~ 75"', 4500, 'HIGH'),
('TV', 'TV_REPAIR_TCON_65_75', '65-75', 'T-Con Repair 65" ~ 75"', 5100, 'HIGH')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TV BRANDED PARTS (LOW CONFIDENCE - ₹1 placeholders)
-- ============================================================================

INSERT INTO public.market_benchmarks (category, size_band, description, competitor_total, source_confidence) VALUES
('TV', NULL, 'Branded Speaker set of 2', 1, 'LOW'),
('TV', NULL, 'BT Remote Control Branded', 1, 'LOW'),
('TV', NULL, 'Invertor Board (replacement - branded)', 1, 'LOW'),
('TV', NULL, 'MotherBoard (replacement - branded)', 1, 'LOW'),
('TV', NULL, 'Panel Replacement Branded', 1, 'LOW'),
('TV', NULL, 'Power Supply Board (replacement - branded)', 1, 'LOW'),
('TV', NULL, 'Panel minor repair Branded', 0, 'LOW')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MICROWAVE BENCHMARKS
-- ============================================================================

INSERT INTO public.market_benchmarks (category, service_code, description, competitor_total, source_confidence) VALUES
-- Power Unit
('MW', 'MW_POWER_PCB_NEW', 'PCB New', 2000, 'HIGH'),
('MW', 'MW_POWER_PCB_REPAIR', 'PCB Repair', 1500, 'HIGH'),
('MW', 'MW_POWER_KEYPAD', 'Keypad/Touchpad repair', 1550, 'HIGH'),
('MW', 'MW_POWER_CORD', 'Power Cord', 400, 'HIGH'),

-- No Heating
('MW', 'MW_HEATING_CAPACITOR', 'HV Capacitor', 650, 'HIGH'),
('MW', 'MW_HEATING_MAGNETRON', 'Magnetron', 1800, 'HIGH'),
('MW', 'MW_HEATING_TRANSFORMER', 'HV Transformer', 2100, 'HIGH'),
('MW', 'MW_HEATING_DIODE', 'HV Diode', 400, 'HIGH'),
('MW', 'MW_HEATING_HEATER_CONV', 'Convection Heater', 860, 'HIGH'),
('MW', 'MW_HEATING_HEATER_GRILL', 'Grill Heater', 750, 'HIGH'),

-- Noise
('MW', 'MW_NOISE_TURNTABLE', 'Turn Table Motor', 700, 'HIGH'),
('MW', 'MW_NOISE_FAN', 'Fan Motor', 950, 'HIGH'),

-- Accessories
('MW', 'MW_ACCESS_GLASS', 'Glass Turn table', 810, 'HIGH'),
('MW', 'MW_ACCESS_MICA', 'Mica Sheet', 250, 'HIGH'),
('MW', 'MW_ACCESS_COUPLER', 'Coupler', 230, 'HIGH')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MICROWAVE MINOR REPAIR (Labor only - ₹0 parts)
-- ============================================================================

INSERT INTO public.market_benchmarks (category, description, competitor_total, competitor_labor, source_confidence) VALUES
('MW', 'Wire Retaping', 0, 299, 'MEDIUM'),
('MW', 'Cavity Cleaning', 0, 299, 'MEDIUM'),
('MW', 'Ventilation clean', 0, 299, 'MEDIUM'),
('MW', 'Electrical Plug Adjustment', 0, 299, 'MEDIUM'),
('MW', 'Body Cabinet Adjustment', 0, 299, 'MEDIUM')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LAPTOP ADAPTOR BENCHMARKS
-- ============================================================================

INSERT INTO public.market_benchmarks (category, service_code, model_band, description, competitor_total, competitor_labor, source_confidence) VALUES
('LAPTOP', 'LAPTOP_ADAPTOR_COMPAT_45W', 'standard', 'Adaptor Compatible 45W', 1200, 349, 'HIGH'),
('LAPTOP', 'LAPTOP_ADAPTOR_COMPAT_65W', 'standard', 'Adaptor Compatible 65W', 1400, 349, 'HIGH'),
('LAPTOP', 'LAPTOP_ADAPTOR_COMPAT_90W', 'standard', 'Adaptor Compatible 90W', 1600, 349, 'HIGH'),
('LAPTOP', 'LAPTOP_ADAPTOR_OEM_45W', 'standard', 'Adaptor OEM 45W', 1600, 349, 'HIGH'),
('LAPTOP', 'LAPTOP_ADAPTOR_OEM_65W', 'standard', 'Adaptor OEM 65W', 1800, 349, 'HIGH'),
('LAPTOP', 'LAPTOP_ADAPTOR_OEM_90W', 'standard', 'Adaptor OEM 90W', 2000, 349, 'HIGH')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LAPTOP BATTERY BENCHMARKS (Compatible)
-- ============================================================================

INSERT INTO public.market_benchmarks (category, service_code, model_band, description, competitor_total, competitor_labor, source_confidence) VALUES
('LAPTOP', 'LAPTOP_BATTERY_COMPAT_STD', 'standard', 'Compatible Battery - Standard', 2300, 349, 'HIGH'),
('LAPTOP', 'LAPTOP_BATTERY_COMPAT_GAMING', 'gaming', 'Compatible Battery - Gaming', 3200, 349, 'HIGH'),
('LAPTOP', 'LAPTOP_BATTERY_COMPAT_PREMIUM', 'premium', 'Compatible Battery - Premium (XPS/Spectre)', 3200, 349, 'HIGH')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LAPTOP BATTERY BENCHMARKS (OEM)
-- ============================================================================

INSERT INTO public.market_benchmarks (category, service_code, model_band, description, competitor_total, competitor_labor, source_confidence) VALUES
('LAPTOP', 'LAPTOP_BATTERY_OEM_STD', 'standard', 'OEM Battery - Standard', 3800, 349, 'HIGH'),
('LAPTOP', 'LAPTOP_BATTERY_OEM_GAMING', 'gaming', 'OEM Battery - Gaming', 4300, 349, 'HIGH'),
('LAPTOP', 'LAPTOP_BATTERY_OEM_PREMIUM', 'premium', 'OEM Battery - Premium', 4800, 349, 'HIGH')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LAPTOP DISPLAY BENCHMARKS
-- ============================================================================

INSERT INTO public.market_benchmarks (category, service_code, size_band, description, competitor_total, competitor_labor, source_confidence) VALUES
('LAPTOP', 'LAPTOP_DISPLAY_14_LCD', '14', 'Display LCD - 14 inch', 4000, 349, 'HIGH'),
('LAPTOP', 'LAPTOP_DISPLAY_14_LED', '14', 'Display LED - 14 inch', 4000, 349, 'HIGH'),
('LAPTOP', 'LAPTOP_DISPLAY_15_LED', '15.6', 'Display LED - 15.6 inch', 4800, 349, 'HIGH'),
('LAPTOP', 'LAPTOP_DISPLAY_17_LED', '17.3', 'Display LED - 17.3 inch', 5000, 349, 'HIGH'),
('LAPTOP', 'LAPTOP_DISPLAY_IPS', NULL, 'Display IPS SCREEN', 6500, 349, 'HIGH'),
('LAPTOP', 'LAPTOP_DISPLAY_TOUCH', NULL, 'Display TOUCH SCREEN', 12500, 349, 'HIGH')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LAPTOP MOTHERBOARD BENCHMARKS
-- ============================================================================

INSERT INTO public.market_benchmarks (category, service_code, model_band, description, competitor_total, competitor_labor, source_confidence) VALUES
('LAPTOP', 'LAPTOP_MOBO_REPAIR_STD', 'standard', 'Controller/IO Repair - Standard', 4500, 349, 'HIGH'),
('LAPTOP', 'LAPTOP_MOBO_REPAIR_GAMING', 'gaming', 'Controller/IO Repair - Gaming', 6500, 349, 'HIGH'),
('LAPTOP', 'LAPTOP_MOBO_CORROSION_STD', 'standard', 'Shorting/Corrosion Repair - Standard', 2800, 349, 'HIGH'),
('LAPTOP', 'LAPTOP_MOBO_CORROSION_GAMING', 'gaming', 'Shorting/Corrosion Repair - Gaming', 3800, 349, 'HIGH'),
('LAPTOP', 'LAPTOP_MOBO_IO_STD', 'standard', 'HM chip - Standard 9-12th Gen', 5150, 349, 'HIGH'),
('LAPTOP', 'LAPTOP_MOBO_IO_GAMING', 'gaming', 'HM chip - Gaming', 6500, 349, 'HIGH')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LAPTOP MOTHERBOARD REPLACEMENT (LOW CONFIDENCE - ₹1 placeholder)
-- ============================================================================

INSERT INTO public.market_benchmarks (category, model_band, description, competitor_total, competitor_labor, source_confidence) VALUES
('LAPTOP', NULL, 'Motherboard Replacement (varies by model)', 1, 349, 'LOW')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
DECLARE
  v_total INTEGER;
  v_high INTEGER;
  v_low INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.market_benchmarks;
  SELECT COUNT(*) INTO v_high FROM public.market_benchmarks WHERE source_confidence = 'HIGH';
  SELECT COUNT(*) INTO v_low FROM public.market_benchmarks WHERE source_confidence = 'LOW';
  RAISE NOTICE 'C21 Market Benchmarks: % rows loaded (HIGH: %, LOW: %).', v_total, v_high, v_low;
  RAISE NOTICE 'LOW confidence rows will be excluded from guardrail computations.';
END $$;
