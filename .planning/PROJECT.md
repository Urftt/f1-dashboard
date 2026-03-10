# F1 Dashboard

## What This Is

An F1 race-side dashboard for a data-oriented fan who wants more insight than the broadcast provides. For this milestone, the product focus is a historical replay experience that advances through a race timeline as if it were live, showing a two-driver gap graph plus a compact race statistics view.

## Core Value

Make race progression easy to read at a glance through reliable, replay-synced timing and tyre context.

## Current Milestone: v1.0

**Goal:** Get the dashboard working reliably for historical race replay with evolving KPIs.

**Target features:**
- Replay a historical race session from race start with timeline-based playback
- Show a two-driver gap graph that updates over the replay
- Show a race statistics table with last lap time, current tyre compound, and tyre age
- Provide playback controls for start, pause, resume, scrub, jump, and speed control

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — current code is a prototype and is not working reliably enough to count as validated)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Historical replay mode works end-to-end for a selected race session
- [ ] Gap graph updates over replay time for two selected drivers
- [ ] Basic race statistics update over replay time
- [ ] Replay controls make the dashboard usable while rewatching a race

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- True low-latency live race mode — external live data access is unreliable and not required for this milestone
- Advanced strategy analysis, pit windows, and tyre degradation modeling — useful next features, but they depend on a stable replay foundation first
- Sector-level comparison views as a primary milestone deliverable — interesting, but secondary to getting replay and core KPIs working

## Context

- Existing codebase is a small Streamlit prototype with OpenF1-based session loading and partial charting code.
- The repository was started earlier and does not currently function reliably.
- The user is a data scientist and wants richer race insight while watching or rewatching F1.
- Live-by-the-millisecond behavior is not required; replay-synced behavior is acceptable and preferred for this milestone.
- Current codebase concerns include a broken package entrypoint, incomplete live/replay logic in `app.py`, and no automated tests.

## Constraints

- **Tech stack**: Keep the current Python + Streamlit + Plotly stack for this milestone — it matches the existing code and is sufficient for a laptop-side dashboard
- **Data source**: Build around historical/replay-capable data first — official live F1 data is difficult to access reliably
- **Scope**: Prioritize usability over analytics breadth — the repo needs a working baseline before adding deeper race insights
- **Interface**: Dashboard should work on a laptop during a race rewatch — controls and KPIs must be easy to understand quickly

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Prioritize historical replay over true live mode for v1.0 | Replay is achievable with available data and still delivers the core user value | — Pending |
| Make the gap graph and basic race stats the initial KPI set | These are the most direct expressions of race progression and are simple enough to validate first | — Pending |
| Keep Streamlit as the app shell for v1.0 | The existing prototype already uses it and the milestone is about making the product work before re-platforming | — Pending |

---
*Last updated: 2026-03-10 after starting milestone v1.0*
