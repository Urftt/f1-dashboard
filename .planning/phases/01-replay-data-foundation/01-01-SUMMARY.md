---
phase: 01-replay-data-foundation
plan: "01"
subsystem: api
tags: [openf1, replay, pandas, streamlit]
requires: []
provides:
  - reusable ReplaySession dataclasses and normalization helpers for historical session preload
  - fetcher entrypoint to preload one historical session into a deterministic replay contract
  - documented lap-granular replay semantics and compatibility seams for the current Streamlit app
affects: [replay-engine, dashboard-kpis, app.py, data_fetcher.py]
tech-stack:
  added: []
  patterns: [dataclass-based replay contract, deterministic lap normalization, fetcher preload seam]
key-files:
  created: [replay_data.py]
  modified: [data_fetcher.py]
key-decisions:
  - "Keep Phase 1 replay semantics lap-granular so later snapshot helpers can derive latest known state at lap N without UI coupling."
  - "Preserve `load_session()` and `get_lap_data()` while adding `load_replay_session()` so the current Streamlit app remains usable during migration."
patterns-established:
  - "Replay preload returns a `ReplaySession` instead of leaving raw DataFrames as the only shared contract."
  - "Normalization collapses duplicate driver/lap rows by latest timestamp and keeps tyre fields optional but present when supplied."
requirements-completed: [REPL-01]
duration: 2 min
completed: 2026-03-10
---

# Phase 1 Plan 01: Replay Data Foundation Summary

**Historical session preload now returns a reusable `ReplaySession` with deterministic lap ordering, duplicate collapse, and tyre-field retention through the fetcher seam**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T21:35:26Z
- **Completed:** 2026-03-10T21:37:10Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Added `ReplayDriver`, `ReplayLap`, and `ReplaySession` dataclasses plus normalization helpers in `replay_data.py`.
- Refactored `F1DataFetcher` to support one-shot historical preload through `load_replay_session(session_key)`.
- Documented lap-granular assumptions, duplicate handling, missing tyre-field behavior, and compatibility seams for the existing Streamlit flow.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define a canonical replay session model** - `6ffbd68` (feat)
2. **Task 2: Add replay-session preload entrypoints to the fetcher** - `adb9193` (feat)
3. **Task 3: Document loader assumptions in code and preserve compatibility seams** - `253199b` (refactor)

## Files Created/Modified
- `replay_data.py` - Replay dataclasses and normalization helpers for historical session preload.
- `data_fetcher.py` - Replay preload entrypoint, shared session/driver loaders, and compatibility seams for existing app usage.

## Decisions Made
- Kept replay semantics lap-granular in this plan because the current app and future tyre snapshot work both align to completed laps.
- Left the existing fetcher APIs in place and introduced a parallel preload entrypoint so Plan 02 can migrate `app.py` incrementally instead of through a breaking rewrite.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed indentation regression in `get_lap_data()`**
- **Found during:** Task 2 (Add replay-session preload entrypoints to the fetcher)
- **Issue:** Initial refactor introduced an indentation error that broke module compilation.
- **Fix:** Corrected the DataFrame normalization block and added a guard for optional `date` conversion.
- **Files modified:** `data_fetcher.py`
- **Verification:** `python -m py_compile data_fetcher.py replay_data.py`
- **Committed in:** `adb9193` (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix was required for correctness. No scope creep.

## Issues Encountered
- The first post-refactor compile check failed because of the indentation regression in `data_fetcher.py`; this was corrected immediately and re-verified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Replay preload is now reusable outside the Streamlit callback flow and ready for replay-state consumers.
- Plan 02 can migrate `app.py` toward replay-driven state without needing to redesign the fetcher contract first.

## Self-Check: PASSED

- Found `.planning/phases/01-replay-data-foundation/01-01-SUMMARY.md`
- Verified task commits `6ffbd68`, `adb9193`, and `253199b` exist in git history

---
*Phase: 01-replay-data-foundation*
*Completed: 2026-03-10*
