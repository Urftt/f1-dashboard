---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 04-02-PLAN.md (awaiting Task 3 human-verify checkpoint)
last_updated: "2026-03-13T18:38:21.948Z"
last_activity: 2026-03-13 — Roadmap created, all 18 v1 requirements mapped across 4 phases
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 12
  completed_plans: 12
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-13)

**Core value:** Users can see the gap between any two drivers plotted over time — the single most missing piece of F1 broadcast data
**Current focus:** Phase 1 — Backend Foundation

## Current Position

Phase: 1 of 4 (Backend Foundation)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-13 — Roadmap created, all 18 v1 requirements mapped across 4 phases

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-backend-foundation P02 | 5min | 1 tasks | 22 files |
| Phase 01-backend-foundation P01 | 6min | 2 tasks | 13 files |
| Phase 01-backend-foundation P03 | 2min | 2 tasks | 11 files |
| Phase 01-backend-foundation P04 | 60min | 1 tasks | 1 files |
| Phase 02-gap-chart-replay-engine P01 | 8min | 2 tasks | 5 files |
| Phase 02-gap-chart-replay-engine P03 | 2min | 2 tasks | 2 files |
| Phase 02-gap-chart-replay-engine P02 | 2min | 2 tasks | 2 files |
| Phase 02-gap-chart-replay-engine P04 | 55min | 2 tasks | 12 files |
| Phase 03-standings-board P01 | 4min | 2 tasks | 4 files |
| Phase 03-standings-board P02 | 30min | 1 tasks | 4 files |
| Phase 04-chart-enhancements P01 | 4min | 2 tasks | 6 files |
| Phase 04-chart-enhancements P02 | 1min | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Setup]: Replace Streamlit with React + FastAPI for richer interactivity and stateful replay
- [Setup]: FastF1 historical data before OpenF1 live data — get UX right first
- [Setup]: Replay model over static views — simulates live experience using historical data
- [Phase 01-backend-foundation]: Frontend scaffold: added .npmrc legacy-peer-deps for Vite 8 + @tailwindcss/vite v4 compatibility
- [Phase 01-backend-foundation]: sse-starlette: Use sse-starlette EventSourceResponse for SSE — better compatibility than fastapi.sse
- [Phase 01-backend-foundation]: pytest importlib mode: Required to prevent root main.py (Streamlit) shadowing backend/main.py in monorepo
- [Phase 01-backend-foundation]: EventDate tz-naive: FastF1 returns datetime64[ns] tz-naive — normalize both sides to UTC-naive before comparison
- [Phase 01-backend-foundation]: fetch-event-source onerror rethrows to prevent automatic SSE reconnect on session load failure
- [Phase 01-backend-foundation]: base-ui Select onValueChange type is (string|null) — null guard required before passing to typed store actions
- [Phase 01-backend-foundation]: shadcn/ui Progress is self-contained — value prop controls indicator; passing children caused duplicate bar
- [Phase 02-gap-chart-replay-engine]: Gap uses LapRow.Time (session elapsed time) not LapTime to avoid cumulative errors from safety cars and pit stops
- [Phase 02-gap-chart-replay-engine]: --legacy-peer-deps required for react-plotly.js React 18 peer dep cap — works fine at runtime with React 19
- [Phase 02-gap-chart-replay-engine]: lapRef.current updated every render; only isPlaying, replaySpeed, maxLap in useEffect deps — avoids stale closure while keeping interval lifecycle correct
- [Phase 02-gap-chart-replay-engine]: HTML range input used for scrubber instead of @base-ui Slider — simpler, sufficient for integer lap steps
- [Phase 02-gap-chart-replay-engine]: Auto-restart: pressing play when currentLap >= maxLap resets to lap 1 then plays — prevents dead play button at race end
- [Phase 02-gap-chart-replay-engine]: Plotly dark theme via template: plotly_dark with transparent bg; yref paper on cursor shape for full-height span
- [Phase 02-gap-chart-replay-engine]: react-plotly.js CJS default export double-wrap: fix by checking for .default on the imported value before use
- [Phase 02-gap-chart-replay-engine]: Driver/team data: served dynamically from FastF1 session via serialize_drivers — no hardcoded lookup tables
- [Phase 02-gap-chart-replay-engine]: Plotly hovermode: closest instead of x-unified prevents tooltip from obscuring the gap line
- [Phase 02-gap-chart-replay-engine]: Single invisible hover trace: overlay a transparent scatter trace to unify tooltip without visual duplication
- [Phase 03-standings-board]: @base-ui/react/tooltip: use 'import { Tooltip } from @base-ui/react/tooltip' then Tooltip.Root etc — named subpath exports cause Vite MISSING_EXPORT errors
- [Phase 03-standings-board]: Position 99 normalization: F1 API sends Position 99 for retirements — normalize to null in useStandingsData, display '—' in StandingsBoard, sort to bottom
- [Phase 03-standings-board]: DNF classification: use data-derived race length (max lap across drivers) rather than totalLaps store field to detect finished/retired status
- [Phase 04-chart-enhancements]: parse_safety_car_periods uses session.laps for lap mapping via _time_to_lap; unclosed periods included with end_lap=max; adjacent SC->VSC creates two separate periods; _time_to_lap returns 1 not max lap when all times NaT
- [Phase 04-chart-enhancements]: Pit hover traces use two-point invisible lines (y: [0,1], line.width: 0, hoverinfo: text) — invisible markers at y: null fail to trigger hover
- [Phase 04-chart-enhancements]: Annotation shapes in separate useMemo from gap segments (different deps: currentLap + safetyCarPeriods)

### Critical Pitfalls (from research)

- Never call `session.load()` directly in async FastAPI routes — use `await asyncio.to_thread(session.load)` or `run_in_threadpool`
- Enable FastF1 cache in `lifespan` startup, never per-request; add cache dir to `.gitignore` immediately (can reach 500+ MB)
- Use per-session `asyncio.Lock` to prevent concurrent duplicate loads and cache state corruption
- Gap calculation: use `session.laps['Time']` (session timestamp at lap end), NOT cumulative `LapTime` sums
- All FastF1/pandas response values must be converted to Python primitives before Pydantic serialization (Timedelta, numpy.float64, NaT will cause silent 500s)

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-13T18:38:21.946Z
Stopped at: Completed 04-02-PLAN.md (awaiting Task 3 human-verify checkpoint)
Resume file: None
