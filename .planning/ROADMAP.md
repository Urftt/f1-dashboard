# Roadmap: F1 Race Replay Dashboard

## Overview

This roadmap builds a working race replay dashboard in four phases. The session loading pipeline is established first because it gates all other work. The gap chart and replay engine are built together in Phase 2 because the replay cursor connects them architecturally — the core product loop becomes usable at the end of this phase. The standings board is added in Phase 3 as a pure consumer of the existing data and state infrastructure. Phase 4 adds chart annotations and shading that make the gap chart self-explanatory without external context.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Backend Foundation** - Session loading pipeline with FastF1 caching and SSE progress streaming (completed 2026-03-13)
- [ ] **Phase 2: Gap Chart + Replay Engine** - Core product loop: selectable driver gap chart synchronized with replay controls
- [x] **Phase 3: Standings Board** - Per-lap standings table showing positions, gaps, tires, and pit stops (completed 2026-03-13)
- [ ] **Phase 4: Chart Enhancements** - Pit stop annotations and safety car shading on the gap chart

## Phase Details

### Phase 1: Backend Foundation
**Goal**: Users can select a historical F1 session, watch it load with progress feedback, and have subsequent loads be instant from cache
**Depends on**: Nothing (first phase)
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04, SESS-05
**Success Criteria** (what must be TRUE):
  1. User can pick a season (2018 onwards), browse Grand Prix events within it, and select a session type (Race, Qualifying, FP1/2/3) from a UI
  2. After selecting a session, user sees a loading progress bar or percentage indicator that updates in real time during the FastF1 fetch — the UI does not appear frozen
  3. After the first load completes, selecting the same session again loads instantly (under 1 second) from disk cache
  4. All lap data is available in the frontend Zustand store after a successful load — confirmed by checking network tab or dev console, no follow-up API calls needed
**Plans:** 4/4 plans complete

Plans:
- [x] 01-01-PLAN.md — Backend API (schedule + SSE session loading + caching) and test suite
- [x] 01-02-PLAN.md — Frontend skeleton (Vite, Tailwind, shadcn/ui, Zustand, proxy config)
- [x] 01-03-PLAN.md — Frontend UI: Zustand store, SSE client, cascading session selector, progress bar, empty state
- [x] 01-04-PLAN.md — End-to-end integration verification (human checkpoint)

### Phase 2: Gap Chart + Replay Engine
**Goal**: Users can select two drivers and see their gap plotted over time, then replay the session lap-by-lap with the chart cursor tracking the current lap
**Depends on**: Phase 1
**Requirements**: GAP-01, GAP-02, GAP-03, REPL-01, REPL-02, REPL-03, REPL-04
**Success Criteria** (what must be TRUE):
  1. User can pick any two drivers from the loaded session and immediately see an interactive gap-over-time chart with a zero-line reference
  2. User can hover over the chart and see exact gap values and lap numbers in a tooltip
  3. User can press play and watch the chart cursor advance lap by lap at the selected speed (0.5x, 1x, 2x, 4x); pressing pause freezes it
  4. User can drag the lap scrubber to any lap and the chart cursor jumps to that lap instantly
**Plans:** 3/4 plans executed

Plans:
- [ ] 02-01-PLAN.md — Data layer: install Plotly, extend Zustand store with replay state, driver lookups, gap calculation hook
- [ ] 02-02-PLAN.md — Gap chart: Plotly scatter with dark theme, team-color lines, tooltip, cursor; driver selector dropdowns
- [ ] 02-03-PLAN.md — Replay engine: timer hook with stale-closure prevention, replay controls bar (play/pause, speed, scrubber)
- [ ] 02-04-PLAN.md — Dashboard layout: two-column wiring, sticky header, dark theme, end-to-end human verification

### Phase 3: Standings Board
**Goal**: Users can see a synchronized standings table that shows every driver's position, gaps, tire compound, tire age, and pit stop count at the current replay lap
**Depends on**: Phase 2
**Requirements**: STND-01, STND-02, STND-03, STND-04
**Success Criteria** (what must be TRUE):
  1. User sees a standings table listing all drivers in race position order at the current replay lap
  2. Each row shows gap to the race leader and interval to the car directly ahead
  3. Each row shows the driver's current tire compound and the number of laps on that set
  4. Each row shows how many pit stops the driver has made to that lap
  5. When the user advances the replay (play or scrub), the standings table updates to reflect the new lap
**Plans:** 2/2 plans complete

Plans:
- [ ] 03-01-PLAN.md — Data hook, StandingsBoard component, and dashboard wiring
- [ ] 03-02-PLAN.md — End-to-end human verification of all standings behaviors

### Phase 4: Chart Enhancements
**Goal**: Users can read the gap chart without external context — pit stops and safety car periods are visible as annotations and shading directly on the chart
**Depends on**: Phase 2
**Requirements**: GAP-04, GAP-05
**Success Criteria** (what must be TRUE):
  1. User sees vertical lines on the gap chart at laps where either selected driver pitted, clearly distinguishing gap changes caused by strategy from genuine on-track pace differences
  2. User sees yellow-shaded lap ranges on the gap chart where a Safety Car or VSC was deployed, so gap collapses under neutralized conditions are not misread as pace changes
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend Foundation | 4/4 | Complete   | 2026-03-13 |
| 2. Gap Chart + Replay Engine | 3/4 | In Progress|  |
| 3. Standings Board | 2/2 | Complete   | 2026-03-13 |
| 4. Chart Enhancements | 0/TBD | Not started | - |
