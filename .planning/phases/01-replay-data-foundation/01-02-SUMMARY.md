---
phase: 01-replay-data-foundation
plan: "02"
subsystem: ui
tags: [streamlit, replay, tyres, historical-data, openf1]
requires:
  - phase: 01-replay-data-foundation
    provides: replay session preload contract with normalized lap rows
provides:
  - lap-granular replay snapshot helpers for current compound and tyre age
  - historical Streamlit flow wired to canonical replay session preload data
  - explicit replay-position messaging and placeholder semantics for missing tyre fields
affects: [replay-controls, dashboard-kpis, historical-session-flow]
tech-stack:
  added: []
  patterns: [pure replay snapshot helpers, lap-granular replay position seam]
key-files:
  created: []
  modified: [app.py, data_processor.py, replay_data.py]
key-decisions:
  - "Replay position remains lap-granular in Phase 1 and resolves to the latest interval-history lap or the preloaded session maximum."
  - "Tyre KPIs are derived through pure helper functions over ReplaySession instead of direct Streamlit DataFrame access."
patterns-established:
  - "Replay KPI derivation lives in pure Python helpers that accept ReplaySession and replay lap inputs."
  - "Historical UI paths preload canonical replay data once, then render KPI state from helper snapshots."
requirements-completed: [REPL-01, STAT-02, STAT-03]
duration: 7 min
completed: 2026-03-10
---

# Phase 1 Plan 02: Replay Snapshot Wiring Summary

**Lap-granular replay tyre snapshots wired into the historical Streamlit flow through pure ReplaySession helpers**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-10T21:41:22Z
- **Completed:** 2026-03-10T21:48:38Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added pure replay helpers to resolve latest known lap rows, tyre compound, tyre age, and per-driver snapshot payloads from normalized replay data.
- Refactored the historical session load path to use `load_replay_session()` and render selected-driver tyre metrics from the canonical replay contract.
- Made the UI seam explicit that replay position is lap-granular and added stable fallback text when tyre data is missing.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add pure replay snapshot helpers for driver KPIs** - `5f5636c` (feat)
2. **Task 2: Route historical-session UI state through the replay foundation** - `2d7709a` (feat)
3. **Task 3: Define replay-position semantics in the UI seam** - `1169f37` (refactor)

**Plan metadata:** docs commit recorded after state updates

## Files Created/Modified
- `replay_data.py` - Adds replay session accessors used by lap-granular snapshot calculations.
- `data_processor.py` - Adds pure replay snapshot helpers and stable display fallbacks for compound and tyre age.
- `app.py` - Loads historical sessions through the replay preload contract and renders tyre-aware metrics from helper snapshots.

## Decisions Made
- Replay position is explicitly lap-based for this phase, using the latest calculated history lap when present and otherwise the preloaded session maximum lap.
- Historical session KPI rendering now depends on the canonical `ReplaySession` contract instead of raw session-state lap DataFrames.
- Missing tyre data renders explicit placeholder text instead of surfacing empty values or crashing the UI.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- A headless Streamlit smoke check initially failed inside the sandbox because local socket binding was denied. Re-running the same startup check with approval confirmed the app booted successfully at `http://127.0.0.1:8502`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 2 can build replay controls on top of the new lap-granular snapshot seam without re-deriving tyre context inside the UI loop.
- Historical-session loading now has a stable contract boundary for adding replay position controls and advancing KPI state over time.

## Self-Check

PASSED

- Found `.planning/phases/01-replay-data-foundation/01-02-SUMMARY.md`
- Found task commits `5f5636c`, `2d7709a`, and `1169f37` in git history

---
*Phase: 01-replay-data-foundation*
*Completed: 2026-03-10*
