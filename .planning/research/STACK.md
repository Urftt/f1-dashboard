# Stack Research

**Domain:** F1 Race Replay Dashboard (React + TypeScript + FastAPI + FastF1)
**Researched:** 2026-03-13
**Confidence:** HIGH (core libraries verified against PyPI/npm current versions)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| FastF1 | 3.8.1 | Historical F1 timing, lap, tire, pit stop data | The only production-ready library for historical F1 data — provides laps, tire compounds, pit stops, driver positions as Pandas DataFrames; built-in disk caching prevents API rate-limits; actively maintained (3.8.1 released Feb 2026) |
| FastAPI | 0.135.1 | REST API backend + async request handling | Native async support essential for wrapping FastF1's blocking I/O in threadpools; Pydantic v2 integration gives free request/response validation; automatic OpenAPI docs accelerate frontend dev |
| Uvicorn | 0.41.0 | ASGI server for FastAPI | Required to run FastAPI; `--reload` for dev workflow; standard pairing |
| Pydantic v2 | >=2.7.0 | Request/response model validation and JSON serialization | Bundled with FastAPI; Rust-backed serialization is 2x+ faster than v1; use `model_dump()` to convert Pandas DataFrames to typed JSON responses |
| React | 19 | Frontend UI | Declared in PROJECT.md; component model maps cleanly to dashboard panels (session selector, gap chart, standings board, replay controls) |
| TypeScript | 5.x | Type safety across frontend | Catches API shape mismatches early; PROJECT.md constraint; Vite template ships it out of the box |
| Vite | 6.x | Frontend build + dev server | Current standard (replaces CRA); hot reload, fast cold starts; `npm create vite@latest -- --template react-ts` scaffolds the project |
| Plotly.js via react-plotly.js | plotly.js 3.1.0 / react-plotly.js 2.6.0 | Interactive gap charts and standings visualizations | PROJECT.md constraint; supports zoom, pan, hover out of the box — exactly what gap-over-time analysis needs; same library already used in the Streamlit prototype, so chart logic can be reused |
| Tailwind CSS | v4 | Utility-first styling | v4 has a first-party Vite plugin (`@tailwindcss/vite`) — zero config, automatic content detection; better than CSS modules for a dashboard that needs quick dark-theme layout work |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/react-plotly.js | latest | TypeScript types for react-plotly.js | Required — react-plotly.js ships without native TS types; install alongside react-plotly.js |
| @types/plotly.js | latest | TypeScript types for Plotly data/layout objects | Use to type `Plotly.Data[]`, `Plotly.Layout`, `Plotly.Config` in chart components |
| @tanstack/react-query | v5 | Server state management, API polling, loading/error states | Use for all FastAPI calls — provides caching, loading states, and background refetch for replay step polling; avoids manual `useEffect` fetch patterns |
| Zustand | v5 | Frontend replay engine state | Use for replay state (current lap, is-playing, speed multiplier, selected drivers) — minimal boilerplate, no reducers; call `getState()`/`setState()` imperatively from the timer loop |
| pandas | 2.3.0 | Data transformation in backend | Already in pyproject.toml; FastF1 returns DataFrames — serialize to JSON with `.to_dict(orient='records')` before sending to frontend |
| numpy | 2.2.6 | Numeric operations for gap calculations | Already in pyproject.toml; used for NaN handling and gap delta calculations |
| python-dotenv | 1.1.0 | Environment variable management | Already in pyproject.toml; use for cache path config (`FASTF1_CACHE_DIR`) |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| uv | Python package manager | Faster than pip/poetry; works with the existing `pyproject.toml`; `uv sync` resolves deps |
| mypy | Python static type checking | Already in dev deps; use with `pandas-stubs` for typed DataFrame operations |
| ESLint | JavaScript/TypeScript linting | Ships with `create vite --template react-ts`; no extra config needed |
| Vite proxy | Forward `/api/*` requests to FastAPI during dev | Set `server.proxy` in `vite.config.ts` to avoid CORS issues in dev — simpler than configuring CORS twice |

---

## Installation

```bash
# --- Backend (Python) ---
# Add FastAPI + uvicorn to pyproject.toml, remove streamlit
uv add "fastapi>=0.135.1" "uvicorn[standard]>=0.41.0"
uv remove streamlit

# Dev
uv add --dev "mypy>=1.16.0" "pandas-stubs>=2.2.0"

# Run backend
uv run uvicorn backend.main:app --reload --port 8000

# --- Frontend (Node) ---
npm create vite@latest frontend -- --template react-ts
cd frontend

# Core
npm install react-plotly.js plotly.js
npm install @tanstack/react-query zustand
npm install tailwindcss @tailwindcss/vite

# Types
npm install -D @types/react-plotly.js @types/plotly.js
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| react-plotly.js | Recharts / Chart.js | If bundle size is critical (Plotly.js is ~3MB); for this project Plotly is correct — it was explicitly chosen in PROJECT.md and the prototype already uses it |
| react-plotly.js | ECharts (Apache) | ECharts has better performance at 100k+ data points; F1 replay has ~60 laps × 20 drivers = 1200 data points — Plotly is fine |
| Zustand | Redux Toolkit | Redux for larger teams with strict action patterns; Zustand is simpler for a solo personal tool with a replay timer |
| @tanstack/react-query | SWR | Both work; React Query v5 has better TypeScript ergonomics and explicit mutation support needed for session load endpoint |
| Tailwind CSS v4 | CSS Modules | CSS Modules if no utility-class styling; Tailwind faster for dashboard layouts with dark theme |
| Vite | Next.js | Next.js if you need SSR or routing; this is a single-page tool with no public deployment requirement |
| FastAPI background tasks + threadpool | Celery + Redis | Celery for distributed workers; overkill for a local tool — `asyncio.to_thread(session.load)` is sufficient |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Streamlit | Being replaced — can't support multi-panel layout, replay timer loop, or stateful frontend interactions without hacks; already confirmed broken in this codebase | React + FastAPI |
| OpenF1 REST API (for this milestone) | Explicitly deferred to future milestone in PROJECT.md; live data complexity would block shipping the core UX | FastF1 historical data only |
| `async def` FastAPI route that calls `session.load()` directly | `session.load()` is synchronous and blocking — it downloads and parses large datasets; calling it directly in an async route blocks the entire event loop | `await asyncio.to_thread(session.load, ...)` or `run_in_threadpool` from Starlette |
| Polling the FastAPI `/step` endpoint from a React `setInterval` without React Query | Leads to duplicate requests, stale closure bugs, and missed loading states | `useQuery` with `refetchInterval` from TanStack Query, or a Zustand-managed interval that invalidates the query |
| CRA (Create React App) | Deprecated, unmaintained since 2023; slow build times | `npm create vite@latest -- --template react-ts` |
| FastF1 without caching | FastF1 prints a warning and will hit API rate limits; session loads can take 10-30 seconds without cache | `fastf1.Cache.enable_cache('~/.fastf1')` or read from `FASTF1_CACHE_DIR` env var |

---

## Stack Patterns by Variant

**For the session load endpoint (long-running, blocking):**
- Accept a `POST /sessions/load` call that returns immediately with a job ID
- Run `asyncio.to_thread(session.load)` in the background
- Frontend polls `GET /sessions/{id}/status` with React Query `refetchInterval` until status is `ready`
- Because FastF1 caches on disk, subsequent loads of the same session complete in < 1 second

**For the replay engine:**
- Backend: single `GET /sessions/{id}/lap/{n}` endpoint returns all 20 drivers' state for lap N (position, gap to leader, tire compound, pit stops so far)
- Frontend: Zustand store holds `{ currentLap, isPlaying, speed }` — a `setInterval` in a `useEffect` increments `currentLap` and fetches the next lap
- Gap chart: React Query caches the full lap dataset on first load; chart shows all laps up to `currentLap` using array slice, no re-fetching needed

**For the gap chart data shape:**
- FastF1's `session.laps` gives per-lap data per driver as a DataFrame
- Serialize with `df.to_dict(orient='records')` in the FastAPI endpoint
- Frontend receives `{ lap: number, driver: string, gapToLeader: number, compound: string }[]`

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| fastapi>=0.135.1 | pydantic>=2.7.0 | FastAPI dropped Pydantic v1 support; minimum is now 2.7.0 |
| fastf1>=3.8.1 | Python >=3.10 | Python 3.12 (project constraint) is fully supported |
| react-plotly.js@2.6.0 | plotly.js@3.1.0 | Install both; react-plotly.js is a peer-dep wrapper around plotly.js |
| @tanstack/react-query@5 | React 19 | v5 is fully React 19 compatible; v4 is not |
| tailwindcss@v4 | @tailwindcss/vite plugin | v4 no longer uses postcss config or `tailwind.config.js` by default — use the Vite plugin instead |
| Vite@6.x | Node.js >=18 | Node 18+ required |

---

## Sources

- https://pypi.org/project/fastf1/ — FastF1 3.8.1 release date (Feb 11, 2026) and Python version support confirmed
- https://docs.fastf1.dev/getting_started/basics.html — Session load API, laps/results/compound data structure confirmed
- https://pypi.org/project/fastapi/ — FastAPI 0.135.1 latest version (March 1, 2026) confirmed
- https://pypi.org/project/uvicorn/ — Uvicorn 0.41.0 (Feb 16, 2026) confirmed
- https://github.com/plotly/react-plotly.js — react-plotly.js v2.6.0 current (MEDIUM confidence — package not updated in 3 years but still the official integration; plotly.js-dist 3.1.0 is active)
- https://github.com/plotly/react-plotly.js/issues/80 — TypeScript setup pattern via `@types/react-plotly.js` confirmed
- https://vite.dev/guide/ — Vite 6.x, Node >= 18, `react-ts` template confirmed
- https://tailwindcss.com/blog/tailwindcss-v4 — Tailwind v4 Vite plugin setup confirmed
- https://tanstack.com/query/latest — TanStack Query v5 React 19 compatibility confirmed
- https://github.com/pmndrs/zustand — Zustand v5 hook-based state management confirmed
- https://fastapi.tiangolo.com/tutorial/background-tasks/ — `asyncio.to_thread` / `run_in_threadpool` pattern for blocking FastF1 calls confirmed

---

*Stack research for: F1 Race Replay Dashboard*
*Researched: 2026-03-13*
