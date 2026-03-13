# Project Research Summary

**Project:** F1 Race Replay Dashboard
**Domain:** Interactive sports analytics dashboard — React frontend, FastAPI backend, FastF1 data library
**Researched:** 2026-03-13
**Confidence:** HIGH

## Executive Summary

The F1 Race Replay Dashboard is a second-screen companion tool that lets users load historical Formula 1 sessions and replay them lap by lap, with a synchronized two-driver gap chart and live standings board. There is a clear gap in the open-source ecosystem: existing tools (MultiViewer, f1-dash, undercut-f1) either provide live-only data or lack a replay engine — none combine historical FastF1 data with a two-driver selectable gap chart and a synchronized standings replay. The recommended architecture is a FastAPI backend that wraps the FastF1 Python library, serving all session data in a single bulk fetch to a React+TypeScript frontend, where the replay engine lives entirely client-side.

The highest-risk element of the entire project is the session loading pipeline. FastF1's `session.load()` is a synchronous, blocking call that takes 10–60 seconds on first load. Getting this right — offloading to a thread pool, enabling the disk cache, using per-session async locks, and streaming progress via SSE — must happen in Phase 1 before any feature work begins. Everything else (gap chart, replay engine, standings board) is relatively straightforward given the well-documented stack and established patterns.

The recommended approach is to build the backend data layer first, validate the FastF1 field shapes and gap calculation logic before touching the UI, then layer in the frontend in bottom-up order: store and API client, then session picker, then gap chart, then replay controls, then standings board. All v1 data requirements are satisfied by a single `session.load(laps=True, telemetry=False)` call — no external APIs, no streaming, no additional data sources needed for the initial milestone.

---

## Key Findings

### Recommended Stack

The stack is fully determined by the existing project constraints (React, TypeScript, FastAPI, FastF1, Plotly) and is well-matched to the problem. The only meaningful additions are Zustand for replay state management (minimal boilerplate, imperative `getState()`/`setState()` required by the replay timer loop), TanStack Query v5 for all API calls (React 19 compatible, explicit mutation support needed for session load), and Tailwind CSS v4 with its first-party Vite plugin for dashboard layout. Streamlit must be removed — it cannot support the required multi-panel layout and stateful replay interactions.

The most critical version constraint is that TanStack Query v4 is **not** React 19 compatible — v5 is required. Tailwind v4 no longer uses `tailwind.config.js` or PostCSS by default; the `@tailwindcss/vite` plugin replaces both. FastAPI 0.135.1 dropped Pydantic v1 support; minimum is Pydantic v2.7.0.

**Core technologies:**
- FastF1 3.8.1: Historical F1 lap, timing, tire, and pit stop data — the only production-ready library for this domain
- FastAPI 0.135.1 + Uvicorn 0.41.0: Async REST backend with native Pydantic v2 serialization and SSE support
- React 19 + TypeScript 5 + Vite 6: Frontend scaffold; Vite proxy eliminates CORS config in dev
- react-plotly.js 2.6.0 / plotly.js 3.1.0: Interactive gap chart with zoom, hover, and annotation support
- Zustand v5: Replay state (currentLap, isPlaying, speed, selectedDrivers) — kept out of React Query to avoid lifecycle conflicts
- TanStack Query v5: All API calls, loading/error states, session load polling
- Tailwind CSS v4: Dashboard dark-theme layout via `@tailwindcss/vite` plugin

### Expected Features

All v1 features are confirmed buildable from a single `session.load(laps=True)` call. No computed fields require external APIs. The data shape is ~20 drivers × 58 laps = ~1,400 rows, serializable to ~1–2 MB JSON — appropriate for a single bulk fetch to the frontend.

**Must have (table stakes / P1):**
- Session picker (year + event + session type cascade) — gates everything
- Loading progress feedback via SSE — FastF1 cold load is 10–60s; no feedback means users assume it crashed
- Two-driver selectable gap chart with zero-line reference and hover tooltips — the core stated value
- Standings board per lap (position, driver, gap to leader, interval, compound, tire age, pit count) — second-screen context
- Replay engine (play/pause, lap advance, 0.5x/1x/2x/4x speed control) — "replay" is in the product name
- Lap scrubber / jump-to-lap — lets users investigate a specific moment without full replay
- Replay lap cursor on gap chart — connects the replay position to the chart visually

**Should have (competitive / P2, add after core is stable):**
- Pit stop annotations on gap chart — explains gap spikes
- Safety car / VSC lap shading — prevents misreading gap collapses under SC conditions
- Gap-to-leader vs interval toggle — strategy view vs battle view
- Tire age display in standings

**Defer (v2+):**
- Live race data via OpenF1 WebSocket — adds async pipeline complexity; get UX right with historical replay first
- Telemetry drill-down (speed/throttle/brake) — different data cadence, 10x data volume, separate rendering problem
- Qualifying/sprint session support — gap chart semantics differ; position data is NaN in non-race sessions

**Hard anti-features (do not build):**
- Animated car track map — FastF1 positional data resolution is too low; produces mediocre results
- Inline sector time micro-charts in standings table — complex React state, defer to a separate detail view

### Architecture Approach

The architecture is a clean two-tier system: a stateless React frontend that holds all session data in a Zustand store after a single bulk fetch, and a FastAPI backend that wraps FastF1 with an in-memory session cache (load once per session key, serve many). The replay engine is entirely client-side — the backend has no concept of "current lap." Communication between frontend and backend uses REST JSON for data endpoints and SSE for session load progress streaming.

**Major components:**
1. SessionService (Python) — loads FastF1 sessions in a thread pool, caches results in process memory, serializes DataFrames to JSON. All FastF1 logic is isolated here; swapping to live data in v2 only touches this layer.
2. FastAPI routers — thin HTTP/SSE layer only. No business logic. Two routers: `sessions.py` (event schedule listing) and `session.py` (load SSE + data endpoints).
3. Zustand store — single source of truth for all cross-component UI state (sessionState, replayState, lapData, driverData). Shared across SessionPicker, GapChart, StandingsBoard, and ReplayControls without prop drilling.
4. useReplay hook — manages `setInterval` timer for lap advancement. Lives in React lifecycle (useEffect with cleanup), reads speed/isPlaying from Zustand but owns the timer itself. Must NOT be placed inside the Zustand store.
5. GapChart (react-plotly.js) — filters full `lapData` by `currentLap` client-side on each render; traces memoized with `useMemo` to prevent Plotly full redraws.
6. StandingsBoard — reads lapData at `currentLap`, derives per-lap standings. Must handle NaN position gracefully for non-race sessions.

### Critical Pitfalls

1. **Blocking the FastAPI event loop with `session.load()`** — use `await asyncio.to_thread(session.load)` inside every FastAPI route that touches FastF1. Never call it directly in an `async def` route. This must be correct from the first line of Phase 1.

2. **FastF1 cache not configured** — call `fastf1.Cache.enable_cache(CACHE_DIR)` once in the FastAPI `lifespan` startup event, never per-request. Add the cache directory to `.gitignore` immediately (cache can grow to 500+ MB and get the repo flagged). Without the cache, every session load is 30–60 seconds.

3. **Thread-unsafe FastF1 cache operations** — use a per-session `asyncio.Lock` pattern to ensure each unique session is loaded only once, even under concurrent requests. The in-memory session store (dict keyed by session ID) both prevents redundant loads and avoids cache state corruption.

4. **Gap calculation using cumulative `LapTime` sums** — do not sum `LapTime` across laps to compute driver gaps. Pit laps, SC laps, and crash laps produce inaccurate cumulative errors that grow lap by lap. Use `session.laps['Time']` (session timestamp at lap end) and take the diff between drivers at the same lap number. Filter with `IsAccurate` or `pick_quicklaps()` for display.

5. **pandas/numpy types escaping JSON serialization** — FastAPI cannot auto-serialize `pandas.Timedelta`, `numpy.float64`, or `pandas.NaT`. All response values must be converted to Python primitives before the Pydantic response model. A serialization utility applied globally to all route responses prevents silent 500 errors during development.

---

## Implications for Roadmap

Based on the combined research, a 4-phase structure emerges cleanly from the dependency graph. Session loading gates everything; the replay engine must exist before the gap chart cursor works; the standings board can be built in parallel with the chart but requires the same data foundation.

### Phase 1: Backend Foundation + Frontend Scaffold

**Rationale:** Session loading is the highest-risk piece and gates all other features. FastF1's threading model, cache setup, async wrapping, and serialization quirks must be resolved before any UI work begins. Validating the JSON data shape early prevents rework. The Vite proxy setup eliminates CORS configuration issues for all subsequent phases.

**Delivers:** A working end-to-end session load pipeline — select a session, wait for SSE progress events, receive all lap data in the frontend Zustand store. No visible UI beyond a dev console or basic picker form.

**Addresses:** Session picker, loading progress feedback (table stakes)

**Avoids:** Event loop blocking (Pitfall 1), cache misconfiguration (Pitfall 2), thread-unsafe cache operations (Pitfall 3), pandas serialization failures (Pitfall 5), CORS/Vite proxy issues

**Research flag:** Standard patterns. SSE, `asyncio.to_thread`, Vite proxy, and FastF1 cache are all well-documented. No additional research needed.

### Phase 2: Gap Chart + Replay Engine

**Rationale:** The gap chart is the stated core value of the product. The replay engine is architecturally central — it drives both the chart cursor and the standings board. Build them together so the cursor integration is tested from the start rather than bolted on later. Gap calculation logic must be validated against known race results (broadcast screenshots) before the UI is declared done.

**Delivers:** A fully functional gap chart with driver selectors, zero-line, hover tooltips, replay cursor, and a working replay engine (play/pause, speed control, lap scrubber). The core product loop is usable.

**Addresses:** Two-driver selectable gap chart, zero-line + hover tooltips, replay engine, lap scrubber, replay cursor on gap chart (all P1 table stakes)

**Avoids:** Gap calculation using cumulative lap times (Pitfall 4), Plotly re-render on every render cycle (must memoize traces with useMemo), replay timer stored in Zustand (must live in useReplay hook / useEffect)

**Research flag:** Standard patterns. Plotly Scatter traces, Zustand store slices, and useEffect interval patterns are well-documented. Gap calculation specifics (using `Time` column vs `LapTime`) are verified in FastF1 docs.

### Phase 3: Standings Board

**Rationale:** The standings board depends on the same lapData already loaded in Phase 2 and reads `currentLap` from the same Zustand store the replay engine writes. It is a pure consumer of Phase 2 infrastructure. Building it third keeps Phase 2 focused and avoids rendering complexity blocking the core chart work.

**Delivers:** A per-lap standings table synchronized to the replay engine showing position, driver (with team color), gap to leader, interval, tire compound, tire age, and pit stop count.

**Addresses:** Standings board (P1 table stakes), tire compound display, pit stop count, tire age (P2)

**Avoids:** Position data NaN for non-race sessions (Pitfall 5 from PITFALLS.md — implement session-type-aware position logic from the start; use `Position` for races, `LapTime` rank for qualifying/practice)

**Research flag:** Standard patterns. HTML table + Zustand read is well-documented. The only domain-specific nuance (NaN position in non-race sessions) is documented in FastF1 and has a clear resolution.

### Phase 4: Chart Enhancements (P2 Features)

**Rationale:** Pit stop annotations, safety car shading, and the gap-to-leader toggle all require the gap chart and lap data already built in Phase 2. They are low-complexity additions once the chart infrastructure exists. Grouping them in a dedicated phase keeps earlier phases focused on the core loop and prevents scope creep during the highest-risk work.

**Delivers:** Pit stop vertical annotations on the gap chart, yellow safety car / VSC lap-range shading, and a gap-to-leader vs interval toggle. Makes the chart self-explanatory without external context.

**Addresses:** Pit stop annotations, SC/VSC shading, gap-to-leader toggle (all P2 features)

**Avoids:** Safety car shading requires `TrackStatus` data — confirm it is included in the initial `session.load()` call (confirmed: `TrackStatus` is part of the laps DataFrame). Gap-to-leader toggle requires all drivers loaded — confirmed, full field is loaded upfront in Phase 1.

**Research flag:** Standard patterns. All data fields are confirmed available from `session.load(laps=True)`. Plotly shape annotations and layout annotations are well-documented.

### Phase Ordering Rationale

- **Phase 1 before everything:** The session loading pipeline is the single point of failure. An event-loop-blocking session load makes the entire app non-functional; a missing cache makes the app unusable in practice. These must be correct before any UI work.
- **Phase 2 before Phase 3:** The replay engine's `currentLap` Zustand state is consumed by the standings board. Building the engine first means Phase 3 is purely additive with no architecture changes.
- **Phase 4 last:** All P2 chart enhancements are pure additions to the gap chart built in Phase 2. They have zero risk of breaking earlier phases.
- **Anti-features deferred:** Track map (low data fidelity), telemetry overlay (different data cadence), and live data (adds async pipeline) are all correctly deferred to v2 — confirmed by competitor analysis showing even mature tools don't attempt all three.

### Research Flags

Phases with well-documented patterns (skip `/gsd:research-phase`):
- **Phase 1:** SSE streaming, `asyncio.to_thread`, FastF1 cache setup, Vite proxy — all have official documentation and verified code patterns in research
- **Phase 2:** Plotly Scatter with useMemo, Zustand store slices, useEffect interval hook — established React patterns
- **Phase 3:** HTML table with Zustand read — no novel integration
- **Phase 4:** Plotly shape/annotation API — documented in Plotly.js reference

No phases require additional research. All patterns are verified against official sources.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core versions verified against PyPI and npm (March 2026). react-plotly.js is MEDIUM — the wrapper is 3 years old but plotly.js-dist is actively maintained and the integration pattern is confirmed |
| Features | HIGH | FastF1 data columns verified against official docs; all v1 features confirmed buildable from a single `session.load()` call; competitor analysis confirms the market gap |
| Architecture | HIGH | All patterns are standard for FastAPI + React; FastF1-specific patterns (thread pool, in-memory cache, SSE load) are verified in official FastAPI and FastF1 docs |
| Pitfalls | HIGH | All critical pitfalls verified against official FastF1 and FastAPI documentation with direct links; gap calculation pitfall verified against FastF1 "accurate calculations" howto |

**Overall confidence: HIGH**

### Gaps to Address

- **react-plotly.js wrapper age:** The `react-plotly.js` package has not been updated in ~3 years, though it remains the official Plotly React integration. If TypeScript type errors surface during Phase 2, fall back to `@types/react-plotly.js` community types or wrap the component manually. Monitor for Plotly.js v4 compatibility if it releases.

- **Gap calculation validation:** The `Time` column approach is theoretically correct per FastF1 docs but must be validated empirically during Phase 2 against a known race result (e.g., a race where broadcast gap is publicly documented). Do not consider the gap chart "done" until this validation is performed.

- **FastF1 2026 pre-season data:** GitHub Issue #851 notes a 2026 pre-season testing data bug. If testing with 2026 sessions, use a known-good 2024 or 2025 race session (e.g., 2024 Monaco GP) for development to avoid false data quality issues.

---

## Sources

### Primary (HIGH confidence)
- https://docs.fastf1.dev/core.html — FastF1 laps DataFrame columns, Position NaN behavior, timing data structure
- https://docs.fastf1.dev/fastf1.html — Cache docs, threading safety warnings
- https://docs.fastf1.dev/howto_accurate_calculations.html — Gap calculation using `Time` vs cumulative `LapTime`
- https://pypi.org/project/fastapi/ — FastAPI 0.135.1 latest version confirmed
- https://pypi.org/project/fastf1/ — FastF1 3.8.1 release date and Python version support confirmed
- https://pypi.org/project/uvicorn/ — Uvicorn 0.41.0 confirmed
- https://vite.dev/guide/ — Vite 6.x, Node >= 18, react-ts template
- https://tailwindcss.com/blog/tailwindcss-v4 — Tailwind v4 Vite plugin setup
- https://tanstack.com/query/latest — TanStack Query v5 React 19 compatibility
- https://fastapi.tiangolo.com/async/ — Concurrency model, sync-in-async antipattern
- https://fastapi.tiangolo.com/tutorial/background-tasks/ — `asyncio.to_thread` / `run_in_threadpool` pattern

### Secondary (MEDIUM confidence)
- https://multiviewer.app/docs/usage/race-trace — Competitor feature reference (gap chart patterns)
- https://github.com/JustAman62/undercut-f1 — Open source replay tool, feature reference
- https://github.com/IAmTomShaw/f1-race-replay — Open source reference implementation
- https://github.com/pmndrs/zustand — Zustand v5 state management
- https://github.com/plotly/react-plotly.js — react-plotly.js v2.6.0 current (wrapper is 3 years old; plotly.js-dist is active)
- https://makersden.io/blog/react-state-management-in-2025 — Zustand patterns in 2025

### Tertiary (LOW confidence / domain context)
- https://www.topracingshop.com/blog/what-does-interval-mean-in-f1.html — Domain explanation of gap vs interval terminology

---
*Research completed: 2026-03-13*
*Ready for roadmap: yes*
