# Phase 7: Interval History - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Gap-to-car-ahead chart showing each selected driver's interval to the car one position ahead across all laps, with a 1.0s DRS reference line and shaded DRS zone. Supports spoiler-free progressive reveal (laps up to currentLap only) and uses the shared DriverToggle for driver visibility. Replay cursor synced to current lap.

</domain>

<decisions>
## Implementation Decisions

### Interval calculation
- Compute interval from `Time` + `Position` columns — `IntervalToPositionAhead` not in public FastF1 API
- Position-based gap: show interval to whichever driver is one position ahead (P-1) in race classification, not physical car ahead
- Race leader (P1): exclude from chart — interval-to-car-ahead is undefined. If a driver leads mid-race, their trace has a gap for those laps
- Pit stop laps: keep in trace but dim to ~30% opacity (same approach as lap time chart outliers)
- Lap 1: include but dim to ~30% opacity — chaotic data shouldn't dominate scale
- DNF/retired drivers: trace simply ends at last completed lap, no special marker
- Overtakes: continuous line — when car-ahead changes due to position swap, trace continues (natural jump tells the overtake story)

### DRS reference line
- Horizontal dashed line at 1.0s with "DRS" label
- Subtle green shaded zone below 1.0s line (rgba green ~0.08 opacity) indicating DRS window
- DRS zone always visible across all laps (not conditionally hidden during SC/first 2 laps)
- Green color consistent with F1 broadcast DRS indicators

### Chart visual style
- Line chart (lines mode, no markers) — team-colored traces per driver
- Y-axis auto-scale, but clip large intervals at a reasonable cap (~10-15s) to keep DRS-range data readable
- Hover highlighting: same pattern as PositionChart — hovered trace opaque + thicker, others dim to ~0.5 opacity
- End-of-line driver abbreviation labels at rightmost data point (same as position chart)
- SC/VSC shading via buildSCShapes pattern with progressive reveal
- Replay cursor via makeReplayCursorShape
- Chart height 400px, full-width card in analysis section

### SC/VSC intervals
- No dimming for SC/VSC laps — SC shading rectangles provide sufficient context
- Interval data during SC is real and shows field compression, which is strategically interesting

### Claude's Discretion
- Exact Plotly configuration (margins, font sizes, grid styling)
- Interval clipping threshold (somewhere in 10-15s range)
- Hover tooltip content and formatting
- Opacity value for dimmed pit/lap 1 data points
- Whether to use per-point opacity array (like lap time chart) or separate traces for dimmed laps
- Loading/empty state design
- Exact DRS zone green shade and line style

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `makeReplayCursorShape` (`lib/plotlyShapes.ts`): Replay cursor shape — reuse directly
- `buildSCShapes` (`PositionChart/usePositionData.ts`): SC/VSC shading with progressive reveal — duplicate pattern (hooks are self-contained per Phase 6 decision)
- `buildEndOfLineAnnotations` (`PositionChart/usePositionData.ts`): Driver abbreviation labels at rightmost point — same pattern
- `useVisibleDrivers` + `DriverToggle`: Shared driver toggle infrastructure from Phase 6
- `useSessionStore`: Zustand store with `laps`, `drivers`, `currentLap`, `safetyCarPeriods`
- `DriverInfo` type: Has `teamColor`, `abbreviation`, `team` fields
- `LapRow` type: Has `Time`, `Position`, `Driver`, `LapNumber`, `PitInTime`, `PitOutTime`, `Stint` fields

### Established Patterns
- Chart component pattern: pure exported functions (testable) + hook + presentational component
- Memoization: chart data memos on `[laps]`, cursor shape separately on `[currentLap]`
- Progressive reveal: filter data by `currentLap`
- Per-point opacity array for outlier dimming (Phase 6 lap time chart pattern)
- Plotly dark theme: `paper_bgcolor: '#1a1a2e'`, `plot_bgcolor: '#1a1a2e'`, font `#e0e0f0`, grid `#2d2d3d`
- `scattergl` (WebGL) for multi-driver traces
- Hover highlighting via React state (hoveredTraceIndex) rather than Plotly.restyle

### Integration Points
- `Dashboard.tsx`: IntervalHistory card goes after PositionChart card, inside the analysis section
- `visibleDrivers` prop threaded from `useVisibleDrivers` in Dashboard
- `sessionStore`: reads `laps`, `drivers`, `currentLap`, `safetyCarPeriods`

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

*Phase: 07-interval-history*
*Context gathered: 2026-03-14*
