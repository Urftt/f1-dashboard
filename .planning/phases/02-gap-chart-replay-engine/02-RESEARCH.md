# Phase 2: Gap Chart + Replay Engine - Research

**Researched:** 2026-03-13
**Domain:** React data visualization (Plotly.js), Zustand state management, replay timer patterns
**Confidence:** HIGH

## Summary

Phase 2 builds the core interactive gap chart and a global replay engine on top of the Phase 1 session data pipeline. All lap data already flows into `sessionStore.ts` via SSE — no new backend endpoints are needed. The primary new work is: (1) adding a `react-plotly.js` chart with dark theming, a dynamic-color gap line, custom tooltip, and a vertical cursor shape; (2) extending `sessionStore.ts` with replay state; (3) building a sticky replay controls bar; and (4) refactoring `App.tsx` into a two-column dashboard layout.

The key integration points are well understood. `LapRow.Time` (session elapsed time at lap end, in seconds) is the correct field for gap calculation — not cumulative `LapTime` sums, which don't account for time off-track or safety car gaps correctly. Team color data is NOT included in the serialized lap rows; it must either be derived from a static lookup table (the old `config.py` has F1 2024 colors keyed by driver abbreviation) or added to the backend SSE payload by joining `session.results` to `session.laps`.

Bundle size is the main `react-plotly.js` concern — the default bundle is ~2 MB minified. For a personal local tool this is acceptable; use `plotly.js-basic-dist-min` via `createPlotlyComponent` if size becomes a problem.

**Primary recommendation:** Install `react-plotly.js` + `plotly.js` with `--legacy-peer-deps` (React 19 peer dep mismatch), extend the Zustand store with replay state, compute the gap series client-side from `laps`, render a Plotly scatter chart with `layout.shapes` vertical cursor, and drive it with a `useEffect`/`setInterval` timer.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Driver Selection UX**
- Two separate dropdowns: "Driver A" and "Driver B" side by side, above the chart
- Dropdown items show abbreviation + full name (e.g. "VER — Max Verstappen"); selected value shows abbreviation only
- Drivers ordered by team (grouped by constructor)
- Auto-select P1 and P2 at lap 1 (grid positions) when session loads — chart renders immediately, no empty state
- No spoilers: never sort or display anything that reveals race outcome (no finishing positions, no final standings)

**Gap Chart Presentation**
- Y-axis: gap in seconds between the two drivers. Positive = Driver A ahead, negative = Driver B ahead. Zero-line reference
- Line color changes based on who's leading: team color of the leading driver (e.g., Red Bull blue when VER leads, Ferrari red when LEC leads)
- Tooltip on hover: minimal format — "Lap 23: +1.432s"
- Dark theme: dark background with light grid lines (Plotly dark template). Entire dashboard uses dark theme, not just the chart
- Vertical dashed line as replay cursor at the current lap

**Replay Controls Design**
- Global replay controls (not attached to chart) — they drive all widgets including future standings
- Sticky bar at top of page, below the compact session selector
- Media player style: play/pause button, speed buttons (0.5x, 1x, 2x, 4x), lap scrubber
- Lap scrubber: draggable slider spanning all laps, with tick marks at every 5 or 10 laps, shows current lap number above thumb
- Displays "Lap X/Y" counter

**Page Layout**
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GAP-01 | User can select two drivers from the loaded session | Driver list derived from `laps` in Zustand store; `ui/select.tsx` and `@base-ui/react` Select primitive support grouped items |
| GAP-02 | User sees an interactive gap-over-time chart for the selected pair | `react-plotly.js` scatter chart; gap computed client-side from `LapRow.Time` per driver; Plotly dark template |
| GAP-03 | User can hover to see exact gap values and lap numbers | Plotly `hovertemplate` with `%{x}` (lap) and `%{y:.3f}` (gap seconds); `<extra></extra>` suppresses trace name |
| REPL-01 | User can start/pause a lap-by-lap replay | `isPlaying` state in Zustand store; `useEffect`/`setInterval` timer in a custom hook; play/pause Button from `ui/button.tsx` |
| REPL-02 | User can set replay speed (0.5x, 1x, 2x, 4x) | `replaySpeed` in Zustand store; interval duration = `1000 / speed` ms; speed Buttons from `ui/button.tsx` |
| REPL-03 | User can jump to any lap via a scrubber control | `currentLap` in Zustand store; HTML `<input type="range">` styled with Tailwind; `@base-ui/react` Slider primitive if preferred |
| REPL-04 | Gap chart shows a vertical cursor at the current replay lap | `layout.shapes` array with a single `type: 'line'` shape at `x0: currentLap, x1: currentLap`; dash style `'dash'` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-plotly.js | ^2.6.0 | React wrapper for Plotly charts | Official Plotly React integration; accepts `data` and `layout` props |
| plotly.js | ^2.35.x | Underlying chart engine | Powers react-plotly.js; full scatter, shapes, hover support |
| zustand | ^5.0.11 (already installed) | Cross-component replay state | Already used for session state; extend with replay fields |
| @base-ui/react | ^1.3.0 (already installed) | Slider primitive for scrubber | Already used in project; provides accessible slider |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| plotly.js-basic-dist-min | ^2.35.x | Partial Plotly bundle | Only if 2 MB default bundle causes noticeable load lag (unlikely for local tool) |
| @types/react-plotly.js | ^2.6.x | TypeScript types for Plot component | Install alongside react-plotly.js for TS strict mode |
| lucide-react | ^0.577.0 (already installed) | Play, Pause, icons | Already installed; use `PlayIcon`, `PauseIcon` for media controls |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-plotly.js | Recharts, Victory, Visx | Plotly is decided; those alternatives lack built-in shapes/cursor support at the same depth |
| HTML `<input type="range">` | @base-ui/react Slider | Base UI Slider gives better accessibility and styling hooks; either works |
| setInterval timer | requestAnimationFrame | setInterval is simpler and sufficient; rAF is for animation-speed updates |

**Installation:**
```bash
# From frontend/ directory — --legacy-peer-deps required for React 19 + react-plotly.js peer dep mismatch
npm install react-plotly.js plotly.js --legacy-peer-deps
npm install --save-dev @types/react-plotly.js --legacy-peer-deps
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── stores/
│   └── sessionStore.ts        # Extend with: selectedDrivers, currentLap, isPlaying, replaySpeed
├── components/
│   ├── ReplayControls/
│   │   └── ReplayControls.tsx # Sticky bar: play/pause, speed, scrubber, lap counter
│   ├── GapChart/
│   │   ├── GapChart.tsx       # react-plotly.js Plot wrapper
│   │   └── useGapData.ts      # Hook: derives gap series from laps in store
│   └── Dashboard/
│       └── Dashboard.tsx      # Two-column layout: GapChart left, placeholder right
├── lib/
│   └── driverColors.ts        # Static lookup: driver abbreviation -> team hex color
└── App.tsx                    # Sticky header + Dashboard
```

### Pattern 1: Extending Zustand Store with Replay State

**What:** Add replay fields directly to the existing `sessionStore.ts`.
**When to use:** Replay state must be accessible by both `ReplayControls` and `GapChart` without prop drilling.

```typescript
// Additions to sessionStore.ts
interface SessionState {
  // ... existing fields ...
  selectedDrivers: [string | null, string | null]  // [driverA, driverB]
  currentLap: number
  isPlaying: boolean
  replaySpeed: 0.5 | 1 | 2 | 4
}

interface SessionActions {
  // ... existing actions ...
  setSelectedDrivers: (a: string | null, b: string | null) => void
  setCurrentLap: (lap: number) => void
  setIsPlaying: (playing: boolean) => void
  setReplaySpeed: (speed: 0.5 | 1 | 2 | 4) => void
}
```

### Pattern 2: Gap Calculation Hook

**What:** Client-side gap computation from `LapRow[]`. Group laps by driver, then for each lap number compute `timeA - timeB` using `LapRow.Time` (session elapsed seconds at lap end).
**When to use:** Called in `useGapData.ts`, memoized so it only recomputes when `laps` or `selectedDrivers` changes.

```typescript
// src/components/GapChart/useGapData.ts
import { useMemo } from 'react'
import { useSessionStore } from '@/stores/sessionStore'

export function useGapData() {
  const laps = useSessionStore((s) => s.laps)
  const [driverA, driverB] = useSessionStore((s) => s.selectedDrivers)

  return useMemo(() => {
    if (!driverA || !driverB) return { lapNumbers: [], gaps: [] }

    const byDriver = (d: string) =>
      laps.filter((l) => l.Driver === d && l.LapNumber !== null && l.Time !== null)

    const aLaps = new Map(byDriver(driverA).map((l) => [l.LapNumber!, l.Time!]))
    const bLaps = new Map(byDriver(driverB).map((l) => [l.LapNumber!, l.Time!]))

    const sharedLaps = [...aLaps.keys()].filter((n) => bLaps.has(n)).sort((a, b) => a - b)

    const lapNumbers: number[] = []
    const gaps: number[] = []

    for (const lap of sharedLaps) {
      // Positive = driverA ahead (lower session time = completed lap sooner)
      const gap = bLaps.get(lap)! - aLaps.get(lap)!
      lapNumbers.push(lap)
      gaps.push(gap)
    }

    return { lapNumbers, gaps }
  }, [laps, driverA, driverB])
}
```

**CRITICAL:** Use `LapRow.Time` (session elapsed seconds at lap end), NOT cumulative `LapTime` sums. The `Time` field correctly accounts for SC periods, DNFs, and lapped traffic. This is documented in STATE.md critical pitfalls.

### Pattern 3: react-plotly.js Chart with Dark Theme and Cursor

**What:** Render a Plotly scatter chart with `layout.template: 'plotly_dark'`, a zero-line reference, a `hovertemplate`, and a `layout.shapes` vertical dashed line for the replay cursor.
**When to use:** `GapChart.tsx` renders this; cursor updates by re-passing `layout.shapes` when `currentLap` changes. Plotly re-renders the shape without redrawing the full chart.

```typescript
// Source: https://plotly.com/javascript/react/ + https://plotly.com/javascript/shapes/
import Plot from 'react-plotly.js'

<Plot
  data={[{
    x: lapNumbers,
    y: gaps,
    type: 'scatter',
    mode: 'lines',
    line: { color: leadingDriverColor, width: 2 },
    hovertemplate: 'Lap %{x}: %{y:+.3f}s<extra></extra>',
  }]}
  layout={{
    template: 'plotly_dark',
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    yaxis: { zeroline: true, zerolinecolor: '#666', zerolinewidth: 1 },
    xaxis: { title: { text: 'Lap' } },
    yaxis_title: 'Gap (s)',
    margin: { t: 20, r: 10, b: 40, l: 50 },
    shapes: currentLap > 0 ? [{
      type: 'line',
      x0: currentLap,
      x1: currentLap,
      y0: 0,
      y1: 1,
      yref: 'paper',           // spans full chart height regardless of gap values
      line: { color: '#888', width: 1.5, dash: 'dash' },
    }] : [],
    showlegend: false,
    hovermode: 'x unified',
  }}
  useResizeHandler
  style={{ width: '100%', height: '100%' }}
  config={{ displayModeBar: false }}
/>
```

**Key detail — `yref: 'paper'`:** Using `y0: 0, y1: 1, yref: 'paper'` makes the vertical line span the full chart height regardless of current gap scale. Without this it clips to data range.

### Pattern 4: Replay Timer

**What:** A `useEffect` in `ReplayControls` (or a custom hook `useReplayTimer`) that runs `setInterval` when `isPlaying === true`. On each tick, increments `currentLap` by 1; stops at `maxLap`.
**When to use:** Always in the component that owns play/pause; cleanup is critical.

```typescript
// useReplayTimer.ts
import { useEffect, useRef } from 'react'

export function useReplayTimer(
  isPlaying: boolean,
  replaySpeed: number,
  currentLap: number,
  maxLap: number,
  onTick: (lap: number) => void,
) {
  const lapRef = useRef(currentLap)
  lapRef.current = currentLap

  useEffect(() => {
    if (!isPlaying || lapRef.current >= maxLap) return

    const intervalMs = 1000 / replaySpeed
    const id = setInterval(() => {
      const next = lapRef.current + 1
      if (next >= maxLap) {
        clearInterval(id)
        onTick(maxLap)
      } else {
        onTick(next)
      }
    }, intervalMs)

    return () => clearInterval(id)
  }, [isPlaying, replaySpeed, maxLap, onTick])
}
```

**Key pitfall:** Use a `ref` to track `currentLap` inside the interval closure — otherwise stale closure captures the initial value and every tick goes to lap 1.

### Pattern 5: Driver List with Team Grouping

**What:** Derive the ordered driver list from `laps` in the store. Group by team (use a static team->drivers map or `TeamColor` lookup). Order by lap 1 grid position using `LapRow.Position` at `LapNumber === 1`. Never sort by final position (spoiler risk).

```typescript
// lib/driverColors.ts — static lookup for current F1 colors
// Source: config.py DRIVER_COLORS (2024 season, extend as needed)
export const DRIVER_COLORS: Record<string, string> = {
  VER: '#3671C6', PER: '#3671C6',  // Red Bull
  HAM: '#27F4D2', RUS: '#27F4D2',  // Mercedes
  LEC: '#E8002D', SAI: '#E8002D',  // Ferrari
  NOR: '#FF8000', PIA: '#FF8000',  // McLaren
  ALO: '#229971', STR: '#229971',  // Aston Martin
  OCO: '#FF87BC', GAS: '#FF87BC',  // Alpine
  ZHO: '#52E252', BOT: '#52E252',  // Alfa Romeo (Kick Sauber in 2024)
  TSU: '#6692FF', RIC: '#6692FF',  // AlphaTauri (RB in 2024)
  ALB: '#B6BABD', SAR: '#B6BABD',  // Williams
  MAG: '#B6BABD', HUL: '#B6BABD', // Haas
}

// Team grouping for Select grouped items
export const DRIVER_TEAMS: Record<string, string> = {
  VER: 'Red Bull', PER: 'Red Bull',
  HAM: 'Mercedes', RUS: 'Mercedes',
  LEC: 'Ferrari', SAI: 'Ferrari',
  NOR: 'McLaren', PIA: 'McLaren',
  ALO: 'Aston Martin', STR: 'Aston Martin',
  OCO: 'Alpine', GAS: 'Alpine',
  ZHO: 'Kick Sauber', BOT: 'Kick Sauber',
  TSU: 'RB', RIC: 'RB',
  ALB: 'Williams', SAR: 'Williams',
  MAG: 'Haas', HUL: 'Haas',
}
```

**Team color limitation:** `TeamColor` is in FastF1's `session.results` (SessionResults), NOT in laps. The current backend only serializes `session.laps`. The static lookup in `driverColors.ts` is the correct approach for Phase 2 — it avoids a backend change. For multi-year support, colors will need updating per season (low priority for a personal tool).

### Pattern 6: Dynamic Gap Line Color

**What:** The gap line changes color based on who is leading at each segment. Since Plotly scatter does not support per-segment color natively, use multiple traces — one per "who's leading" segment, each with the appropriate team color.
**When to use:** Whenever `selectedDrivers` or `laps` changes; recompute segments in `useGapData`.

```typescript
// Segment the gap series by sign change (who's leading)
function segmentByLeader(lapNumbers: number[], gaps: number[], colorA: string, colorB: string) {
  // Build an array of trace objects, each covering a contiguous run where one driver leads
  const traces = []
  let segStart = 0
  for (let i = 1; i <= gaps.length; i++) {
    const prevPositive = gaps[i - 1] >= 0
    const currPositive = i < gaps.length ? gaps[i] >= 0 : !prevPositive // force flush at end
    if (i === gaps.length || prevPositive !== currPositive) {
      traces.push({
        x: lapNumbers.slice(segStart, i),
        y: gaps.slice(segStart, i),
        type: 'scatter' as const,
        mode: 'lines' as const,
        line: { color: prevPositive ? colorA : colorB, width: 2 },
        hovertemplate: 'Lap %{x}: %{y:+.3f}s<extra></extra>',
        showlegend: false,
      })
      segStart = i - 1 // overlap by 1 point to avoid line gaps at crossings
    }
  }
  return traces
}
```

### Anti-Patterns to Avoid

- **Sorting drivers by final position:** Reveals race outcome before replay reaches the end. Use lap 1 grid position only.
- **Cumulative LapTime for gap calc:** `LapRow.LapTime` is per-lap duration. Summing it does not match `LapRow.Time` (session elapsed) because pit stops, VSC, SC, and formation laps create discrepancies. Always use `LapRow.Time`.
- **Calling `Plotly.react()` imperatively:** Use the declarative `<Plot data={...} layout={...} />` props pattern; react-plotly.js handles the diff internally.
- **Creating a new setInterval on every render:** The `useEffect` dependency array must include `isPlaying` and `replaySpeed` only; use a ref for `currentLap` inside the closure.
- **Passing `plotly.js` full bundle when using `createPlotlyComponent`:** Must pass the same Plotly object to both `createPlotlyComponent` and the rendered component.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interactive chart with hover/zoom | Custom SVG chart | react-plotly.js | Hover tooltips, zoom, pan, axis formatting are hundreds of lines of complexity |
| Vertical dashed cursor line | SVG overlay positioned over chart | `layout.shapes` in Plotly | Plotly shapes are coordinate-aware and zoom/pan correctly; CSS overlays don't |
| Accessible slider scrubber | Custom drag handler | `<input type="range">` or @base-ui/react Slider | Keyboard nav, ARIA attributes, touch support are built-in |
| Play/pause with speed control | Custom timer class | `useEffect` + `setInterval` + `useRef` | Standard React pattern; class approach fights React lifecycle |
| Team color lookup | Fetching colors from backend | Static `driverColors.ts` map | FastF1 TeamColor is in SessionResults, not Laps — no backend change needed |

**Key insight:** Plotly's `layout.shapes` is the correct primitive for the replay cursor — it participates in the chart coordinate system and requires zero positioning math.

## Common Pitfalls

### Pitfall 1: Stale Closure in setInterval
**What goes wrong:** `currentLap` inside `setInterval` callback always reads the value from when the effect ran, so the lap counter never advances past lap 1.
**Why it happens:** JavaScript closures capture by reference at creation time; the interval callback sees the stale initial value.
**How to avoid:** Store `currentLap` in a `useRef` and update the ref on every render. Read from `lapRef.current` inside the interval body, not from the state variable.
**Warning signs:** Lap counter always resets to lap 1 on each tick; `currentLap` in store doesn't change.

### Pitfall 2: Wrong Time Field for Gap Calculation
**What goes wrong:** Gap values are wildly wrong, especially after safety cars or pit stops.
**Why it happens:** `LapRow.LapTime` is the raw recorded lap duration; it doesn't account for safety car periods that inflate lap times. `LapRow.Time` is the cumulative session timestamp at lap end, which is correct for positional gap calculation.
**How to avoid:** Always use `LapRow.Time` (already documented in STATE.md critical pitfalls).
**Warning signs:** Gaps jump discontinuously at laps where a safety car period occurred.

### Pitfall 3: react-plotly.js React 19 Peer Dependency Error
**What goes wrong:** `npm install react-plotly.js` fails with peer dependency conflict — the library declares `peerDependencies: { react: ">=16.8.0 <=18" }` but the project runs React 19.
**Why it happens:** react-plotly.js hasn't updated its peer dep range to include React 19 yet.
**How to avoid:** Use `--legacy-peer-deps` flag. The library works with React 19 at runtime; only the declared version range is stale.
**Warning signs:** npm error `ERESOLVE` mentioning react-plotly.js during install.

### Pitfall 4: Plotly Vertical Line Clips to Data Range
**What goes wrong:** The replay cursor line only extends to the min/max gap values rather than spanning the full chart height.
**Why it happens:** Default `yref: 'y'` interprets `y0`/`y1` in data coordinates. If the gap is always between -2s and +2s, a shape with `y0: 0, y1: 1` only occupies that tiny slice.
**How to avoid:** Set `yref: 'paper'` on the shape. `y0: 0, y1: 1` then means 0%–100% of the plot area height.
**Warning signs:** Cursor line appears as a tiny tick mark near the zero line.

### Pitfall 5: Auto-selecting Drivers from Final Standings (Spoiler)
**What goes wrong:** Auto-selected drivers reveal who finished P1 and P2.
**Why it happens:** `laps` contains `Position` for every lap including the final lap; sorting by final position gives away the race result.
**How to avoid:** Auto-select based on `LapNumber === 1` grid positions. The `Position` field at lap 1 reflects the starting grid, not the finish.
**Warning signs:** When session loads, selected drivers are always the overall winner and runner-up.

### Pitfall 6: TypeScript Type Import for react-plotly.js
**What goes wrong:** TypeScript errors on `Plot` component props (`data`, `layout`, etc.).
**Why it happens:** react-plotly.js ships no bundled types; they're in a separate `@types/react-plotly.js` package.
**How to avoid:** Install `@types/react-plotly.js` as a dev dependency alongside `react-plotly.js`.

## Code Examples

Verified patterns from official sources:

### Plotly dark template with zero line
```typescript
// Source: https://plotly.com/javascript/layout-template/ + https://plotly.com/javascript/reference/layout/
const layout: Partial<Plotly.Layout> = {
  template: 'plotly_dark',
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  yaxis: {
    zeroline: true,
    zerolinecolor: 'rgba(255,255,255,0.3)',
    zerolinewidth: 1.5,
    gridcolor: 'rgba(255,255,255,0.08)',
  },
  xaxis: {
    gridcolor: 'rgba(255,255,255,0.08)',
    title: { text: 'Lap' },
  },
  margin: { t: 16, r: 8, b: 40, l: 56 },
}
```

### Vertical dashed replay cursor shape
```typescript
// Source: https://plotly.com/javascript/shapes/
const cursorShape: Partial<Plotly.Shape> = {
  type: 'line',
  x0: currentLap,
  x1: currentLap,
  y0: 0,
  y1: 1,
  yref: 'paper',   // CRITICAL: use paper coords to span full height
  line: {
    color: 'rgba(255,255,255,0.6)',
    width: 1.5,
    dash: 'dash',
  },
}
```

### hovertemplate with sign prefix
```typescript
// Source: https://plotly.com/javascript/hover-text-and-formatting/
// %{y:+.3f} formats with sign prefix (+ for positive, - for negative) and 3 decimal places
hovertemplate: 'Lap %{x}: %{y:+.3f}s<extra></extra>'
// <extra></extra> suppresses the trace name box in the hover
```

### @base-ui/react Select with grouped items (driver picker)
```typescript
// Source: existing ui/select.tsx pattern (from SessionSelector.tsx)
<Select value={driverA} onValueChange={(v) => v && setSelectedDrivers(v, driverB)}>
  <SelectTrigger><SelectValue placeholder="Driver A" /></SelectTrigger>
  <SelectContent>
    {Object.entries(teamDriverGroups).map(([team, drivers]) => (
      <SelectGroup key={team}>
        <SelectLabel>{team}</SelectLabel>
        {drivers.map((abbr) => (
          <SelectItem key={abbr} value={abbr}>
            {abbr} — {DRIVER_FULL_NAMES[abbr]}
          </SelectItem>
        ))}
      </SelectGroup>
    ))}
  </SelectContent>
</Select>
```

### Gap auto-select from lap 1 grid position (no spoiler)
```typescript
// Called in useEffect when stage === 'complete' and laps.length > 0
function getGridPositionDrivers(laps: LapRow[]): [string, string] {
  const lap1 = laps.filter((l) => l.LapNumber === 1 && l.Position !== null)
  const sorted = lap1.sort((a, b) => (a.Position ?? 99) - (b.Position ?? 99))
  return [sorted[0]?.Driver ?? null, sorted[1]?.Driver ?? null]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plotly Python (Streamlit) | react-plotly.js (React) | Phase 1 migration | Full interactivity, no full-page re-renders |
| No replay; static chart | useEffect/setInterval replay timer | Phase 2 | Simulates live race experience |
| `layout.template` not set | `template: 'plotly_dark'` | Phase 2 decision | Dark theme consistent with dashboard |

**Deprecated/outdated:**
- `plotly.js` `Plotly.plot()` imperative API: replaced by declarative react-plotly.js `<Plot />` component — never call `Plotly.newPlot` or `Plotly.react` directly in React components.

## Open Questions

1. **Driver full names for dropdown labels**
   - What we know: `LapRow` only has the 3-letter abbreviation (e.g. "VER"); the full name "Max Verstappen" is not in the lap data
   - What's unclear: We need a full name lookup for the "VER — Max Verstappen" dropdown label format
   - Recommendation: Add a static `DRIVER_FULL_NAMES` map in `driverColors.ts` covering recent seasons; this is sufficient for a personal tool and avoids a backend round-trip

2. **Historical driver color accuracy (pre-2024 seasons)**
   - What we know: The static color map reflects 2024 liveries; a 2021 Red Bull would render the same blue even though the livery shade differed
   - What's unclear: How noticeable this inaccuracy is in practice
   - Recommendation: Accept the approximation for Phase 2; a per-year color map can be added in a future iteration

3. **react-plotly.js React 19 runtime compatibility**
   - What we know: The declared peer dep range caps at React 18; `--legacy-peer-deps` bypasses the install error
   - What's unclear: Whether any React 19 behavioral change breaks an internal react-plotly.js assumption
   - Recommendation: Install and run a smoke test immediately; if anything is broken, fall back to the `createPlotlyComponent` factory pattern with a manually imported Plotly object

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x (backend); no frontend test runner currently configured |
| Config file | `backend/pytest.ini` |
| Quick run command | `cd backend && python -m pytest tests/ -x -q` |
| Full suite command | `cd backend && python -m pytest tests/` |

**Frontend:** No test runner (Vitest/Jest) is currently configured. The project has no `*.test.*` or `*.spec.*` files. Frontend validation for Phase 2 is manual smoke testing only, consistent with "personal local tool" scope.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GAP-01 | Driver list derived correctly from laps (no duplicates, ordered by lap 1 position) | unit (backend) | `cd backend && python -m pytest tests/test_gap.py::test_driver_list -x` | ❌ Wave 0 |
| GAP-02 | Gap series computed correctly from LapRow.Time (not LapTime) | unit (backend) | `cd backend && python -m pytest tests/test_gap.py::test_gap_calculation -x` | ❌ Wave 0 |
| GAP-03 | Tooltip format string verified | manual-only | Hover over chart data point; verify "Lap N: +X.XXXs" format | N/A |
| REPL-01 | Play/pause toggles isPlaying state | manual-only | Click play; verify lap counter advances. Click pause; verify it stops | N/A |
| REPL-02 | Speed buttons change interval correctly | manual-only | Set 4x; verify playback is 4x faster than 1x | N/A |
| REPL-03 | Scrubber drag jumps to correct lap | manual-only | Drag scrubber to lap 30; verify chart cursor at lap 30 | N/A |
| REPL-04 | Cursor renders at current lap | manual-only | Advance replay; verify dashed line tracks lap number | N/A |

**Note:** GAP-01 and GAP-02 are pure data-transformation logic that can be extracted to testable Python utility functions (gap calculation can live in `fastf1_service.py` or a new `gap_service.py`). The other requirements are UI/interaction behaviors best validated manually.

### Sampling Rate
- **Per task commit:** `cd /Users/luckleineschaars/repos/f1-dashboard/backend && python -m pytest tests/ -x -q`
- **Per wave merge:** `cd /Users/luckleineschaars/repos/f1-dashboard/backend && python -m pytest tests/`
- **Phase gate:** Full suite green + manual smoke test of chart and replay controls before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_gap.py` — covers GAP-01 (driver list from laps), GAP-02 (gap calculation uses Time not LapTime)
- [ ] No frontend test infrastructure needed for Phase 2 (manual-only per project scope)

## Sources

### Primary (HIGH confidence)
- Official Plotly JS docs — https://plotly.com/javascript/react/ — react-plotly.js integration pattern
- Official Plotly shapes docs — https://plotly.com/javascript/shapes/ — vertical line shape configuration
- Official Plotly hover formatting — https://plotly.com/javascript/hover-text-and-formatting/ — hovertemplate syntax
- FastF1 core docs — http://docs.fastf1.dev/core.html — confirmed TeamColor is in SessionResults not Laps DataFrame
- Existing codebase — `backend/services/fastf1_service.py`, `frontend/src/stores/sessionStore.ts`, `config.py` — direct inspection

### Secondary (MEDIUM confidence)
- WebSearch verified: react-plotly.js requires `--legacy-peer-deps` with React 19; runtime compatibility is expected to work
- WebSearch verified: plotly.js default bundle is ~2 MB minified; `plotly.js-basic-dist-min` reduces to ~1 MB
- WebSearch: Multiple sources confirm `yref: 'paper'` is the correct approach for full-height vertical lines in Plotly

### Tertiary (LOW confidence)
- Color hex values from `config.py` reflect 2024 F1 season; accuracy for prior years is unverified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — react-plotly.js is the official React wrapper; Zustand already in project; confirmed via official docs
- Architecture: HIGH — patterns derived from existing codebase + official Plotly docs + standard React timer patterns
- Pitfalls: HIGH — stale closure and Time vs LapTime are verified from STATE.md critical pitfalls; Plotly yref from official shapes docs; React 19 peer dep is a known ecosystem-wide pattern

**Research date:** 2026-03-13
**Valid until:** 2026-06-13 (stable APIs; react-plotly.js React 19 compatibility may improve sooner)
