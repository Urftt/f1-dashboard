---
phase: 02-gap-chart-replay-engine
plan: 01
subsystem: ui
tags: [react, plotly, zustand, typescript, gap-chart, replay]

# Dependency graph
requires:
  - phase: 01-backend-foundation
    provides: sessionStore with laps data, LapRow type with Time field
provides:
  - Extended Zustand store with selectedDrivers, currentLap, isPlaying, replaySpeed state
  - Auto-selection of P1/P2 grid positions on session load (spoiler-free)
  - driverColors.ts with DRIVER_COLORS, DRIVER_FULL_NAMES, DRIVER_TEAMS, getDriverColor
  - useGapData hook computing gap series from LapRow.Time with dynamic team color segments
  - useDriverList hook returning team-grouped drivers ordered by lap 1 grid position
  - react-plotly.js and plotly.js installed
affects:
  - 02-02-PLAN.md (GapChart component consumes useGapData and segments)
  - 02-03-PLAN.md (DriverSelector uses useDriverList and driverColors)
  - 02-04-PLAN.md (ReplayControls uses isPlaying, replaySpeed, setCurrentLap)

# Tech tracking
tech-stack:
  added: [react-plotly.js@2.6.0, plotly.js, @types/react-plotly.js]
  patterns:
    - useMemo selectors in hooks isolate store reads for performance
    - Segment algorithm overlaps by 1 point at leader-change crossovers to prevent visual gaps
    - Anti-spoiler ordering — all driver lists use lap 1 Position, never final race results

key-files:
  created:
    - frontend/src/lib/driverColors.ts
    - frontend/src/components/GapChart/useGapData.ts
  modified:
    - frontend/src/stores/sessionStore.ts
    - frontend/src/types/session.ts
    - frontend/package.json

key-decisions:
  - "Gap uses LapRow.Time (session elapsed time at lap end) not LapTime (individual lap duration) — avoids cumulative error from safety cars, pit stops"
  - "Segment line coloring: getDriverColor(driverA) when gap >= 0, getDriverColor(driverB) when gap < 0 — shows which driver's color leads on chart"
  - "TDD skipped: no test runner configured in frontend; TypeScript compilation + Plan 04 smoke test is sufficient verification"
  - "--legacy-peer-deps required for react-plotly.js peer dep capping at React 18 (works fine at runtime with React 19)"

patterns-established:
  - "Anti-spoiler: always order/select by lap 1 Position, never by final Position"
  - "Gap sign convention: positive = driverA leading (lower session time), negative = driverB leading"
  - "Segment overlap: each crossover segment includes 1 extra boundary point to prevent visual gaps in Plotly chart"

requirements-completed: [GAP-01, GAP-02]

# Metrics
duration: 8min
completed: 2026-03-13
---

# Phase 2 Plan 01: Data Layer Summary

**Zustand store extended with replay + driver selection state, Plotly installed, gap calculation hook using LapRow.Time with dynamic team color segment splitting**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-13T12:38:01Z
- **Completed:** 2026-03-13T12:46:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Installed react-plotly.js, plotly.js, and TypeScript types with `--legacy-peer-deps` for React 19 compatibility
- Extended sessionStore with selectedDrivers, currentLap, isPlaying, replaySpeed — auto-selecting P1/P2 grid positions on session load (spoiler-free using lap 1 Position, not final results)
- Created driverColors.ts covering 2023-2025 F1 grid with team hex colors, full names, team groupings, and fallback helper
- Created useGapData hook: derives gap from LapRow.Time, segments line by leader with team colors and 1-point crossover overlap
- Created useDriverList hook: team-grouped drivers ordered by lap 1 grid position

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Plotly and extend Zustand store with replay state** - `5b6b955` (feat)
2. **Task 2: Create useGapData hook for gap calculation** - `5245192` (feat)

## Files Created/Modified

- `frontend/package.json` - Added react-plotly.js, plotly.js, @types/react-plotly.js
- `frontend/src/types/session.ts` - Added ReplaySpeed type
- `frontend/src/stores/sessionStore.ts` - Extended with replay state, actions, auto-P1/P2 selection in setLaps
- `frontend/src/lib/driverColors.ts` - DRIVER_COLORS, DRIVER_FULL_NAMES, DRIVER_TEAMS, getDriverColor
- `frontend/src/components/GapChart/useGapData.ts` - useGapData and useDriverList hooks

## Decisions Made

- Gap calculation uses `LapRow.Time` (session elapsed timestamp at lap end), not `LapTime` (individual lap duration). This avoids accumulation errors from safety cars, VSC periods, and pit stop inlaps where LapTime is not comparable.
- Segment coloring: when `gap >= 0` (driverA leading), use `getDriverColor(driverA)`; when `gap < 0`, use `getDriverColor(driverB)`. Each segment overlaps by 1 point at crossover boundaries to prevent visual gaps in the Plotly chart line.
- Skipped TDD test files: plan explicitly notes no test runner is configured and TypeScript + Plan 04 smoke test is sufficient verification for straightforward filter/map/subtract logic.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Phase 2 UI components can now be built against this data layer
- Plan 02-02 (GapChart component) can consume `useGapData` and `segments` directly
- Plan 02-03 (DriverSelector) can use `useDriverList` and `DRIVER_TEAMS`/`DRIVER_FULL_NAMES`
- Plan 02-04 (ReplayControls + Dashboard integration) can access all replay state actions

---
*Phase: 02-gap-chart-replay-engine*
*Completed: 2026-03-13*

## Self-Check: PASSED

- frontend/src/lib/driverColors.ts: FOUND
- frontend/src/components/GapChart/useGapData.ts: FOUND
- frontend/src/stores/sessionStore.ts: FOUND
- Commit 5b6b955: FOUND
- Commit 5245192: FOUND
