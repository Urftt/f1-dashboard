---
phase: 07-interval-history
plan: 01
subsystem: ui
tags: [react, plotly, scattergl, zustand, vitest, tdd, f1, interval, drs]

# Dependency graph
requires:
  - phase: 06-lap-time-position-chart
    provides: PositionChart hover pattern, usePositionData blueprint, buildSCShapes pattern, DriverToggle visibleDrivers prop
  - phase: 05-dashboard-layout-stint-timeline
    provides: three-memo useMemo split pattern, pure-function hook exports for testability

provides:
  - IntervalHistory Plotly chart showing gap-to-car-ahead per driver across laps
  - buildTimeLookup, buildIntervalTraces, buildDRSShapes, buildSCShapes, buildEndOfLineAnnotations pure functions
  - useIntervalData React hook with three-memo split
  - Dashboard card wired after PositionChart

affects:
  - 07-interval-history (further plans if any)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two traces per driver (normal + dim) for pit/lap1 distinction via opacity
    - buildTimeLookup: Map<lapNumber, Map<position, time>> for O(1) car-ahead lookup
    - Hover highlighting by driver name (strips _dim suffix) — handles two-trace-per-driver pattern
    - DRS zone: paper-width rect (y0=0, y1=1.0) + dashed line at y=1.0 using yref=y

key-files:
  created:
    - frontend/src/components/IntervalHistory/useIntervalData.ts
    - frontend/src/components/IntervalHistory/useIntervalData.test.ts
    - frontend/src/components/IntervalHistory/IntervalHistory.tsx
  modified:
    - frontend/src/components/Dashboard/Dashboard.tsx

key-decisions:
  - "buildTimeLookup returns Map<lapNumber, Map<position, time>> enabling O(1) car-ahead lookup per lap"
  - "Two traces per driver (normal + dim) for pit laps and lap 1 — consistent with interval distortion at pit stops"
  - "buildSCShapes duplicated in useIntervalData (not imported from usePositionData) — keeps hook self-contained per Phase 6 pattern"
  - "Hover identification uses trace name field (strips _dim suffix) rather than index — handles two-trace-per-driver pairing"
  - "rangemode tozero on y-axis ensures DRS reference line at 1.0s always visible even with large gaps"

patterns-established:
  - "buildTimeLookup pattern: derive position-time lookup from laps array for interval computation"
  - "Two-trace pattern: normal trace + dim trace per driver for styled subsets within a driver's data"

requirements-completed: [RACE-02, ENHANCE-04]

# Metrics
duration: 3min
completed: 2026-03-14
---

# Phase 7 Plan 1: Interval History Summary

**Plotly gap-to-car-ahead chart with DRS zone (1.0s), progressive reveal, dim traces for pit/lap1, and hover highlighting — wired into Dashboard after PositionChart**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-14T12:59:19Z
- **Completed:** 2026-03-14T13:02:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- TDD implementation of 5 pure exported functions in `useIntervalData.ts` with 40 passing unit tests
- IntervalHistory component rendering gap-to-car-ahead with DRS zone, hover highlighting, and end-of-line labels
- Dashboard wired with IntervalHistory card after PositionChart in the Strategy & Analysis section

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure functions and unit tests (TDD)** - `46e6116` (feat)
2. **Task 2: IntervalHistory component and Dashboard wiring** - `cd99611` (feat)

**Plan metadata:** (to be added in final commit)

_Note: TDD task used RED (failing test) -> GREEN (implementation) -> one test corrected for data accuracy_

## Files Created/Modified

- `frontend/src/components/IntervalHistory/useIntervalData.ts` — Pure computation functions + useIntervalData hook with three-memo split
- `frontend/src/components/IntervalHistory/useIntervalData.test.ts` — 40 unit tests covering all behaviors
- `frontend/src/components/IntervalHistory/IntervalHistory.tsx` — Presentational Plotly chart with hover highlighting
- `frontend/src/components/Dashboard/Dashboard.tsx` — Added IntervalHistory card after PositionChart

## Decisions Made

- `buildTimeLookup` produces `Map<lapNumber, Map<position, time>>` for O(1) car-ahead time lookup
- Two traces per driver (normal + dim): pit laps and lap 1 rendered at 0.3 opacity, all other laps at full opacity
- `buildSCShapes` duplicated from `usePositionData.ts` to keep hooks self-contained (per Phase 6 decision)
- Hover uses trace `name` field to identify driver: strips `_dim` suffix for pairing normal + dim traces
- `rangemode: 'tozero'` on y-axis ensures the DRS 1.0s line always stays visible

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected test expectation for buildEndOfLineAnnotations annotation count**
- **Found during:** Task 1 (TDD GREEN verification)
- **Issue:** Test expected 2 annotations (assuming VER always P1) but VER is P2 on lap 3, giving all 3 drivers a valid annotation at currentLap=5
- **Fix:** Updated test assertion from `toBe(2)` to `toBe(3)` with accurate comment
- **Files modified:** `useIntervalData.test.ts`
- **Verification:** All 40 tests pass after fix

---

**Total deviations:** 1 auto-fixed (1 test data accuracy fix)
**Impact on plan:** No scope change, test data was simply more complex than the comment suggested.

## Issues Encountered

None — plan executed cleanly following PositionChart blueprint patterns.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- IntervalHistory chart ready in Dashboard for all sessions with position + time data
- The `buildTimeLookup` pattern is available as a blueprint for any future interval-derived computations
- Ready for Phase 07-02 if one exists, or Phase 08

---
*Phase: 07-interval-history*
*Completed: 2026-03-14*
