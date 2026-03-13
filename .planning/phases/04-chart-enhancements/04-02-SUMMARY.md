---
phase: 04-chart-enhancements
plan: 02
subsystem: ui
tags: [plotly, react, zustand, typescript, pit-stops, safety-car, annotations]

# Dependency graph
requires:
  - phase: 04-chart-enhancements
    provides: safetyCarPeriods in Zustand store, SafetyCarPeriod TypeScript interface (plan 01)
  - phase: 02-gap-chart-replay-engine
    provides: currentLap replay state, useGapData hook, GapChart Plotly component

provides:
  - pitStopShapes: team-colored vertical Plotly shapes at each pit stop lap
  - pitStopHoverTraces: invisible scatter traces enabling "VER pit — Lap 12" hover tooltips
  - scShapes: yellow/red Plotly rect shapes for SC/VSC/RED periods with type labels
  - Progressive reveal: annotations appear/disappear as replay cursor advances/retreats
  - Z-ordered annotation layers: SC shading (below) -> pit lines (above) -> cursor (above)

affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plotly shapes can't hover — use invisible two-point line traces (y: [0,1], line.width: 0) with hoverinfo: text for pit stop tooltips"
    - "Progressive reveal via useMemo with currentLap in deps: filter pit laps to <= currentLap, clamp SC rect x1 to currentLap"
    - "Same-lap double pit offset: detect Set intersection, apply +/-0.15 lap x-offset"
    - "Separate useMemo blocks for gap segments vs annotation shapes (different dep arrays)"

key-files:
  created: []
  modified:
    - frontend/src/components/GapChart/useGapData.ts
    - frontend/src/components/GapChart/GapChart.tsx

key-decisions:
  - "Pit hover traces use two-point lines (y: [0,1]) with line.width: 0 and hoverinfo: text — not hovertemplate — because hovertemplate requires valid y values and invisible markers at y: null fail to trigger"
  - "Annotation shapes separated into own useMemo block with [laps, drivers, selectedDrivers, currentLap, safetyCarPeriods] deps — gap segments memo kept separate with narrower deps"
  - "Z-order: scShapes spread first (layer: below), pitStopShapes next (layer: above), cursorShape last (layer: above implicitly)"

patterns-established:
  - "Invisible hover trace pattern: x: [xPos, xPos], y: [0, 1], mode: lines, line.width: 0, hoverinfo: text — reusable for any vertical annotation hover"

requirements-completed: [GAP-04, GAP-05]

# Metrics
duration: 1min
completed: 2026-03-13
---

# Phase 04 Plan 02: Pit Stop Annotations and Safety Car Shading Summary

**Team-colored pit stop vertical lines with "VER pit — Lap 12" hover tooltips and SC/VSC/RED shading added to GapChart with progressive reveal synchronized to the replay cursor**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-13T18:35:28Z
- **Completed:** 2026-03-13T18:36:51Z
- **Tasks:** 3 (2 auto + 1 human-verify, all complete)
- **Files modified:** 2

## Accomplishments

- `useGapData` extended to return `pitStopShapes`, `pitStopHoverTraces`, and `scShapes` arrays
- Pit stop lines are team-colored (1px solid), carry driver abbreviation label at top, and offset by +/-0.15 laps when both drivers pit on the same lap
- Invisible two-point line traces deliver hover tooltips in "VER pit — Lap 12" format without conflicting with the gap line's hover
- SC/VSC rectangles use differentiated opacity (0.18 vs 0.08); RED uses red band with border
- All annotations are progressively revealed: filtered to `<= currentLap` for pit stops, `x1 = min(end_lap, currentLap)` for SC rects
- Z-ordering implemented: SC shading (below traces) -> pit lines (above traces) -> cursor (topmost)
- GapChart spreads pit hover traces into Plot data array; gap segments are unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend useGapData with pit stop and safety car shape builders** - `f4420ee` (feat)
2. **Task 2: Wire annotation shapes and hover traces into GapChart** - `26c084e` (feat)
3. **Task 3: Visual verification of chart annotations** - human-verify checkpoint (approved)

**Plan metadata:** `d76d361` (docs: complete plan)

## Files Created/Modified

- `frontend/src/components/GapChart/useGapData.ts` - Extended GapDataResult interface; added annotation useMemo block returning pitStopShapes, pitStopHoverTraces, scShapes
- `frontend/src/components/GapChart/GapChart.tsx` - Destructures new arrays from hook; composes shapes array in z-order; spreads hover traces into Plot data

## Decisions Made

- Pit hover traces use `hoverinfo: 'text'` with two-point invisible line traces (y: [0,1], line.width: 0) rather than single-point invisible markers. Invisible markers at y: null do not trigger hover; this approach spans the full y-range for reliable hover detection.
- Annotation shapes are in a separate `useMemo` from gap segments — annotations depend on `currentLap` and `safetyCarPeriods` while segments do not. Keeping them separate avoids unnecessary segment recomputation on every lap tick during replay.

## Deviations from Plan

None - plan executed exactly as written. The plan explicitly documented all three hover trace fallback approaches; the two-point invisible line approach was selected as the most reliable.

## Issues Encountered

None — TypeScript compiled clean on first attempt, backend tests still pass (34/34).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 04 Plan 02 fully complete — all 3 tasks done including human verification
- All annotation behaviors verified: pit lines with hover tooltips, SC/VSC shading, red flags, progressive reveal, z-ordering
- Phase 04 has no remaining plans; all requirements (GAP-04, GAP-05) satisfied
- Deferred: user noted wanting the gap line itself to reveal progressively (not just annotations) — out of scope for this plan, candidate for a future enhancement plan

---
*Phase: 04-chart-enhancements*
*Completed: 2026-03-13*
