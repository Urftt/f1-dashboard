# Roadmap: F1 Race Replay Dashboard

## Milestones

- ✅ **v1.0 F1 Race Replay Dashboard** — Phases 1-4 (shipped 2026-03-13)
- 🚧 **v1.1 Strategy & Analysis Dashboard** — Phases 5-8 (in progress)

## Phases

<details>
<summary>✅ v1.0 F1 Race Replay Dashboard (Phases 1-4) — SHIPPED 2026-03-13</summary>

- [x] Phase 1: Backend Foundation (4/4 plans) — completed 2026-03-13
- [x] Phase 2: Gap Chart + Replay Engine (4/4 plans) — completed 2026-03-13
- [x] Phase 3: Standings Board (2/2 plans) — completed 2026-03-13
- [x] Phase 4: Chart Enhancements (2/2 plans) — completed 2026-03-13

</details>

### 🚧 v1.1 Strategy & Analysis Dashboard (In Progress)

**Milestone Goal:** Add five analysis views to the scrollable dashboard — stint timeline, lap time chart, position chart, sector comparison heatmap, and interval history — giving users deeper strategic insight into race data.

- [x] **Phase 5: Dashboard Layout + Stint Timeline** - Scrollable analysis section and first chart; establishes shared utilities and memoization pattern (completed 2026-03-13)
- [ ] **Phase 6: Lap Time Chart + Position Chart** - Per-driver pace and race order views with driver visibility toggle and SC shading
- [ ] **Phase 7: Interval History** - Gap-to-car-ahead chart showing DRS hunting phases, with spoiler-free progressive reveal
- [ ] **Phase 8: Sector Comparison Heatmap** - New backend endpoint and per-driver per-sector heatmap with delta coloring

## Phase Details

### Phase 5: Dashboard Layout + Stint Timeline
**Goal**: Users can scroll the dashboard to see a tire strategy timeline for all drivers, and the analysis section is in place for subsequent charts
**Depends on**: Phase 4
**Requirements**: LAYOUT-01, STRAT-01, ENHANCE-01
**Success Criteria** (what must be TRUE):
  1. User can scroll below the existing gap chart and standings board to reach a new analysis section
  2. User can view a stint timeline showing all drivers' tire stints as horizontal compound-colored bars spanning their lap range
  3. A vertical replay cursor appears on the stint timeline, synced to the current replay lap
  4. Shared utilities (`lib/compounds.ts`, `lib/plotlyShapes.ts`) exist and are used by the stint timeline — chart data memoizes on `[laps]` only, cursor reads `currentLap` separately
**Plans**: 2 plans
Plans:
- [ ] 05-01-PLAN.md — Vitest setup, shared utilities (compounds, plotlyShapes), and useStintData hook
- [ ] 05-02-PLAN.md — StintTimeline component and Dashboard layout integration with analysis section

### Phase 6: Lap Time Chart + Position Chart
**Goal**: Users can see per-driver lap time trends and race position changes over the full race, with interactive driver filtering and safety car context
**Depends on**: Phase 5
**Requirements**: STRAT-02, STRAT-03, RACE-01, ENHANCE-02, ENHANCE-03
**Success Criteria** (what must be TRUE):
  1. User can view a lap time scatter chart for selected drivers, with pit laps and SC laps excluded so degradation trends are visible
  2. User can see per-stint trend lines overlaid on the lap time chart showing each stint's degradation rate
  3. User can view a position chart showing all 20 drivers' positions over laps with P1 at the top (y-axis inverted)
  4. User can toggle individual drivers on/off in multi-driver charts to reduce visual noise
  5. SC and VSC periods appear as shaded regions on both the lap time chart and position chart
**Plans**: 2 plans
Plans:
- [ ] 06-01-PLAN.md — DriverToggle, useLapTimeData hook with trend lines, and LapTimeChart component
- [ ] 06-02-PLAN.md — usePositionData hook, PositionChart with hover highlighting, and Dashboard wiring

### Phase 7: Interval History
**Goal**: Users can see how close each driver was to the car ahead on every lap, revealing DRS hunting phases and gap management
**Depends on**: Phase 6
**Requirements**: RACE-02, ENHANCE-04
**Success Criteria** (what must be TRUE):
  1. User can view an interval history chart showing each selected driver's gap-to-car-ahead across all laps, with a 1.0s DRS reference line
  2. During replay, the interval history chart only reveals laps up to the current replay lap — no future gaps are shown
  3. The replay cursor appears on the interval history chart synced to the current lap
**Plans**: TBD

### Phase 8: Sector Comparison Heatmap
**Goal**: Users can see a per-driver per-sector time heatmap color-coded by relative pace, with purple marking session bests and green marking personal bests
**Depends on**: Phase 7
**Requirements**: RACE-03
**Success Criteria** (what must be TRUE):
  1. User can view a sector comparison heatmap grid with drivers as rows and laps as columns, split into 3 sectors per lap
  2. Cells are color-coded by delta to session best: purple for session fastest, green for driver's personal best, and gradient for relative pace
  3. Sector data loads lazily when the heatmap component mounts — the main session load is not slowed
  4. Missing sector data (outlaps, SC laps) appears as visually distinct empty cells rather than incorrect values
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Backend Foundation | v1.0 | 4/4 | Complete | 2026-03-13 |
| 2. Gap Chart + Replay Engine | v1.0 | 4/4 | Complete | 2026-03-13 |
| 3. Standings Board | v1.0 | 2/2 | Complete | 2026-03-13 |
| 4. Chart Enhancements | v1.0 | 2/2 | Complete | 2026-03-13 |
| 5. Dashboard Layout + Stint Timeline | 2/2 | Complete   | 2026-03-13 | - |
| 6. Lap Time Chart + Position Chart | v1.1 | 0/2 | Planned | - |
| 7. Interval History | v1.1 | 0/? | Not started | - |
| 8. Sector Comparison Heatmap | v1.1 | 0/? | Not started | - |

_Full v1.0 details archived to `.planning/milestones/v1.0-ROADMAP.md`_
