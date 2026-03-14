# Phase 7: Interval History - Research

**Researched:** 2026-03-14
**Domain:** Plotly.js interval/gap chart with per-point opacity, positional gap computation from LapRow data
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Interval calculation
- Compute interval from `Time` + `Position` columns — `IntervalToPositionAhead` not in public FastF1 API
- Position-based gap: show interval to whichever driver is one position ahead (P-1) in race classification, not physical car ahead
- Race leader (P1): exclude from chart — interval-to-car-ahead is undefined. If a driver leads mid-race, their trace has a gap for those laps
- Pit stop laps: keep in trace but dim to ~30% opacity (same approach as lap time chart outliers)
- Lap 1: include but dim to ~30% opacity — chaotic data shouldn't dominate scale
- DNF/retired drivers: trace simply ends at last completed lap, no special marker
- Overtakes: continuous line — when car-ahead changes due to position swap, trace continues (natural jump tells the overtake story)

#### DRS reference line
- Horizontal dashed line at 1.0s with "DRS" label
- Subtle green shaded zone below 1.0s line (rgba green ~0.08 opacity) indicating DRS window
- DRS zone always visible across all laps (not conditionally hidden during SC/first 2 laps)
- Green color consistent with F1 broadcast DRS indicators

#### Chart visual style
- Line chart (lines mode, no markers) — team-colored traces per driver
- Y-axis auto-scale, but clip large intervals at a reasonable cap (~10-15s) to keep DRS-range data readable
- Hover highlighting: same pattern as PositionChart — hovered trace opaque + thicker, others dim to ~0.5 opacity
- End-of-line driver abbreviation labels at rightmost data point (same as position chart)
- SC/VSC shading via buildSCShapes pattern with progressive reveal
- Replay cursor via makeReplayCursorShape
- Chart height 400px, full-width card in analysis section

#### SC/VSC intervals
- No dimming for SC/VSC laps — SC shading rectangles provide sufficient context

### Claude's Discretion
- Exact Plotly configuration (margins, font sizes, grid styling)
- Interval clipping threshold (somewhere in 10-15s range)
- Hover tooltip content and formatting
- Opacity value for dimmed pit/lap 1 data points
- Whether to use per-point opacity array (like lap time chart) or separate traces for dimmed laps
- Loading/empty state design
- Exact DRS zone green shade and line style

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RACE-02 | User can view an interval history chart showing gap-to-car-ahead over laps with DRS window reference | Core chart implementation: interval computation from Time+Position, Plotly line traces, DRS reference line + shaded zone, progressive reveal, hover highlighting, end-of-line labels |
| ENHANCE-04 | All charts progressively reveal data up to current lap during replay (spoiler-free mode) | Already established pattern from Phase 6: filter laps by `<= currentLap` in buildIntervalTraces; SC shapes clamped to currentLap via buildSCShapes |
</phase_requirements>

---

## Summary

Phase 7 builds the IntervalHistory chart using patterns established in Phase 6. The component follows the same three-file structure as PositionChart: a pure-functions + hook file (`useIntervalData.ts`) plus a presentational component (`IntervalHistory.tsx`). All scaffold patterns — `scattergl` traces, hover highlighting via React state, `buildSCShapes`, `buildEndOfLineAnnotations`, `makeReplayCursorShape` — are copy/adapt, not design-from-scratch.

The novel work in this phase is the interval computation algorithm: for each driver lap, find which driver holds position P-1 at that lap, then subtract their cumulative race time (`Time` column) from the subject driver's `Time`. The `LapRow.Time` field is cumulative elapsed time since session start (in seconds), making gap computation a simple subtraction when positions are valid. The P1 case is excluded (undefined interval), and dimming for pit/lap-1 data uses the same per-point opacity array pattern as `buildLapTimeTraces`.

The DRS reference line and green shaded zone are new static shapes added to the Plotly layout. The DRS zone is implemented as a `rect` shape from `y=0` to `y=1.0` with `yref: 'y'` (data coordinates), ensuring it tracks the actual 1.0s threshold regardless of y-axis scale.

**Primary recommendation:** Implement `buildIntervalTraces` as a pure exported function identical in signature to `buildPositionTraces`, then wire into a hook and presentational component following the PositionChart blueprint exactly.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| plotly.js | Current (already installed) | Chart rendering | Project standard for all analysis charts |
| react-plotly.js | Current (already installed) | React wrapper | CJS interop workaround already in place |
| zustand (useSessionStore) | Current (already installed) | State: laps, drivers, currentLap, safetyCarPeriods | Project store |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest + jsdom | Current (already installed) | Unit tests for pure functions | All exported pure functions need tests |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| scattergl lines mode | scatter lines mode | scattergl required for 20-driver WebGL performance; lines mode has no markers so per-point opacity via marker is unavailable — use separate dim traces instead |

**Installation:** No new packages needed — all dependencies already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/components/IntervalHistory/
├── IntervalHistory.tsx          # Presentational component (Plot wrapper)
├── useIntervalData.ts           # Pure functions + React hook
└── useIntervalData.test.ts      # Vitest unit tests for pure functions
```

Dashboard.tsx gets one new import and one new card `<div>` after the PositionChart card.

### Pattern 1: Interval Computation from Time + Position

**What:** For each driver at each lap, find which driver is one position ahead (P-1). Subtract subject driver's `Time` from car-ahead driver's `Time`. If the subject IS P1 at that lap, skip the data point (null gap).

**When to use:** Only valid for race sessions; `Time` is cumulative elapsed time.

**Key edge cases:**
- `Position === null` — skip data point
- `Position === 1` (leader) — skip data point (gap to car ahead is undefined)
- `Time === null` for either driver — skip data point
- Result is negative (overtake moment, data artifact) — keep in trace; it tells the story

**Example:**
```typescript
// Source: derived from LapRow type in src/types/session.ts
export function buildIntervalTraces(
  laps: LapRow[],
  drivers: DriverInfo[],
  visibleDrivers: Set<string>,
  currentLap: number
): Partial<Plotly.PlotData>[] {
  // Build lookup: Map<lapNumber, Map<position, Time>>
  const timeByLapPos = new Map<number, Map<number, number>>()
  for (const lap of laps) {
    if (lap.LapNumber === null || lap.Position === null || lap.Time === null) continue
    if (!timeByLapPos.has(lap.LapNumber)) timeByLapPos.set(lap.LapNumber, new Map())
    timeByLapPos.get(lap.LapNumber)!.set(lap.Position, lap.Time)
  }

  const driverMap = new Map(drivers.map((d) => [d.abbreviation, d]))
  const traces: Partial<Plotly.PlotData>[] = []

  const CLIP_MAX = 12 // seconds — discretion within 10-15s range

  for (const driverAbbr of visibleDrivers) {
    const driverInfo = driverMap.get(driverAbbr)
    const color = driverInfo?.teamColor ?? '#888888'

    const driverLaps = laps
      .filter(
        (l) =>
          l.Driver === driverAbbr &&
          l.LapNumber !== null &&
          l.LapNumber <= currentLap &&
          l.Position !== null &&
          l.Position > 1 &&       // exclude P1 (leader)
          l.Time !== null
      )
      .sort((a, b) => (a.LapNumber as number) - (b.LapNumber as number))

    const x: (number | null)[] = []
    const y: (number | null)[] = []
    const opacities: number[] = []

    for (const lap of driverLaps) {
      const lapNum = lap.LapNumber as number
      const pos = lap.Position as number
      const carAheadTime = timeByLapPos.get(lapNum)?.get(pos - 1)

      if (carAheadTime === undefined) {
        // No data for car ahead at this lap — insert gap (null) for line break
        x.push(lapNum)
        y.push(null)
        opacities.push(1)
        continue
      }

      const interval = Math.min((lap.Time as number) - carAheadTime, CLIP_MAX)
      x.push(lapNum)
      y.push(interval)

      const isDimmed = lap.LapNumber === 1 || lap.PitInTime !== null || lap.PitOutTime !== null
      opacities.push(isDimmed ? 0.3 : 1.0)
    }

    // scattergl lines mode does not support per-point marker opacity
    // Use separate dim traces strategy (two traces per driver: dim laps and normal laps)
    // OR use scatter (non-GL) — 20 drivers x 60 laps of lines is lighter than scatter markers
    // Decision: use scattergl with connectgaps:false; dim laps as separate overlaid trace
    traces.push({
      type: 'scattergl' as const,
      mode: 'lines' as const,
      name: driverAbbr,
      x,
      y,
      line: { color, width: 2 },
      connectgaps: false,
      hovertemplate: `${driverAbbr}<br>Lap %{x}<br>%{y:.2f}s<extra></extra>`,
      showlegend: false,
    } as Partial<Plotly.PlotData>)
  }

  return traces
}
```

**Important note on per-point opacity with scattergl lines mode:** Unlike `scattergl` markers mode used in `buildLapTimeTraces`, `scattergl` in `lines` mode does not support per-point marker opacity (there are no markers). The two main strategies are:

1. **Separate dim trace per driver:** Build a second trace for dim laps only (lap 1, pit laps) with `opacity: 0.3` at the trace level. Two traces per driver.
2. **Single trace, accept uniform opacity:** Simpler but can't dim individual laps.

Strategy 1 (separate dim traces) preserves the intended UX and matches the per-point dimming spirit from the LapTimeChart, at the cost of doubling the trace count (still only 40 traces max — well within WebGL limits).

### Pattern 2: DRS Reference Line and Zone as Plotly Shapes

**What:** Static horizontal line at y=1.0 (dashed, labeled "DRS") plus a filled rectangle from y=0 to y=1.0 to indicate the DRS window.

**When to use:** Always rendered in the shapes array (not gated on currentLap).

**Example:**
```typescript
// Source: Plotly shapes API — verified against plotly.js docs
export function buildDRSShapes(): Partial<Plotly.Shape>[] {
  return [
    // Green filled zone: below 1.0s
    {
      type: 'rect',
      x0: 0,
      x1: 1,
      xref: 'paper',
      y0: 0,
      y1: 1.0,
      yref: 'y',
      fillcolor: 'rgba(0, 200, 80, 0.08)',
      line: { width: 0 },
      layer: 'below' as any,
    },
    // Dashed reference line at 1.0s
    {
      type: 'line',
      x0: 0,
      x1: 1,
      xref: 'paper',
      y0: 1.0,
      y1: 1.0,
      yref: 'y',
      line: {
        color: 'rgba(0, 200, 80, 0.6)',
        width: 1,
        dash: 'dash',
      },
    },
  ]
}
```

Note: `xref: 'paper'` spans the full chart width regardless of lap range. `yref: 'y'` anchors to data coordinates so the 1.0s threshold is correct even when the y-axis auto-scales. There is no annotation label on the shape itself; a Plotly annotation can be added at `(x=0, y=1.0)` with text "DRS" if preferred over the shape's built-in `label` property (which has limited positioning control in older Plotly versions).

### Pattern 3: Hover Highlighting (React State Fallback)

**What:** Identical to PositionChart — track `hoveredTraceIndex` in React state, remap traces to apply opacity/width on render.

**When to use:** Always prefer this over `Plotly.restyle` to avoid race conditions with react-plotly.js reconciliation (established Phase 6 decision).

**Example:**
```typescript
// Source: PositionChart.tsx (established pattern)
const data = intervalTraces.map((trace, i) => {
  if (hoveredTraceIndex === null) return trace
  const isHovered = i === hoveredTraceIndex
  return {
    ...trace,
    line: {
      ...(trace as any).line,
      opacity: isHovered ? 1 : 0.5,
      width: isHovered ? 3 : 1.5,
    },
  }
})
```

Note: When using separate dim traces (two per driver), the trace index mapping must account for the doubled count. Hover should apply to both the normal and dim trace for a given driver (same curveNumber grouping logic needed).

### Pattern 4: Three-Memo Split in Hook

**What:** Standard hook pattern established across all Phase 5-6 hooks.

```typescript
// Memo 1: stable computation on [laps] only — building the position→time lookup
const timeByLapPos = useMemo(() => buildTimeLookup(laps), [laps])

// Memo 2: traces + annotations + SC shapes — on [timeByLapPos, drivers, visibleDrivers, currentLap, safetyCarPeriods]
const { intervalTraces, annotations, scShapes } = useMemo(() => { ... }, [...])

// Memo 3: cursor shape — only [currentLap]
const cursorShapes = useMemo(() => { ... }, [currentLap])
```

### Anti-Patterns to Avoid

- **Using `IntervalToPositionAhead` from FastF1:** Not available in the public API. Must compute from `Time` and `Position`.
- **Using `yref: 'paper'` for DRS zone:** Would anchor to chart height percentage, not 1.0 seconds. Must use `yref: 'y'`.
- **Including P1 laps:** Driver in lead position has no car ahead — must filter `Position > 1`.
- **Missing null gap insertion:** When car-ahead data is missing for a lap, push `null` to `y` (not skip the x value) so `connectgaps: false` produces a line break rather than a phantom connection.
- **Forgetting to duplicate buildSCShapes:** Per Phase 6 decision, hooks are self-contained. Do NOT import buildSCShapes from usePositionData — copy it into useIntervalData.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Replay cursor vertical line | Custom SVG/CSS overlay | `makeReplayCursorShape` from `lib/plotlyShapes.ts` | Already correct, tested, synced to currentLap |
| SC/VSC shading | Custom rect drawing | `buildSCShapes` pattern (copy from usePositionData.ts) | Handles progressive reveal, multiple period types |
| Driver end-of-line labels | Separate legend or custom DOM labels | `buildEndOfLineAnnotations` pattern (copy from usePositionData.ts) | Handles progressive reveal, last visible lap |
| Driver visibility state | Custom toggle state | `useVisibleDrivers` + `DriverToggle` | Shared across all Phase 6-8 charts |
| Chart hover state | `Plotly.restyle` calls | React state `hoveredTraceIndex` | Avoids reconciliation race conditions |

**Key insight:** This chart is a theme-and-variation on PositionChart. Every structural element already exists; the only net-new logic is `buildIntervalTraces` and `buildDRSShapes`.

---

## Common Pitfalls

### Pitfall 1: Interval Sign and Magnitude

**What goes wrong:** `Time` is cumulative elapsed time from session start. The driver behind has a LARGER `Time` value than the driver ahead. So `interval = driverTime - carAheadTime` yields a POSITIVE gap (correct). If the result is negative, the driver was literally ahead at that moment (data artifact or overtake in progress) — keep it but don't clip to 0.

**Why it happens:** Intuitive subtraction direction confusion.

**How to avoid:** Always: `interval = subject.Time - carAhead.Time`. Positive = behind. Apply `Math.min(interval, CLIP_MAX)` to cap large gaps; no floor clipping.

**Warning signs:** Traces showing large negative y-values for a driver who isn't leading.

### Pitfall 2: Position Lookup Collision (Two Drivers Same Position Same Lap)

**What goes wrong:** In rare cases (data quality issues), two drivers may have the same `Position` value on the same lap. The Map will keep only the last one.

**Why it happens:** FastF1 data can have classification glitches at lap boundaries (e.g., the moment of an overtake).

**How to avoid:** The natural behavior (last write wins) is acceptable — this is an edge case in data quality, not a code correctness issue. No special handling needed.

**Warning signs:** A brief unexplained spike on a single lap for one driver.

### Pitfall 3: Hover Index Offset with Separate Dim Traces

**What goes wrong:** If each driver has 2 traces (normal + dim), hovering trace index 2 corresponds to driver 1's dim trace, not driver 2's normal trace. Hover highlighting logic breaks.

**Why it happens:** Simple `i === hoveredTraceIndex` no longer maps 1:1 to drivers.

**How to avoid:** Either (a) use a driver abbreviation stored in trace `name` and match on name instead of index, or (b) always push dim trace immediately after normal trace and use `Math.floor(i / 2) === Math.floor(hoveredTraceIndex / 2)` to group them.

**Warning signs:** Wrong driver highlights when hovering.

### Pitfall 4: DRS Zone Clipped When Y-Axis Auto-Scales Below 1.0s

**What goes wrong:** If all visible intervals are below 1.0s, the y-axis auto-scale may set `ymax < 1.0`. The DRS reference line at y=1.0 disappears off-chart.

**Why it happens:** Plotly respects auto-range strictly.

**How to avoid:** Set `yaxis.rangemode: 'tozero'` or explicitly set `yaxis.range: [0, Math.max(maxInterval, 1.5)]` in the hook. Ensures the DRS line is always visible.

**Warning signs:** DRS line not visible during DRS-heavy battle sequences.

### Pitfall 5: connectgaps Default is True

**What goes wrong:** Plotly's `scattergl` default is `connectgaps: true`. Null values in `y` are bridged over with a straight line, making it look like there is data when there isn't (e.g., laps where car-ahead data is missing).

**Why it happens:** Plotly default behavior.

**How to avoid:** Explicitly set `connectgaps: false` on every interval trace.

**Warning signs:** Perfectly straight line segments spanning multi-lap gaps.

---

## Code Examples

### Verified Patterns from Existing Codebase

### Per-Point Opacity (LapTimeChart pattern — marker-based)
```typescript
// Source: frontend/src/components/LapTimeChart/useLapTimeData.ts
// Note: this works because scattergl markers support per-point opacity array
// For lines mode, use separate traces instead
marker: {
  color,
  size: 6,
  opacity: opacities,  // number[] — per-point
},
```

### react-plotly.js CJS Interop Workaround
```typescript
// Source: frontend/src/components/PositionChart/PositionChart.tsx
import _Plot from 'react-plotly.js'
const Plot = (typeof (_Plot as any).default === 'function' ? (_Plot as any).default : _Plot) as typeof _Plot
```

### Plotly Dark Theme Application
```typescript
// Source: frontend/src/components/PositionChart/PositionChart.tsx
const layout: Partial<Plotly.Layout> = {
  template: 'plotly_dark' as unknown as Plotly.Template,
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  height: 400,
  // gridcolor: '#2d2d3d', color: '#e0e0f0' for axes
}
```

### SC Shapes + Cursor Shapes Array Construction
```typescript
// Source: frontend/src/components/PositionChart/PositionChart.tsx
shapes: [...scShapes, ...cursorShapes].filter(Boolean),
```

### Dashboard Card Insertion Point
```typescript
// Source: frontend/src/components/Dashboard/Dashboard.tsx
// New card goes AFTER the PositionChart card:
{/* Interval History card */}
<div className="bg-card border border-border rounded-lg p-4">
  <IntervalHistory visibleDrivers={visibleDrivers} />
</div>
```

### makeLap Test Helper (use 'key' in overrides pattern)
```typescript
// Source: frontend/src/components/PositionChart/usePositionData.test.ts
// CRITICAL: use 'key' in overrides (not ??) to allow explicit null values
Time: 'Time' in overrides ? (overrides.Time as number | null) : 5400.0,
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plotly.restyle for hover | React state hoveredTraceIndex | Phase 6 | No reconciliation race conditions |
| Import shared buildSCShapes | Duplicate per hook | Phase 6 | Hooks self-contained, no cross-component deps |
| scatter (non-GL) | scattergl | Phase 6 | Required for 20-driver WebGL performance |

**Deprecated/outdated:**
- `IntervalToPositionAhead` FastF1 column: not available in public API — compute from `Time` + `Position`.

---

## Open Questions

1. **Per-point opacity for dim laps in lines mode**
   - What we know: `scattergl` lines mode does not support per-point marker opacity (no markers exist)
   - What's unclear: Whether Claude's discretion preference leans toward two-trace-per-driver (faithful dimming) or single trace (simpler, no dim)
   - Recommendation: Use two traces per driver (normal + dim). Total ≤ 40 traces is fine for WebGL. Match the visual intention from the lap time chart.

2. **Interval clipping threshold**
   - What we know: CONTEXT.md says "somewhere in 10-15s range" — Claude's discretion
   - Recommendation: Use 12s. It's the midpoint, keeps 10s+ DRS gaps visible while preventing outlier scale destruction from lapped cars.

3. **Hover tooltip format**
   - Recommendation: `"VER<br>Lap 23<br>0.45s ahead<extra></extra>"` — matches hover style of other charts, shows decimal seconds.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom environment) |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `cd /Users/luckleineschaars/repos/f1-dashboard/frontend && npm test -- --reporter=verbose src/components/IntervalHistory/` |
| Full suite command | `cd /Users/luckleineschaars/repos/f1-dashboard/frontend && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RACE-02 | buildIntervalTraces returns one scattergl trace per visible driver | unit | `npm test -- src/components/IntervalHistory/useIntervalData.test.ts` | ❌ Wave 0 |
| RACE-02 | P1 laps excluded from interval traces (no gap to car ahead) | unit | same | ❌ Wave 0 |
| RACE-02 | Interval value = subject.Time - carAhead.Time | unit | same | ❌ Wave 0 |
| RACE-02 | Intervals clipped at CLIP_MAX | unit | same | ❌ Wave 0 |
| RACE-02 | buildDRSShapes returns two shapes (zone + line) | unit | same | ❌ Wave 0 |
| RACE-02 | DRS shapes use yref: 'y' (data coordinates) | unit | same | ❌ Wave 0 |
| RACE-02 | Pit/lap-1 laps use dim trace (0.3 opacity) | unit | same | ❌ Wave 0 |
| RACE-02 | buildEndOfLineAnnotations labels at last visible lap | unit | same | ❌ Wave 0 |
| ENHANCE-04 | Progressive reveal: only laps <= currentLap included | unit | same | ❌ Wave 0 |
| ENHANCE-04 | buildSCShapes skips future periods (progressive reveal) | unit | same (buildSCShapes tests) | ❌ Wave 0 |
| ENHANCE-04 | buildSCShapes clamps active period end to currentLap | unit | same | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd /Users/luckleineschaars/repos/f1-dashboard/frontend && npm test -- src/components/IntervalHistory/useIntervalData.test.ts`
- **Per wave merge:** `cd /Users/luckleineschaars/repos/f1-dashboard/frontend && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/src/components/IntervalHistory/useIntervalData.test.ts` — covers RACE-02 + ENHANCE-04 pure function tests
- [ ] `frontend/src/components/IntervalHistory/useIntervalData.ts` — pure functions must exist before tests can import them
- [ ] `frontend/src/components/IntervalHistory/IntervalHistory.tsx` — presentational component

*(No new framework install needed — vitest + jsdom already configured)*

---

## Sources

### Primary (HIGH confidence)
- `frontend/src/components/PositionChart/usePositionData.ts` — buildSCShapes, buildEndOfLineAnnotations, buildPositionTraces, hook memo split patterns
- `frontend/src/components/PositionChart/PositionChart.tsx` — hover highlighting via React state, layout config, CJS interop
- `frontend/src/components/LapTimeChart/useLapTimeData.ts` — per-point opacity array, outlier dimming, three-memo pattern
- `frontend/src/lib/plotlyShapes.ts` — makeReplayCursorShape signature and behavior
- `frontend/src/types/session.ts` — LapRow type: Time (cumulative seconds), Position, PitInTime, PitOutTime fields
- `frontend/src/stores/sessionStore.ts` — available state: laps, drivers, currentLap, safetyCarPeriods
- `frontend/src/components/Dashboard/Dashboard.tsx` — integration point for new card insertion

### Secondary (MEDIUM confidence)
- Plotly.js shapes documentation — `xref: 'paper'` + `yref: 'y'` combination for spanning shapes anchored to data axis
- `connectgaps` behavior in scattergl — default true, must explicitly set false

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use
- Architecture: HIGH — all patterns directly verified from existing codebase files
- Pitfalls: HIGH — derived from direct reading of LapRow types and Plotly shape API behavior
- Interval algorithm: HIGH — LapRow.Time is cumulative seconds (verified in types); position subtraction is straightforward math

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable stack — Plotly, Zustand, Vitest versions locked in package.json)
