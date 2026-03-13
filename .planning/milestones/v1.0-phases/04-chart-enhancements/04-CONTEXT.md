# Phase 4: Chart Enhancements - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can read the gap chart without external context — pit stops and safety car periods are visible as annotations and shading directly on the chart. Requirements: GAP-04, GAP-05.

</domain>

<decisions>
## Implementation Decisions

### Pit Stop Annotations
- Vertical solid thin lines at each pit stop lap, thinner than the replay cursor line
- Team-colored lines — each driver's pit uses their team color (consistent with gap line segments)
- Small 3-letter driver abbreviation (e.g., "VER") rendered at the top of each pit line for quick identification
- Hover tooltip shows "VER pit — Lap 12" format
- When both drivers pit on the same lap: two side-by-side lines with slight offset so both colors are visible

### Safety Car Shading
- Yellow shading for both SC and VSC, differentiated by opacity — full SC gets stronger shading, VSC gets lighter
- "SC" or "VSC" text label rendered inside the shaded region, at top of chart
- Shading renders behind the gap line (background layer) — line always visible through shading
- Red flag periods: thick red vertical band at the stoppage lap with "RED" label (not a range, since the session stops and no gap data exists during the stoppage)
- Z-ordering: SC shading (back) → pit stop lines (middle) → gap line (front) → cursor (front)

### Replay Integration
- Progressive reveal: annotations only appear once the replay cursor reaches that lap (matches "no spoilers" principle)
- Scrubbing backward hides annotations beyond the current lap — future events re-hidden
- Active safety car periods grow with replay — shading extends from SC start to current lap while SC is ongoing
- Matches existing behavior where the gap chart line itself only renders up to the current replay lap

### Annotation Density
- Always show everything — no toggles or filters. Rely on distinct visual styles (team-colored lines vs yellow shading) for readability
- Pit lines render on top of SC shading when a pit occurs during a safety car period (very common in F1)

### Claude's Discretion
- Exact yellow shading opacity values for SC vs VSC
- Exact red band width for red flags
- Plotly shapes vs annotations implementation choice
- How to parse FastF1 messages for SC/VSC/red flag events
- Pit line offset amount for same-lap double pits
- Driver abbreviation font size and positioning

</decisions>

<specifics>
## Specific Ideas

- Progressive reveal is key — the dashboard simulates watching a live race, so pit stops and SC periods should "happen" as you replay, not be visible upfront
- Red flags are fundamentally different from SC/VSC because the session stops entirely — no shading range, just a marker at the stoppage point
- Pit stops during safety cars are extremely common (teams pit under SC to minimize time loss) — layering must handle this cleanly

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GapChart.tsx`: Plotly chart component with existing cursor line using `shapes` array — extend this for pit stop lines and SC rectangles
- `useGapData.ts`: Gap calculation hook — extend to compute pit stop laps and SC periods for the selected drivers
- `sessionStore.ts`: Zustand store with `laps: LapRow[]` containing `PitInTime` and `PitOutTime` — pit stop data already available
- `useStandingsData.ts`: Already counts pit stops per driver by checking `l.PitInTime !== null` — reuse this pattern

### Established Patterns
- Plotly shapes array for chart overlays (cursor line pattern at GapChart.tsx lines 21-38)
- `yref: 'paper'` for full-height shapes regardless of data range
- Zustand for cross-component state, no prop drilling
- TypeScript strict types for all data models

### Integration Points
- Backend: `fastf1_service.py` line 184 has `messages=False` — needs to be enabled to get SC/VSC/red flag events
- Backend: `schemas.py` needs new fields for safety car periods
- Frontend: `session.ts` types need SafetyCarPeriod interface
- Frontend: `sessionStore.ts` needs to store safety car period data from backend
- SSE "complete" event payload needs new `safetyCarPeriods` field alongside existing `laps` and `drivers`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-chart-enhancements*
*Context gathered: 2026-03-13*
