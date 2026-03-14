# Requirements: F1 Dashboard

**Defined:** 2026-03-13
**Core Value:** Users can see the gap between any two drivers plotted over time — the single most missing piece of F1 broadcast data

## v1.1 Requirements

Requirements for v1.1 Strategy & Analysis Dashboard. Each maps to roadmap phases.

### Strategy Charts

- [x] **STRAT-01**: User can view a stint timeline showing all drivers' tire stints as horizontal bars (compound-colored, lap range)
- [x] **STRAT-02**: User can view a lap time chart plotting selected drivers' lap times as a scatter plot across laps
- [x] **STRAT-03**: User can see per-stint trend lines overlaid on the lap time chart to visualize degradation rate

### Race Overview Charts

- [x] **RACE-01**: User can view a position chart showing all drivers' positions over laps (P1 at top)
- [ ] **RACE-02**: User can view an interval history chart showing gap-to-car-ahead over laps with DRS window reference
- [ ] **RACE-03**: User can view a sector comparison heatmap color-coded by relative pace (purple=session best, green=personal best)

### Cross-Chart Enhancements

- [x] **ENHANCE-01**: All charts show a replay cursor (vertical line) synced to the current replay lap
- [x] **ENHANCE-02**: All time-series charts show SC/VSC period shading (reusing existing pattern)
- [x] **ENHANCE-03**: Multi-driver charts have a driver visibility toggle to show/hide individual drivers
- [ ] **ENHANCE-04**: All charts progressively reveal data up to current lap during replay (spoiler-free mode)

### Dashboard Layout

- [x] **LAYOUT-01**: New analysis charts are displayed in a scrollable dashboard below the existing gap chart and standings board

## Future Requirements

### Deferred from v1.1

- **SECTOR-02**: User can view sector comparison for qualifying sessions (different session logic)
- **LAPTIMES-02**: User can view fuel-corrected lap times (data not available via FastF1)

### v2+

- **LIVE-01**: Live data interval history via OpenF1 API
- **TELEM-01**: Telemetry side-by-side drill-down (speed/throttle/brake traces)
- **QUALI-01**: Qualifying analysis views (sector bests, lap time evolution across Q1/Q2/Q3)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Fuel-corrected lap times | Fuel load/burn rate not available via FastF1 — estimates would be misleading |
| Qualifying sector heatmap | Different session structure; race heatmap first |
| Telemetry overlays | Different data model (100ms samples), significant performance risk |
| Real-time chart re-render on replay | Too expensive; cursor overlay is sufficient |
| 3D/animated track position map | FastF1 positional data resolution too low |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STRAT-01 | Phase 5 | Complete |
| STRAT-02 | Phase 6 | Complete |
| STRAT-03 | Phase 6 | Complete |
| RACE-01 | Phase 6 | Complete |
| RACE-02 | Phase 7 | Pending |
| RACE-03 | Phase 8 | Pending |
| ENHANCE-01 | Phase 5 | Complete |
| ENHANCE-02 | Phase 6 | Complete |
| ENHANCE-03 | Phase 6 | Complete |
| ENHANCE-04 | Phase 7 | Pending |
| LAYOUT-01 | Phase 5 | Complete |

**Coverage:**
- v1.1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-13*
*Last updated: 2026-03-13 — traceability populated after roadmap creation*
