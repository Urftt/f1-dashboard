---
phase: 03-standings-board
plan: 01
subsystem: ui
tags: [react, typescript, zustand, standings, replay, base-ui, tailwind]

# Dependency graph
requires:
  - phase: 02-gap-chart-replay-engine
    provides: sessionStore with laps, drivers, currentLap; replay controls advancing currentLap
provides:
  - StandingRow type with gap/interval/tire/pit fields
  - useStandingsData hook deriving StandingRow[] from store at currentLap
  - COMPOUND_DISPLAY map for tire letter+color rendering
  - StandingsBoard component with gap/interval toggle, tire indicator, position delta arrows
  - Dashboard right column wired to live standings
affects: [03-standings-board]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useMemo hook deriving sorted standings array from store (same pattern as useGapData)
    - COMPOUND_DISPLAY constant map keyed by compound string for tire rendering
    - @base-ui/react/tooltip Tooltip namespace import; Tooltip.Provider wraps entire table

key-files:
  created:
    - frontend/src/components/StandingsBoard/useStandingsData.ts
    - frontend/src/components/StandingsBoard/StandingsBoard.tsx
  modified:
    - frontend/src/types/session.ts
    - frontend/src/components/Dashboard/Dashboard.tsx

key-decisions:
  - "@base-ui/react/tooltip exports Tooltip namespace — import { Tooltip } from '@base-ui/react/tooltip' then use Tooltip.Root, Tooltip.Trigger etc. (named subpath exports don't exist at the subpath level)"
  - "Gap/interval uses LapRow.Time (session elapsed) not LapTime — consistent with Phase 2 gap chart decision"
  - "lapsDown computed by comparing maxLapByDriver per driver against leader's max — handles lapped cars correctly at any lap"

patterns-established:
  - "Tooltip.Provider wraps entire list component rather than per-row to avoid 20 nested providers"
  - "Compound change detection: compoundChanged=false at lap 1 to avoid false positives at race start"

requirements-completed: [STND-01, STND-02, STND-03, STND-04]

# Metrics
duration: 4min
completed: 2026-03-13
---

# Phase 3 Plan 01: Standings Board Summary

**Standings table with live position order, gap/interval toggle, colored tire indicator, laps-down detection, and pit count — wired to the replay cursor via useStandingsData hook**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-13T14:57:31Z
- **Completed:** 2026-03-13T15:01:28Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- useStandingsData hook deriving StandingRow[] from store: positions sorted, gaps/intervals computed from LapRow.Time, lapped car detection, pit stop counting, compound change flagging
- StandingsBoard component: team color bar, position delta arrows (ChevronUp/Down), driver abbreviation with full-name tooltip, gap/interval toggle via column header button, tire compound as colored letter with animate-pulse on change, tire age and pit count columns
- Dashboard right column replaced from placeholder to live StandingsBoard

## Task Commits

1. **Task 1: Create StandingRow type and useStandingsData hook** - `7de6b6a` (feat)
2. **Task 2: Create StandingsBoard component and wire into Dashboard** - `dc2ebe2` (feat)

## Files Created/Modified
- `frontend/src/types/session.ts` - Added StandingRow interface export
- `frontend/src/components/StandingsBoard/useStandingsData.ts` - Data derivation hook + COMPOUND_DISPLAY map
- `frontend/src/components/StandingsBoard/StandingsBoard.tsx` - Presentational standings table
- `frontend/src/components/Dashboard/Dashboard.tsx` - Imports and renders StandingsBoard in right column

## Decisions Made
- `@base-ui/react/tooltip` exports `Tooltip` as a namespace object — use `import { Tooltip } from '@base-ui/react/tooltip'` and access `Tooltip.Root`, `Tooltip.Trigger`, etc. Named subpath exports at the module root level (e.g. `import { Root } from '@base-ui/react/tooltip'`) cause Vite MISSING_EXPORT build errors.
- Wrapped entire StandingsBoard in a single `Tooltip.Provider` rather than one per row — avoids 20 nested providers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed @base-ui/react/tooltip import pattern**
- **Found during:** Task 2 (StandingsBoard component)
- **Issue:** Plan specified `import * as Tooltip from '@base-ui/react/tooltip'` which caused Vite build error — `Root`, `Trigger`, etc. are not direct exports at that path; `Tooltip` namespace is
- **Fix:** Changed to `import { Tooltip } from '@base-ui/react/tooltip'` and used `Tooltip.Root`, `Tooltip.Trigger`, etc.
- **Files modified:** frontend/src/components/StandingsBoard/StandingsBoard.tsx
- **Verification:** `npx vite build` passes without import errors
- **Committed in:** dc2ebe2 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required for build to succeed. Same functional outcome as planned.

## Issues Encountered
None beyond the tooltip import fix above.

## Next Phase Readiness
- StandingsBoard live and synchronized with replay — Phase 3 plan 01 complete
- All four STND requirements fulfilled
- TypeScript compiles clean, Vite build passes, 19 backend tests pass

---
*Phase: 03-standings-board*
*Completed: 2026-03-13*
