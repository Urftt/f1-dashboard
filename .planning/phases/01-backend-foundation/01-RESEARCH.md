# Phase 1: Backend Foundation - Research

**Researched:** 2026-03-13
**Domain:** FastF1 + FastAPI (SSE) + React (Vite + Zustand + shadcn/ui)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Cascading dropdowns: Year → Grand Prix event → Session type
- Session type defaults to Race
- Year range: 2018 through current season
- Event dropdown shows only completed events
- Default year dropdown to current season
- Inline progress bar below session selector (not full-page overlay)
- Shows percentage + current stage name (e.g., "72% — Fetching lap data...")
- On failure: inline error message with retry button (replaces progress bar)
- Cached sessions visually marked in event dropdown
- On first open: session selector at top, empty dashboard below with "Select a session to get started"
- After successful load: progress bar completes, then dashboard panels fade in smoothly
- Selector compacts to single-line summary ("Monaco GP 2024 — Race") with a change button
- Monorepo: `frontend/` (React + TypeScript) and `backend/` (FastAPI + Python)
- Frontend: Vite, Tailwind CSS, shadcn/ui, Zustand, Plotly
- Backend: FastAPI + FastF1, Python 3.12+

### Claude's Discretion

- Exact SSE event format and progress stage granularity
- FastAPI project structure within `backend/`
- React component file organization within `frontend/src/`
- Exact fade-in animation implementation
- How to detect cached sessions for the dropdown indicator

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SESS-01 | User can select a historical F1 season (2018 onwards) | `fastf1.get_event_schedule(year)` covers 2018+; year list is static range |
| SESS-02 | User can browse Grand Prix events within a season | EventSchedule DataFrame gives EventName, RoundNumber, EventDate; filter past events by comparing Session*DateUtc against now |
| SESS-03 | User can select session type (Race, Qualifying, FP1/2/3) | Session identifiers: 'Race', 'Qualifying', 'Practice 1/2/3'; Event.Session1–5 fields enumerate available types |
| SESS-04 | User sees loading progress with percentage during FastF1 data fetch | FastAPI SSE with EventSourceResponse + asyncio.to_thread; named progress stages yielded as JSON events |
| SESS-05 | Loaded sessions are cached so reloads are instant | fastf1.Cache.enable_cache() in lifespan startup; cache dir detection for dropdown indicator via os.path.exists check on cache path |
</phase_requirements>

---

## Summary

This phase establishes the full project from scratch: a Python FastAPI backend that fetches historical F1 session data using FastF1 with disk caching, streams loading progress over SSE, and a React + TypeScript frontend that presents cascading dropdowns, a real-time progress bar, and loads all lap data into a Zustand store. There is no existing React or FastAPI code — this is greenfield on top of an existing Streamlit/OpenF1 project that will be superseded.

The critical technical constraint is that FastF1's `session.load()` is a blocking synchronous call that can take 30–120 seconds on a cold cache. It must be run in a thread pool (`asyncio.to_thread`) to avoid blocking the FastAPI event loop. Progress cannot be captured natively from FastF1 callbacks — instead, SSE stages are named milestones yielded before/after each FastF1 sub-call (`get_event_schedule`, `get_session`, `session.load(laps=True, telemetry=False, weather=False, messages=False)`).

The second critical constraint is pandas/numpy type serialization: FastF1 returns DataFrames with `Timedelta`, `numpy.float64`, `NaT`, and `pd.Timestamp` values that will cause silent 500 errors if passed through Pydantic without explicit conversion to Python primitives.

**Primary recommendation:** Wire SSE progress from named stages around `asyncio.to_thread(session.load)`, convert all FastF1 data to Python primitives before returning from FastAPI, and use `fastf1.Cache.enable_cache()` in FastAPI lifespan startup — never per-request.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastF1 | 3.5.3+ (3.8.1 latest) | F1 historical data fetch + disk cache | Only mature Python library for F1 lap-level historical data |
| FastAPI | 0.115+ | REST + SSE API server | Async-first, native SSE support via `EventSourceResponse`, Pydantic built in |
| Uvicorn | 0.30+ | ASGI server for FastAPI | Standard for FastAPI; supports async streaming |
| Pydantic v2 | 2.x | Request/response models, validation | Bundled with FastAPI; required for type safety |
| React | 18.x | Frontend UI framework | Locked in CONTEXT.md |
| Vite | 5.x | Frontend build + dev server | Locked in CONTEXT.md; fast HMR, native TS |
| Zustand | 5.x | Frontend state management | Locked in CONTEXT.md |
| Tailwind CSS | 4.x | Utility-first styling | Locked in CONTEXT.md |
| shadcn/ui | latest | Component primitives (select, progress, button) | Locked in CONTEXT.md; copies components into project |
| TypeScript | 5.x | Type safety on frontend | Standard with Vite React template |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pandas | 2.3+ | FastF1 data frames | Already in project; FastF1 returns Laps as pandas DataFrame |
| numpy | 2.2+ | Numeric types from FastF1 | Already in project; must convert to float() before JSON |
| python-dotenv | 1.1+ | Env var config in backend | Already in project |
| asyncio (stdlib) | — | Lock per session key, thread offloading | Prevents duplicate concurrent session loads |
| @microsoft/fetch-event-source | 1.0 | SSE client with POST support and retry | Better error handling than native EventSource; supports reconnect |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SSE (EventSourceResponse) | WebSockets | SSE is one-way server→client: simpler, correct for progress streaming |
| asyncio.to_thread | run_in_executor | Both work; to_thread is cleaner syntax in Python 3.9+ |
| fetch-event-source | native EventSource | Native EventSource is simpler but lacks POST and custom error handling |
| Tailwind v4 | Tailwind v3 | shadcn/ui init handles whichever version; prefer v4 for new projects |

**Installation (backend):**
```bash
# In backend/
uv add fastapi uvicorn[standard] python-dotenv
# FastF1, pandas, numpy already in pyproject.toml — move to backend/pyproject.toml
```

**Installation (frontend):**
```bash
# In frontend/
npm create vite@latest . -- --template react-ts
npx shadcn@latest init -t vite
npm install zustand @microsoft/fetch-event-source
```

---

## Architecture Patterns

### Recommended Project Structure

```
f1-dashboard/
├── backend/
│   ├── pyproject.toml          # FastAPI, FastF1, pandas, numpy deps
│   ├── main.py                 # FastAPI app + lifespan
│   ├── routers/
│   │   ├── schedule.py         # GET /api/schedule/{year}
│   │   └── sessions.py         # GET /api/sessions/load (SSE)
│   ├── services/
│   │   ├── cache_service.py    # Cache path helpers, is_cached detection
│   │   └── fastf1_service.py   # Wraps fastf1 calls, yields progress stages
│   ├── models/
│   │   └── schemas.py          # Pydantic models: EventSummary, LapData, ProgressEvent
│   └── cache/                  # FastF1 disk cache (gitignored)
└── frontend/
    ├── package.json
    ├── vite.config.ts          # Proxy /api → localhost:8000
    ├── tsconfig.json
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── stores/
    │   │   └── sessionStore.ts  # Zustand: session state, laps, loading progress
    │   ├── components/
    │   │   ├── SessionSelector/
    │   │   │   ├── SessionSelector.tsx   # Orchestrates cascading dropdowns
    │   │   │   ├── YearSelect.tsx
    │   │   │   ├── EventSelect.tsx
    │   │   │   └── SessionTypeSelect.tsx
    │   │   ├── LoadingProgress/
    │   │   │   └── LoadingProgress.tsx   # Inline progress bar + stage label
    │   │   └── Dashboard/
    │   │       └── EmptyState.tsx        # "Select a session to get started"
    │   └── lib/
    │       ├── api.ts            # Typed API client functions
    │       └── sse.ts            # SSE connection + event parsing
    └── components/ui/            # shadcn/ui generated components
```

### Pattern 1: FastAPI Lifespan — Cache Init + Shared Lock

**What:** Initialize FastF1 cache once at startup, store per-session locks in app.state to prevent duplicate concurrent loads.

**When to use:** Always — never call `enable_cache` per-request; never let two requests load the same session simultaneously.

```python
# Source: FastAPI docs https://fastapi.tiangolo.com/advanced/events/
from contextlib import asynccontextmanager
from fastapi import FastAPI
import fastf1
import asyncio
from pathlib import Path

CACHE_DIR = Path(__file__).parent / "cache"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    CACHE_DIR.mkdir(exist_ok=True)
    fastf1.Cache.enable_cache(str(CACHE_DIR))
    app.state.session_locks: dict[str, asyncio.Lock] = {}
    yield
    # Shutdown — nothing to clean up for FastF1

app = FastAPI(lifespan=lifespan)
```

### Pattern 2: SSE Progress Streaming with asyncio.to_thread

**What:** Run blocking `session.load()` in a thread, yield named progress events over SSE before and after each stage.

**When to use:** The only safe way to run FastF1 loading in an async FastAPI route.

```python
# Source: FastAPI SSE docs https://fastapi.tiangolo.com/tutorial/server-sent-events/
# and asyncio.to_thread (Python 3.9+)
import asyncio
import json
import fastf1
from fastapi import FastAPI, Request
from fastapi.sse import EventSourceResponse, ServerSentEvent
from collections.abc import AsyncIterable

async def load_session_stream(
    year: int, event: str, session_type: str, request: Request
) -> AsyncIterable[ServerSentEvent]:
    session_key = f"{year}_{event}_{session_type}"
    locks = request.app.state.session_locks
    if session_key not in locks:
        locks[session_key] = asyncio.Lock()

    async with locks[session_key]:
        def make_event(stage: str, pct: int) -> ServerSentEvent:
            return ServerSentEvent(
                data=json.dumps({"stage": stage, "pct": pct}),
                event="progress"
            )

        yield make_event("Connecting to F1 data...", 5)
        session = await asyncio.to_thread(
            fastf1.get_session, year, event, session_type
        )

        yield make_event("Fetching lap data...", 20)
        await asyncio.to_thread(
            session.load,
            laps=True,
            telemetry=False,  # not needed in phase 1
            weather=False,
            messages=False,
        )

        yield make_event("Processing...", 80)
        laps_data = serialize_laps(session.laps)

        yield ServerSentEvent(
            data=json.dumps({"laps": laps_data}),
            event="complete"
        )

@app.get("/api/sessions/load", response_class=EventSourceResponse)
async def load_session(year: int, event: str, session_type: str, request: Request):
    return EventSourceResponse(
        load_session_stream(year, event, session_type, request)
    )
```

### Pattern 3: FastF1 Primitive Serialization

**What:** Convert all pandas/numpy types to Python primitives before Pydantic/JSON serialization.

**When to use:** Every time FastF1 data exits the service layer.

```python
# Source: pitfall documented in STATE.md critical pitfalls
import pandas as pd
import numpy as np
from typing import Any

def serialize_timedelta(td: Any) -> float | None:
    """Convert pd.Timedelta to total seconds (float). Returns None for NaT."""
    if pd.isna(td):
        return None
    return float(td.total_seconds())

def serialize_laps(laps: pd.DataFrame) -> list[dict]:
    """Convert FastF1 Laps DataFrame to JSON-safe list of dicts."""
    result = []
    for _, row in laps.iterrows():
        result.append({
            "LapNumber": int(row["LapNumber"]) if not pd.isna(row["LapNumber"]) else None,
            "Driver": str(row["Driver"]),
            "LapTime": serialize_timedelta(row["LapTime"]),
            "Time": serialize_timedelta(row["Time"]),  # session timestamp at lap end
            "PitInTime": serialize_timedelta(row.get("PitInTime")),
            "PitOutTime": serialize_timedelta(row.get("PitOutTime")),
            "Compound": str(row["Compound"]) if pd.notna(row.get("Compound")) else None,
            "TyreLife": float(row["TyreLife"]) if pd.notna(row.get("TyreLife")) else None,
            "Position": int(row["Position"]) if pd.notna(row.get("Position")) else None,
            "Stint": int(row["Stint"]) if pd.notna(row.get("Stint")) else None,
        })
    return result
```

### Pattern 4: Filter Completed Events

**What:** Filter EventSchedule to only show events where the last session date is in the past.

**When to use:** Populating the event dropdown (only show events with available data).

```python
# Source: FastF1 events docs https://docs.fastf1.dev/events.html
from datetime import datetime, timezone
import fastf1

def get_completed_events(year: int) -> list[dict]:
    schedule = fastf1.get_event_schedule(year, include_testing=False)
    now = datetime.now(timezone.utc)
    # EventDate is usually the date of the last session — if it's in the past, data exists
    past = schedule[schedule["EventDate"] < now]
    return [
        {
            "round": int(row["RoundNumber"]),
            "name": str(row["EventName"]),
            "country": str(row["Country"]),
        }
        for _, row in past.iterrows()
    ]
```

### Pattern 5: Cache Detection for Dropdown Indicator

**What:** Check whether a session's cache file already exists on disk to mark it as "instant load" in the UI.

**When to use:** Claude's discretion — implement in `cache_service.py` as a helper.

```python
# FastF1 cache stores files under: {cache_dir}/{year}/{event_name}/
# No public API for is_cached — use filesystem check
import os
from pathlib import Path

def is_session_cached(cache_dir: Path, year: int, event: str, session_type: str) -> bool:
    """Best-effort check: if any cache file exists for this session key."""
    pattern = f"{year}*{event.replace(' ', '_')}*"
    candidates = list(cache_dir.glob(f"**/*{session_type}*"))
    return len(candidates) > 0
```

Note: FastF1 does not expose a public `is_cached()` API (confidence: MEDIUM — based on source inspection). The filesystem glob approach above is the pragmatic solution; it may have false positives if partial cache files exist.

### Pattern 6: Zustand Session Store (TypeScript)

**What:** Single Zustand store slice for session state — loading progress, lap data, session metadata.

**When to use:** The authoritative source of truth for all session-related UI state.

```typescript
// Source: Zustand docs https://github.com/pmndrs/zustand
import { create } from 'zustand'

type LoadingStage = 'idle' | 'loading' | 'complete' | 'error'

interface LapRow {
  LapNumber: number | null
  Driver: string
  LapTime: number | null  // seconds
  Time: number | null     // session timestamp at lap end (seconds)
  PitInTime: number | null
  PitOutTime: number | null
  Compound: string | null
  TyreLife: number | null
  Position: number | null
  Stint: number | null
}

interface SessionState {
  year: number | null
  event: string | null
  sessionType: string
  stage: LoadingStage
  progress: number
  stageLabel: string
  laps: LapRow[]
  error: string | null
  // Actions
  setSelection: (year: number, event: string, sessionType: string) => void
  setProgress: (pct: number, label: string) => void
  setLaps: (laps: LapRow[]) => void
  setError: (msg: string) => void
  reset: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  year: null,
  event: null,
  sessionType: 'Race',
  stage: 'idle',
  progress: 0,
  stageLabel: '',
  laps: [],
  error: null,
  setSelection: (year, event, sessionType) =>
    set({ year, event, sessionType, stage: 'loading', progress: 0, error: null }),
  setProgress: (progress, stageLabel) => set({ progress, stageLabel }),
  setLaps: (laps) => set({ laps, stage: 'complete', progress: 100 }),
  setError: (error) => set({ error, stage: 'error' }),
  reset: () => set({ stage: 'idle', progress: 0, laps: [], error: null }),
}))
```

### Pattern 7: Vite Proxy for Dev

**What:** Vite dev server proxies `/api` to the FastAPI backend, avoiding CORS issues during development.

```typescript
// vite.config.ts
// Source: https://vitejs.dev/config/server-options#server-proxy
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

### SSE Progress Stage Schema

Recommended (Claude's discretion) event format:

```
event: progress
data: {"pct": 5, "stage": "Connecting to F1 data..."}

event: progress
data: {"pct": 20, "stage": "Fetching session info..."}

event: progress
data: {"pct": 50, "stage": "Loading lap data..."}

event: progress
data: {"pct": 80, "stage": "Processing..."}

event: complete
data: {"laps": [...]}

event: error
data: {"message": "Session not found or data unavailable"}
```

This gives the frontend concrete stages to display (matching the CONTEXT.md requirement of "percentage + stage name").

### Anti-Patterns to Avoid

- **Calling `session.load()` directly in an `async def` route:** Blocks the event loop; all other requests hang. Always use `asyncio.to_thread`.
- **Calling `fastf1.Cache.enable_cache()` per-request:** Creates race conditions and cache corruption; call once in lifespan startup only.
- **Passing pandas DataFrame directly to Pydantic model:** `Timedelta`, `numpy.float64`, and `NaT` will not serialize; convert to primitives first.
- **Using `LapTime` sums for gap calculations:** Use `session.laps['Time']` (session-relative timestamp at lap end) instead, as established in STATE.md.
- **Loading telemetry in phase 1:** `session.load(telemetry=True)` adds significant load time and data volume; phase 1 only needs laps. Set `telemetry=False, weather=False, messages=False`.
- **Storing FastF1 cache in git:** Cache can reach 500+ MB; add `backend/cache/` to `.gitignore` immediately.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE streaming in FastAPI | Custom chunked response | `fastapi.sse.EventSourceResponse` (built into FastAPI 0.115+) | Handles keep-alive, headers, reconnect automatically |
| UI component primitives | Custom Select, Progress, Button | shadcn/ui (`Select`, `Progress`) | Accessible, keyboard-navigable, styled with Tailwind |
| Global state management | React Context + useReducer | Zustand | Far less boilerplate; no provider wrapping; works outside React |
| Type-safe env config | os.environ.get() scattered | pydantic-settings `BaseSettings` | Single validated config object, auto-loads from .env |
| Blocking I/O in async route | Thread pooling manually | `asyncio.to_thread()` | Standard library, correct solution for CPU/IO-bound sync work |
| JSON serialization of pandas | Manual `.to_json()` calls | Explicit primitive conversion function (see Pattern 3) | Prevents silent NaN/NaT/Timedelta bugs |

**Key insight:** The most dangerous hand-roll in this phase is the FastF1/pandas serialization layer — every field that can be `NaT` or `numpy.float64` must be explicitly converted or it will cause a 500 error that appears in no stack trace visible to the client.

---

## Common Pitfalls

### Pitfall 1: Blocking the Event Loop with session.load()

**What goes wrong:** `session.load()` runs for 30–120 seconds on a cold cache. If called directly in an `async def` route, it blocks the entire Uvicorn event loop — no other requests are served during this time.

**Why it happens:** FastF1 uses `requests` (synchronous HTTP) internally. Python's asyncio cannot yield during synchronous blocking calls.

**How to avoid:** Always wrap in `await asyncio.to_thread(session.load, ...)`.

**Warning signs:** Other API calls hang or timeout while a session is loading.

---

### Pitfall 2: Concurrent Duplicate Session Loads

**What goes wrong:** Two browser tabs load the same session simultaneously. FastF1 writes to the same cache file from two threads, corrupting it.

**Why it happens:** No coordination between concurrent requests.

**How to avoid:** Use a per-session-key `asyncio.Lock` stored in `app.state.session_locks`. The second request waits for the first to finish, then the cache serves it instantly.

**Warning signs:** Occasional "cache read error" or corrupt session data on repeated loads.

---

### Pitfall 3: Pandas/Numpy Type Serialization Failures

**What goes wrong:** FastAPI returns a 500 error (or silently drops fields) when a Pydantic model contains `pandas.Timedelta`, `numpy.float64`, or `pandas.NaT` values.

**Why it happens:** These types have no native JSON representation; Pydantic v2 raises a serialization error.

**How to avoid:** Use the `serialize_laps()` pattern (Pattern 3) to convert all fields to `float | None`, `int | None`, or `str | None` before constructing any Pydantic model or JSON response.

**Warning signs:** 500 errors on load completion with no error body; or fields silently `null` when they should have values.

---

### Pitfall 4: FastF1 Cache Directory Not Created Before enable_cache

**What goes wrong:** `fastf1.Cache.enable_cache(path)` raises `FileNotFoundError` if the directory doesn't exist.

**Why it happens:** FastF1 does not create the directory automatically (behavior verified in source).

**How to avoid:** `Path(CACHE_DIR).mkdir(exist_ok=True)` before `fastf1.Cache.enable_cache(str(CACHE_DIR))` in lifespan startup.

**Warning signs:** App fails to start with a FileNotFoundError traceback.

---

### Pitfall 5: EventSource Reconnect During Long Loads

**What goes wrong:** The browser's native `EventSource` automatically reconnects if the connection drops (e.g., after a 30-second load). This triggers a second load, creating duplicate work.

**Why it happens:** SSE spec mandates automatic reconnect on disconnect.

**How to avoid:** Use `@microsoft/fetch-event-source` on the frontend, which allows custom reconnect logic. On the backend, the per-session `asyncio.Lock` ensures the second connection waits for the first and then gets the cached result instantly.

**Warning signs:** Duplicate progress events or double loads in the network tab.

---

### Pitfall 6: EventDate Timezone Comparison Errors

**What goes wrong:** Comparing `event["EventDate"]` (pandas Timestamp, timezone-aware) with `datetime.now()` (naive) raises a TypeError.

**Why it happens:** FastF1 EventDate timestamps include timezone info; Python's `datetime.now()` returns a naive datetime.

**How to avoid:** Always use `datetime.now(timezone.utc)` for the comparison:
```python
from datetime import datetime, timezone
now = datetime.now(timezone.utc)
past = schedule[schedule["EventDate"] < now]
```

**Warning signs:** `TypeError: can't compare offset-naive and offset-aware datetimes` in the schedule endpoint.

---

## Code Examples

### Verified: FastF1 get_session and session.load

```python
# Source: https://docs.fastf1.dev/fastf1.html
import fastf1

# Get session object (does NOT load data yet)
session = fastf1.get_session(2024, "Monaco", "Race")

# Load only laps (fastest for phase 1 — skip telemetry/weather/messages)
session.load(laps=True, telemetry=False, weather=False, messages=False)

# Access laps DataFrame
laps = session.laps  # pd.DataFrame with columns: Time, Driver, LapTime, LapNumber, etc.
```

### Verified: FastF1 Event Schedule

```python
# Source: https://docs.fastf1.dev/events.html
import fastf1
from datetime import datetime, timezone

schedule = fastf1.get_event_schedule(2024, include_testing=False)
# Columns: RoundNumber, Country, Location, EventName, EventDate, Session1..5, Session1..5DateUtc

now = datetime.now(timezone.utc)
completed = schedule[schedule["EventDate"] < now]
# completed.EventName → ["Bahrain Grand Prix", "Saudi Arabian Grand Prix", ...]
```

### Verified: FastAPI SSE EventSourceResponse

```python
# Source: https://fastapi.tiangolo.com/tutorial/server-sent-events/
from fastapi.sse import EventSourceResponse, ServerSentEvent
from collections.abc import AsyncIterable

async def event_generator() -> AsyncIterable[ServerSentEvent]:
    yield ServerSentEvent(data='{"pct": 10, "stage": "Starting..."}', event="progress")
    # ... do work ...
    yield ServerSentEvent(data='{"laps": [...]}', event="complete")

@app.get("/api/sessions/load", response_class=EventSourceResponse)
async def load_session():
    return EventSourceResponse(event_generator())
```

### Verified: Zustand Store (TypeScript)

```typescript
// Source: https://github.com/pmndrs/zustand
import { create } from 'zustand'

// Use selectors to avoid unnecessary re-renders
const progress = useSessionStore((s) => s.progress)
const laps = useSessionStore((s) => s.laps)
```

### Verified: shadcn/ui Init (Vite)

```bash
# Source: https://ui.shadcn.com/docs/installation/vite
npx shadcn@latest init -t vite
# Then add specific components as needed:
npx shadcn@latest add select progress button
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@app.on_event("startup")` | `lifespan` async context manager | FastAPI 0.93+ | Cleaner startup/shutdown, supports state |
| Pydantic v1 | Pydantic v2 | FastAPI ~0.100+ | Stricter serialization — NaT/numpy64 now raises errors |
| EventSource (native) | @microsoft/fetch-event-source | 2022+ | POST support, reconnect control, better error handling |
| Streamlit + OpenF1 | FastAPI + FastF1 + React | This phase | Full interactivity, stateful replay, richer UX |
| `pip` + `requirements.txt` | `uv` + `pyproject.toml` | 2024+ | 10x faster installs, lock files, modern tooling |

**Deprecated/outdated:**
- `fastf1.Cache.enable_cache()` via `@app.on_event("startup")`: Replaced by `lifespan` pattern
- `force_ergast=True` in `get_session()`: Deprecated in FastF1 3.x; Ergast API shut down
- Direct `EventSource` for SSE with retry needs: Use `@microsoft/fetch-event-source` instead

---

## Open Questions

1. **FastF1 cache file naming convention for is_cached detection**
   - What we know: Cache is stored in `{cache_dir}/` with year/event-based subdirectories
   - What's unclear: Exact filename patterns — no public `is_cached()` API exposed by FastF1
   - Recommendation: Implement a filesystem glob check as a best-effort indicator; mark as LOW confidence until confirmed by running FastF1 locally and inspecting the cache directory structure

2. **SSE connection behavior when session is already loading (lock held)**
   - What we know: The second request will wait on the lock, then complete instantly
   - What's unclear: How `EventSourceResponse` handles a generator that blocks for 60+ seconds before yielding the first event
   - Recommendation: Yield a "Waiting for concurrent load..." event immediately on lock acquisition failure, before acquiring, so the client knows it's queued

3. **shadcn/ui version (v3 vs v4 docs exist)**
   - What we know: shadcn/ui `init -t vite` handles configuration automatically; v3 and v4 docs both exist
   - What's unclear: Whether the CLI automatically handles Tailwind v4 vs v3 differences
   - Recommendation: Run `npx shadcn@latest init` — "latest" will use the current stable version; if Tailwind v4 issues arise, fall back to v3 config

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest + httpx (async FastAPI testing) on backend; Vitest on frontend |
| Config file | `backend/pytest.ini` (Wave 0 gap) / `frontend/vitest.config.ts` (Wave 0 gap) |
| Quick run command | `cd backend && python -m pytest tests/ -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ && cd ../frontend && npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SESS-01 | `GET /api/schedule?year=2018` returns non-empty event list | integration | `pytest tests/test_schedule.py::test_get_schedule_2018 -x` | Wave 0 |
| SESS-02 | Events returned are only past events (EventDate < now) | unit | `pytest tests/test_schedule.py::test_only_completed_events -x` | Wave 0 |
| SESS-03 | Session type list matches FastF1 available sessions for an event | unit | `pytest tests/test_schedule.py::test_session_types -x` | Wave 0 |
| SESS-04 | SSE endpoint yields `progress` events with pct and stage fields | integration | `pytest tests/test_sessions.py::test_sse_progress_events -x` | Wave 0 |
| SESS-05 | Second load of same session returns `complete` event faster than first | integration | `pytest tests/test_sessions.py::test_cache_hit_faster -x` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && python -m pytest tests/ -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ && cd ../frontend && npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/__init__.py` — test package init
- [ ] `backend/tests/conftest.py` — shared fixtures (FastAPI test client, mock FastF1 calls)
- [ ] `backend/tests/test_schedule.py` — covers SESS-01, SESS-02, SESS-03
- [ ] `backend/tests/test_sessions.py` — covers SESS-04, SESS-05
- [ ] `backend/pytest.ini` — pytest configuration
- [ ] Framework install: `uv add --dev pytest httpx pytest-asyncio` in backend/
- [ ] `frontend/vitest.config.ts` — Vitest config for React components

---

## Sources

### Primary (HIGH confidence)
- [FastF1 docs (3.8.1)](https://docs.fastf1.dev/) — enable_cache, get_session, get_event_schedule signatures
- [FastF1 core module docs](http://docs.fastf1.dev/core.html) — Session.load() parameters, Laps DataFrame columns
- [FastF1 events docs](https://docs.fastf1.dev/events.html) — EventSchedule fields, EventDate, Session1-5 fields
- [FastAPI SSE docs](https://fastapi.tiangolo.com/tutorial/server-sent-events/) — EventSourceResponse, ServerSentEvent pattern
- [FastAPI lifespan docs](https://fastapi.tiangolo.com/advanced/events/) — lifespan startup/shutdown, app.state pattern
- [shadcn/ui Vite install](https://ui.shadcn.com/docs/installation/vite) — `npx shadcn@latest init -t vite`
- [Zustand GitHub](https://github.com/pmndrs/zustand) — TypeScript create<State>() pattern, selector usage

### Secondary (MEDIUM confidence)
- [FastAPI + Vite CORS/proxy setup](https://www.joshfinnie.com/blog/fastapi-and-react-in-2025/) — Vite proxy config pattern confirmed by multiple 2025 sources
- [Pydantic timedelta serialization discussion](https://github.com/fastapi/fastapi/discussions/10174) — Confirms timedelta serialization behavior with Pydantic v2

### Tertiary (LOW confidence)
- FastF1 cache filesystem structure for `is_cached` detection — based on source inspection; not documented in official API

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against official docs; versions from PyPI/npm
- Architecture: HIGH — patterns verified against FastAPI and FastF1 official docs
- Pitfalls: HIGH — critical pitfalls documented in STATE.md (already validated by prior research session), serialization issues verified via Pydantic/FastAPI GitHub discussions
- Cache detection: LOW — no public API; filesystem approach is pragmatic but unverified

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (FastF1 and FastAPI release frequently; verify SSE API if FastAPI version changes)
