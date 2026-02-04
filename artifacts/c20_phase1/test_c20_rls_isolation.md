# C20 Phase 1: RLS Isolation Test Results

**Timestamp:** 2026-01-26T21:54:37.664Z
**Mode:** ci
**Result:** 18/18 tests passed (100%)


## Test Results

| Test | Status | Details |
|------|--------|---------|
| cities: service_role can read all cities | ✅ PASS | - |
| geo_pincodes: service_role can read all cities | ✅ PASS | - |
| competitor_locations: service_role can read all cities | ✅ PASS | - |
| expansion_candidate_locations: service_role can read all cities | ✅ PASS | - |
| PostGIS extension enabled (via _c20_postgis_enabled()) | ✅ PASS | Result: true |
| _c20_app_role() callable | ✅ PASS | Result: service_role |
| _c20_is_city_accessible() callable | ✅ PASS | - |
| Pincode unique(city_id, code) constraint enforced | ✅ PASS | - |
| cities: Manager A cannot see City B rows | ✅ PASS | Saw 0 City B rows (expected 0) |
| cities: Manager B cannot see City A rows | ✅ PASS | Saw 0 City A rows (expected 0) |
| geo_pincodes: Manager A cannot see City B rows | ✅ PASS | Saw 0 City B rows (expected 0) |
| geo_pincodes: Manager B cannot see City A rows | ✅ PASS | Saw 0 City A rows (expected 0) |
| competitor_locations: Manager A cannot see City B rows | ✅ PASS | Saw 0 City B rows (expected 0) |
| competitor_locations: Manager B cannot see City A rows | ✅ PASS | Saw 0 City A rows (expected 0) |
| expansion_candidate_locations: Manager A cannot see City B rows | ✅ PASS | Saw 0 City B rows (expected 0) |
| expansion_candidate_locations: Manager B cannot see City A rows | ✅ PASS | Saw 0 City A rows (expected 0) |
| Manager A can INSERT in own city (City A) | ✅ PASS | - |
| Manager A cannot INSERT in other city (City B) | ✅ PASS | - |


