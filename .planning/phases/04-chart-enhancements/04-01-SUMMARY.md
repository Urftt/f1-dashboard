---
phase: 04-chart-enhancements
plan: 01
subsystem: api
tags: [fastf1, safety-car, sse, zustand, typescript, pydantic]

# Dependency graph
requires:
  - phase: 02-gap-chart-replay-engine
    provides: load_session_stream SSE infrastructure, sessionStore Zustand setup

provides:
  - parse_safety_car_periods() and _time_to_lap() backend functions
  - SafetyCarPeriod Pydantic model
  - safetyCarPeriods field in SSE complete event payload
  - SafetyCarPeriod TypeScript interface
  - safetyCarPeriods state field in Zustand sessionStore

affects: [04-02-chart-enhancements, gap-chart-shading]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "_time_to_lap: timestamp-to-lap mapping via first-exceeding lap end time"
    - "track_status status codes: '4'=SC, '6'/'7'=VSC, '5'=RED, '1'=AllClear"
    - "TDD: RED commit (test) then GREEN commit (feat) for backend logic"

key-files:
  created: []
  modified:
    - backend/services/fastf1_service.py
    - backend/models/schemas.py
    - backend/tests/test_sessions.py
    - frontend/src/types/session.ts
    - frontend/src/stores/sessionStore.ts
    - frontend/src/lib/sse.ts

key-decisions:
  - "parse_safety_car_periods uses session.laps (not session.track_status time) for lap mapping via _time_to_lap"
  - "Unclosed SC/VSC periods at end of track_status data are included with end_lap = max lap"
  - "Adjacent SC->VSC transition creates two separate periods (type change closes current, opens new)"
  - "_time_to_lap returns 1 (not max lap) when all lap times are NaT — prevents false fallback"
  - "session.load() kept with messages=False — track_status is available without messages (Open Question 1 resolved by graceful empty handling)"

patterns-established:
  - "Safety car period data flows: FastF1 track_status -> parse_safety_car_periods -> SSE complete event -> sessionStore.safetyCarPeriods"

requirements-completed: [GAP-05]

# Metrics
duration: 4min
completed: 2026-03-13
---

# Phase 04 Plan 01: Safety Car Period Detection Summary

**FastF1 track_status parsing into lap-indexed SC/VSC/RED periods delivered via SSE and stored in frontend Zustand store**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-13T18:30:08Z
- **Completed:** 2026-03-13T18:33:32Z
- **Tasks:** 2 (Task 1 TDD with 2 commits, Task 2 with 1 commit)
- **Files modified:** 6

## Accomplishments

- Backend parses `track_status` DataFrame status codes into lap-indexed SC/VSC/RED periods
- `_time_to_lap()` maps session timestamps to lap numbers using first-exceeding lap end time
- SSE `complete` event now includes `safetyCarPeriods` array alongside `laps` and `drivers`
- Frontend `SafetyCarPeriod` type, Zustand store field, and SSE handler all wired end-to-end
- 27 test_sessions.py tests pass (11 new safety car tests); full 34-test suite passes

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Backend safety car period parsing tests** - `d804c72` (test)
2. **Task 1 GREEN: Backend implementation** - `f5a74d3` (feat)
3. **Task 2: Frontend type, store, and SSE wiring** - `ca18096` (feat)

_Note: TDD tasks have multiple commits (test RED -> feat GREEN)_

## Files Created/Modified

- `backend/services/fastf1_service.py` - Added `_time_to_lap()`, `parse_safety_car_periods()`, updated `load_session_stream()` to include `safetyCarPeriods` in complete event
- `backend/models/schemas.py` - Added `SafetyCarPeriod` Pydantic model
- `backend/tests/test_sessions.py` - Added `TestSafetyCarParsing` class with 11 tests
- `frontend/src/types/session.ts` - Added `SafetyCarPeriod` interface
- `frontend/src/stores/sessionStore.ts` - Added `safetyCarPeriods` state field; updated `setLaps` signature and implementation
- `frontend/src/lib/sse.ts` - Updated `complete` handler to parse and pass `safetyCarPeriods`

## Decisions Made

- Kept `messages=False` in `session.load()` — `track_status` is available via the laps load; graceful empty handling covers cases where it's absent
- `_time_to_lap` returns 1 (not max lap) when all lap times are NaT, preventing false attribution to the final lap
- Type change (SC->VSC) closes the current period and opens a new one with the same timestamp, ensuring no gap between adjacent periods
- RED flag (status '5') always produces a single-lap period; it closes any open SC/VSC first

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed _time_to_lap all-NaT fallback returning max lap instead of 1**
- **Found during:** Task 1 GREEN (first test run)
- **Issue:** When all lap Time values are NaT, the loop skips all rows but still falls through to `max lap` fallback, returning 3 instead of 1
- **Fix:** Introduced `found_any_valid_time` flag; only use max-lap fallback when at least one valid time was compared
- **Files modified:** backend/services/fastf1_service.py
- **Verification:** All 27 tests pass including `test_time_to_lap_returns_1_when_all_times_are_nat`
- **Committed in:** f5a74d3 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in initial implementation)
**Impact on plan:** Minor fix during TDD GREEN iteration. No scope changes.

## Issues Encountered

None beyond the single auto-fixed bug caught during TDD GREEN phase.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `safetyCarPeriods` is available on `useSessionStore` for any chart component
- Plan 02 can import `SafetyCarPeriod` from `@/types/session` and read `store.safetyCarPeriods` directly
- No blockers
