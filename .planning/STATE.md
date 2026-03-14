---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Strategy & Analysis Dashboard
status: completed
stopped_at: Completed 06-02 Position Chart
last_updated: "2026-03-14T12:20:57.930Z"
last_activity: 2026-03-14 — Completed 06-01 DriverToggle + LapTimeChart
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 4
  completed_plans: 4
  percent: 31
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-13)

**Core value:** Users can see the gap between any two drivers plotted over time — the single most missing piece of F1 broadcast data
**Current focus:** Phase 6 — Lap Time Chart + Position Chart

## Current Position

Phase: 6 of 8 (Lap Time Chart + Position Chart)
Plan: 1 of 2 completed
Status: Plan 06-01 complete — ready for 06-02 position chart
Last activity: 2026-03-14 — Completed 06-01 DriverToggle + LapTimeChart

Progress: [███░░░░░░░] 31%

## Accumulated Context

### Decisions

Decisions logged in PROJECT.md Key Decisions table. Full history archived with v1.0.

Key decisions carrying forward into v1.1 (including 06-01):
- Memoize chart `data` on `[laps]` only; cursor shape reads `currentLap` separately — prevents jank with 5+ charts open
- Use `scattergl` (not `scatter`) for position chart from the start — 20 traces require WebGL
- Compute interval-to-car-ahead from `Time` + `Position` columns — `IntervalToPositionAhead` not in public FastF1 API
- Group stints by `Stint` integer (not compound) — FastF1 v3.6.0+ has `None` compound values that fragment groupings
- [Phase 05-dashboard-layout-stint-timeline]: Group stints by Stint integer column (not Compound) to handle FastF1 None values
- [Phase 05-dashboard-layout-stint-timeline]: Export pure functions from hooks for direct testability without React mocking
- [Phase 05-dashboard-layout-stint-timeline]: Three-memo split in useStintData: allStints/[laps], chart data/[currentLap+], cursor/[currentLap]
- [Phase 05-02]: StintTimeline height fixed at 500px to fit all 20 drivers at ~24px per row
- [Phase 05-02]: Analysis section gated by isReplayActive (isPlaying || currentLap > 1) for spoiler-free UX
- [Phase 05-02]: Analysis section layout is full-width below 5-col main grid; subsequent charts (phases 6-8) follow this pattern
- [Phase 06-01]: Use scattergl (WebGL) for lap time scatter — 20 drivers x 60+ laps = 1200+ points requires WebGL
- [Phase 06-01]: Per-point opacity array on scatter marker for outliers (0.3 dim) — single trace per driver, no separate outlier traces
- [Phase 06-01]: makeLap test helpers must use 'key' in overrides (not ??) to allow explicit null values for LapTime etc
- [Phase 06-01]: DriverToggle is shared infrastructure for Phase 6-8 multi-driver charts via visibleDrivers prop threading
- [Phase 06-02]: Hover highlighting via React state fallback (hoveredTraceIndex) rather than Plotly.restyle — avoids race conditions with react-plotly.js reconciliation
- [Phase 06-02]: buildSCShapes duplicated in usePositionData (not imported from useLapTimeData) — keeps hooks self-contained

### Pending Todos

1 pending todo(s). See `.planning/todos/pending/`.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-14T12:14:35.135Z
Stopped at: Completed 06-02 Position Chart
Resume file: None
