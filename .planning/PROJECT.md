# F1 Dashboard

## What This Is

A personal F1 race replay dashboard — a second-screen companion for watching Formula 1 races. It loads historical session data via FastF1, renders interactive driver gap charts with pit stop annotations and safety car shading, and replays sessions lap-by-lap with a synchronized standings board.

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

### Active

- [ ] Stint timeline — horizontal bars showing each driver's tire stints (compound, length, pit laps)
- [ ] Lap time chart — multi-driver selectable lap time plot showing degradation, stint pace, strategy
- [ ] Position chart — all-driver position over laps (spaghetti chart) showing overtakes and strategy
- [ ] Sector comparison heatmap — multi-driver lap-by-sector grid, color-coded by relative pace
- [ ] Interval history — gap-to-car-ahead over time, showing hunting vs. managing phases

### Out of Scope

- Live data integration (OpenF1 API) — build historical/replay UX first
- Tire strategy predictions — future feature
- Driver telemetry overlays — future feature, different data cadence
- Mobile app — laptop second-screen only
- Multi-user / deployment — personal local tool
- Animated track position map — FastF1 positional data resolution too low
- Qualifying/Sprint gap charts — gap semantics differ from races

## Context

Shipped v1.0 with ~2,000 LOC TypeScript/React frontend and Python/FastAPI backend.
Tech stack: React 19, Vite 8, Tailwind CSS v4, Zustand, Plotly.js, FastAPI, FastF1, Pydantic.
All 18 v1 requirements satisfied. 4 minor tech debt items (non-blocking).

## Current Milestone: v1.1 Strategy & Analysis Dashboard

**Goal:** Add five new analysis views to the scrollable dashboard — stint timeline, lap time chart, position chart, sector comparison heatmap, and interval history — giving users deeper strategic insight into race data.

**Target features:**
- Stint timeline (tire strategy overview)
- Lap time chart (degradation & stint pace)
- Position chart (spaghetti chart)
- Sector comparison heatmap
- Interval history

## Constraints

- **Tech stack**: React + TypeScript frontend, FastAPI + Python backend, FastF1 for data, Plotly for charts
- **Data source**: FastF1 historical data only for v1 (live data in future milestone)
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
| HTML range input for scrubber | Simpler than component library slider for integer lap steps | ✓ Good — sufficient, no extra dependency |

---
*Last updated: 2026-03-13 after v1.1 milestone start*
