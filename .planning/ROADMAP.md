# Roadmap: F1 Dashboard v1.0

**Created:** 2026-03-10
**Milestone:** v1.0
**Requirements covered:** 15 / 15

## Overview

This roadmap turns the current non-working prototype into a reliable historical replay dashboard. The order is deliberate: first make session data loadable and testable, then build replay control, then wire the dashboard KPIs to replay state, then harden the app for real use.

## Phases

| Phase | Name | Goal | Requirements |
|-------|------|------|--------------|
| 1 | Replay Data Foundation | Load and normalize the historical race data needed for replay and tyre-aware KPIs | REPL-01, STAT-02, STAT-03, RELY-03 |
| 2 | Replay Engine And Controls | Introduce replay state and playback controls that move through race time reliably | REPL-02, REPL-03, REPL-04, REPL-05 |
| 3 | Dashboard KPIs | Connect selected drivers, gap graph, and race stats to the replay timeline | COMP-01, COMP-02, COMP-03, STAT-01, STAT-04 |
| 4 | Reliability And UX Hardening | Make the full flow robust, with clear fallbacks and a usable end-to-end experience | RELY-01, RELY-02 |

## Phase Details

### Phase 1: Replay Data Foundation

**Goal:** Load a supported historical session once, normalize the required datasets, and make replay-time KPI derivation testable.

**Requirements:** `REPL-01`, `STAT-02`, `STAT-03`, `RELY-03`

**Plan progress:** 3 / 3 complete (`01-01`, `01-02`, and `01-03` done)

**Success criteria:**
1. A user can select a historical race session and the app can preload the datasets needed for replay.
2. The code can derive tyre compound and tyre age for a driver at a chosen replay position.
3. Core replay snapshot calculations are covered by automated tests.
4. The data layer no longer depends on the blocking UI loop to be usable.

### Phase 2: Replay Engine And Controls

**Goal:** Make replay progression explicit and controllable through state instead of long-running blocking loops.

**Requirements:** `REPL-02`, `REPL-03`, `REPL-04`, `REPL-05`

**Plan progress:** 1 / 3 complete (`02-01` done)

**Success criteria:**
1. A user can start replay from race start and the replay clock advances through the session.
2. A user can pause and resume replay without losing position.
3. A user can change playback speed and see replay progression update accordingly.
4. A user can scrub or jump to another replay position without breaking dashboard state.

### Phase 3: Dashboard KPIs

**Goal:** Render the main value of the product by connecting replay state to comparison and race-stat views.

**Requirements:** `COMP-01`, `COMP-02`, `COMP-03`, `STAT-01`, `STAT-04`

**Success criteria:**
1. A user can select two drivers for comparison in the dashboard.
2. The gap graph updates over replay time for the selected drivers.
3. The user can visually tell whether the selected gap is closing or extending.
4. The statistics table updates over replay time with latest completed lap information.

### Phase 4: Reliability And UX Hardening

**Goal:** Make the replay dashboard usable end-to-end on real sessions, including missing-data cases.

**Requirements:** `RELY-01`, `RELY-02`

**Success criteria:**
1. A supported session can be loaded and used through the main replay flow without app-breaking errors.
2. Missing or incomplete fields show clear fallback messaging in the UI.
3. The broken or stale prototype paths are removed or brought into line with the working replay flow.
4. The repo has a documented and runnable local path for validating the milestone manually.

## Coverage Check

- Total v1 requirements: 15
- Requirements mapped: 15
- Unmapped requirements: 0

All v1 requirements are covered exactly once.

---
*Last updated: 2026-03-10 after completing Phase 2 Plan 01*
