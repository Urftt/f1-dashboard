# Phase 3: Standings Board - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-lap standings table synchronized with the replay engine, displayed in the right column (~40%) of the existing two-column dashboard layout. Shows all 20 drivers with positions, gaps/intervals, tire compounds, tire age, and pit stop count at the current replay lap. Requirements: STND-01, STND-02, STND-03, STND-04.

</domain>

<decisions>
## Implementation Decisions

### Table Layout & Density
- Comfortable row height — top ~10 drivers visible, scroll for the rest
- Team color bar on left edge of each row (thin vertical stripe)
- Columns: Position + Driver abbreviation + Interval/Gap + Tire compound + Tire age + Pit count
- Abbreviation only (VER, NOR) — no full driver names in the table
- Full driver name available on hover tooltip

### Position Change Indicators
- Show position change vs previous lap (green ▲ gained, red ▼ lost, no indicator when unchanged)
- Instant update each lap (no persistence delay, even at high replay speeds)
- Smooth row reorder animation (~200ms) when position order changes between laps

### Tire Visualization
- Compound shown as single colored letter: S (red), M (yellow), H (white), I (green), W (blue) — F1-standard colors
- Tire age shows laps on current set (TyreLife from FastF1), resets after pit stop
- Brief highlight on the tire cell when compound changes (driver pitted)

### Gap & Interval Format
- Single column toggleable between "interval to car ahead" and "gap to leader"
- Toggle via clickable column header — header text changes to show current mode (INT / GAP)
- Default mode: interval to car ahead
- Leader row shows "—" (dash) instead of a time value
- 1 decimal place precision (+1.2s)
- Lapped drivers show "+1 LAP", "+2 LAPS" instead of time gap

### Claude's Discretion
- Exact row height and spacing to fit ~10 drivers
- Scroll container implementation
- How to calculate interval from FastF1 lap data (Time field differences)
- Hover tooltip implementation for full driver names
- Exact animation implementation for row reorder
- How to detect lapped cars from the data

</decisions>

<specifics>
## Specific Ideas

- The standings syncs to `currentLap` from the global replay controls (already in sessionStore)
- "No spoilers" principle carries forward — standings only show data up to the current replay lap
- F1-standard tire colors are universally recognized by F1 fans — the target audience
- The toggle between interval and gap-to-leader satisfies both STND-02 requirements in a single column

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sessionStore.ts`: Zustand store with `laps: LapRow[]` containing all needed fields (Position, Compound, TyreLife, PitInTime, PitOutTime, Stint, Time, Driver, Team)
- `drivers: DriverInfo[]` in store has abbreviation, fullName, team, teamColor — provides team colors for the color bar
- `currentLap` in store — the replay position that standings syncs to
- `ui/select.tsx`, `ui/button.tsx` — existing styled components
- `driverColors.ts` — team color mappings

### Established Patterns
- Zustand for cross-component state (no prop drilling) — standings reads from same store as GapChart
- @base-ui/react primitives for interactive components
- Tailwind CSS for styling, dark theme via `class="dark"` on `<html>`
- TypeScript strict types for all data models

### Integration Points
- `Dashboard.tsx` has a placeholder div in the right column (`lg:col-span-2`) — standings component replaces this
- No new backend endpoints needed — all data already in frontend store from session load
- Standings derives its data from `laps.filter(l => l.LapNumber === currentLap)` sorted by Position

</code_context>

<deferred>
## Deferred Ideas

- Expandable/wider standings view (click or hover to widen the right column for more horizontal info) — future enhancement

</deferred>

---

*Phase: 03-standings-board*
*Context gathered: 2026-03-13*
