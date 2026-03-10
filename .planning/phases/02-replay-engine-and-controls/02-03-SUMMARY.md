---
phase: 02-replay-engine-and-controls
plan: "03"
subsystem: ui
tags: [python, streamlit, plotly, pytest, replay-controls]
requires:
  - phase: 01-replay-data-foundation
    provides: normalized replay sessions and tyre snapshot helpers
  - phase: 02-replay-engine-and-controls
    provides: immutable replay controller state plus speed, scrub, and jump helpers
provides:
  - historical Streamlit replay controls backed by controller-owned session state
  - fragment-driven replay ticks that advance lap state without the blocking historical loop
  - pair-scoped replay history caching plus controller-driven visible history and KPI snapshots
affects: [app.py, data_processor.py, replay_controls.py, phase-03-dashboard-kpis]
tech-stack:
  added: []
  patterns: [fragment-driven replay tick, controller-owned Streamlit session state, pair-scoped history cache]
key-files:
  created: []
  modified: [app.py, data_processor.py, replay_controls.py, tests/test_replay_controls.py]
key-decisions:
  - "Historical replay state lives in Streamlit session state as a ReplayControllerState plus replay_status/replay_position_lap mirrors for UI rendering."
  - "Historical playback advances through st.fragment-driven ticks and full reruns instead of the prior blocking while loop."
  - "Charts, gap metrics, and tyre cards all resolve from one controller-driven replay view model over cached full pair history."
patterns-established:
  - "Historical replay wiring: load session -> initialize controller at lap 1 -> cache full pair history -> derive visible history from replay lap."
  - "UI actions use replay_controls session-state helpers instead of mutating ad hoc session fields."
requirements-completed: [REPL-02, REPL-03, REPL-04, REPL-05]
duration: 2 min
completed: 2026-03-10
---

# Phase 2 Plan 3: Replay Engine And Controls Summary

**Streamlit historical replay controls with fragment-driven lap ticks, pair-scoped history caching, and controller-aligned chart and tyre views**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T22:51:56Z
- **Completed:** 2026-03-10T22:54:20Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Replaced the historical-session blocking replay loop with controller-backed Play, Pause, Resume, Restart, speed, and scrub controls.
- Moved historical chart, gap, and tyre rendering onto a shared replay view model derived from the active controller lap and cached full pair history.
- Added regression coverage for lap-1 initialization, first-play progression, cache refresh semantics, and replay-view alignment.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace the blocking historical replay flow with explicit control wiring** - `50e7e3e` (feat)
2. **Task 2: Render charts and KPI state from replay-position-driven derived views** - `0df87a8` (feat)
3. **Task 3: Add final regression coverage and executable verification notes** - `1064875` (test)

**Plan metadata:** pending final docs commit

## Files Created/Modified
- `app.py` - Wires historical replay controls, fragment ticks, pair-history selection, and controller-driven rendering.
- `replay_controls.py` - Adds session-state controller helpers for initialize, play, pause, resume, restart, speed, scrub, and tick updates.
- `data_processor.py` - Adds cached replay-history builders and a replay view model that keeps visible history, gap stats, and tyre snapshots on one lap.
- `tests/test_replay_controls.py` - Locks lap-1 initialization, first-play behavior, cache refresh, and replay-view alignment with deterministic tests.

## Decisions Made
- Kept historical playback on the existing Streamlit page and used `st.fragment` plus reruns instead of introducing a separate async service or background thread.
- Cached full interval history by `(session_key, ordered_driver_pair)` so driver swaps recompute cleanly while repeated reruns stay cheap.
- Treated controller state as the only replay clock and derived visible chart/KPI data from that state rather than mutating history over time.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 3 can consume the replay view model directly for richer comparison widgets and race-stat surfaces.
- Manual Streamlit verification remains straightforward: load a historical session, press Play, then confirm Pause, Resume, speed changes, and scrub updates keep the chart prefix and tyre cards on the same lap.

## Self-Check

PASSED
- Found `.planning/phases/02-replay-engine-and-controls/02-03-SUMMARY.md`
- Found task commits `50e7e3e`, `0df87a8`, and `1064875`

---
*Phase: 02-replay-engine-and-controls*
*Completed: 2026-03-10*
