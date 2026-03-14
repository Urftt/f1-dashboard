# Phase 6: Lap Time Chart + Position Chart - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Two new analysis charts in the scrollable dashboard: (1) a lap time scatter plot with per-stint linear degradation trend lines, and (2) a position spaghetti chart showing race order over laps. Both charts share a single driver visibility toggle (checkbox panel grouped by team) and display SC/VSC shading. Charts are full-width cards stacked below the existing StintTimeline.

</domain>

<decisions>
## Implementation Decisions

### Lap time data filtering
- Show ALL laps in the scatter plot — do not exclude pit laps, SC laps, or lap 1
- Outlier laps (pit in/out, SC/VSC, lap 1) rendered at ~30% opacity; normal racing laps at full opacity
- Same marker shape for all laps — opacity alone distinguishes outliers from clean laps

### Trend lines
- Linear regression per stint — straight line fit showing average degradation rate
- Trend lines computed from clean laps only (excluding pit/SC/lap 1 data points)
- Trend line overlaid on each stint in the driver's team color (or matching the scatter color)

### Driver visibility toggle
- Checkbox panel grouped by team (similar to existing DriverSelector pattern)
- Each driver checkbox in team color, grouped under team name headers
- Default: top 2 drivers by current position visible; user checks more as needed
- Shared toggle — one panel controls visibility for both Lap Time Chart and Position Chart
- Toggle panel placed as standalone element between StintTimeline and the two charts

### Position chart style
- Lines colored by team color (from DriverInfo.teamColor) — consistent with rest of dashboard
- Driver abbreviation labels at end of line only (rightmost data point)
- Y-axis inverted so P1 is at top
- Highlight on hover: all lines at ~0.5 opacity, hovered driver becomes fully opaque and thicker, others dim further
- Only toggled-on drivers shown (respects the shared driver toggle)

### Chart card layout
- Both charts stacked full-width below StintTimeline, each in its own card
- Order: StintTimeline → Driver Toggle → Lap Time Chart → Position Chart
- Each chart height: 400px
- SC/VSC shading on both charts (reuse existing pattern from `useGapData`)
- Replay cursor on both charts (reuse `makeReplayCursorShape`)

### Claude's Discretion
- Exact Plotly configuration details (margins, font sizes, grid styling)
- Linear regression implementation approach (simple least-squares)
- How to categorize outlier laps (pit detection via PitInTime/PitOutTime, SC detection via safetyCarPeriods)
- Hover tooltip content and formatting for both charts
- Loading/empty state design
- Driver toggle component styling details (compact horizontal layout)
- Whether to create one shared data hook or separate hooks per chart

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `makeReplayCursorShape` (`lib/plotlyShapes.ts`): Replay cursor shape — use on both new charts
- `getCompoundColor`, `getCompoundLetter` (`lib/compounds.ts`): For coloring trend lines by compound if needed
- `computeDriverOrder` (`StintTimeline/useStintData.ts`): Driver ordering by position at current lap
- `useGapData` SC/VSC shading logic: Pattern for building SC shapes with progressive reveal and growing active periods
- `useSessionStore`: Zustand store with `laps`, `drivers`, `currentLap`, `safetyCarPeriods`
- `DriverInfo` type: Has `teamColor`, `abbreviation`, `team` fields

### Established Patterns
- Chart component pattern: data hook (e.g., `useGapData`, `useStintData`) + presentational component
- Plotly dark theme: `paper_bgcolor: '#1a1a2e'`, `plot_bgcolor: '#1a1a2e'`, font `#e0e0f0`, grid `#2d2d3d`
- Progressive reveal: filter data by `currentLap` for spoiler-free replay
- Memoization: chart data memos on `[laps]`, cursor/annotations memo separately with `currentLap`

### Integration Points
- `Dashboard.tsx`: New charts go inside the analysis section `<section>`, after StintTimeline card
- `sessionStore`: Charts read `laps`, `drivers`, `currentLap`, `safetyCarPeriods`
- LapRow fields needed: `LapNumber`, `LapTime`, `Driver`, `Position`, `Stint`, `PitInTime`, `PitOutTime`, `Compound`

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

*Phase: 06-lap-time-chart-position-chart*
*Context gathered: 2026-03-14*
