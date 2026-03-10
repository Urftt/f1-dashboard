---
phase: 01-replay-data-foundation
plan: "03"
subsystem: testing
tags: [pytest, replay, tyres, historical-data, testing]
requires:
  - phase: 01-replay-data-foundation
    provides: lap-granular replay preload contract and snapshot helpers from plans 01-01 and 01-02
provides:
  - deterministic pytest coverage for replay preload normalization
  - fixture-backed regression coverage for tyre compound and tyre age semantics
  - a documented repo-level pytest entrypoint for replay foundation work
affects: [replay-controls, dashboard-kpis, reliability]
tech-stack:
  added: [pytest]
  patterns: [fixture-backed replay regression tests, local replay fetcher seam for no-network coverage]
key-files:
  created: [tests/conftest.py, tests/fixtures/replay_session.json, tests/test_replay_foundation.py]
  modified: [pyproject.toml, replay_data.py, data_processor.py]
key-decisions:
  - "Replay regression tests should exercise normalize_replay_session() and F1DataFetcher.load_replay_session() with deterministic local payloads instead of bespoke mocks."
  - "Missing DataFrame-backed tyre fields must normalize to None so replay fallback semantics remain stable under pytest fixtures and real pandas inputs."
  - "Tyre-age inference stops at unknown stint boundaries instead of carrying age across rows with missing stint markers."
patterns-established:
  - "Replay foundation coverage uses compact JSON fixtures loaded through shared pytest fixtures, then routes assertions through production helpers."
  - "Helper regressions discovered by tests are fixed inline in production code and verified by the same targeted replay suite."
requirements-completed: [RELY-03, STAT-02, STAT-03]
duration: 7 min
completed: 2026-03-10
---

# Phase 1 Plan 03: Replay Foundation Test Coverage Summary

**Pytest-backed replay regression coverage with deterministic local fixtures for preload normalization, tyre compound lookup, and tyre-age fallback semantics**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-10T21:51:00Z
- **Completed:** 2026-03-10T21:58:04Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Added a focused repo-level pytest entrypoint for Phase 1 replay foundation work.
- Created deterministic two-driver replay fixtures and shared pytest helpers that exercise production preload paths without live OpenF1 calls.
- Locked replay normalization, duplicate-lap handling, compound lookup, tyre-age inference, and snapshot fallback behavior behind automated regression tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install pytest support for replay-foundation work** - `acbd7a3` (chore)
2. **Task 2: Create deterministic replay fixtures with tyre-change coverage** - `9c7849b` (feat)
3. **Task 3: Add fixture-backed tests for preload and tyre-aware semantics** - `3954686` (feat)

**Plan metadata:** docs commit recorded after state updates

## Files Created/Modified
- `pyproject.toml` - Adds the pytest development dependency for the repo-level test entrypoint.
- `tests/conftest.py` - Provides shared fixture loaders for raw payloads, DataFrames, normalized replay sessions, and a local fetcher seam.
- `tests/fixtures/replay_session.json` - Stores deterministic replay data with duplicate laps, a pit-stop compound change, and missing tyre fields.
- `tests/test_replay_foundation.py` - Covers replay preload, normalization, compound lookup, tyre-age inference, and snapshot fallbacks.
- `replay_data.py` - Normalizes pandas missing values correctly when building replay laps from DataFrames.
- `data_processor.py` - Prevents tyre-age inference from crossing rows with unknown stint boundaries.

## Decisions Made
- Replay foundation tests use local fixture payloads and the real preload helpers so later phases can trust the production seams instead of test-only mocks.
- Missing tyre fields coming from pandas DataFrames are treated as absent data, not stringified `NaN` values.
- Tyre-age inference favors conservative correctness at uncertain stint boundaries over optimistic carry-forward behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pandas missing-value normalization for replay tyre fields**
- **Found during:** Task 3 (Add fixture-backed tests for preload and tyre-aware semantics)
- **Issue:** Fixture-backed DataFrame rows turned missing compound and tyre-age fields into `NaN`, which leaked through normalization and broke fallback behavior.
- **Fix:** Updated replay lap normalization to treat pandas-missing values as absent data, select the first present tyre field explicitly, and exclude missing source fields.
- **Files modified:** `replay_data.py`
- **Verification:** `python -m pytest tests/test_replay_foundation.py`
- **Committed in:** `3954686` (part of Task 3 commit)

**2. [Rule 1 - Bug] Stopped tyre-age inference at unknown stint boundaries**
- **Found during:** Task 3 (Add fixture-backed tests for preload and tyre-aware semantics)
- **Issue:** Tyre-age fallback could incorrectly carry a stint backward across rows with no stint marker, over-counting inferred tyre age.
- **Fix:** Updated stint inference to break when a prior row lacks a stint number for a driver whose current replay row has one.
- **Files modified:** `data_processor.py`
- **Verification:** `python -m pytest tests/test_replay_foundation.py` and `python -m pytest`
- **Committed in:** `3954686` (part of Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 bug fixes)
**Impact on plan:** Both fixes were required for correct replay fallback semantics under deterministic test coverage. No scope creep beyond the replay foundation contract.

## Issues Encountered
- A commit attempt briefly hit a stale worktree `index.lock` after overlapping git commands. Retrying sequentially after the lock cleared completed normally.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 2 can build replay controls on top of a deterministic regression suite for preload and tyre-aware state.
- Replay helper behavior around missing tyre data is now specified by tests, reducing risk for future replay-position logic changes.

## Self-Check

PASSED

- Found `.planning/phases/01-replay-data-foundation/01-03-SUMMARY.md`
- Found task commits `acbd7a3`, `9c7849b`, and `3954686` in git history

---
*Phase: 01-replay-data-foundation*
*Completed: 2026-03-10*
