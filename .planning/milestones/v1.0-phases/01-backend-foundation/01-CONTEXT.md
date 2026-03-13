# Phase 1: Backend Foundation - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Session loading pipeline with FastF1 caching and SSE progress streaming. Users can select a historical F1 session (year, event, session type), watch it load with real-time progress feedback, and have subsequent loads be instant from cache. This phase establishes the React + FastAPI project structure and the data pipeline that all other phases depend on.

</domain>

<decisions>
## Implementation Decisions

### Session Selector Flow
- Cascading dropdowns: Year → Grand Prix event → Session type
- Session type defaults to Race (most common use case)
- Year range: 2018 through current season (matches FastF1 data availability)
- Event dropdown shows only completed events (no future races with no data)
- Default the year dropdown to the current season so events populate immediately

### Loading Experience
- Inline progress bar below the session selector (not full-page overlay)
- Shows percentage + current stage name (e.g., "72% — Fetching lap data...")
- On failure: inline error message with retry button (replaces progress bar)
- Cached sessions are visually marked in the event dropdown so user knows they'll load instantly

### Initial & Empty States
- On first open: session selector at top, empty chart/dashboard area below with "Select a session to get started" message
- Year dropdown pre-selects current season
- After successful load: progress bar completes, then dashboard panels fade in smoothly
- Selector compacts to single-line summary ("Monaco GP 2024 — Race") with a change button to maximize chart space

### Project Scaffolding
- Monorepo structure: `frontend/` (React + TypeScript) and `backend/` (FastAPI + Python)
- Frontend: Vite build tool, Tailwind CSS for styling, shadcn/ui for component primitives
- State management: Zustand (per PROJECT.md)
- Charting: Plotly (per PROJECT.md)
- Backend: FastAPI with FastF1, Python 3.12+

### Claude's Discretion
- Exact SSE event format and progress stage granularity
- FastAPI project structure within backend/
- React component file organization within frontend/src/
- Exact fade-in animation implementation
- How to detect cached sessions for the dropdown indicator

</decisions>

<specifics>
## Specific Ideas

- Compact selector post-load should show session name like "Monaco GP 2024 — Race" with a change/expand button
- Progress stages should use named stages (connecting, fetching laps, fetching positions, processing) not just a generic bar
- The app is a second-screen companion for watching F1 — the selector should be quick to use, not exploratory

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `config.py`: Contains driver colors (DRIVER_COLORS), plot settings, session types — these constants can inform the new backend config
- `data_processor.py`: IntervalCalculator logic for gap calculation can inform the new backend's data processing, though the approach changes (FastF1 vs OpenF1)
- `pyproject.toml`: Already has fastf1, plotly, pandas, numpy dependencies

### Established Patterns
- The existing Streamlit app uses OpenF1 API — this is being fully replaced with FastF1 + React + FastAPI
- No existing React/TypeScript/FastAPI code — this phase is greenfield
- Existing gap calculation uses `date_start` time differences — the new approach should use `session.laps['Time']` per critical pitfalls

### Integration Points
- The existing `pyproject.toml` needs to be reorganized (move Python deps to backend/, create frontend/package.json)
- The existing Streamlit files (app.py, config.py, data_fetcher.py, data_processor.py, main.py) will be superseded by the new architecture
- FastF1 cache directory should be in backend/ and added to .gitignore

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-backend-foundation*
*Context gathered: 2026-03-13*
