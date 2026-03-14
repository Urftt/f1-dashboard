---
phase: 06-lap-time-chart-position-chart
plan: 02
subsystem: ui
tags: [react, plotly, scattergl, webgl, typescript, vitest]

# Dependency graph
requires:
  - phase: 06-01
    provides: "DriverToggle, useVisibleDrivers, LapTimeChart, buildSCShapes pattern, three-memo hook pattern"
provides:
  - "usePositionData hook with buildPositionTraces, buildEndOfLineAnnotations, buildSCShapes"
  - "PositionChart component with P1-at-top y-axis and hover highlighting"
  - "Dashboard fully wired with 4 analysis components: StintTimeline, DriverToggle, LapTimeChart, PositionChart"
affects: [phase-07, phase-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "State-based hover highlighting fallback (avoids Plotly.restyle race conditions with react-plotly.js)"
    - "Three-memo split: stable laps grouping / visible chart data / cursor shape"
    - "buildEndOfLineAnnotations: driver abbreviation at last visible lap per driver"

key-files:
  created:
    - frontend/src/components/PositionChart/usePositionData.ts
    - frontend/src/components/PositionChart/usePositionData.test.ts
    - frontend/src/components/PositionChart/PositionChart.tsx
  modified:
    - frontend/src/components/Dashboard/Dashboard.tsx

key-decisions:
  - "Hover highlighting via React state fallback (hoveredTraceIndex) rather than Plotly.restyle — avoids race conditions where react-plotly.js reconciliation overwrites restyle changes"
  - "buildSCShapes duplicated in usePositionData (not imported from useLapTimeData) — keeps each hook self-contained and avoids cross-component coupling"

patterns-established:
  - "State hover pattern: track hoveredTraceIndex in useState, recompute trace opacity/width in render"

requirements-completed: [RACE-01, ENHANCE-02]

# Metrics
duration: 3min
completed: 2026-03-14
---

# Phase 6 Plan 02: Position Chart Summary

**WebGL scattergl position chart showing all toggled drivers' race positions over laps with P1 at top, end-of-line labels, SC shading, hover highlighting via React state fallback, and progressive reveal**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-14T12:11:36Z
- **Completed:** 2026-03-14T12:13:45Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- TDD: 21 new tests covering buildPositionTraces, buildEndOfLineAnnotations, buildSCShapes (99 total, all green)
- PositionChart component with P1-at-top (autorange: 'reversed'), dtick 1, dark theme
- Hover highlighting using React state fallback: hovered driver at full opacity/width 3, others at 0.3 opacity/width 1.5
- Dashboard fully wired with all 4 analysis components in correct order: StintTimeline → DriverToggle → LapTimeChart → PositionChart

## Task Commits

Each task was committed atomically:

1. **Task 1: usePositionData hook with tests** - `297b283` (feat)
2. **Task 2: PositionChart component with hover highlighting and Dashboard wiring** - `ae809b9` (feat)

**Plan metadata:** (docs commit follows)

_Note: Task 1 followed TDD flow (RED → GREEN in single commit due to test + impl created together)_

## Files Created/Modified
- `frontend/src/components/PositionChart/usePositionData.ts` - Pure functions + React hook with three-memo split
- `frontend/src/components/PositionChart/usePositionData.test.ts` - 21 tests for pure functions
- `frontend/src/components/PositionChart/PositionChart.tsx` - Plotly scattergl chart with hover highlighting
- `frontend/src/components/Dashboard/Dashboard.tsx` - Added PositionChart import and card

## Decisions Made
- **Hover state fallback:** Used React `useState(hoveredTraceIndex)` rather than `Plotly.restyle` to avoid race conditions where react-plotly.js reconciliation would overwrite direct DOM mutations. Per plan: "If Plotly.restyle conflicts with react-plotly.js reconciliation (race condition), fall back to storing hoveredDriver in component state."
- **buildSCShapes duplication:** Self-contained in usePositionData rather than imported from useLapTimeData to avoid cross-component coupling. The 60-line block is small and each chart hook owns its shape building.

## Deviations from Plan

None - plan executed exactly as written. Used the state fallback for hover highlighting as permitted by the plan.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 6 complete: DriverToggle, LapTimeChart, and PositionChart all wired into Dashboard
- Phase 7 (Gap Chart or interval analysis) can use the same visibleDrivers prop threading pattern
- Phase 8 can follow the same three-memo hook pattern + scattergl + hover highlighting

## Self-Check: PASSED

All created files exist on disk. All task commits verified in git log.

---
*Phase: 06-lap-time-chart-position-chart*
*Completed: 2026-03-14*
