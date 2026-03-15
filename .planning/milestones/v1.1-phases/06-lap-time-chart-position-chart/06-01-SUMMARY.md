---
phase: 06-lap-time-chart-position-chart
plan: "01"
subsystem: ui
tags: [react, plotly, vitest, zustand, scattergl, regression, lap-time-chart, driver-toggle]

# Dependency graph
requires:
  - phase: 05-dashboard-layout-stint-timeline
    provides: Three-memo hook pattern, pure-function export for TDD, useSessionStore shape, plotlyShapes utilities, Dashboard layout with analysis section

provides:
  - useVisibleDrivers hook with computeDefaultVisible pure function
  - DriverToggle team-grouped checkbox panel component
  - useLapTimeData hook with linearRegression, isOutlierLap, buildLapTimeTraces, computeAllTrendLines, buildSCShapes
  - LapTimeChart Plotly scattergl chart component
  - Dashboard wiring: DriverToggle + LapTimeChart in analysis section

affects: [06-02-position-chart, future-chart-phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-memo split: allData/[laps,drivers,sc] + traces/[currentLap,visible] + cursor/[currentLap]"
    - "Pure exported functions for testability without React mocking"
    - "Per-point opacity array for outlier visualization (0.3 dim / 1.0 normal)"
    - "Two-point trend line from regression slope/intercept"

key-files:
  created:
    - frontend/src/components/DriverToggle/useVisibleDrivers.ts
    - frontend/src/components/DriverToggle/useVisibleDrivers.test.ts
    - frontend/src/components/DriverToggle/DriverToggle.tsx
    - frontend/src/components/LapTimeChart/useLapTimeData.ts
    - frontend/src/components/LapTimeChart/useLapTimeData.test.ts
    - frontend/src/components/LapTimeChart/LapTimeChart.tsx
  modified:
    - frontend/src/components/Dashboard/Dashboard.tsx

key-decisions:
  - "Use scattergl (WebGL) for lap time scatter traces — 20 drivers x 60+ laps = 1200+ points, WebGL required for smooth rendering"
  - "Per-point opacity array on scatter markers instead of separate traces for outliers — single trace per driver, simpler hover/legend handling"
  - "Trend lines drawn as 2-point lines (start-to-currentLap) rather than full polylines — regression gives linear approximation per stint"
  - "useEffect guard skips reset when visibleDrivers non-empty and laps.length unchanged from 0 — prevents unwanted resets during replay"
  - "makeLap test helper uses 'LapTime' in overrides check (not ??) to allow explicit null — ?? operator swallows null to default"

patterns-established:
  - "makeLap test helpers: use 'key' in overrides for fields that may be explicitly null (not ?? default)"
  - "DriverToggle: shared visible-drivers infrastructure for all Phase 6+ multi-driver charts"

requirements-completed: [ENHANCE-03, STRAT-02, STRAT-03, ENHANCE-02]

# Metrics
duration: 4min
completed: 2026-03-14
---

# Phase 06 Plan 01: DriverToggle + LapTimeChart Summary

**Lap time scatter chart with per-point outlier dimming, per-stint linear trend lines, SC shading, and team-grouped driver visibility toggle wired into Dashboard analysis section**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-14T12:05:33Z
- **Completed:** 2026-03-14T12:09:05Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- linearRegression pure function with least-squares computation, tested against known data
- isOutlierLap classifies pit-in, pit-out, lap 1, and SC/VSC/RED periods as outliers
- buildLapTimeTraces returns scattergl traces with per-point opacity array (0.3 dim / 1.0 clean)
- computeAllTrendLines computes per-driver-stint regression from clean laps only, clamps to currentLap
- buildSCShapes produces colored rect shapes with progressive reveal (matches GapChart pattern)
- computeDefaultVisible selects top 2 drivers by lap 1 position as default visibility
- DriverToggle renders team-grouped checkboxes with driver team colors
- LapTimeChart renders Plotly scattergl chart with dark theme, SC shading, trend lines, replay cursor
- Dashboard updated: StintTimeline -> DriverToggle -> LapTimeChart in analysis section
- All 78 tests pass, TypeScript compiles without errors

## Task Commits

Each task was committed atomically:

1. **Task 1: DriverToggle hook/component and useLapTimeData hook with tests** - `7f10049` (feat)
2. **Task 2: LapTimeChart component and Dashboard wiring** - `f78a8ae` (feat)

**Plan metadata:** (docs commit — see below)

_Note: Task 1 was TDD — tests written first, implementation second, all green in single commit._

## Files Created/Modified

- `frontend/src/components/DriverToggle/useVisibleDrivers.ts` - Hook + computeDefaultVisible pure function
- `frontend/src/components/DriverToggle/useVisibleDrivers.test.ts` - Tests for computeDefaultVisible
- `frontend/src/components/DriverToggle/DriverToggle.tsx` - Team-grouped checkbox panel component
- `frontend/src/components/LapTimeChart/useLapTimeData.ts` - Hook + linearRegression, isOutlierLap, buildLapTimeTraces, computeAllTrendLines, buildSCShapes
- `frontend/src/components/LapTimeChart/useLapTimeData.test.ts` - Tests for all pure functions
- `frontend/src/components/LapTimeChart/LapTimeChart.tsx` - Plotly scattergl chart component
- `frontend/src/components/Dashboard/Dashboard.tsx` - Added DriverToggle + LapTimeChart wiring

## Decisions Made

- Used `scattergl` (WebGL) for scatter traces — 20 drivers x 60+ laps requires WebGL for performance
- Per-point opacity array on scatter marker rather than separate outlier traces — cleaner API, single trace per driver
- Trend lines as 2-point lines (regression start-to-end) not full polylines — linear approximation is the goal
- useEffect guard: only reset visibleDrivers when transitioning from empty to populated laps — prevents replay scrub resets
- makeLap test helper uses `'LapTime' in overrides` instead of `??` — explicit null must be preserved, not defaulted

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed makeLap test helper null coercion**
- **Found during:** Task 1 (TDD GREEN verification)
- **Issue:** `LapTime: overrides.LapTime ?? 90.0` coerces explicit `null` to `90.0` via `??` operator — test for "skips null LapTime" was passing null but getting 90.0
- **Fix:** Changed to `'LapTime' in overrides ? overrides.LapTime : 90.0` to preserve explicit null
- **Files modified:** `frontend/src/components/LapTimeChart/useLapTimeData.test.ts`
- **Verification:** Test now correctly fails when LapTime is null, buildLapTimeTraces filters it out
- **Committed in:** `7f10049` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug in test helper null coercion)
**Impact on plan:** Single minor fix in test helper. No scope creep.

## Issues Encountered

None beyond the null coercion bug documented above.

## Next Phase Readiness

- DriverToggle is shared infrastructure — Phase 06-02 position chart will reuse `visibleDrivers` prop pattern
- useLapTimeData three-memo split pattern established for Phase 06-02 usePositionData hook
- All 78 tests green, TypeScript clean — ready for Phase 06-02 immediately

---
*Phase: 06-lap-time-chart-position-chart*
*Completed: 2026-03-14*
