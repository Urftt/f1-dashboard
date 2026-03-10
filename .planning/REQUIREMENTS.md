# Requirements: F1 Dashboard

**Defined:** 2026-03-10
**Core Value:** Make race progression easy to read at a glance through reliable, replay-synced timing and tyre context.

## v1 Requirements

### Replay

- [x] **REPL-01**: User can load a historical race session for replay.
- [x] **REPL-02**: User can start replay from race start and have dashboard state advance over time.
- [x] **REPL-03**: User can pause and resume replay without losing the current replay position.
- [ ] **REPL-04**: User can change replay speed while a replay is running.
- [ ] **REPL-05**: User can scrub or jump to a different replay position.

### Comparison

- [ ] **COMP-01**: User can choose two drivers to compare in the dashboard.
- [ ] **COMP-02**: User can view a gap graph that updates over replay time for the selected drivers.
- [ ] **COMP-03**: User can see whether the gap between the selected drivers is increasing or decreasing from the graph.

### Race Stats

- [ ] **STAT-01**: User can view the latest completed lap time for each selected driver at the current replay position.
- [x] **STAT-02**: User can view the current tyre compound for each selected driver at the current replay position.
- [x] **STAT-03**: User can view the current tyre age for each selected driver at the current replay position.
- [ ] **STAT-04**: User can see the race statistics update as replay time advances.

### Reliability

- [ ] **RELY-01**: User can load a supported session and reach a working dashboard flow without app-breaking errors.
- [ ] **RELY-02**: The app handles missing or incomplete session fields with clear fallback messaging instead of crashing.
- [x] **RELY-03**: Core replay and KPI calculations are covered by automated tests.

## v2 Requirements

### Strategy

- **STRA-01**: User can compare stint strategy across multiple drivers.
- **STRA-02**: User can see likely pit windows or stint-context overlays.
- **STRA-03**: User can see tyre degradation trends beyond raw tyre age.

### Detailed Analysis

- **DETL-01**: User can compare sector-by-sector performance between drivers.
- **DETL-02**: User can view race control or weather context alongside replay.

### Live Mode

- **LIVE-01**: User can run the dashboard against near-live race data when a reliable source is available.

## Out of Scope

| Feature | Reason |
|---------|--------|
| True broadcast-grade live timing | Not required for v1.0 and constrained by data availability |
| Predictive race models | Adds complexity before core replay experience is proven |
| Multi-driver strategy workspace | Valuable later, but the milestone is centered on two-driver comparison and core KPIs |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REPL-01 | Phase 1 | Complete |
| REPL-02 | Phase 2 | Complete |
| REPL-03 | Phase 2 | Complete |
| REPL-04 | Phase 2 | Pending |
| REPL-05 | Phase 2 | Pending |
| COMP-01 | Phase 3 | Pending |
| COMP-02 | Phase 3 | Pending |
| COMP-03 | Phase 3 | Pending |
| STAT-01 | Phase 3 | Pending |
| STAT-02 | Phase 1 | Complete |
| STAT-03 | Phase 1 | Complete |
| STAT-04 | Phase 3 | Pending |
| RELY-01 | Phase 4 | Pending |
| RELY-02 | Phase 4 | Pending |
| RELY-03 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after completing Phase 1 Plan 03*
