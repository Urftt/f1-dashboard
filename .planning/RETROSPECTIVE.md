# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — F1 Race Replay Dashboard

**Shipped:** 2026-03-13
**Phases:** 4 | **Plans:** 12 | **Commits:** 71

### What Was Built
- FastAPI backend with FastF1 data pipeline, SSE progress streaming, and disk caching
- Interactive Plotly gap chart with team-color lines, hover tooltips, pit stop annotations, safety car shading
- Lap-by-lap replay engine with play/pause, speed control (0.5x-4x), and scrubber
- Standings board with positions, gaps, tire compounds, tire age, and pit counts
- Cascading session selector (year/event/session type) with real-time loading progress

### What Worked
- Phase decomposition was clean — each phase had clear boundaries and minimal cross-phase rework
- Dynamic driver/team data from FastF1 eliminated the need for hardcoded lookup tables
- SSE for session loading gave great UX feedback without polling complexity
- Human verification checkpoints caught real issues (stale JSDoc, position 99 edge case)

### What Was Inefficient
- Phase 2 ROADMAP checkbox status was never updated to `[x]` despite all 4 plans completing — caused confusion during audit
- Human verification plans (01-04, 02-04, 03-02) took disproportionate wall-clock time (~145min combined) vs automated plans
- Some tech debt accumulated that could have been caught in-phase (orphaned driverColors.ts, stale LapData model)

### Patterns Established
- Gap calculation via session `Time` field, not cumulative `LapTime` — avoids safety car and pit stop errors
- Invisible hover traces for Plotly annotation tooltips (two-point lines at y:[0,1])
- `asyncio.to_thread` for all FastF1 blocking calls in async FastAPI routes
- Per-session `asyncio.Lock` for concurrent load protection

### Key Lessons
1. Always update ROADMAP.md plan checkboxes when plans complete — audit relies on this
2. FastF1 returns surprising types (datetime64[ns] tz-naive, numpy.float64, Position 99) — serialize everything to Python primitives at the boundary
3. react-plotly.js CJS default export needs double-wrap check — test imports before building components

### Cost Observations
- Model mix: balanced profile (sonnet for research/planning agents, opus for execution)
- Sessions: ~6 (foundation, gap chart, replay, dashboard, standings, chart enhancements)
- Notable: All 4 phases completed in a single day

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 71 | 4 | Initial process — established GSD workflow with research → plan → execute → verify |

### Top Lessons (Verified Across Milestones)

1. (First milestone — lessons to be verified in future milestones)
