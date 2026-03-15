# F1 Dashboard

## What This Is

A personal F1 race replay dashboard — a second-screen companion for watching Formula 1 races. It loads historical session data via FastF1, renders interactive driver gap charts, strategy analysis charts, and replays sessions lap-by-lap with a synchronized standings board and full analysis suite.

## Core Value

Users can see the gap between any two drivers plotted over time — the single most missing piece of information from F1 broadcasts.

## Requirements

### Validated

- ✓ Select a historical F1 session (year, event, session type) and load its data via FastF1 — v1.0
- ✓ Select two drivers and view their gap over time as an interactive chart — v1.0
- ✓ Replay a session lap-by-lap with a start button and configurable speed — v1.0
- ✓ View a live standings board showing positions, gaps, tire compounds, and pit stops — v1.0
- ✓ Navigate to any lap during replay to inspect that moment — v1.0
- ✓ Pit stop annotations on gap chart — v1.0
- ✓ Safety car/VSC shading on gap chart — v1.0
- ✓ Stint timeline with compound-colored bars — v1.1
- ✓ Lap time chart with degradation trend lines — v1.1
- ✓ Position chart with hover highlighting — v1.1
- ✓ Sector comparison heatmap with relative pace coloring — v1.1
- ✓ Interval history with DRS threshold reference — v1.1
- ✓ Replay cursor synced across all charts — v1.1
- ✓ SC/VSC shading on all time-series charts — v1.1
- ✓ Driver visibility toggle for multi-driver charts — v1.1
- ✓ Progressive reveal / spoiler-free mode — v1.1
- ✓ Scrollable analysis dashboard layout — v1.1

### Active

(None — define in next milestone)

### Out of Scope

- Live data integration (OpenF1 API) — build historical/replay UX first
- Tire strategy predictions — future feature
- Driver telemetry overlays — future feature, different data cadence
- Mobile app — laptop second-screen only
- Multi-user / deployment — personal local tool
- Animated track position map — FastF1 positional data resolution too low
- Qualifying/Sprint gap charts — gap semantics differ from races
- Fuel-corrected lap times — fuel load/burn rate not available via FastF1
- Qualifying sector heatmap — different session structure; race heatmap first

## Context

Shipped v1.1 with ~12,000 LOC TypeScript/React frontend and Python/FastAPI backend.
Tech stack: React 19, Vite 8, Tailwind CSS v4, Zustand, Plotly.js (with WebGL scattergl), FastAPI, FastF1, Pydantic.
All 29 requirements satisfied across v1.0 + v1.1. 7 minor tech debt items from v1.1.

## Constraints

- **Tech stack**: React + TypeScript frontend, FastAPI + Python backend, FastF1 for data, Plotly for charts
- **Data source**: FastF1 historical data only (live data in future milestone)
- **Platform**: Runs locally on macOS, accessed via browser
- **Python**: 3.12+

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Replace Streamlit with React + FastAPI | Need richer interactivity, multiple panels, real-time updates | ✓ Good — enabled replay engine and multi-panel layout |
| FastF1 before OpenF1 live data | Get the UX right with reliable historical data first | ✓ Good — solid foundation for future live data |
| Plotly for charting | Interactive, zoomable, pannable charts out of the box | ✓ Good — dark theme, hover tooltips, annotation shapes all work well |
| Replay model over static views | Simulates live experience using historical data | ✓ Good — core UX differentiator, drives standings sync |
| SSE for session loading | Stream progress updates during FastF1 fetch | ✓ Good — real-time progress bar, no polling needed |
| Gap via session Time not LapTime | Avoids cumulative errors from safety cars and pit stops | ✓ Good — accurate gap calculation |
| Dynamic driver/team data from FastF1 | No hardcoded lookup tables | ✓ Good — works across all seasons automatically |
| Memoize chart data on [laps] only; cursor reads currentLap separately | Prevents full chart recompute on every replay tick | ✓ Good — smooth replay performance with 6 charts |
| Export pure functions from hooks for testability | Direct unit testing without mocking React | ✓ Good — 162 tests, fast and reliable |
| Self-contained hooks (no cross-hook imports) | Avoids coupling; pure function imports OK | ✓ Good — each chart is independently maintainable |
| WebGL scattergl for multi-driver charts | 20-driver traces need GPU rendering | ✓ Good — no performance issues |

---
*Last updated: 2026-03-15 after v1.1 milestone completion*
