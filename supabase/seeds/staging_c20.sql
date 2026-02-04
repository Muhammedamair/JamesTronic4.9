-- === C20 Staging Seed: minimal fixtures ===

-- 1) City
insert into public.cities (id, name, state, active, centroid)
values
('11111111-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'Bengaluru', 'Karnataka', true,
 ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography)
on conflict (id) do update set name=excluded.name;

-- 2) Pincodes (3)
insert into public.geo_pincodes (id, city_id, code, name, centroid)
values
('66666666-1111-4111-1111-111111111111','11111111-aaaa-4aaa-aaaa-aaaaaaaaaaaa','560001','CBD',
 ST_SetSRID(ST_MakePoint(77.5940, 12.9750), 4326)::geography),
('66666666-1111-4111-1111-222222222222','11111111-aaaa-4aaa-aaaa-aaaaaaaaaaaa','560002','South',
 ST_SetSRID(ST_MakePoint(77.5800, 12.9300), 4326)::geography),
('66666666-1111-4111-1111-333333333333','11111111-aaaa-4aaa-aaaa-aaaaaaaaaaaa','560003','East',
 ST_SetSRID(ST_MakePoint(77.6500, 12.9800), 4326)::geography)
on conflict (id) do nothing;

-- 3) Store origin (inventory_locations)
-- NOTE: Adjusted to match inferred schema if needed, but using User provided columns for now.
-- If schema differs, this might fail, but it's the specific instruction.
insert into public.inventory_locations (id, name, city, active, city_id, location)
values
('aaaaaaaa-0000-4000-8000-000000000001','Hub-1','Bengaluru', true,
 '11111111-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
 ST_SetSRID(ST_MakePoint(77.6000, 12.9700), 4326)::geography)
on conflict (id) do update set city_id=excluded.city_id, location=excluded.location, active=true;

-- 4) Candidates (2)
insert into public.expansion_candidate_locations (id, city_id, name, location, status)
values
('bbbbbbbb-0000-4000-8000-000000000001','11111111-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Candidate-1',
 ST_SetSRID(ST_MakePoint(77.6100, 12.9650), 4326)::geography, 'identified'),
('bbbbbbbb-0000-4000-8000-000000000002','11111111-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Candidate-2',
 ST_SetSRID(ST_MakePoint(77.5850, 12.9400), 4326)::geography, 'identified')
on conflict (id) do nothing;

-- 5) Scenario
insert into public.expansion_scenarios (id, city_id, name, weights, created_at)
values
('cccccccc-0000-4000-8000-000000000001','11111111-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Bangalore V1',
 '{"demand_density":0.4,"competitor_distance":0.2,"travel_time":0.3,"rent_cost":0.1}'::jsonb,
 now())
on conflict (id) do nothing;

-- 6) Pending Run
insert into public.expansion_scenario_runs (id, scenario_id, city_id, status, created_at)
values
('dddddddd-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001',
 '11111111-aaaa-4aaa-aaaa-aaaaaaaaaaaa','pending', now())
on conflict (id) do nothing;
