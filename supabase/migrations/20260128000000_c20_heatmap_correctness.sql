-- C20: Heatmap Correctness Patch

-- A1) Quarantine known-wrong pincode in BLR (staging dirty row)
UPDATE public.geo_pincodes
SET active = false,
    metadata = COALESCE(metadata,'{}'::jsonb) ||
      jsonb_build_object('quarantined_at', now(), 'reason', 'invalid_pincode_for_city')
WHERE city_id = '11111111-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
  AND code = '900001';

-- A2) Create canonical view with real lat/lng from centroid (no JS parsing, no 0,0)
CREATE OR REPLACE VIEW public.c20_heatmap_points_v1 AS
SELECT
  dp.city_id,
  dp.day,
  gp.code AS pincode,
  ST_Y(gp.centroid::geometry) AS lat,
  ST_X(gp.centroid::geometry) AS lng,
  dp.device_category AS category,
  dp.ticket_count AS weight
FROM public.demand_points_daily dp
JOIN public.geo_pincodes gp
  ON gp.id = dp.pincode_id
 AND gp.city_id = dp.city_id
WHERE gp.active = true
  AND gp.centroid IS NOT NULL;

GRANT SELECT ON public.c20_heatmap_points_v1 TO authenticated;
