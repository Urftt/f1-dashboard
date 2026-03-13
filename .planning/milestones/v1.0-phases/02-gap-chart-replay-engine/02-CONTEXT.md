# Phase 2: Gap Chart + Replay Engine - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can select two drivers and see their gap plotted over time as an interactive Plotly chart, then replay the session lap-by-lap with start/pause, configurable speed (0.5x, 1x, 2x, 4x), a lap scrubber, and a vertical cursor on the chart tracking the current lap. Requirements: GAP-01, GAP-02, GAP-03, REPL-01, REPL-02, REPL-03, REPL-04.

</domain>

<decisions>
## Implementation Decisions

### Driver Selection UX
- Two separate dropdowns: "Driver A" and "Driver B" side by side, above the chart
- Dropdown items show abbreviation + full name (e.g. "VER — Max Verstappen"); selected value shows abbreviation only
- Drivers ordered by team (grouped by constructor)
- Auto-select P1 and P2 at lap 1 (grid positions) when session loads — chart renders immediately, no empty state
- **No spoilers**: never sort or display anything that reveals race outcome (no finishing positions, no final standings)

### Gap Chart Presentation
- Y-axis: gap in seconds between the two drivers. Positive = Driver A ahead, negative = Driver B ahead. Zero-line reference
- Line color changes based on who's leading: team color of the leading driver (e.g., Red Bull blue when VER leads, Ferrari red when LEC leads)
- Tooltip on hover: minimal format — "Lap 23: +1.432s"
- Dark theme: dark background with light grid lines (Plotly dark template). **Entire dashboard uses dark theme, not just the chart**
- Vertical dashed line as replay cursor at the current lap

### Replay Controls Design
- Global replay controls (not attached to chart) — they drive all widgets including future standings
- Sticky bar at top of page, below the compact session selector
- Media player style: play/pause button, speed buttons (0.5x, 1x, 2x, 4x), lap scrubber
- Lap scrubber: draggable slider spanning all laps, with tick marks at every 5 or 10 laps, shows current lap number above thumb
- Displays "Lap X/Y" counter

### Page Layout
- Two-column layout: gap chart on the left (~60%), standings placeholder on the right (~40%)
- Right column shows "Standings coming soon" placeholder for Phase 2 (Phase 3 fills it in)
- Sticky header: compact session selector + replay controls bar (always visible)
- Driver dropdowns sit above the gap chart, within the left column
- Content scrolls below the sticky header

### Claude's Discretion
- Exact Plotly configuration and dark theme customization
- Gap calculation algorithm (client-side from existing laps in Zustand store)
- Replay timer implementation (useEffect/setInterval approach)
- Responsive breakpoints and exact column widths
- How to derive driver list and team colors from the loaded session data
- Scrubber tick mark density (every 5 vs 10 laps)

</decisions>

<specifics>
## Specific Ideas

- "No spoilers" is a core UX principle — the dashboard simulates watching a live race with historical data, so nothing should reveal the outcome
- Auto-selecting grid P1 and P2 gives an immediate chart on session load — the user is watching a race replay, not browsing data
- Team color on the gap line instantly communicates who's in front without reading values
- The replay controls are global because they'll drive the standings board (Phase 3) and chart annotations (Phase 4) too

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ui/select.tsx`: Fully styled Select component — reuse for driver dropdowns
- `ui/button.tsx`: Button with variants (default, outline, ghost) and sizes — reuse for play/pause and speed buttons
- `ui/progress.tsx`: Progress bar component — potential reuse for lap scrubber styling
- `SessionSelector/SessionSelector.tsx`: Pattern for cascading dropdowns with @base-ui/react
- `sessionStore.ts`: Zustand store with `laps: LapRow[]` containing Driver, LapNumber, Time, Position, Compound, PitInTime, PitOutTime — all data needed for gap calculation

### Established Patterns
- Zustand for cross-component state (no prop drilling)
- @base-ui/react primitives for interactive components
- Tailwind CSS + shadcn/ui for styling
- TypeScript strict types for all data models
- API client in `lib/api.ts`, SSE client in `lib/sse.ts`

### Integration Points
- Extend `sessionStore.ts` with: selectedDrivers, currentLap, isPlaying, replaySpeed
- All lap data already flows into store via SSE at session load — no new backend endpoints needed
- Gap calculation is client-side: filter laps by driver pair, compute time difference per lap
- `config.py` in old Streamlit app has DRIVER_COLORS that could inform team color mapping
- Need to add `react-plotly.js` (or `plotly.js`) dependency to frontend

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-gap-chart-replay-engine*
*Context gathered: 2026-03-13*
