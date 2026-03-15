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

## Milestone: v1.1 — Strategy & Analysis Dashboard

**Shipped:** 2026-03-15
**Phases:** 4 | **Plans:** 7 | **Files:** 59 changed

### What Was Built
- Scrollable analysis dashboard with "Strategy & Analysis" section
- Stint timeline with compound-colored bars for all 20 drivers
- Lap time chart with per-stint trend lines, slope/σ annotations, std dev bands, and SC exclusion toggle
- Position chart with hover highlighting, end-of-line labels, and SC/VSC shading
- Interval history with DRS threshold, gap-to-car-ahead, and hover highlighting
- Sector comparison heatmap with session/personal best color coding, cursor highlight, and SC exclusion toggle
- Pit stop vertical lines on lap time chart
- Progressive reveal (spoiler-free) across all charts

### What Worked
- Three-memo split pattern (data / visible / cursor) established in Phase 5 scaled perfectly to all 4 charts
- Pure function exports from hooks enabled 162 tests without mocking React
- Cross-phase reuse worked well: `makeReplayCursorShape` (Ph5) used by all charts, `computeDriverOrder` (Ph5) reused by sector heatmap (Ph8)
- Post-milestone bugfixes (GapChart spoiler, process.env, SC restart laps) were caught during manual UAT

### What Was Inefficient
- Phase 8 was executed without formal PLAN.md files — skipped the plan → execute loop
- Phase 8 SUMMARY frontmatter didn't list RACE-03 in requirements_completed
- No VERIFICATION.md for Phase 8 — had to infer satisfaction from code inspection
- Nyquist validation drafts created for phases 5-7 but never completed (all `nyquist_compliant: false`)
- `buildSCShapes` duplicated in 3 files (intentional decision but still debt)

### Patterns Established
- Toggle switch UI pattern for SC/VSC exclusion (reusable across charts)
- Slope annotation on trend lines: `±Nms/lap` + `σ Nms` for degradation comparison
- Standard deviation bands around regression lines for consistency visualization
- Restart lap (lap after SC/VSC) treated as outlier alongside SC laps themselves
- `hexToRgba` helper for Plotly fill colors with proper alpha control

### Key Lessons
1. Always check progressive reveal on ALL chart data — the GapChart spoiler bug was missed because only annotations were filtered by currentLap, not the line data
2. `process.env` doesn't exist in Vite — use `import.meta.env` (caught as runtime crash, not build error)
3. Pre-computing trend lines on full data then clamping visually still leaks information (slope values) — compute from revealed data only
4. Phase 8 skipping formal plans led to documentation gaps that the audit caught — the plan step has value even for "simple" phases

### Cost Observations
- Model mix: balanced profile (sonnet for agents, opus for execution)
- Sessions: ~4 (layout+stint, charts, interval, sector + manual UAT)
- Notable: Entire milestone completed in 2 days. Post-milestone bugfix session added significant value (spoiler fixes, chart titles, degradation stats)

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 71 | 4 | Initial process — established GSD workflow with research → plan → execute → verify |
| v1.1 | ~15 | 4 | Scaled chart pattern; post-milestone UAT caught spoiler bugs |

### Top Lessons (Verified Across Milestones)

1. Always update ROADMAP.md checkboxes and REQUIREMENTS.md status — audit relies on these (v1.0, v1.1)
2. FastF1/Plotly type boundaries need explicit serialization — CJS interop, numpy types, process.env (v1.0, v1.1)
3. Skipping formal plans leads to documentation gaps that audits catch — the plan step has value (v1.1)
