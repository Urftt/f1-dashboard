# F1 Dashboard

## What This Is

A personal F1 data dashboard designed as a second-screen companion while watching Formula 1 races. It provides real-time-style visualizations — driver gap charts, standings, and race data — that the broadcast doesn't show, aimed at data-curious fans who want deeper insight during races.

## Core Value

Users can see the gap between any two drivers plotted over time so they can instantly tell whether a gap is growing or shrinking — the single most missing piece of information from F1 broadcasts.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Select a historical F1 session (year, event, session type) and load its data via FastF1
- [ ] Select two drivers and view their gap over time as an interactive chart
- [ ] Replay a session lap-by-lap with a start button and configurable speed
- [ ] View a live standings board showing positions, gaps, tire compounds, and pit stops
- [ ] Navigate to any lap during replay to inspect that moment

### Out of Scope

- Live data integration (OpenF1 API) — deferred to future milestone, build historical/replay first
- Tire strategy predictions — future feature
- Driver telemetry overlays — future feature
- Mobile app — laptop second-screen only
- Multi-user / deployment — personal local tool

## Context

- The existing codebase is a Streamlit prototype using the OpenF1 API for interval tracking between two drivers. It's not working correctly and will be replaced.
- FastF1 is a mature Python library that provides rich historical F1 timing data (laps, positions, tire info, pit stops) from 2018 onwards.
- The user is a data scientist who values clean data visualization and interactive charts.
- Primary use case: laptop open next to TV during race weekends, replaying historical sessions or (eventually) tracking live races.

## Constraints

- **Tech stack**: React + TypeScript frontend, FastAPI + Python backend, FastF1 for data, Plotly for charts
- **Data source**: FastF1 historical data only for v1 (live data in future milestone)
- **Platform**: Runs locally on macOS, accessed via browser
- **Python**: 3.12+

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Replace Streamlit with React + FastAPI | Need richer interactivity, multiple panels, real-time updates that Streamlit can't handle well | — Pending |
| FastF1 before OpenF1 live data | Get the UX right with reliable historical data, then add live complexity | — Pending |
| Plotly for charting | Interactive, zoomable, pannable charts out of the box — perfect for gap analysis | — Pending |
| Replay model over static views | Simulates the live experience using historical data — core UX differentiator | — Pending |

---
*Last updated: 2026-03-13 after initial project setup*

## Current Milestone: v1.0 F1 Race Replay Dashboard

**Goal:** Build a fully functional race replay dashboard with gap charts and standings using historical F1 data via FastF1.

**Target features:**
- Session selection and data loading with progress feedback
- Interactive driver gap chart (core feature)
- Standings board with positions, gaps, tires, pit stops
- Lap-by-lap replay engine with jump-to-lap
