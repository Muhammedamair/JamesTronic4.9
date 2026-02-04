-- ============================================================================
-- C20 ExpansionOS - Phase 4.1: Store Geo Integrity Gate
-- JamesTronic Platform
-- ============================================================================
-- Purpose:
-- Ensure inventory_locations has canonical geo columns (city_id, location)
-- to support correct travel matrix computation and mapping.
-- ============================================================================
-- Job ID: C20_PHASE4_GEO_INTEGRITY
-- Priority: P0 (Correctness)
-- ============================================================================

DO $$
BEGIN
    -- 1. Add city_id (Link to cities table)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='inventory_locations' AND column_name='city_id'
    ) THEN
        ALTER TABLE public.inventory_locations
        ADD COLUMN city_id uuid REFERENCES public.cities(id);
        
        RAISE NOTICE 'Added city_id to inventory_locations';
    END IF;

    -- 2. Add location (PostGIS Geography)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='inventory_locations' AND column_name='location'
    ) THEN
        ALTER TABLE public.inventory_locations
        ADD COLUMN location geography(Point, 4326);
        
        CREATE INDEX IF NOT EXISTS idx_inventory_locations_location_gist
        ON public.inventory_locations USING GIST(location);
        
        RAISE NOTICE 'Added location to inventory_locations';
    END IF;
END $$;

-- 3. Attempt Backfill (Best Effort based on City Name)
-- Only for rows where city_id is null AND city name matches a cities row
UPDATE public.inventory_locations l
SET city_id = c.id
FROM public.cities c
WHERE l.city_id IS NULL 
  AND lower(l.city) = lower(c.name);

-- 4. Attempt Backfill Location (Mock for dev/test if address missing)
-- In production, this would use a geocoder. 
-- Here, if location is null and we have a city_id, use city centroid as fallback (or random offset).
UPDATE public.inventory_locations l
SET location = c.centroid
FROM public.cities c
WHERE l.location IS NULL 
  AND l.city_id = c.id; 
