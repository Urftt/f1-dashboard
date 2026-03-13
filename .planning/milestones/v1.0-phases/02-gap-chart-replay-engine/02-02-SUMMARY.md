---
phase: 02-gap-chart-replay-engine
plan: 02
subsystem: ui
tags: [react, plotly, react-plotly.js, zustand, typescript, gap-chart, driver-selector, base-ui]

# Dependency graph
requires:
  - phase: 02-gap-chart-replay-engine
    plan: 01
    provides: useGapData hook with segments array, useDriverList hook, sessionStore selectedDrivers/currentLap, driverColors.ts

provides:
  - GapChart.tsx: Plotly scatter with dark theme, dynamic team-color segments, zero-line, hover tooltip, vertical dashed replay cursor
  - DriverSelector.tsx: Two side-by-side team-grouped Select dropdowns wired to sessionStore

affects:
  - 02-03-PLAN.md (if separate replay controls plan)
  - 02-04-PLAN.md (dashboard integration consuming GapChart + DriverSelector)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Declarative Plotly: use <Plot data={} layout={} /> never Plotly.react() or Plotly.newPlot()"
    - "yref paper on cursor shape — spans full chart height independent of y-axis data range"
    - "base-ui Select onValueChange null guard before passing to typed Zustand store action"

key-files:
  created:
    - frontend/src/components/GapChart/GapChart.tsx
    - frontend/src/components/GapChart/DriverSelector.tsx
  modified: []

key-decisions:
  - "Plotly dark theme via template: plotly_dark with transparent paper/plot bg — zero custom CSS needed"
  - "Replay cursor uses yref: paper so line spans full chart height regardless of gap data range"
  - "DriverSelector passes value ?? undefined to Select (not null) to satisfy base-ui value prop type"

patterns-established:
  - "Gap chart cursor: always use yref paper for vertical line shapes spanning full height"
  - "Driver dropdowns: null guard in onValueChange handler, not in store action"

requirements-completed: [GAP-02, GAP-03, REPL-04]

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 2 Plan 02: Gap Chart UI Summary

**Plotly scatter chart with plotly_dark theme, dynamic team-color segments, zero-line, dashed replay cursor, and dual team-grouped driver Select dropdowns wired to Zustand store**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-13T13:02:07Z
- **Completed:** 2026-03-13T13:03:31Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created GapChart.tsx rendering Plotly scatter with plotly_dark template, transparent backgrounds, zero-line reference, and a vertical dashed cursor line at `currentLap` using `yref: 'paper'`
- Created DriverSelector.tsx with two side-by-side Select dropdowns grouped by team, items showing "ABB — Full Name", selected value showing abbreviation only, null guards on `onValueChange`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GapChart component with Plotly** - `dd0bbfd` (feat)
2. **Task 2: Create DriverSelector component with team-grouped dropdowns** - `a5755fc` (feat)

## Files Created/Modified

- `frontend/src/components/GapChart/GapChart.tsx` - Plotly scatter chart component with dark theme, dynamic segments, hover tooltip, and replay cursor
- `frontend/src/components/GapChart/DriverSelector.tsx` - Dual team-grouped driver Select dropdowns

## Decisions Made

- Used `template: 'plotly_dark'` with `paper_bgcolor: 'transparent'` and `plot_bgcolor: 'transparent'` — chart inherits dashboard dark theme with no custom CSS overrides needed
- Cursor shape uses `yref: 'paper'` so the vertical dashed line always spans the full chart height, not just the current y-axis data range
- Passed `value ?? undefined` to the base-ui Select `value` prop rather than `null` — base-ui's controlled value prop is typed as `string | undefined`, not `string | null`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- GapChart and DriverSelector are ready for dashboard integration in Plan 02-03 or 02-04
- Both components read from and write to sessionStore correctly
- TypeScript compiles clean with no errors

---
*Phase: 02-gap-chart-replay-engine*
*Completed: 2026-03-13*

## Self-Check: PASSED

- frontend/src/components/GapChart/GapChart.tsx: FOUND
- frontend/src/components/GapChart/DriverSelector.tsx: FOUND
- .planning/phases/02-gap-chart-replay-engine/02-02-SUMMARY.md: FOUND
- Commit dd0bbfd: FOUND
- Commit a5755fc: FOUND
