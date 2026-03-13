---
phase: 01-backend-foundation
plan: 01
subsystem: api
tags: [fastapi, fastf1, pandas, numpy, sse, python, pydantic]

# Dependency graph
requires: []
provides:
  - FastAPI backend with GET /api/schedule/{year} returning completed EventSummary list
  - GET /api/schedule/{year}/{event}/session-types returning session types
  - GET /api/sessions/load SSE endpoint streaming progress events then lap data
  - FastF1 cache initialized at lifespan startup with per-session asyncio.Lock
  - Pydantic models: EventSummary, SessionTypeInfo, LapData, ProgressEvent
  - serialize_laps() converting all pandas/numpy types to Python primitives
  - 19 passing backend tests with mocked FastF1 calls
affects: [02-session-selector-ui, 03-gap-chart, 04-replay]

# Tech tracking
tech-stack:
  added:
    - fastapi>=0.115.0
    - uvicorn[standard]>=0.30.0
    - sse-starlette>=2.0.0
    - pydantic-settings>=2.0.0
    - pytest>=8.0.0
    - httpx>=0.27.0
    - pytest-asyncio>=0.23.0
    - anyio[trio]>=4.0.0
  patterns:
    - FastAPI lifespan for FastF1 cache init and session lock dict
    - asyncio.to_thread for all blocking FastF1 calls
    - Per-session asyncio.Lock preventing concurrent duplicate loads
    - serialize_laps() explicit primitive conversion for all FastF1/pandas types
    - SSE progress stages: 5% connecting, 20% fetching session, 50% loading laps, 80% processing
    - pytest --import-mode=importlib to avoid root main.py shadowing backend main.py

key-files:
  created:
    - backend/pyproject.toml
    - backend/main.py
    - backend/models/schemas.py
    - backend/services/fastf1_service.py
    - backend/services/cache_service.py
    - backend/routers/schedule.py
    - backend/routers/sessions.py
    - backend/tests/conftest.py
    - backend/tests/test_schedule.py
    - backend/tests/test_sessions.py
    - backend/pytest.ini
    - backend/conftest.py
  modified:
    - .gitignore

key-decisions:
  - "Use sse-starlette for EventSourceResponse (built-in FastAPI SSE API changed between versions)"
  - "pytest --import-mode=importlib required because root-level main.py (Streamlit) shadows backend/main.py"
  - "EventDate tz-naive normalization: FastF1 returns datetime64[ns] (tz-naive) so compare with naive UTC datetime"
  - "app.state.session_locks initialized manually in test fixture since lifespan doesn't run in AsyncClient tests"

patterns-established:
  - "Pattern: All FastF1 blocking calls wrapped in asyncio.to_thread — never called directly in async routes"
  - "Pattern: serialize_laps() converts Timedelta/NaT/numpy.float64 to float|None/int|None before JSON"
  - "Pattern: Per-session asyncio.Lock prevents concurrent duplicate loads and cache corruption"
  - "Pattern: FastF1 Cache.enable_cache() called once in lifespan startup, never per-request"
  - "Pattern: EventDate comparison normalizes to tz-naive UTC to handle both tz-naive and tz-aware DateFrames"

requirements-completed: [SESS-01, SESS-02, SESS-03, SESS-04, SESS-05]

# Metrics
duration: 6min
completed: 2026-03-13
---

# Phase 1 Plan 01: Backend Foundation Summary

**FastAPI backend with FastF1 SSE session loading, schedule endpoints, pandas/numpy serialization, and 19 passing mocked tests**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-13T11:10:55Z
- **Completed:** 2026-03-13T11:17:23Z
- **Tasks:** 2 + 1 auto-fix
- **Files modified:** 13

## Accomplishments

- Full FastAPI backend with schedule endpoint (completed events, year validation, session types) and SSE session loading endpoint
- serialize_laps() correctly handles all FastF1/pandas edge cases: Timedelta, NaT, numpy.float64, NaN LapNumber
- 19 passing tests covering schedule filtering, year validation, SSE progress/complete events, serialization correctness, and cache detection

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold backend and complete API** - `b23379c` (feat)
2. **Task 2: Backend test suite** - `ed3fccb` (test)
3. **Auto-fix: EventDate timezone comparison** - `5ed6eae` (fix)

**Plan metadata:** (this commit)

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified

- `backend/main.py` - FastAPI app with lifespan, CORS, router mounts
- `backend/models/schemas.py` - EventSummary, SessionTypeInfo, LapData, ProgressEvent Pydantic models
- `backend/services/fastf1_service.py` - get_completed_events, get_session_types, serialize_laps, load_session_stream
- `backend/services/cache_service.py` - is_session_cached with case-insensitive filesystem glob
- `backend/routers/schedule.py` - GET /api/schedule/{year} and session-types endpoints with year validation
- `backend/routers/sessions.py` - GET /api/sessions/load SSE endpoint
- `backend/tests/conftest.py` - AsyncClient fixture, mock_schedule and mock_session with edge cases
- `backend/tests/test_schedule.py` - 7 tests covering year validation and event filtering
- `backend/tests/test_sessions.py` - 12 tests covering serialization, cache detection, SSE events
- `backend/pytest.ini` - asyncio_mode=auto, importlib mode
- `backend/conftest.py` - sys.path fix for root-level main.py conflict
- `backend/pyproject.toml` - FastAPI, FastF1, sse-starlette, pytest deps
- `.gitignore` - Added backend/cache/ exclusion

## Decisions Made

- Used `sse-starlette` package for `EventSourceResponse` (FastAPI's built-in SSE API is available via `fastapi.sse` but sse-starlette provides better compatibility)
- Set `--import-mode=importlib` in pytest.ini to prevent the root `main.py` (Streamlit app) from shadowing `backend/main.py`
- EventDate comparison normalizes both sides to tz-naive UTC — FastF1 returns `datetime64[ns]` (tz-naive) which raises TypeError when compared to `datetime.now(timezone.utc)` (tz-aware)
- `app.state.session_locks` initialized manually in the test fixture because FastAPI lifespan doesn't run in httpx AsyncClient tests (intentional FastAPI behavior for test isolation)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed tz-naive EventDate comparison TypeError**
- **Found during:** Overall verification (server startup test against real FastF1)
- **Issue:** FastF1 `get_event_schedule()` returns EventDate as `datetime64[ns]` (tz-naive). The plan showed `schedule["EventDate"] < now` where `now = datetime.now(timezone.utc)` (tz-aware). This raises `TypeError: Invalid comparison between dtype=datetime64[ns] and datetime`.
- **Fix:** Detect EventDate timezone awareness and normalize both sides to tz-naive UTC before comparison
- **Files modified:** `backend/services/fastf1_service.py`
- **Verification:** `GET /api/schedule/2020` returns HTTP 200 (previously 500); all 19 tests still pass
- **Committed in:** `5ed6eae`

**2. [Rule 3 - Blocking] Added sys.path fix for root main.py conflict**
- **Found during:** Task 2 (test collection)
- **Issue:** pytest's rootdir resolution found the git root first, so `from main import app` imported the Streamlit `main.py` at the repo root instead of `backend/main.py`
- **Fix:** Added `backend/conftest.py` with `sys.path.insert(0, backend_dir)` and `--import-mode=importlib` in pytest.ini
- **Files modified:** `backend/conftest.py`, `backend/pytest.ini`
- **Verification:** All 19 tests pass; `from main import app` resolves to `backend/main.py`
- **Committed in:** `ed3fccb`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for correctness. Timezone fix is documented Pitfall 6 in RESEARCH.md. No scope creep.

## Issues Encountered

- FastAPI lifespan doesn't run in httpx AsyncClient tests — resolved by manually setting `app.state.session_locks = {}` in the test fixture. This is the correct approach for unit tests (integration tests with real lifespan are out of scope for Phase 1).

## User Setup Required

None - no external service configuration required. FastF1 fetches data directly from the F1 API; no API keys needed.

## Next Phase Readiness

- Backend API fully functional: schedule, session types, and SSE session loading endpoints all operational
- All pandas/numpy type serialization patterns established and tested — safe for Phase 2 frontend consumption
- FastF1 cache configured and gitignored — cold loads will work; subsequent loads will be fast
- Per-session lock prevents concurrent duplicate loads
- Ready for Phase 2: Session Selector UI to connect to these endpoints

---
*Phase: 01-backend-foundation*
*Completed: 2026-03-13*
