---
phase: 05-dashboard-layout-stint-timeline
plan: 01
subsystem: ui
tags: [vitest, react, plotly, typescript, testing, f1, compounds, stint]

# Dependency graph
requires: []
provides:
  - vitest test runner configured for frontend with jsdom environment
  - lib/compounds.ts with canonical F1 compound color/letter maps and helpers
  - lib/plotlyShapes.ts with makeReplayCursorShape factory
  - components/StintTimeline/useStintData.ts hook with pure exported functions
  - 51 passing tests across 3 test files
affects: [05-02, 05-03, 05-04, 05-05]

# Tech tracking
tech-stack:
  added: [vitest, jsdom, "@testing-library/react", "@testing-library/jest-dom"]
  patterns:
    - Pure functions exported from hooks for independent testability
    - Three-memo split in hooks (stable data / filtered data / cursor)
    - TDD with explicit RED/GREEN phases

key-files:
  created:
    - frontend/vitest.config.ts
    - frontend/src/test/setup.ts
    - frontend/src/lib/compounds.ts
    - frontend/src/lib/compounds.test.ts
    - frontend/src/lib/plotlyShapes.ts
    - frontend/src/lib/plotlyShapes.test.ts
    - frontend/src/components/StintTimeline/useStintData.ts
    - frontend/src/components/StintTimeline/useStintData.test.ts
  modified:
    - frontend/package.json
    - frontend/tsconfig.app.json

key-decisions:
  - "Group stints by Stint integer column (not Compound) to handle FastF1 None values that fragment compound-based groupings"
  - "Export pure functions (deriveStints, computeVisibleStints, computeDriverOrder, buildStintTraces) for direct testability without mocking React"
  - "Three-memo split in useStintData: allStints on [laps], chart data on [allStints/drivers/currentLap], cursor on [currentLap]"
  - "Use last non-null Compound in each stint group to resolve FastF1 None values mid-stint"
  - "Cast through unknown for Plotly.PlotData base property — valid Plotly bar property not included in TypeScript typings"

patterns-established:
  - "Pure functions pattern: Extract hook logic into exported pure functions so tests never need to mock React or the store"
  - "Exclusion pattern: Pre-existing Jest test files added to vitest.config.ts exclude list to prevent old tests from polluting the run"

requirements-completed: [STRAT-01, ENHANCE-01]

# Metrics
duration: 4min
completed: 2026-03-13
---

# Phase 5 Plan 01: Vitest Setup + Shared Utilities + useStintData Hook Summary

**Vitest configured with 51 passing tests across compounds, plotlyShapes, and useStintData — establishing the tested data foundation for all v1.1 stint timeline charts**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-13T23:14:56Z
- **Completed:** 2026-03-13T23:19:07Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Vitest test runner configured for the frontend with jsdom environment, path aliases, and stale test exclusions
- Three shared utility modules created and tested: compounds (color/letter maps), plotlyShapes (cursor factory), useStintData (data hook)
- useStintData implements the core stint derivation logic: grouping by Stint integer, null compound handling, progressive reveal, and driver ordering by race position

## Task Commits

Each task was committed atomically:

1. **Task 1: Set up vitest and create shared utility modules** - `7f71836` (feat)
2. **Task 2: Create useStintData hook with TDD** - `e39969f` (feat)

**Plan metadata:** (docs commit follows)

_Note: Task 2 used TDD — tests written first (RED), then implementation (GREEN)._

## Files Created/Modified

- `frontend/vitest.config.ts` - Test runner configuration with jsdom, path aliases, exclusions
- `frontend/src/test/setup.ts` - jest-dom vitest matchers setup
- `frontend/package.json` - Added test/test:watch scripts and vitest devDependencies
- `frontend/tsconfig.app.json` - Added vitest/globals to compilerOptions.types
- `frontend/src/lib/compounds.ts` - COMPOUND_COLOR, COMPOUND_LETTER maps; getCompoundColor, getCompoundLetter helpers
- `frontend/src/lib/compounds.test.ts` - 17 tests for compound utilities
- `frontend/src/lib/plotlyShapes.ts` - makeReplayCursorShape factory matching GapChart cursor pattern
- `frontend/src/lib/plotlyShapes.test.ts` - 9 tests for cursor shape factory
- `frontend/src/components/StintTimeline/useStintData.ts` - Pure functions + useStintData hook
- `frontend/src/components/StintTimeline/useStintData.test.ts` - 25 tests for all pure functions

## Decisions Made

- Grouping stints by `Stint` integer column (not Compound) is essential because FastF1 v3.6.0+ emits `None` compound values that would fragment groupings if grouped by compound.
- Pure functions exported from the hook module so tests can exercise logic directly without React renders or store mocking.
- Three-memo split matches the existing GapChart pattern: heavy derivation on `[laps]`, filtered data on `[currentLap]`, cursor separately on `[currentLap]`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Excluded pre-existing App.test.tsx from vitest**
- **Found during:** Task 1 (running full vitest suite)
- **Issue:** `src/App.test.tsx` is a legacy Jest test using `jest.mock()` with missing `@testing-library/dom` peer dep — it fails under vitest and blocks a clean suite run
- **Fix:** Added `src/App.test.tsx` to the exclude list in `vitest.config.ts` (plan's exclude list only specified component-level test files)
- **Files modified:** `frontend/vitest.config.ts`
- **Verification:** Full vitest run shows 3 files / 51 tests passing, 0 failing
- **Committed in:** `e39969f` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed Plotly.PlotData base property TypeScript error**
- **Found during:** Task 2 (TypeScript compilation check after implementation)
- **Issue:** `base` is a valid Plotly bar chart property but missing from `Partial<Plotly.PlotData>` typings
- **Fix:** Build trace object without type annotation then cast `as unknown as Partial<Plotly.PlotData>`; access via same cast in test
- **Files modified:** `frontend/src/components/StintTimeline/useStintData.ts`, `frontend/src/components/StintTimeline/useStintData.test.ts`
- **Verification:** `tsc -b --noEmit` reports no errors in new files; 51 tests pass
- **Committed in:** `e39969f` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes essential for clean compilation and test runs. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## Next Phase Readiness

- vitest infrastructure in place — all subsequent plans can add tests immediately
- `getCompoundColor` and `getCompoundLetter` ready for use by StandingsBoard tyre indicator and other charts
- `makeReplayCursorShape` ready for any chart needing the replay cursor
- `useStintData` exports all pure functions and the hook; ready for the StintTimeline chart component in plan 02

---
*Phase: 05-dashboard-layout-stint-timeline*
*Completed: 2026-03-13*

## Self-Check: PASSED

- FOUND: frontend/src/lib/compounds.ts
- FOUND: frontend/src/lib/plotlyShapes.ts
- FOUND: frontend/src/components/StintTimeline/useStintData.ts
- FOUND: frontend/vitest.config.ts
- FOUND: .planning/phases/05-dashboard-layout-stint-timeline/05-01-SUMMARY.md
- FOUND: commit 7f71836 (Task 1)
- FOUND: commit e39969f (Task 2)
