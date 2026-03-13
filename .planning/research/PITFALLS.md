# Pitfalls Research

**Domain:** F1 Race Replay Dashboard (FastF1 + FastAPI + React + Plotly)
**Researched:** 2026-03-13
**Confidence:** HIGH (most findings verified against official FastF1 docs and FastAPI docs)

---

## Critical Pitfalls

### Pitfall 1: session.load() Blocks the Entire FastAPI Event Loop

**What goes wrong:**
`session.load()` in FastF1 is a synchronous, blocking call. It fetches multiple data sources (timing stream, telemetry, car data, driver list) sequentially and can take 10–60 seconds on first load without cache. When called directly inside an `async def` FastAPI endpoint, it blocks the entire ASGI event loop, making all other requests unresponsive for the duration of the load.

**Why it happens:**
FastF1 was designed for Jupyter notebooks and scripts, not for concurrent web server use. Developers assume that since FastAPI supports `async`, calling sync library code inside an `async def` is fine — it is not. The call will block the single event loop thread.

**How to avoid:**
Wrap `session.load()` in `asyncio.to_thread()` (Python 3.9+) or `loop.run_in_executor(None, ...)` to offload it to the default thread pool. Always use a background task pattern with progress streaming (SSE or polling a status endpoint) so the frontend can show a loading indicator:

```python
import asyncio

async def load_session_async(year, event, session_type):
    session = await asyncio.to_thread(
        fastf1.get_session, year, event, session_type
    )
    await asyncio.to_thread(session.load)
    return session
```

**Warning signs:**
- All API requests hang when session loading is in progress
- FastAPI access logs show requests queuing during load
- Frontend appears completely frozen, not just the session-select UI

**Phase to address:**
Phase 1 (Backend foundation / session loading endpoint) — must be correct from the first implementation.

---

### Pitfall 2: FastF1 Cache Not Configured — Repeated 30-60 Second Loads

**What goes wrong:**
Without the cache enabled, every `session.load()` re-downloads all timing data from the F1 live timing archive. A full race session is ~50–150 MB of raw data. Without caching, each request to the backend takes minutes; with caching, repeat loads take seconds. The FastF1 docs explicitly warn: "Disabling the cache is highly discouraged and will generally slow down your programs."

**Why it happens:**
Developers skip the one-line cache setup because the library works without it. In a web server context the default temporary OS cache location may also not persist between server restarts.

**How to avoid:**
Always call `fastf1.Cache.enable_cache()` with an explicit, persistent directory path at application startup — not inside request handlers. Use a project-local path like `./fastf1_cache` or configure via environment variable. Add the cache directory to `.gitignore` (FastF1 cache can exceed 500 MB and get repos flagged/banned).

```python
# In FastAPI app startup
import fastf1
import os

CACHE_DIR = os.getenv("FASTF1_CACHE", "./fastf1_cache")
os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)
```

**Warning signs:**
- Session loading consistently takes 30+ seconds every time, even for the same session
- Large network traffic on every reload
- `fastf1_http_cache.sqlite` file not present in your expected cache directory

**Phase to address:**
Phase 1 (Backend bootstrap) — configure cache as the very first thing before any data loading.

---

### Pitfall 3: FastF1 Cache Operations Are Not Thread-Safe

**What goes wrong:**
The FastF1 cache management functions (`Cache.set_disabled()`, `Cache.set_enabled()`, `Cache.disabled()` context manager) are explicitly documented as NOT multithreading-safe. In a FastAPI app serving concurrent requests that each try to load sessions, cache state corruption can occur — sessions load inconsistently or raise `OperationalError: unable to open database file`.

**Why it happens:**
Multiple concurrent requests trigger concurrent calls to FastF1 internals, which share global cache state. FastF1 was not designed for concurrent server use.

**How to avoid:**
Use a session loading pattern with a mutex or loading state cache at the application level — load each unique session only once, store the result in memory, and return the cached result to subsequent requests. Never toggle cache enable/disable state at runtime in a server context.

```python
# Application-level session cache
_loaded_sessions: dict[str, Any] = {}
_loading_locks: dict[str, asyncio.Lock] = {}

async def get_or_load_session(key: str, year: int, event: str, session_type: str):
    if key not in _loading_locks:
        _loading_locks[key] = asyncio.Lock()
    async with _loading_locks[key]:
        if key not in _loaded_sessions:
            session = await asyncio.to_thread(fastf1.get_session, year, event, session_type)
            await asyncio.to_thread(session.load)
            _loaded_sessions[key] = session
    return _loaded_sessions[key]
```

**Warning signs:**
- `OperationalError: unable to open database file` in FastF1 logs
- Different API requests for the same session return inconsistent results
- Cache corruption after concurrent load attempts

**Phase to address:**
Phase 1 (Backend session loading) — implement the in-memory session store from the start.

---

### Pitfall 4: Gap Calculation Using Raw Cumulative Lap Times Produces Inaccurate Results

**What goes wrong:**
Computing "gap between two drivers" by summing `LapTime` values per driver and taking the difference produces inaccurate gaps. FastF1 lap times have known inaccuracies — pit lap times include stationary pit time, safety car laps are outliers, and laptimes for crash laps are NaT. Summing these produces cumulative error that grows lap-by-lap, making the gap chart drift from reality. The FastF1 docs warn explicitly: "Errors can stack up" when using integrated values.

**Why it happens:**
It feels natural to compute `driver_a_total_time - driver_b_total_time` as the gap. It works for clean green-flag racing but produces garbage for pit laps, safety car laps, and first laps.

**How to avoid:**
Use the `Time` column from the laps DataFrame, which represents the session time at lap end — this is derived directly from the timing stream and not accumulated. Gap between drivers at lap N = `session.laps.pick_driver(A).iloc[N]['Time'] - session.laps.pick_driver(B).iloc[N]['Time']`. Filter out inaccurate laps using `lap['IsAccurate']` or `pick_quicklaps()` for display purposes.

**Warning signs:**
- Gap chart shows driver "A" ahead by an unrealistic amount after a pit stop
- Gap values diverge from what the TV broadcast shows
- Gaps continue growing even when drivers are clearly side-by-side on circuit

**Phase to address:**
Phase 2 (Gap chart feature) — validate gap calculation logic against known race results before building the UI on top of it.

---

### Pitfall 5: Position Data Is NaN for Practice and Qualifying Sessions

**What goes wrong:**
`session.laps['Position']` returns NaN for all FP1, FP2, FP3, Sprint Shootout, and Qualifying sessions. The "standings board" feature breaks with a KeyError or renders all positions as empty if code assumes position data always exists.

**Why it happens:**
Race position tracking is inherently different from qualifying — in qualifying, there is no fixed "position" mid-session in the same sense. The F1 timing stream doesn't publish car position data for these session types. FastF1 documents this behavior but it's easy to miss.

**How to avoid:**
Add session type guards throughout the standings/position code. For qualifying, derive standings from lap time order, not from the `Position` column. For races, use `Position` normally. Handle NaT/NaN gracefully everywhere position is rendered.

```python
if session.session_info['Type'] == 'R':  # Race
    positions = session.laps.groupby('Driver')['Position'].last()
else:  # Qualifying / Practice
    positions = session.laps.groupby('Driver')['LapTime'].min().rank()
```

**Warning signs:**
- Standings board shows all positions as blank or "N/A"
- `ValueError` or NaN propagation errors when sorting by position
- Only appears in testing with non-race session types

**Phase to address:**
Phase 2 (Standings board) — implement session-type-aware position logic from the start.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode FastAPI port 8000 in React fetch calls | Avoids Vite proxy setup | Breaks in any non-dev environment; CORS errors | Never — set up Vite proxy in Phase 1 |
| Call `session.load()` without in-memory caching | Simpler code | Every chart interaction re-loads the full session (30–60s per request) | Never — load once per session key |
| Use full react-plotly.js bundle | Easiest import | ~2 MB minified JS added to bundle; slower initial page load | Acceptable for local personal tool |
| Skip `IsAccurate` filtering on lap data | Faster to implement | Pit laps, SC laps, crash laps pollute the gap chart with spikes | Never for the gap chart specifically |
| Load all lap data in one JSON response | Simpler API contract | Full race is ~3000 rows × 30+ columns; serialization delay, large payload | Only if lap count is paginated or filtered |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| FastAPI + React CORS | `allow_origins=["*"]` in development, forgotten in reconfiguration | Set `allow_origins=["http://localhost:5173"]` (Vite default) explicitly from the start |
| Vite proxy | Hardcoding full backend URL `http://localhost:8000` in React fetch calls | Configure `server.proxy` in `vite.config.ts`; use relative `/api/` paths in all fetch calls |
| Vite proxy + Vite build | Assuming proxy works in production builds | Vite proxy ONLY works in `dev` mode; `npm run build` output has no proxy — irrelevant for local-only tool but document it |
| FastF1 + FastAPI startup | Calling `fastf1.Cache.enable_cache()` per-request | Call once in FastAPI `lifespan` startup event, not per request handler |
| Plotly + React state | Passing new object references for `data` and `layout` props on every render | Memoize with `useMemo` — react-plotly.js does deep comparison but repeated new objects still trigger unnecessary diffs |
| pandas Timedelta → JSON | Returning pandas Timedelta objects directly from FastAPI | Convert all Timedelta/Timestamp to ISO strings or float seconds before serializing; FastAPI cannot auto-serialize pandas types |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Sending full session DataFrame as JSON per replay tick | Chart re-render lags with each lap advance, large responses | Pre-compute all lap states server-side; send only the current lap's delta or a pre-aggregated summary list | Immediately — even at 58 laps × 20 drivers |
| Plotly SVG rendering with all 58 laps × 2 drivers as individual points | Hover over chart lags; zoom is sluggish | Use `scattergl` (WebGL) trace type instead of `scatter`; or down-sample to ~200 points for the gap chart | At 500+ points per trace; gap chart has ~58 which is fine — telemetry would be the trigger |
| Multiple concurrent `session.load()` calls for the same session | Server hangs; double-loading; cache contention | Application-level session store with asyncio Lock (see Pitfall 3) | At 2+ concurrent users / browser tabs |
| Loading all session data upfront at startup | Long startup time; blocks FastAPI from being ready | Lazy-load sessions on first request, cache result in memory | Not a trap for single-user local app, but don't auto-load on startup |
| Plotly re-rendering entire chart on every replay tick | React re-renders feel janky, chart flickers | Use `react-plotly.js` `onUpdate` with revision counter; update only the frame data, not the full layout | At > 1 tick/second replay speed |

---

## Security Mistakes

This is a local personal tool with no multi-user access, no authentication, and no sensitive data. Security surface is minimal. The relevant domain-specific risks are:

| Mistake | Risk | Prevention |
|---------|------|------------|
| Committing the `fastf1_cache` directory to git | Repo size explodes (500+ MB); GitHub may ban the repo | Add `fastf1_cache/` to `.gitignore` immediately in Phase 1 |
| Exposing FastAPI on `0.0.0.0` without firewall | Other devices on local network can access the API | Bind to `127.0.0.1` for local-only use; `0.0.0.0` only if LAN access is desired intentionally |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading state during session.load() | UI appears frozen for 10–60s on first session load; user cannot tell if the app is working | Show progressive loading feedback via SSE or polling a `/session/status` endpoint; display steps ("Fetching timing data...", "Processing laps...") |
| Replay speed set to real-time (1x) | A 90-minute race takes 90 minutes to replay | Default to 5x or 10x; offer a speed selector with 1x, 5x, 10x, 30x; instant jump-to-lap is higher priority than smooth animation |
| Gap chart Y-axis shows raw seconds with no context | User cannot tell if a 3-second gap is large or small | Label the Y-axis clearly; add a "pit stop" marker so users understand gap spikes; consider showing as "+Xs" with sign indicating which driver leads |
| Pit lap spikes on gap chart with no annotation | Gap chart shows sudden ±30 second jumps that look like data errors | Annotate pit stop laps with a vertical line or marker; or exclude pit laps from gap line and show them as separate annotations |
| Session picker shows raw year/event name strings | "2024 Bahrain GP" vs "BAHRAIN GRAND PRIX 2024" — confusing inconsistency from FastF1 schedule data | Normalize display names using `session.event['EventName']` and `session.event['OfficialEventName']`; standardize format in API response |

---

## "Looks Done But Isn't" Checklist

- [ ] **Session loading:** Shows a loading state — verify it also handles the case where FastF1 raises an exception (network failure, F1 archive unavailable)
- [ ] **Gap chart:** Looks correct for a clean race — verify it also handles safety car laps, virtual safety car periods, and pit stops without nonsensical spikes
- [ ] **Standings board:** Shows correct positions for races — verify it degrades gracefully (or hides) for qualifying/practice sessions where `Position` is NaN
- [ ] **Replay engine:** Advances laps correctly at 1x — verify jump-to-lap and that replay state resets when a different session is selected
- [ ] **Backend serialization:** Returns JSON from FastAPI — verify no `pandas.Timedelta`, `numpy.float64`, or `pandas.NaT` objects slip through (these cause 500 errors silently during serialization)
- [ ] **Cache path:** Cache is enabled in development — verify the cache path exists and is writable; verify it is in `.gitignore`
- [ ] **CORS:** React can fetch from FastAPI in dev — verify CORS is configured for the exact Vite dev server origin (`localhost:5173` not `127.0.0.1:5173`)

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Event loop blocked by sync session.load() | MEDIUM | Refactor endpoint to use `asyncio.to_thread()`; add in-memory session store; add background task pattern |
| Cache not configured — slow loads | LOW | Add `fastf1.Cache.enable_cache()` to startup; add `fastf1_cache/` to `.gitignore`; existing sessions will be re-fetched once then cached |
| Gap calculation using summed lap times | MEDIUM | Rewrite gap calculation to use `session.laps['Time']` (session time at lap end) instead of cumulative `LapTime`; retest all gap chart output |
| Position data NaN in qualifying | LOW | Add session-type check; derive standings from lap time rank for non-race sessions |
| pandas types in JSON responses | LOW | Add a serialization utility that converts all pandas/numpy types to Python primitives; apply to all response models |
| react-plotly.js bundle too large | LOW | Switch to `plotly.js/dist/plotly-basic` partial bundle via `createPlotComponent` factory |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Blocking event loop (session.load) | Phase 1: Backend foundation | Load a session while simultaneously hitting another API endpoint — both should respond |
| Cache not configured | Phase 1: Backend foundation | Load same session twice; second load should complete in <2s |
| Thread-unsafe cache operations | Phase 1: Backend foundation | Open two browser tabs, select same session in both simultaneously — no errors |
| Gap calculation with cumulative times | Phase 2: Gap chart | Compare gap at lap 10 to a known broadcast screenshot; verify pit laps show spikes correctly annotated |
| Position NaN for non-race sessions | Phase 2: Standings board | Load a qualifying session and verify standings render without errors |
| CORS / Vite proxy misconfiguration | Phase 1: Frontend scaffold | Verify `fetch('/api/sessions')` works from React dev server without CORS error |
| pandas serialization types | Phase 1: Backend foundation | Write a test that serializes a sample session response and asserts no non-primitive types escape |
| No loading state for session.load() | Phase 1: Backend + Phase 2: UI | Observe the UI while loading a fresh (uncached) session — progress feedback should appear within 1s |

---

## Sources

- [FastF1 General Functions — Cache docs, threading warnings](https://docs.fastf1.dev/fastf1.html)
- [FastF1 Accurate Calculations howto](https://docs.fastf1.dev/howto_accurate_calculations.html)
- [FastF1 Timing and Telemetry Data — Position NaN documentation](http://docs.fastf1.dev/core.html)
- [FastF1 GitHub Discussion #517 — Generated data, tyres, laptimes quirks](https://github.com/theOehrly/Fast-F1/discussions/517)
- [FastF1 GitHub Discussion #445 — Ergast API deprecation](https://github.com/theOehrly/Fast-F1/discussions/445)
- [FastF1 GitHub Issue #851 — 2026 pre-season testing data bug](https://github.com/theOehrly/Fast-F1/issues/851)
- [FastAPI Concurrency and async/await docs](https://fastapi.tiangolo.com/async/)
- [FastAPI CORS middleware](https://fastapi.tiangolo.com/tutorial/cors/)
- [FastAPI Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/)
- [FastAPI hidden thread pool overhead — DEV Community](https://dev.to/bkhalifeh/fastapi-performance-the-hidden-thread-pool-overhead-you-might-be-missing-2ok6)
- [plotly/plotly.js Issue #3227 — Performance with many traces](https://github.com/plotly/plotly.js/issues/3227)
- [plotly/plotly.js Issue #5790 — Large dataset performance regression](https://github.com/plotly/plotly.js/issues/5790)
- [react-plotly.js bundle size modularization issue #98](https://github.com/plotly/react-plotly.js/issues/98)
- [Vite Server Proxy options](https://vite.dev/config/server-options)
- [FastAPI + React CORS fix — cleverzone medium](https://cleverzone.medium.com/how-to-fix-cors-in-fastapi-a9b1f597661b)

---
*Pitfalls research for: F1 Race Replay Dashboard (FastF1 + FastAPI + React + Plotly)*
*Researched: 2026-03-13*
