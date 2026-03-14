# Phase 6: Lap Time Chart + Position Chart - Research

**Researched:** 2026-03-14
**Domain:** React / Plotly.js data visualization — scatter charts, multi-trace lines, linear regression, driver toggle UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Lap time data filtering**
- Show ALL laps in the scatter plot — do not exclude pit laps, SC laps, or lap 1
- Outlier laps (pit in/out, SC/VSC, lap 1) rendered at ~30% opacity; normal racing laps at full opacity
- Same marker shape for all laps — opacity alone distinguishes outliers from clean laps

**Trend lines**
- Linear regression per stint — straight line fit showing average degradation rate
- Trend lines computed from clean laps only (excluding pit/SC/lap 1 data points)
- Trend line overlaid on each stint in the driver's team color (or matching the scatter color)

**Driver visibility toggle**
- Checkbox panel grouped by team (similar to existing DriverSelector pattern)
- Each driver checkbox in team color, grouped under team name headers
- Default: top 2 drivers by current position visible; user checks more as needed
- Shared toggle — one panel controls visibility for both Lap Time Chart and Position Chart
- Toggle panel placed as standalone element between StintTimeline and the two charts

**Position chart style**
- Lines colored by team color (from DriverInfo.teamColor) — consistent with rest of dashboard
- Driver abbreviation labels at end of line only (rightmost data point)
- Y-axis inverted so P1 is at top
- Highlight on hover: all lines at ~0.5 opacity, hovered driver becomes fully opaque and thicker, others dim further
- Only toggled-on drivers shown (respects the shared driver toggle)

**Chart card layout**
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STRAT-02 | User can view a lap time chart plotting selected drivers' lap times as a scatter plot across laps | Plotly `scattergl` trace with per-lap `LapTime` values; opacity array distinguishes outlier vs clean laps; progressive reveal by filtering to `LapNumber <= currentLap` |
| STRAT-03 | User can see per-stint trend lines overlaid on the lap time chart to visualize degradation rate | Pure least-squares linear regression on clean laps per stint; output `scatter` mode lines overlaid on scatter; computed in memo on `[laps]` only |
| RACE-01 | User can view a position chart showing all drivers' positions over laps (P1 at top) | Plotly `scattergl` with `yaxis.autorange: 'reversed'`; one trace per toggled driver; progressive reveal; end-of-line annotations |
| ENHANCE-02 | All time-series charts show SC/VSC period shading (reusing existing pattern) | Copy `scShapes` generation logic from `useGapData`; pass to `layout.shapes` array on both new charts |
| ENHANCE-03 | Multi-driver charts have a driver visibility toggle to show/hide individual drivers | `visibleDrivers` state (Set of abbreviation strings) in a new `DriverToggle` component; shared between both charts; default = top-2 by position at currentLap; team-grouped checkboxes |
</phase_requirements>

---

## Summary

Phase 6 adds two full-width chart cards below the StintTimeline: a lap time scatter chart with per-stint trend lines, and a position spaghetti chart. Both charts share a single driver visibility toggle panel, display SC/VSC shading, and carry the replay cursor. All data already exists in the Zustand `sessionStore` (`laps`, `drivers`, `safetyCarPeriods`, `currentLap`) — no backend changes are needed.

The project already uses Plotly 3.4.0 via `react-plotly.js` with a well-established dark-theme pattern. The charts follow the same hook-plus-presentational-component architecture as `useStintData`/`StintTimeline` and `useGapData`/`GapChart`. The three-memo split (stable data on `[laps]`, dynamic data on `[currentLap+]`, cursor separately) is a proven, already-mandated performance pattern in this codebase.

The most implementation-risk area is the position chart hover behaviour (dynamically adjusting all 20 traces' opacities on hover). The proven Plotly approach is `onHover`/`onUnhover` React callbacks that call `Plotly.restyle` to update marker/line opacity without re-rendering the whole component. This is clearly lower risk than rebuilding trace arrays in React state.

**Primary recommendation:** Two data hooks (`useLapTimeData`, `usePositionData`) plus one shared `DriverToggle` component and a `useVisibleDrivers` hook. Keep linear regression as a pure exported function for testability.

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `plotly.js` | ^3.4.0 | Chart rendering engine | Already in use; `scattergl` for 20-trace position chart |
| `react-plotly.js` | ^2.6.0 | React wrapper for Plotly | Already in use; established import/CJS interop pattern in codebase |
| `zustand` | ^5.0.11 | Session state (laps, drivers, currentLap, safetyCarPeriods) | Already the project state store |
| `react` | ^19.2.4 | Component tree, hooks, useMemo | Already in use |

### No new packages required
All data, chart rendering, and state management needs are met by the existing dependency set. Linear regression is 5 lines of arithmetic — no library needed.

**Installation:** No new packages to install.

---

## Architecture Patterns

### Recommended File Structure
```
frontend/src/components/
├── DriverToggle/
│   ├── DriverToggle.tsx          # Checkbox panel UI, team-grouped
│   └── useVisibleDrivers.ts      # Hook: visibleDrivers state + default logic
├── LapTimeChart/
│   ├── LapTimeChart.tsx          # Plotly scatter presentational component
│   └── useLapTimeData.ts         # Hook: scatter traces + trend lines + shapes
├── PositionChart/
│   ├── PositionChart.tsx         # Plotly scattergl presentational component
│   └── usePositionData.ts        # Hook: per-driver position line traces + shapes
```

Dashboard.tsx gets `<DriverToggle />`, `<LapTimeChart visibleDrivers={...} />`, `<PositionChart visibleDrivers={...} />` added inside the analysis section after the StintTimeline card.

### Pattern 1: Three-Memo Split (established project pattern)

**What:** Split hook memos into three layers: stable data (on `[laps]`), dynamic data (on `[currentLap, drivers, visibleDrivers]`), cursor (on `[currentLap]`).

**When to use:** Every chart hook in this project. Prevents jank when replay advances currentLap at speed.

```typescript
// Source: useStintData.ts (established project pattern)
export function useLapTimeData(visibleDrivers: Set<string>) {
  const laps = useSessionStore((s) => s.laps)
  const drivers = useSessionStore((s) => s.drivers)
  const currentLap = useSessionStore((s) => s.currentLap)
  const safetyCarPeriods = useSessionStore((s) => s.safetyCarPeriods)

  // Memo 1: all-race derived data — only recomputes when laps changes (not on every replay tick)
  const allLapsByDriver = useMemo(() => buildLapsByDriver(laps), [laps])
  const allTrendLines = useMemo(() => computeAllTrendLines(laps, drivers), [laps, drivers])

  // Memo 2: visible traces, filtered by currentLap and visibleDrivers
  const { scatterTraces, trendTraces, scShapes } = useMemo(() => {
    return buildLapTimeTraces(allLapsByDriver, allTrendLines, drivers, visibleDrivers, currentLap, safetyCarPeriods)
  }, [allLapsByDriver, allTrendLines, drivers, visibleDrivers, currentLap, safetyCarPeriods])

  // Memo 3: cursor shape — cheapest update on every replay tick
  const cursorShapes = useMemo(() => {
    const shape = makeReplayCursorShape(currentLap)
    return shape ? [shape] : []
  }, [currentLap])

  return { scatterTraces, trendTraces, scShapes, cursorShapes }
}
```

### Pattern 2: scattergl for Position Chart

**What:** Use Plotly trace type `scattergl` (WebGL-accelerated) for the position chart, which has one trace per driver (up to 20 traces × ~70 laps).

**When to use:** Whenever the chart has more than ~5 traces or the data points per trace is large. Already mandated in project STATE.md: "Use `scattergl` (not `scatter`) for position chart from the start".

```typescript
// Source: Project STATE.md decision + Plotly docs
const trace: Partial<Plotly.PlotData> = {
  type: 'scattergl',
  mode: 'lines',
  x: lapNumbers,
  y: positions,
  line: { color: teamColor, width: 2 },
  name: abbreviation,
  hovertemplate: `${abbreviation}<br>Lap %{x}<br>P%{y}<extra></extra>`,
}
```

### Pattern 3: Opacity Array for Outlier Laps

**What:** Pass a per-point opacity array via `marker.opacity` to the scatter trace. Values are `0.3` for outlier laps (pit, SC, lap 1) and `1.0` for clean laps.

**When to use:** STRAT-02 requirement — show all laps but visually distinguish outliers without separate traces.

```typescript
// Outlier classification
function isOutlierLap(lap: LapRow, safetyCarPeriods: SafetyCarPeriod[]): boolean {
  if (lap.LapNumber === 1) return true
  if (lap.PitInTime !== null || lap.PitOutTime !== null) return true
  if (safetyCarPeriods.some(p => lap.LapNumber !== null && lap.LapNumber >= p.start_lap && lap.LapNumber <= p.end_lap)) return true
  return false
}

// Build opacity array
const opacities = laps.map(lap => isOutlierLap(lap, safetyCarPeriods) ? 0.3 : 1.0)

const trace = {
  type: 'scattergl',
  mode: 'markers',
  x: laps.map(l => l.LapNumber),
  y: laps.map(l => l.LapTime),
  marker: { opacity: opacities, size: 6, color: teamColor },
}
```

### Pattern 4: Linear Regression (Pure Function, No Library)

**What:** Least-squares linear regression fit: `y = slope * x + intercept`. Computed on clean laps within each stint.

**When to use:** STRAT-03 — one trend line per stint per driver. The trend line x-range is `[stintStartLap, stintEndLap]`, producing two points which Plotly draws as a line.

```typescript
// Source: Standard least-squares formula — no library required
export function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number } | null {
  const n = xs.length
  if (n < 2) return null
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0)
  const sumX2 = xs.reduce((acc, x) => acc + x * x, 0)
  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return null
  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

// Build trend line trace for one driver+stint
export function buildTrendLineTrace(
  cleanLaps: LapRow[], stintStartLap: number, stintEndLap: number, color: string
): Partial<Plotly.PlotData> | null {
  const xs = cleanLaps.map(l => l.LapNumber as number)
  const ys = cleanLaps.map(l => l.LapTime as number)
  const reg = linearRegression(xs, ys)
  if (!reg) return null
  return {
    type: 'scatter',
    mode: 'lines',
    x: [stintStartLap, stintEndLap],
    y: [reg.slope * stintStartLap + reg.intercept, reg.slope * stintEndLap + reg.intercept],
    line: { color, width: 2, dash: 'solid' },
    hoverinfo: 'skip',
    showlegend: false,
  }
}
```

### Pattern 5: SC/VSC Shapes (Direct Copy from useGapData)

**What:** The exact same `scShapes` generation logic from `useGapData.ts` (lines 261–306) applies unchanged to both new charts. It takes `safetyCarPeriods` and `currentLap`, returns `Partial<Plotly.Shape>[]` with progressive reveal baked in.

**When to use:** ENHANCE-02 — both new charts need SC/VSC shading. Copy the logic into each chart hook rather than sharing state (keeps hooks independent, consistent with project pattern).

### Pattern 6: useVisibleDrivers Hook

**What:** Lightweight Zustand-free hook that manages a `Set<string>` of currently visible driver abbreviations in `useState`. Default value is the top-2 drivers by `Position` on lap 1.

**When to use:** ENHANCE-03 — one shared toggle panel controls both charts. Pass `visibleDrivers` as a prop to each chart component.

```typescript
export function useVisibleDrivers(drivers: DriverInfo[], laps: LapRow[]): {
  visibleDrivers: Set<string>
  toggleDriver: (abbreviation: string) => void
} {
  const defaultVisible = useMemo(() => {
    const lap1 = laps.filter(l => l.LapNumber === 1 && l.Position !== null)
    const sorted = [...lap1].sort((a, b) => (a.Position ?? 99) - (b.Position ?? 99))
    return new Set(sorted.slice(0, 2).map(l => l.Driver))
  }, [laps])

  const [visibleDrivers, setVisibleDrivers] = useState<Set<string>>(defaultVisible)

  // Re-sync default when session data loads
  useEffect(() => {
    setVisibleDrivers(defaultVisible)
  }, [defaultVisible])

  function toggleDriver(abbreviation: string) {
    setVisibleDrivers(prev => {
      const next = new Set(prev)
      if (next.has(abbreviation)) next.delete(abbreviation)
      else next.add(abbreviation)
      return next
    })
  }

  return { visibleDrivers, toggleDriver }
}
```

### Pattern 7: Position Chart Hover Highlighting

**What:** On hover, dim all non-hovered driver traces to 0.3 opacity; on unhover, restore all to 1.0. Use `Plotly.restyle` in `onHover`/`onUnhover` callbacks rather than rebuilding React state (avoids full re-render).

**When to use:** RACE-01 position chart — 20 traces need coordinated opacity change on hover.

```typescript
// In PositionChart.tsx
import Plotly from 'plotly.js'

function handleHover(event: Plotly.PlotHoverEvent) {
  const hoveredTrace = event.points[0].curveNumber
  const total = traces.length
  const opacities = Array.from({ length: total }, (_, i) => i === hoveredTrace ? 1 : 0.3)
  // Plotly.restyle target is the chart div node, not the React component
  Plotly.restyle(chartRef.current!, { 'line.opacity': opacities })
}

function handleUnhover() {
  const total = traces.length
  Plotly.restyle(chartRef.current!, { 'line.opacity': Array(total).fill(1) })
}
```

Note: `react-plotly.js` exposes `onHover` and `onUnhover` as props on `<Plot>`. The `ref` must be obtained via `divId` + `document.getElementById` or by passing `ref` to the wrapper div around `<Plot>`.

### Pattern 8: End-of-Line Labels for Position Chart

**What:** Driver abbreviation labels at the rightmost data point of each trace. Implemented as Plotly `annotations` in the layout, not as trace text, to avoid label collisions obscuring the line.

**When to use:** RACE-01 — labels at end of each driver's line.

```typescript
const annotations: Partial<Plotly.Annotations>[] = visibleTraces.map(({ abbreviation, lastLap, lastPosition }) => ({
  x: lastLap,
  y: lastPosition,
  text: abbreviation,
  showarrow: false,
  xanchor: 'left',
  font: { color: '#e0e0f0', size: 10 },
  xshift: 4,
}))
```

### Pattern 9: Existing CJS Interop for react-plotly.js

**What:** The project uses this boilerplate at the top of every Plotly component file to handle Vite CJS interop:

```typescript
// Source: StintTimeline.tsx, GapChart.tsx — established project pattern
import _Plot from 'react-plotly.js'
const Plot = (typeof (_Plot as any).default === 'function' ? (_Plot as any).default : _Plot) as typeof _Plot
```

**When to use:** Every new chart component that imports `react-plotly.js`. Copy verbatim.

### Anti-Patterns to Avoid

- **Separate data hook per requirement:** Don't create `useSCShapes` as a separate hook — inline SC shape logic in each chart hook just like `useGapData` does.
- **Storing visibleDrivers in Zustand:** It's purely UI state, not session state. Local `useState` in a hook is correct.
- **Scatter mode for position chart:** Use `scattergl` — 20 traces × ~70 laps in WebGL is faster than SVG scatter.
- **Rebuilding all 20 traces in React state on hover:** Use `Plotly.restyle` for opacity changes; React state re-render for 20 traces on every mouse-move will jank.
- **Including outlier laps in regression:** Trend lines must be computed from clean laps only (non-pit, non-SC, non-lap-1), even though the scatter plot shows all laps.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Safety car period detection | Custom lap-range comparison | Copy `scShapes` block from `useGapData.ts` | Progressive reveal + clamping already solved |
| Pit lap detection | Custom logic | `lap.PitInTime !== null` (already used in `useGapData`) | Field already serialized by backend |
| Replay cursor shape | Custom shape dict | `makeReplayCursorShape(currentLap)` from `lib/plotlyShapes.ts` | Pure function already tested |
| Driver ordering by position | Custom sort | `computeDriverOrder` from `useStintData.ts` | Already exported pure function |
| Team-grouped driver list | Custom grouping | `useDriverList()` from `useGapData.ts` | Already handles lap1 ordering + team grouping |
| Plotly dark theme | Manual bgcolor/font settings | `template: 'plotly_dark'` + `paper_bgcolor: 'transparent'` | Established in every chart in the project |

**Key insight:** The project has accumulated reusable pure functions and hooks specifically to avoid re-solving these problems. Reuse aggressively.

---

## Common Pitfalls

### Pitfall 1: Memo Dependency on currentLap in the "Heavy" Memo

**What goes wrong:** Including `currentLap` in the memo that builds scatter traces and trend lines (the expensive computation) causes the entire trace array to recompute on every replay tick. With 20 drivers × 70 laps of points, this causes visible jank.

**Why it happens:** The natural instinct is to filter `LapNumber <= currentLap` inside a single memo.

**How to avoid:** Two-stage memo. First memo: build stable lookup structures on `[laps]` only. Second memo: apply `currentLap` filtering on the already-prepared lookup. Trend lines are computed once in the first stage (they don't change mid-replay). Only visibility filtering and shape clamping need `currentLap`.

**Warning signs:** Replay plays smoothly at lap 1 but becomes sluggish by lap 50.

### Pitfall 2: Trend Lines on All Laps Instead of Clean Laps

**What goes wrong:** Pit-out and SC restart laps have anomalously slow lap times. Including them in regression produces a significantly flatter (or even negative slope) trend line that misrepresents tyre degradation.

**Why it happens:** Easiest implementation just takes all laps in the stint range.

**How to avoid:** Filter to clean laps before regression: exclude `LapNumber === 1`, any lap where `PitInTime !== null || PitOutTime !== null`, and any lap that falls within a `SafetyCarPeriod` range.

**Warning signs:** Trend line shows degradation of +0.01s/lap on a 2-stop race where tyre wear is clearly visible in scatter points.

### Pitfall 3: LapTime Null Handling

**What goes wrong:** Some laps have `LapTime: null` (DNF laps, laps after car retirement, occasionally the very first lap). Passing `null` values into scatter chart arrays silently creates gaps in traces, or causes `NaN` y-values visible as missing points.

**Why it happens:** FastF1 legitimately returns null for these laps; `serialize_laps` in the backend preserves nulls.

**How to avoid:** Filter out laps where `LapTime === null` before building scatter arrays. For position chart, filter `Position === null` rows similarly.

**Warning signs:** Visible "holes" in traces, or console errors about NaN from Plotly.

### Pitfall 4: Position Chart Y-Axis Direction

**What goes wrong:** Plotly defaults to lowest value at bottom (P20 at top), which is visually backwards for a racing position chart.

**Why it happens:** Standard Plotly behavior.

**How to avoid:** Set `yaxis.autorange: 'reversed'` in the layout. Do not set a manual `range` — that breaks when different sessions have different car counts.

```typescript
yaxis: {
  autorange: 'reversed',  // P1 at top
  dtick: 1,
  range: undefined,  // let Plotly calculate from data
}
```

**Warning signs:** P1 appears at the bottom of the chart.

### Pitfall 5: Plotly.restyle Targeting the Wrong DOM Node

**What goes wrong:** `Plotly.restyle(element, ...)` silently does nothing or throws if `element` is not the Plotly chart div (e.g., if it's the React wrapper div instead of the inner Plotly-managed div).

**Why it happens:** `react-plotly.js` renders a wrapper div, and the actual Plotly chart div is inside it.

**How to avoid:** Use `divId` prop on `<Plot>` and then `document.getElementById(divId)` in the hover handler. Alternatively, let Plotly's built-in `onHover` event provide the div reference via `event.event.target.closest('.js-plotly-plot')`.

### Pitfall 6: visibleDrivers Default Before Data Loads

**What goes wrong:** If `useVisibleDrivers` initialises the default set during component mount before `laps` is populated (e.g., while SSE is loading), the default will be an empty set. When laps arrive, the `useEffect` re-sync fires, but if the user has already clicked a checkbox, their selection gets overwritten.

**Why it happens:** `useEffect` + `useState` default logic with async data arrival.

**How to avoid:** Guard the `useEffect` reset: only reset when transitioning from empty-to-populated laps, not on every `defaultVisible` change. Alternatively, compute initial state lazily inside `useState(() => computeDefault(laps))` and only call `setVisibleDrivers` when the session *key* changes (year/event/sessionType change), not on every lap update.

---

## Code Examples

Verified patterns from existing codebase sources:

### SC/VSC Shading Pattern (copy from useGapData.ts lines 261-306)
```typescript
// Source: frontend/src/components/GapChart/useGapData.ts
for (const period of safetyCarPeriods) {
  if (period.start_lap > currentLap) continue
  const x1 = Math.min(period.end_lap, currentLap)
  // ... fillcolor based on period.type ...
  scShapes.push({
    type: 'rect',
    x0: period.start_lap,
    x1,
    y0: 0,
    y1: 1,
    xref: 'x',
    yref: 'paper' as const,
    layer: 'below' as any,
    fillcolor,
    line: lineStyle,
  })
}
```

### Dark Theme Layout Config (established project pattern)
```typescript
// Source: StintTimeline.tsx, GapChart.tsx
const layout: Partial<Plotly.Layout> = {
  template: 'plotly_dark' as unknown as Plotly.Template,
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  xaxis: { gridcolor: '#2d2d3d', color: '#e0e0f0', title: { text: 'Lap' } },
  yaxis: { gridcolor: '#2d2d3d', color: '#e0e0f0' },
  margin: { t: 16, r: 8, b: 40, l: 56 },
  height: 400,
  showlegend: false,
  hovermode: 'closest',
  shapes: [...scShapes, ...cursorShapes],
}
```

### Pit Lap Detection (from useGapData.ts)
```typescript
// Source: frontend/src/components/GapChart/useGapData.ts
const isPitLap = (lap: LapRow) => lap.PitInTime !== null
```

### react-plotly.js CJS Interop (from StintTimeline.tsx)
```typescript
// Source: frontend/src/components/StintTimeline/StintTimeline.tsx
import _Plot from 'react-plotly.js'
const Plot = (typeof (_Plot as any).default === 'function' ? (_Plot as any).default : _Plot) as typeof _Plot
```

### DriverToggle Checkbox Structure (analogous to DriverSelector in GapChart/DriverSelector.tsx)
```typescript
// Reuses useDriverList() hook from useGapData.ts for team-grouped driver list
const { teams } = useDriverList()
// teams: Array<{ team: string; drivers: string[] }>
// Render as: <section per team> <label team name> <checkbox per driver colored with teamColor>
```

---

## State of the Art

| Old Approach | Current Approach | Context | Impact |
|--------------|------------------|---------|--------|
| `scatter` type for many traces | `scattergl` (WebGL) | 20 drivers × 70 laps = 1400 points | No visible perf difference at this scale, but mandatory per STATE.md |
| Separate memo for every concern | Three-memo split | Established in Phase 5 | Prevents per-tick jank during replay |
| DriverSelector dropdown | Checkbox toggle panel | Phase 6 design decision | Allows multi-driver visibility without select UI |

**Not deprecated / still valid:**
- `react-plotly.js` 2.6.0 is the current version; no migration needed
- The CJS interop boilerplate is still required with Vite 8
- `plotly_dark` template is still the correct dark theme approach

---

## Open Questions

1. **Hover opacity for position chart — `Plotly.restyle` vs trace rebuild**
   - What we know: `Plotly.restyle` avoids React re-render; the project has no existing example of `Plotly.restyle` usage
   - What's unclear: Whether `react-plotly.js` 2.6.0 interferes with direct `Plotly.restyle` calls (React Plotly wrapper may overwrite styles on next render)
   - Recommendation: Use `Plotly.restyle` for hover; if it conflicts with `react-plotly.js` reconciliation, fall back to trace rebuild with `opacity` array stored in component state (acceptable given position chart updates are user-triggered, not replay-tick-triggered)

2. **visibleDrivers re-sync on session change**
   - What we know: `sessionStore.setLaps` is called when a new session loads, resetting all store state; `useVisibleDrivers` lives in local component state
   - What's unclear: Whether the `useEffect` dependency on `defaultVisible` (derived from `laps`) correctly detects session change and resets selection
   - Recommendation: Include a stable `sessionKey` (derived from `year + event + sessionType` from the store) as a `useEffect` dependency to force reset when session changes, not just when `laps` content changes

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `cd frontend && npm test -- --reporter=verbose` |
| Full suite command | `cd frontend && npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STRAT-02 | `buildLapTimeTraces` returns correct scatter arrays with opacity | unit | `npm test -- src/components/LapTimeChart/useLapTimeData.test.ts` | Wave 0 |
| STRAT-02 | Outlier lap classification: pit/SC/lap-1 at 0.3, clean at 1.0 | unit | `npm test -- src/components/LapTimeChart/useLapTimeData.test.ts` | Wave 0 |
| STRAT-03 | `linearRegression` returns correct slope/intercept | unit | `npm test -- src/components/LapTimeChart/useLapTimeData.test.ts` | Wave 0 |
| STRAT-03 | Trend line excludes outlier laps; uses clean laps only | unit | `npm test -- src/components/LapTimeChart/useLapTimeData.test.ts` | Wave 0 |
| RACE-01 | `buildPositionTraces` produces one trace per visible driver | unit | `npm test -- src/components/PositionChart/usePositionData.test.ts` | Wave 0 |
| RACE-01 | Progressive reveal: laps beyond currentLap are excluded | unit | `npm test -- src/components/PositionChart/usePositionData.test.ts` | Wave 0 |
| ENHANCE-02 | SC shapes generated with correct start/end lap range | unit | `npm test -- src/components/LapTimeChart/useLapTimeData.test.ts` | Wave 0 |
| ENHANCE-03 | Default visible: top-2 drivers by lap-1 position | unit | `npm test -- src/components/DriverToggle/useVisibleDrivers.test.ts` | Wave 0 |
| ENHANCE-03 | Toggle adds/removes driver from visible set | unit | `npm test -- src/components/DriverToggle/useVisibleDrivers.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd /Users/luckleineschaars/repos/f1-dashboard/frontend && npm test`
- **Per wave merge:** `cd /Users/luckleineschaars/repos/f1-dashboard/frontend && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/src/components/LapTimeChart/useLapTimeData.test.ts` — covers STRAT-02, STRAT-03, ENHANCE-02
- [ ] `frontend/src/components/PositionChart/usePositionData.test.ts` — covers RACE-01
- [ ] `frontend/src/components/DriverToggle/useVisibleDrivers.test.ts` — covers ENHANCE-03

---

## Sources

### Primary (HIGH confidence)
- `frontend/src/components/GapChart/useGapData.ts` — SC shape pattern, pit detection, driver list hook
- `frontend/src/components/StintTimeline/useStintData.ts` — three-memo split, pure exported functions, driver order
- `frontend/src/components/StintTimeline/StintTimeline.tsx` — dark theme config, CJS interop boilerplate
- `frontend/src/components/GapChart/GapChart.tsx` — shape ordering in layout.shapes
- `frontend/src/stores/sessionStore.ts` — full state shape, all available fields
- `frontend/src/types/session.ts` — LapRow and DriverInfo field definitions
- `frontend/src/lib/plotlyShapes.ts` — makeReplayCursorShape API
- `frontend/vitest.config.ts` — test framework, include/exclude patterns
- `.planning/STATE.md` — scattergl mandate, three-memo performance decision, analysis section layout

### Secondary (MEDIUM confidence)
- Plotly.js documentation on `yaxis.autorange: 'reversed'` — verified via known Plotly API; consistent with observed behavior in codebase
- `Plotly.restyle` hover pattern — standard Plotly.js pattern; no existing usage in this codebase to verify against, but well-documented in Plotly docs

### Tertiary (LOW confidence)
- `react-plotly.js` + `Plotly.restyle` interaction — whether React Plotly wrapper reconciliation interferes with direct `restyle` calls; no verification found; flagged as Open Question

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use; no new packages
- Architecture: HIGH — directly mirrors patterns in useStintData/useGapData/StintTimeline
- Pitfalls: HIGH for memo split and null handling (from existing code); MEDIUM for restyle interaction (no existing codebase example)
- Regression math: HIGH — standard least-squares formula

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable library set; no fast-moving dependencies)
