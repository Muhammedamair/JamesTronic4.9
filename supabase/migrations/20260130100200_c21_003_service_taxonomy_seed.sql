-- ============================================================================
-- C21 Dynamic Pricing Engine v1 - Service Taxonomy Seed Data
-- JamesTronic Platform
-- ============================================================================
-- V1 Canonical Service Codes: ~60 total
-- Structure: {CAT}_{SUBCAT}_{BAND}_{ACTION}
-- ============================================================================

-- ============================================================================
-- TV INSTALLATION/UNINSTALLATION
-- ============================================================================

INSERT INTO public.pricing_service_catalog (service_code, category, subcategory, size_band, description) VALUES
-- Wall Mount Installation
('TV_INSTALL_WALL_24_32', 'TV', 'install', '24-32', 'TV Wall Mount Installation (24" to 32")'),
('TV_INSTALL_WALL_32_43', 'TV', 'install', '32-43', 'TV Wall Mount Installation (32" to 43")'),
('TV_INSTALL_WALL_46_55', 'TV', 'install', '46-55', 'TV Wall Mount Installation (46" to 55")'),
('TV_INSTALL_WALL_65', 'TV', 'install', '65', 'TV Wall Mount Installation (65")'),
('TV_INSTALL_WALL_68_75', 'TV', 'install', '68-75', 'TV Wall Mount Installation (68" to 75")'),
('TV_INSTALL_WALL_76_85', 'TV', 'install', '76-85', 'TV Wall Mount Installation (76" to 85")'),

-- Rotating Wall Mount
('TV_INSTALL_ROTATE_24_32', 'TV', 'install_rotate', '24-32', 'Rotating Wall Mount Stand (24" to 32")'),
('TV_INSTALL_ROTATE_32_43', 'TV', 'install_rotate', '32-43', 'Rotating Wall Mount Stand (32" to 43")'),
('TV_INSTALL_ROTATE_46_55', 'TV', 'install_rotate', '46-55', 'Rotating Wall Mount Stand (46" to 55")'),
('TV_INSTALL_ROTATE_65', 'TV', 'install_rotate', '65', 'Rotating Wall Mount Stand (65")'),

-- Uninstallation
('TV_UNINSTALL_24_43', 'TV', 'uninstall', '24-43', 'TV Uninstallation (below 46")'),
('TV_UNINSTALL_46_55', 'TV', 'uninstall', '46-55', 'TV Uninstallation (46" to 55")'),
('TV_UNINSTALL_65', 'TV', 'uninstall', '65', 'TV Uninstallation (65")'),
('TV_UNINSTALL_75_85', 'TV', 'uninstall', '75-85', 'TV Uninstallation (75" to 85")')
ON CONFLICT (service_code) DO NOTHING;

-- ============================================================================
-- TV REPAIR
-- ============================================================================

INSERT INTO public.pricing_service_catalog (service_code, category, subcategory, size_band, description) VALUES
-- Backlight
('TV_REPAIR_BACKLIGHT_24_32', 'TV', 'repair_backlight', '24-32', 'Backlight Set Replacement (24" to 32")'),
('TV_REPAIR_BACKLIGHT_40_43', 'TV', 'repair_backlight', '40-43', 'Backlight Set Replacement (40" to 43")'),
('TV_REPAIR_BACKLIGHT_46_55', 'TV', 'repair_backlight', '46-55', 'Backlight Set Replacement (46" to 55")'),
('TV_REPAIR_BACKLIGHT_65_75', 'TV', 'repair_backlight', '65-75', 'Backlight Set Replacement (65" to 75")'),

-- Motherboard
('TV_REPAIR_MOBO_24_32', 'TV', 'repair_motherboard', '24-32', 'Motherboard Repair (24" to 32")'),
('TV_REPAIR_MOBO_40_43', 'TV', 'repair_motherboard', '40-43', 'Motherboard Repair (40" to 43")'),
('TV_REPAIR_MOBO_46_55', 'TV', 'repair_motherboard', '46-55', 'Motherboard Repair (46" to 55")'),
('TV_REPAIR_MOBO_65_75', 'TV', 'repair_motherboard', '65-75', 'Motherboard Repair (65" to 75")'),

-- Panel
('TV_REPAIR_PANEL_24_32', 'TV', 'repair_panel', '24-32', 'Panel Repair (24" to 32")'),
('TV_REPAIR_PANEL_40_43', 'TV', 'repair_panel', '40-43', 'Panel Repair (40" to 43")'),
('TV_REPAIR_PANEL_46_55', 'TV', 'repair_panel', '46-55', 'Panel Repair (46" to 55")'),
('TV_REPAIR_PANEL_65_75', 'TV', 'repair_panel', '65-75', 'Panel Repair (65" to 75")'),

-- Power Supply
('TV_REPAIR_PSU_24_32', 'TV', 'repair_psu', '24-32', 'Power Supply Board Repair (24" to 32")'),
('TV_REPAIR_PSU_40_43', 'TV', 'repair_psu', '40-43', 'Power Supply Board Repair (40" to 43")'),
('TV_REPAIR_PSU_46_55', 'TV', 'repair_psu', '46-55', 'Power Supply Board Repair (46" to 55")'),
('TV_REPAIR_PSU_65_75', 'TV', 'repair_psu', '65-75', 'Power Supply Board Repair (65" to 75")'),

-- T-Con
('TV_REPAIR_TCON_32_43', 'TV', 'repair_tcon', '32-43', 'T-Con Repair (32" to 43")'),
('TV_REPAIR_TCON_46_55', 'TV', 'repair_tcon', '46-55', 'T-Con Repair (46" to 55")'),
('TV_REPAIR_TCON_65_75', 'TV', 'repair_tcon', '65-75', 'T-Con Repair (65" to 75")')
ON CONFLICT (service_code) DO NOTHING;

-- ============================================================================
-- MICROWAVE
-- ============================================================================

INSERT INTO public.pricing_service_catalog (service_code, category, subcategory, description) VALUES
-- Power Unit
('MW_POWER_PCB_NEW', 'MW', 'power', 'PCB Replacement (New)'),
('MW_POWER_PCB_REPAIR', 'MW', 'power', 'PCB Repair'),
('MW_POWER_KEYPAD', 'MW', 'power', 'Keypad/Touchpad Repair'),
('MW_POWER_CORD', 'MW', 'power', 'Power Cord Replacement'),

-- No Heating
('MW_HEATING_CAPACITOR', 'MW', 'heating', 'HV Capacitor Replacement'),
('MW_HEATING_MAGNETRON', 'MW', 'heating', 'Magnetron Replacement'),
('MW_HEATING_TRANSFORMER', 'MW', 'heating', 'HV Transformer Replacement'),
('MW_HEATING_DIODE', 'MW', 'heating', 'HV Diode Replacement'),
('MW_HEATING_HEATER_CONV', 'MW', 'heating', 'Convection Heater Replacement'),
('MW_HEATING_HEATER_GRILL', 'MW', 'heating', 'Grill Heater Replacement'),

-- Noise
('MW_NOISE_TURNTABLE', 'MW', 'noise', 'Turn Table Motor Replacement'),
('MW_NOISE_FAN', 'MW', 'noise', 'Fan Motor Replacement'),

-- Accessories
('MW_ACCESS_GLASS', 'MW', 'accessories', 'Glass Turn Table Replacement'),
('MW_ACCESS_MICA', 'MW', 'accessories', 'Mica Sheet Replacement'),
('MW_ACCESS_COUPLER', 'MW', 'accessories', 'Coupler Replacement')
ON CONFLICT (service_code) DO NOTHING;

-- ============================================================================
-- LAPTOP BATTERY
-- ============================================================================

INSERT INTO public.pricing_service_catalog (service_code, category, subcategory, model_band, description) VALUES
-- Compatible Batteries
('LAPTOP_BATTERY_COMPAT_STD', 'LAPTOP', 'battery', 'standard', 'Compatible Battery - Standard Laptop'),
('LAPTOP_BATTERY_COMPAT_GAMING', 'LAPTOP', 'battery', 'gaming', 'Compatible Battery - Gaming Laptop'),
('LAPTOP_BATTERY_COMPAT_PREMIUM', 'LAPTOP', 'battery', 'premium', 'Compatible Battery - Premium Laptop (XPS/Spectre/ThinkPad)'),

-- OEM Batteries
('LAPTOP_BATTERY_OEM_STD', 'LAPTOP', 'battery_oem', 'standard', 'OEM Battery - Standard Laptop'),
('LAPTOP_BATTERY_OEM_GAMING', 'LAPTOP', 'battery_oem', 'gaming', 'OEM Battery - Gaming Laptop'),
('LAPTOP_BATTERY_OEM_PREMIUM', 'LAPTOP', 'battery_oem', 'premium', 'OEM Battery - Premium Laptop')
ON CONFLICT (service_code) DO NOTHING;

-- ============================================================================
-- LAPTOP DISPLAY
-- ============================================================================

INSERT INTO public.pricing_service_catalog (service_code, category, subcategory, size_band, description) VALUES
('LAPTOP_DISPLAY_14_LCD', 'LAPTOP', 'display', '14', 'Display LCD Replacement (14")'),
('LAPTOP_DISPLAY_14_LED', 'LAPTOP', 'display', '14', 'Display LED Replacement (14")'),
('LAPTOP_DISPLAY_15_LED', 'LAPTOP', 'display', '15.6', 'Display LED Replacement (15.6")'),
('LAPTOP_DISPLAY_17_LED', 'LAPTOP', 'display', '17.3', 'Display LED Replacement (17.3")'),
('LAPTOP_DISPLAY_IPS', 'LAPTOP', 'display_ips', NULL, 'IPS Screen Replacement'),
('LAPTOP_DISPLAY_TOUCH', 'LAPTOP', 'display_touch', NULL, 'Touch Screen Replacement')
ON CONFLICT (service_code) DO NOTHING;

-- ============================================================================
-- LAPTOP MOTHERBOARD
-- ============================================================================

INSERT INTO public.pricing_service_catalog (service_code, category, subcategory, model_band, description) VALUES
('LAPTOP_MOBO_REPAIR_STD', 'LAPTOP', 'motherboard', 'standard', 'Motherboard Repair - Standard Laptop'),
('LAPTOP_MOBO_REPAIR_GAMING', 'LAPTOP', 'motherboard', 'gaming', 'Motherboard Repair - Gaming Laptop'),
('LAPTOP_MOBO_CORROSION_STD', 'LAPTOP', 'motherboard_corrosion', 'standard', 'Shorting/Corrosion Repair - Standard'),
('LAPTOP_MOBO_CORROSION_GAMING', 'LAPTOP', 'motherboard_corrosion', 'gaming', 'Shorting/Corrosion Repair - Gaming'),
('LAPTOP_MOBO_IO_STD', 'LAPTOP', 'motherboard_io', 'standard', 'Controller/IO Repair - Standard'),
('LAPTOP_MOBO_IO_GAMING', 'LAPTOP', 'motherboard_io', 'gaming', 'Controller/IO Repair - Gaming')
ON CONFLICT (service_code) DO NOTHING;

-- ============================================================================
-- LAPTOP ADAPTOR
-- ============================================================================

INSERT INTO public.pricing_service_catalog (service_code, category, subcategory, description) VALUES
('LAPTOP_ADAPTOR_COMPAT_45W', 'LAPTOP', 'adaptor', 'Compatible Adaptor 45W'),
('LAPTOP_ADAPTOR_COMPAT_65W', 'LAPTOP', 'adaptor', 'Compatible Adaptor 65W'),
('LAPTOP_ADAPTOR_COMPAT_90W', 'LAPTOP', 'adaptor', 'Compatible Adaptor 90W'),
('LAPTOP_ADAPTOR_OEM_45W', 'LAPTOP', 'adaptor_oem', 'OEM Adaptor 45W'),
('LAPTOP_ADAPTOR_OEM_65W', 'LAPTOP', 'adaptor_oem', 'OEM Adaptor 65W'),
('LAPTOP_ADAPTOR_OEM_90W', 'LAPTOP', 'adaptor_oem', 'OEM Adaptor 90W')
ON CONFLICT (service_code) DO NOTHING;

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.pricing_service_catalog;
  RAISE NOTICE 'C21 Service Taxonomy: % service codes loaded.', v_count;
END $$;
