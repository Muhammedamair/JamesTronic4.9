# C20: ExpansionOS

## Overview

**Module:** ExpansionOS - AI-Driven Expansion Planning
**Status:** In Development (Phase 1)
**Feature Flag:** `expansion_os_v1`
**Branch:** `feat/c20-expansion-os`

---

## Purpose

ExpansionOS enables data-driven decisions for opening new JamesTronic service locations through:

1. **Geo Intelligence** - City/pincode mapping with PostGIS
2. **Demand Heatmaps** - Ticket density visualization by area
3. **Travel Time Modeling** - Cached travel matrices from transporter telemetry
4. **Scenario Simulation** - Score candidate locations with customizable weights
5. **Coverage Planning** - Service area allocation and workload projection

---

## Governance

> **AI Proposes → Humans Approve**

- No auto-execution of store launches
- No auto-pricing changes
- All outputs require explicit Manager/Admin approval
- Every scenario run is audited

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Manager Portal                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ City Map │  │ Heatmap  │  │ Scenario │  │ Rankings │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
└───────┼─────────────┼─────────────┼─────────────┼──────────┘
        │             │             │             │
        ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                               │
│  /expansion/cities  /expansion/heatmap  /expansion/scenarios │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Compute Jobs                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │ Demand Points  │  │ Travel Matrix  │  │ Scenario Run   │ │
│  │   (Nightly)    │  │   (Nightly)    │  │  (On-Demand)   │ │
│  └────────────────┘  └────────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database                                │
│  cities | geo_pincodes | demand_points_daily | travel_matrix │
│  expansion_scenarios | location_scores | service_allocations │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Tables

### Core Geo (Phase 1)
- `cities` - City boundaries and metadata
- `geo_pincodes` - Pincode polygons within cities
- `competitor_locations` - Known competitor service points
- `expansion_candidate_locations` - Potential new locations

### Derived Layers (Phase 2)
- `demand_points_daily` - Aggregated ticket demand by pincode/day
- `travel_time_matrix_cache` - Cached travel times between pincodes
- `expansion_scenarios` - User-created scoring scenarios
- `expansion_location_scores` - Scores per candidate per scenario
- `service_area_allocations` - Pincode-to-location assignments
- `workload_capacity_snapshots` - Utilization projections

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/expansion/cities` | Manager+ | List cities with geo summary |
| GET | `/api/expansion/heatmap` | Manager+ | Demand heatmap for city |
| POST | `/api/expansion/scenarios` | Manager+ | Create scenario |
| POST | `/api/expansion/scenarios/:id/run` | Manager+ | Run scenario (async) |
| GET | `/api/expansion/scenarios/:id/results` | Manager+ | Get results + explanations |

---

## KPIs & Alerts

| Metric | Target |
|--------|--------|
| Coverage SLA | ≥ 80% |
| Store Utilization | 70-85% |

| Alert | Trigger |
|-------|---------|
| Overload | Utilization > 95% for 2 days |
| Coverage Drop | SLA < target for 3 days |

---

## Related Documentation

- [Implementation Plan](file:///Users/mohammedamair/.gemini/antigravity/brain/611b0fbb-5fd6-41b4-bbf8-773d3e8cd7c0/implementation_plan.md)
- [C19 Inventory Prediction](./C19_PHASE5_STAGING_EVIDENCE.md)
- [Backend Overview](./full-backend-overview.md)
