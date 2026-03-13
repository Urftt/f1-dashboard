# Phase 5: Dashboard Layout + Stint Timeline - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Scrollable analysis section below the existing standings + gap chart grid, containing the first analysis chart: a tire strategy timeline showing all drivers' stints as horizontal compound-colored bars spanning their lap range, with a vertical replay cursor synced to the current lap. Shared utilities (`lib/compounds.ts`, `lib/plotlyShapes.ts`) are created here and reused by subsequent chart phases.

</domain>

<decisions>
## Implementation Decisions

### Stint bar visual style
- Gantt-style horizontal bars per driver, one row per driver, spanning lap range on shared x-axis
- Compound abbreviation (S, M, H, I, W) centered on each bar — no lap range text on bars
- Detailed hover tooltips showing: compound, lap range, stint length, tyre life at end of stint
- Compact rows (~20-24px) so all 20 drivers fit without scrolling within the chart (~500px chart height)

### Analysis section layout
- Full-width section below the existing 2-column standings/gap grid
- Subtle horizontal divider with "STRATEGY & ANALYSIS" label separating sections
- Each chart is a full-width card within the analysis section
- Analysis section only visible during active replay (same as standings + gap chart)

### Driver ordering
- Ordered by current race position at the current replay lap
- Rows re-sort with smooth animation when positions change
- Driver labels show position + abbreviation (e.g., "P1 VER") in team color
- Stint bars progressively reveal during replay — only stints up to current lap shown (spoiler-free)

### Compound colors
- Standard F1 Pirelli colors: SOFT=#e10600 (red), MEDIUM=#ffd700 (yellow), HARD=#ffffff (white), INTERMEDIATE=#00cc00 (green), WET=#0066ff (blue)
- No compound color legend — compounds labeled on bars themselves
- Unknown/null compounds shown as gray (#555) bar with "?" label

### Claude's Discretion
- Exact Plotly chart configuration and layout details
- Replay cursor visual style (consistent with existing gap chart cursor)
- Loading skeleton / empty state design
- Shared utility API design (`lib/compounds.ts`, `lib/plotlyShapes.ts`)
- Smooth animation implementation approach for row re-sorting

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useGapData.ts`: Demonstrates the memoization pattern — chart data memos on `[laps, drivers, selectedDrivers]`, annotations memo separately with `currentLap`
- `useDriverList()`: Returns drivers grouped by team, ordered by lap 1 position — can be adapted for position-based ordering
- `sessionStore.ts`: Zustand store with `laps`, `drivers`, `currentLap`, `safetyCarPeriods` — all needed for stint timeline
- `LapRow` type: Already has `Compound`, `TyreLife`, `Stint`, `Position` fields

### Established Patterns
- Plotly dark theme: `paper_bgcolor: '#1a1a2e'`, `plot_bgcolor: '#1a1a2e'`, font color `#e0e0f0`, grid color `#2d2d3d`
- Progressive reveal: Filter data by `currentLap` (see `useGapData` pit stop filtering)
- Replay cursor: Red dashed vertical line at current lap (`#e10600`, width 2, dash dot)
- Chart component pattern: Separate data hook (e.g., `useGapData`) + presentational component (e.g., `GapChart`)

### Integration Points
- `RaceDashboardInner.tsx`: Analysis section goes below the existing `race-dashboard__grid` div, inside the `isReplaying` conditional
- `sessionStore`: Stint timeline reads `laps`, `drivers`, `currentLap` from store
- Prior decision: Group stints by `Stint` integer column (not `Compound`) to handle FastF1 None values

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-dashboard-layout-stint-timeline*
*Context gathered: 2026-03-13*
