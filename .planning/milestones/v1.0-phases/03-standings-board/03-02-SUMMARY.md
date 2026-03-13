---
phase: 03-standings-board
plan: 02
subsystem: ui
tags: [react, fastf1, standings, replay, typescript]

# Dependency graph
requires:
  - phase: 03-01
    provides: StandingsBoard component, useStandingsData hook, StandingRow types
  - phase: 02-gap-chart-replay-engine
    provides: replay store, currentLap sync, Dashboard layout
provides:
  - Human-verified standings board: position order, gaps, tires, pit counts all confirmed working
  - DNF/retirement handling with position 99 normalization
  - Scrollable standings constrained to ~10 visible rows
affects:
  - 04-phase-4 (standings board delivered, phase 3 complete)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Position 99 normalization: F1 API returns 99 for retiring/invalid drivers — treat as null, display '—', sort to bottom"
    - "DNF display: derive race length from data, show 'DNF Lx' label and dimmed row rather than removing driver"
    - "Standings scrolling: max-h with overflow-y-auto constrained to ~10 rows so layout stays fixed"

key-files:
  created: []
  modified:
    - frontend/src/components/StandingsBoard/useStandingsData.ts
    - frontend/src/components/StandingsBoard/StandingsBoard.tsx
    - frontend/src/components/Dashboard/Dashboard.tsx
    - frontend/src/types/session.ts

key-decisions:
  - "Position 99 normalization: F1 API sends Position 99 for retirements — normalize to null in useStandingsData, display '—' in StandingsBoard, sort to bottom of standings"
  - "DNF classification: use data-derived race length (max lap across drivers) rather than a totalLaps store field to detect finished/retired status"
  - "Standings height: max-h-[360px] overflow-y-auto keeps ~10 rows visible without pushing other layout elements"

patterns-established:
  - "Pattern 1: API sentinel values (e.g. position 99) are normalized at the data layer (hook), never in the render layer (component)"

requirements-completed:
  - STND-01
  - STND-02
  - STND-03
  - STND-04

# Metrics
duration: ~30min (verification + fixes)
completed: 2026-03-13
---

# Phase 3 Plan 02: Standings Board Verification Summary

**Human-verified standings board with DNF handling, position 99 normalization, and scrollable ~10-row layout confirmed working across all 5 ROADMAP success criteria**

## Performance

- **Duration:** ~30 min (verification session + three rounds of fixes)
- **Started:** 2026-03-13T15:00:00Z
- **Completed:** 2026-03-13T16:43:47Z
- **Tasks:** 1 (human-verify checkpoint)
- **Files modified:** 4

## Accomplishments

- All 5 Phase 3 ROADMAP success criteria verified working by human inspection
- DNF and retired drivers handled gracefully — "DNF L{x}" label, dimmed row, sorted to bottom
- Position 99 (F1 API sentinel for invalid/retiring positions) normalized to no-position at data layer
- Standings height capped at ~10 visible rows with scroll for full grid access

## Task Commits

Human-verify checkpoint triggered three rounds of auto-fixes during verification:

1. **Fix: DNF handling, scrolling, and >20 drivers** — `e790eed` (fix)
2. **Fix: cap standings to ~10 visible rows and DNF position display** — `a05433b` (fix)
3. **Fix: normalize position 99 from API as no-position** — `279e865` (fix)

## Files Created/Modified

- `frontend/src/components/StandingsBoard/useStandingsData.ts` — DNF detection, position 99 normalization, data-derived race length
- `frontend/src/components/StandingsBoard/StandingsBoard.tsx` — DNF row styling, '—' position display, max-h scroll constraint
- `frontend/src/components/Dashboard/Dashboard.tsx` — Minor layout adjustment for right-column height
- `frontend/src/types/session.ts` — Type updates to support DNF/retirement status fields

## Decisions Made

- **Position 99 normalization:** The F1 FastF1 API returns Position 99 for drivers about to retire or with invalid positions mid-race. This is now treated identically to null — normalized at the data hook layer, displayed as "—" in the UI, and sorted to the bottom. This prevents "99" appearing mid-standings during live replays.
- **DNF race-length derivation:** Rather than requiring a `totalLaps` field in the replay store, the hook now derives race length from the maximum lap seen across all drivers in the session data. This is more robust and removes an external dependency.
- **Standings scroll cap:** `max-h-[360px]` with `overflow-y-auto` constrains the standings panel to approximately 10 visible rows while keeping the Dashboard layout stable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DNF drivers missing or showing position 99**
- **Found during:** Task 1 (human verification)
- **Issue:** Drivers who retired mid-race either disappeared from standings or showed "99" as their position
- **Fix:** Normalized position 99 to null in `useStandingsData`; added DNF detection using data-derived race length; added dimmed row styling for retired drivers
- **Files modified:** `useStandingsData.ts`, `StandingsBoard.tsx`, `session.ts`
- **Verification:** Human confirmed retired drivers show "—" and "DNF L{x}" correctly
- **Committed in:** e790eed, a05433b, 279e865

**2. [Rule 1 - Bug] Standings panel expanded beyond viewport height for 20+ driver grids**
- **Found during:** Task 1 (human verification)
- **Issue:** Full 20-driver grid pushed the standings panel beyond the visible area
- **Fix:** Added `max-h-[360px] overflow-y-auto` to the standings container in `Dashboard.tsx` and `StandingsBoard.tsx`
- **Files modified:** `StandingsBoard.tsx`, `Dashboard.tsx`
- **Verification:** Human confirmed ~10 rows visible, remaining rows scrollable
- **Committed in:** e790eed, a05433b

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both bugs were discovered during human verification and required fixing before approval. No scope creep — all fixes are within the standing board feature boundary.

## Issues Encountered

- Three separate fix commits were required before human approval — the scrolling fix and DNF fix interacted and needed two passes to get the height constraint and position display both right.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3 complete. All standings board requirements (STND-01 through STND-04) verified.
- Phase 4 can proceed with full standings board and gap chart available as building blocks.
- No known blockers.

---
*Phase: 03-standings-board*
*Completed: 2026-03-13*
