# Architecture Research

**Domain:** Race replay dashboard — React+TypeScript frontend, FastAPI backend, FastF1 data
**Researched:** 2026-03-13
**Confidence:** HIGH (stack is well-documented; patterns are standard; FastF1 specifics verified)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Browser (React + TS)                       │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │SessionPicker │  │  GapChart    │  │    StandingsBoard     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬────────────┘  │
│         │                 │                      │               │
│  ┌──────▼─────────────────▼──────────────────────▼────────────┐  │
│  │                   Zustand Store                             │  │
│  │   sessionState · replayState · lapData · driverData        │  │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │ fetch / SSE                        │
├─────────────────────────────┼────────────────────────────────────┤
│                        FastAPI (Python)                          │
├─────────────────────────────┼────────────────────────────────────┤
│  ┌──────────────┐  ┌────────▼──────┐  ┌────────────────────┐   │
│  │  /sessions   │  │ /session/load  │  │  /session/{id}/... │   │
│  │  GET listing │  │  SSE stream   │  │  laps · standings  │   │
│  └──────┬───────┘  └───────┬───────┘  └────────┬───────────┘   │
│         │                  │                    │               │
│  ┌──────▼──────────────────▼────────────────────▼────────────┐  │
│  │                  SessionService                            │  │
│  │         (FastF1 orchestration, in-memory cache)           │  │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
│  ┌──────────────────────────▼───────────────────────────────┐   │
│  │               FastF1  (synchronous, blocking)             │   │
│  │   fastf1.get_session() → session.load() → laps DataFrame  │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
│  ┌──────────────────────────▼───────────────────────────────┐   │
│  │            FastF1 Cache (~/.cache/fastf1/)                │   │
│  │        Parquet files — loads in ~2s on cache hit          │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| SessionPicker | Year/event/session type selection and load trigger | React controlled form + fetch |
| GapChart | Driver gap over laps, interactive zoom/hover | react-plotly.js Scatter trace |
| StandingsBoard | Per-lap standings: position, gap, compound, pits | HTML table, updated by replay clock |
| Zustand Store | Single source of truth for all UI state | zustand with typed slices |
| FastAPI routers | Thin HTTP/SSE layer; no business logic | APIRouter per feature area |
| SessionService | Loads FastF1 data once, caches in process memory | Python class with dict cache |
| FastF1 | Historical F1 data: laps, timing, compounds, pits | External library (synchronous) |

## Recommended Project Structure

```
f1-dashboard/
├── backend/
│   ├── main.py                    # FastAPI app, CORS, router registration
│   ├── routers/
│   │   ├── sessions.py            # GET /sessions — event schedule listing
│   │   └── session.py             # POST /session/load (SSE), GET /session/{id}/*
│   ├── services/
│   │   └── session_service.py     # FastF1 orchestration, in-memory store
│   ├── models/
│   │   └── schemas.py             # Pydantic response models
│   └── pyproject.toml             # fastf1, fastapi, uvicorn, sse-starlette
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts          # Typed fetch wrappers for all endpoints
│   │   ├── store/
│   │   │   └── useStore.ts        # Zustand store — all shared state
│   │   ├── components/
│   │   │   ├── SessionPicker/
│   │   │   │   └── SessionPicker.tsx
│   │   │   ├── GapChart/
│   │   │   │   └── GapChart.tsx
│   │   │   ├── StandingsBoard/
│   │   │   │   └── StandingsBoard.tsx
│   │   │   └── ReplayControls/
│   │   │       └── ReplayControls.tsx
│   │   ├── hooks/
│   │   │   └── useReplay.ts       # Replay timer, lap advancement logic
│   │   ├── types/
│   │   │   └── f1.ts              # Shared TypeScript types (LapData, Driver, etc.)
│   │   └── App.tsx
│   ├── vite.config.ts             # Proxy /api → http://localhost:8000
│   └── package.json
│
├── .planning/
└── pyproject.toml                 # Top-level uv workspace (optional)
```

### Structure Rationale

- **backend/routers/:** Thin HTTP layer only. No FastF1 calls here — keeps endpoints testable without data loading.
- **backend/services/:** All FastF1 logic is isolated here. Swapping data source later (e.g., OpenF1 live) only touches this layer.
- **backend/models/:** Pydantic schemas define the contract between backend and frontend. Generate TypeScript types from these (e.g., datamodel-code-generator).
- **frontend/store/:** One Zustand store for all cross-component state. Avoids prop drilling across SessionPicker → GapChart → StandingsBoard.
- **frontend/hooks/useReplay.ts:** Replay timer is isolated in a custom hook — `setInterval` for advancing `currentLap`, speed multiplier, pause/resume. Kept out of the store because it's a side effect.
- **frontend/api/client.ts:** All fetch calls in one place. Returns typed Promise results. Error handling centralized here.

## Architectural Patterns

### Pattern 1: SSE for Session Load Progress

**What:** FastAPI streams load progress events over Server-Sent Events while FastF1 loads data in a background thread. Frontend shows a progress bar.

**When to use:** FastF1 `session.load()` is synchronous and blocking — first load takes 10-30 seconds over network, ~2 seconds from cache. SSE lets the UI stay responsive and show progress rather than hanging on a blank POST response.

**Trade-offs:** Slightly more complex than a plain POST+poll. Worth it because the loading delay is the biggest UX risk.

**Example:**
```python
# backend/routers/session.py
import asyncio
import threading
from sse_starlette.sse import EventSourceResponse

@router.get("/session/load")
async def load_session(year: int, event: str, session_type: str):
    async def event_generator():
        yield {"data": '{"status": "loading", "progress": 0}'}
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            session_service.load,
            year, event, session_type
        )
        yield {"data": f'{{"status": "ready", "session_id": "{result.session_id}"}}'}
    return EventSourceResponse(event_generator())
```

```typescript
// frontend/api/client.ts
export function loadSession(year: number, event: string, type: string) {
  const url = `/api/session/load?year=${year}&event=${event}&session_type=${type}`;
  const source = new EventSource(url);
  return source; // caller subscribes to onmessage
}
```

### Pattern 2: Load-Once, Serve-Many (In-Memory Session Cache)

**What:** When FastF1 loads a session, the result (a set of DataFrames) is stored in a process-level dict keyed by session ID. All subsequent API requests for that session read from memory.

**When to use:** Always — FastF1 data is immutable historical data. Re-loading from disk or network on every request would be 2-30 second penalty per call.

**Trade-offs:** Memory usage (~50-200 MB per loaded session for full lap + telemetry data). Acceptable for a single-user local tool. For multi-user deployment this would need a per-session LRU eviction policy.

**Example:**
```python
# backend/services/session_service.py
class SessionService:
    def __init__(self):
        self._sessions: dict[str, LoadedSession] = {}

    def load(self, year: int, event: str, session_type: str) -> LoadedSession:
        key = f"{year}_{event}_{session_type}"
        if key not in self._sessions:
            session = fastf1.get_session(year, event, session_type)
            session.load(laps=True, telemetry=False, weather=False)
            self._sessions[key] = LoadedSession(session)
        return self._sessions[key]

    def get_laps_at(self, session_id: str, up_to_lap: int) -> list[dict]:
        return self._sessions[session_id].laps_up_to(up_to_lap)
```

### Pattern 3: Client-Side Replay Clock

**What:** The replay engine lives entirely in the frontend. The backend serves the complete session lap data upfront (one API call after load). The frontend `useReplay` hook advances `currentLap` on a `setInterval` tick, filtered by speed multiplier.

**When to use:** Always for this use case — replay is a UI concern, not a data concern. The backend has no concept of "current lap"; it just answers data queries.

**Trade-offs:** All laps (~20 drivers × 50-70 laps = ~1400 rows) transferred at once on session load. At ~1 KB/row serialized this is ~1.4 MB — well within acceptable range for a local tool. Avoids the complexity of per-tick server polling and race conditions between replay speed and network latency.

**Example:**
```typescript
// frontend/hooks/useReplay.ts
export function useReplay(totalLaps: number) {
  const { currentLap, setCurrentLap, speed, isPlaying } = useStore();

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentLap(lap => Math.min(lap + 1, totalLaps));
    }, 1000 / speed);
    return () => clearInterval(interval);
  }, [isPlaying, speed, totalLaps]);
}
```

## Data Flow

### Session Load Flow

```
User selects year/event/session type
    ↓
SessionPicker calls loadSession(year, event, type) → opens EventSource
    ↓
FastAPI: GET /api/session/load?...
    ↓
SessionService.load() → run_in_executor (thread pool)
    ↓
fastf1.get_session(year, event, type).load(laps=True)
    ↓ (2–30s)
SSE event: {"status": "ready", "session_id": "2024_Monaco_R"}
    ↓
Frontend: stores session_id, calls GET /api/session/{id}/laps
    ↓
SessionService returns all laps serialized to JSON
    ↓
Zustand: stores lapData[], derives driverList
    ↓
GapChart + StandingsBoard render with currentLap = 1
```

### Replay Flow

```
User presses Play
    ↓
useStore: isPlaying = true
    ↓
useReplay hook: setInterval ticks at 1000ms / speed
    ↓
setCurrentLap(lap + 1) on each tick
    ↓
GapChart re-renders: filters lapData where LapNumber <= currentLap
StandingsBoard re-renders: shows state at currentLap
    ↓
User jumps to lap 30: setCurrentLap(30) directly
```

### Key Data Flows

1. **Session loading:** SSE stream → session_id → one bulk fetch of all laps → stored in Zustand
2. **Replay advancement:** Client-only setInterval → currentLap counter → component filters on currentLap
3. **Gap chart:** Derived from lapData — `lapData.filter(d => d.LapNumber <= currentLap)` for each selected driver, then diff at each lap
4. **Standings board:** Derived from lapData at `currentLap` — sorted by Position, shows Compound + PitInTime

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| FastF1 library | Python import, synchronous blocking call | Must run in thread pool (run_in_executor) to avoid blocking FastAPI event loop |
| FastF1 disk cache | Automatic via fastf1.Cache.enable_cache() | Set cache dir to ~/.cache/fastf1 or project-local .fastf1_cache; cache hit = ~2s |
| Vite dev proxy | vite.config.ts proxy /api → localhost:8000 | Eliminates CORS headers in dev; production uses nginx or FastAPI static file serving |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| SessionPicker → Zustand | Direct store write via useStore() | On load complete: stores session_id and lapData |
| GapChart ↔ Zustand | Read selectedDrivers, lapData, currentLap | No props threading needed |
| StandingsBoard ↔ Zustand | Read lapData at currentLap, driverInfo | Derives standings per-lap from lap Position column |
| ReplayControls ↔ Zustand | Writes isPlaying, speed, currentLap | useReplay hook subscribes to these |
| Frontend ↔ FastAPI | REST (JSON) + SSE (load progress) | All calls through `/api/client.ts`; base URL from env var |
| FastAPI routers ↔ SessionService | Direct Python call (singleton injected via FastAPI dependency) | SessionService is stateful — use `app.state` or module-level singleton |

## What Is New vs Modified

| Item | Status | Notes |
|------|--------|-------|
| `backend/` directory | **New** | Replaces root-level Streamlit files |
| `backend/services/session_service.py` | **New** — wraps existing logic | `data_fetcher.py` (OpenF1) and `data_processor.py` (IntervalCalculator) are replaced; interval calculation logic moves here but now uses FastF1 lap data |
| `frontend/` directory | **New** | No existing React code |
| `app.py` | **Replaced** | Streamlit app deleted; all UI becomes React |
| `data_fetcher.py` | **Replaced** | Was OpenF1 API — new SessionService uses FastF1 instead |
| `data_processor.py` | **Reused conceptually** | IntervalCalculator logic (gap = d2.LapStartDate - d1.LapStartDate per lap) is reproduced backend-side, but simpler with FastF1's cleaner per-lap data |
| `config.py` | **Replaced** | Backend gets a `settings.py` using Pydantic BaseSettings |

## Suggested Build Order

Build order respects hard dependencies: you can't build the GapChart without data; you can't get data without the API; you can't call the API without FastF1 loading working.

1. **Backend: FastF1 data layer** — `SessionService.load()` + `get_laps()` working in isolation (test with a Python script). This is the highest-risk piece; validate FastF1 field names and data shape first.

2. **Backend: FastAPI skeleton** — `GET /sessions` (event list) and `GET /session/{id}/laps` returning real data. Add CORS. Add `run_in_executor` wrapper. Validate JSON shape.

3. **Backend: SSE load progress** — Add `GET /api/session/load` SSE endpoint. Test with `curl`. This is optional infrastructure but critical for UX — build it before the frontend so the contract is set.

4. **Frontend: Store + API client** — Zustand store with typed state, `client.ts` with typed fetch wrappers. No UI yet — validate types compile.

5. **Frontend: SessionPicker + load flow** — Form, EventSource subscription, progress display, store population. End-to-end: select session → data in store.

6. **Frontend: GapChart** — Plotly Scatter with `lapData` filtered by `currentLap` for two drivers. Hardcode drivers first, add selector second.

7. **Frontend: Replay controls + useReplay hook** — Play/pause/speed/jump-to-lap. Wire to GapChart filtering.

8. **Frontend: StandingsBoard** — Table reading position data at `currentLap`. Compound and pit stop annotations.

## Anti-Patterns

### Anti-Pattern 1: Calling FastF1 Directly in an Async Route

**What people do:** `@app.get("/load") async def load(): session = fastf1.get_session(...); session.load()`

**Why it's wrong:** `session.load()` is synchronous and blocks for 10-30 seconds. Inside an async route, this blocks the entire FastAPI event loop — no other request can be served until it completes.

**Do this instead:** `await asyncio.get_event_loop().run_in_executor(None, session_service.load, year, event, type)` — offloads the blocking call to a thread pool worker.

### Anti-Pattern 2: Fetching Laps Per-Tick During Replay

**What people do:** Call `GET /api/session/{id}/laps?lap=N` on every replay tick to get incremental data.

**Why it's wrong:** Creates a waterfall of HTTP requests (one per second at 1x speed), adds latency jitter to replay smoothness, and hammers the backend for no reason — the data doesn't change.

**Do this instead:** Fetch all laps once after session load, store in Zustand, filter client-side by `currentLap` on each render. The full dataset is ~1-2 MB and fits comfortably in browser memory.

### Anti-Pattern 3: Re-Creating Plotly Figure Object on Every Render

**What people do:** Construct a new `data` and `layout` object on every React render, passing them as new references to `<Plot>`.

**Why it's wrong:** React Plotly detects change by reference equality. New objects on every render triggers a full Plotly redraw — visible as chart flash and lag, especially with 1400+ data points.

**Do this instead:** Memoize the trace data with `useMemo(() => buildTraces(lapData, currentLap, selectedDrivers), [lapData, currentLap, selectedDrivers])` and use `Plotly.react()` under the hood (which `react-plotly.js` does by default when you don't recreate the component).

### Anti-Pattern 4: Storing Replay Timer in Zustand

**What people do:** Put `setInterval` ID or timer logic inside a Zustand store action.

**Why it's wrong:** Zustand stores are not lifecycle-aware. React's `useEffect` cleanup is the correct mechanism for managing intervals (start on mount / dependency change, clear on unmount / stale closure). Mixing setInterval into Zustand leads to leaked intervals and stale closures over `currentLap`.

**Do this instead:** Keep the interval in `useReplay` hook using `useEffect` with proper cleanup. The hook reads `speed` and `isPlaying` from Zustand but manages the timer itself.

## Scaling Considerations

This is a personal local tool (single user). Scale is not a concern. The only relevant "scale" dimension is data volume per session.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 user, local | Current design is correct — in-memory cache, no auth, no persistence |
| Add live data (future milestone) | Add a second service alongside SessionService: `LiveService` that polls OpenF1 API. Same frontend store interface — just a different data source. |
| Multi-user / deployment | Add per-session LRU eviction in SessionService; add auth; consider Redis for shared session cache across workers |

### Scaling Priorities

1. **First bottleneck:** FastF1 load time (10-30s cold, 2s warm). Mitigated by SSE progress feedback and disk cache. Enable `fastf1.Cache.enable_cache()` on startup.
2. **Second bottleneck:** Large telemetry data if telemetry=True is added later (~10x larger than laps-only). Mitigate by keeping `telemetry=False` until explicitly needed.

## Sources

- FastF1 documentation — Timing and Telemetry Data: https://docs.fastf1.dev/core.html
- FastF1 getting started: https://docs.fastf1.dev/getting_started/basics.html
- FastAPI official SSE docs: https://fastapi.tiangolo.com/tutorial/server-sent-events/
- FastAPI background tasks: https://fastapi.tiangolo.com/tutorial/background-tasks/
- sse-starlette (SSE for FastAPI/Starlette): https://github.com/sysid/sse-starlette
- Zustand state management (2025): https://makersden.io/blog/react-state-management-in-2025
- React Plotly.js performance: https://github.com/plotly/react-plotly.js/issues/68
- FastAPI + React full-stack template: https://github.com/fastapi/full-stack-fastapi-template
- FastAPI and React in 2025: https://www.joshfinnie.com/blog/fastapi-and-react-in-2025/

---
*Architecture research for: F1 Race Replay Dashboard (React + FastAPI + FastF1)*
*Researched: 2026-03-13*
