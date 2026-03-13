# Phase 5: Dashboard Layout + Stint Timeline - Research

**Researched:** 2026-03-14
**Domain:** React + Plotly.js Gantt-style visualization, dashboard layout, shared utility design
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Stint bar visual style:**
- Gantt-style horizontal bars per driver, one row per driver, spanning lap range on shared x-axis
- Compound abbreviation (S, M, H, I, W) centered on each bar — no lap range text on bars
- Detailed hover tooltips showing: compound, lap range, stint length, tyre life at end of stint
- Compact rows (~20-24px) so all 20 drivers fit without scrolling within the chart (~500px chart height)

**Analysis section layout:**
- Full-width section below the existing 2-column standings/gap grid
- Subtle horizontal divider with "STRATEGY & ANALYSIS" label separating sections
- Each chart is a full-width card within the analysis section
- Analysis section only visible during active replay (same as standings + gap chart)

**Driver ordering:**
- Ordered by current race position at the current replay lap
- Rows re-sort with smooth animation when positions change
- Driver labels show position + abbreviation (e.g., "P1 VER") in team color
- Stint bars progressively reveal during replay — only stints up to current lap shown (spoiler-free)

**Compound colors:**
- Standard F1 Pirelli colors: SOFT=#e10600 (red), MEDIUM=#ffd700 (yellow), HARD=#ffffff (white), INTERMEDIATE=#00cc00 (green), WET=#0066ff (blue)
- No compound color legend — compounds labeled on bars themselves
- Unknown/null compounds shown as gray (#555) bar with "?" label

### Claude's Discretion
- Exact Plotly chart configuration and layout details
- Replay cursor visual style (consistent with existing gap chart cursor)
- Loading skeleton / empty state design
- Shared utility API design (`lib/compounds.ts`, `lib/plotlyShapes.ts`)
- Smooth animation implementation approach for row re-sorting

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LAYOUT-01 | New analysis charts displayed in a scrollable dashboard below the existing gap chart and standings board | Dashboard section structure, Tailwind layout patterns, integration with Dashboard.tsx |
| STRAT-01 | User can view a stint timeline showing all drivers' tire stints as horizontal bars (compound-colored, lap range) | Plotly bar chart with `orientation: 'h'`, `base` property for bar offset, compound color map, stint derivation from `laps` + `Stint` grouping |
| ENHANCE-01 | All charts show a replay cursor (vertical line) synced to the current replay lap | Plotly `shapes` array with `yref: 'paper'`, separate `useMemo` keyed on `currentLap`, consistent with GapChart pattern |
</phase_requirements>

---

## Summary

Phase 5 builds two things: (1) a layout extension that adds a scrollable analysis section below the existing Dashboard grid, and (2) the first analysis chart — a tire strategy timeline (Gantt-style horizontal bars). It also establishes two shared utility modules (`lib/compounds.ts`, `lib/plotlyShapes.ts`) that all future chart phases will import.

The existing codebase has a clean, well-established pattern: a data hook (e.g., `useGapData`) computes chart data in a `useMemo` keyed on `[laps, drivers, ...]`, and cursor/annotation data is computed in a **separate** `useMemo` keyed only on `[currentLap, ...]`. This split prevents full chart recomputation on every replay tick. Phase 5 must follow the same split with the stint timeline hook (`useStintData`).

The Plotly Gantt pattern for horizontal bar charts uses `type: 'bar'`, `orientation: 'h'`, and the `base` property to position bars at their start lap. Each driver gets its own trace (one bar per stint within the trace), or alternatively all stints across all drivers can be expressed as separate traces per compound group. The clearest approach for this use case — 20 drivers, each with 2-4 stints — is one trace per driver, where each driver's bars are all the stints for that driver.

**Primary recommendation:** Use one Plotly `bar` trace per driver with `orientation: 'h'`, `base` array for stint start laps, and `width` array for stint lengths. Cursor is a `shapes` entry with `yref: 'paper'`. Shared utilities extract compound color/letter lookups used already in `useStandingsData.ts`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| plotly.js | ^3.4.0 (installed) | Rendering the Gantt/bar chart | Already in use for GapChart; same API |
| react-plotly.js | ^2.6.0 (installed) | React wrapper for Plotly | Already used; CJS interop workaround already in GapChart.tsx |
| zustand | ^5.0.11 (installed) | Reading `laps`, `drivers`, `currentLap` from sessionStore | Established state pattern |
| tailwindcss v4 | ^4.2.1 (installed) | Layout section, divider, card wrapper | Established UI pattern |
| React | ^19.2.4 (installed) | `useMemo` for memoization | Core framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @base-ui/react | ^1.3.0 (installed) | Tooltip for hover on driver labels if needed | Consistent with StandingsBoard tooltips |
| lucide-react | ^0.577.0 (installed) | Any icons in section header | Consistent with rest of UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plotly bar with `base` | Custom SVG/canvas Gantt | Custom builds more flexibility but loses free hover, zoom, and dark theme |
| One trace per driver | One trace per compound type | Per-driver is cleaner for driver-row ordering; per-compound would need y-axis category juggling |
| Separate cursor `useMemo` | Include cursor in main data memo | Main data memo fires only on `[laps]`; cursor-only memo fires on `[currentLap]` — prevents 20-driver recomputation every tick |

**Installation:**
No new packages needed — all dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── compounds.ts        # NEW: compound color/letter map + helper functions
│   └── plotlyShapes.ts     # NEW: cursor shape factory + SC/VSC shape factory
├── components/
│   ├── Dashboard/
│   │   └── Dashboard.tsx   # EDIT: add analysis section below grid
│   └── StintTimeline/      # NEW directory
│       ├── StintTimeline.tsx        # Presentational chart component
│       └── useStintData.ts          # Data hook (two memos: bars + cursor)
```

### Pattern 1: Shared Utility — lib/compounds.ts
**What:** Single source of truth for compound-to-color and compound-to-letter mappings. Extracted from `useStandingsData`'s `COMPOUND_DISPLAY` which already defines the canonical values.
**When to use:** Every chart that needs to color or label a tire compound.
**Example:**
```typescript
// lib/compounds.ts
export const COMPOUND_COLOR: Record<string, string> = {
  SOFT: '#e10600',
  MEDIUM: '#ffd700',
  HARD: '#ffffff',
  INTERMEDIATE: '#00cc00',
  WET: '#0066ff',
}

export const COMPOUND_LETTER: Record<string, string> = {
  SOFT: 'S',
  MEDIUM: 'M',
  HARD: 'H',
  INTERMEDIATE: 'I',
  WET: 'W',
}

export const UNKNOWN_COMPOUND_COLOR = '#555555'
export const UNKNOWN_COMPOUND_LETTER = '?'

export function getCompoundColor(compound: string | null): string {
  return compound ? (COMPOUND_COLOR[compound] ?? UNKNOWN_COMPOUND_COLOR) : UNKNOWN_COMPOUND_COLOR
}

export function getCompoundLetter(compound: string | null): string {
  return compound ? (COMPOUND_LETTER[compound] ?? UNKNOWN_COMPOUND_LETTER) : UNKNOWN_COMPOUND_LETTER
}
```

**Note:** `useStandingsData.ts` exports its own `COMPOUND_DISPLAY` constant today. After this phase, it should import from `lib/compounds.ts` instead (or leave it as-is if it stays internal — but the planner should decide).

### Pattern 2: Shared Utility — lib/plotlyShapes.ts
**What:** Factory functions for reusable Plotly shape objects — replay cursor and SC/VSC/RED shading. Currently this logic lives inline in `GapChart.tsx` and `useGapData.ts`.
**When to use:** Every chart that needs a replay cursor or safety car shading.
**Example:**
```typescript
// lib/plotlyShapes.ts
import type Plotly from 'plotly.js'

export function makeReplayCursorShape(currentLap: number): Partial<Plotly.Shape> | null {
  if (currentLap <= 0) return null
  return {
    type: 'line',
    x0: currentLap,
    x1: currentLap,
    y0: 0,
    y1: 1,
    yref: 'paper' as const,
    line: {
      color: 'rgba(255,255,255,0.6)',
      width: 1.5,
      dash: 'dash' as const,
    },
  }
}
```

### Pattern 3: Two-Memo Hook Split (CRITICAL)
**What:** The stint data hook computes chart trace data in one `useMemo` keyed only on `[laps]`, and the cursor shape in a **separate** `useMemo` keyed only on `[currentLap]`. This mirrors the existing `useGapData` pattern.
**When to use:** Any chart that has a replay cursor — which is ALL charts per ENHANCE-01.
**Example:**
```typescript
// useStintData.ts
export function useStintData() {
  const laps = useSessionStore((s) => s.laps)
  const drivers = useSessionStore((s) => s.drivers)
  const currentLap = useSessionStore((s) => s.currentLap)

  // Heavy: recomputes only when laps change
  const { traces, yAxisCategories } = useMemo(() => {
    // Derive stints, build bar traces, compute driver ordering
    // Progressive reveal: only stints with start_lap <= currentLap... wait —
    // BUT: we need currentLap for progressive reveal of bars too
    // Solution: filter stints by start_lap <= currentLap inside this memo
    // BUT that makes currentLap a dep here...
    //
    // CORRECT SPLIT: bars memo deps = [laps, drivers, currentLap]
    // because progressive bar reveal requires currentLap
    // cursor memo deps = [currentLap] ONLY
    // This still achieves separation since cursor shape is trivially cheap
    // and bar computation (O(20 * ~3 stints)) is acceptable with currentLap dep
    //
    // ALTERNATIVE: compute ALL bars (full race) in [laps] memo,
    // then filter to currentLap in render/separate memo.
    // This is the cleaner approach if bars need re-sort by position too.
    return computeStintTraces(laps, drivers)
  }, [laps, drivers])

  // Light: cursor only — fires every tick but is trivially cheap
  const cursorShape = useMemo(
    () => makeReplayCursorShape(currentLap),
    [currentLap]
  )

  // Driver order by current position — deps [laps, currentLap]
  const driverOrder = useMemo(() => {
    return computeDriverOrder(laps, currentLap)
  }, [laps, currentLap])

  return { traces, yAxisCategories, cursorShape, driverOrder }
}
```

**Key insight from STATE.md decision:** "Memoize chart `data` on `[laps]` only; cursor shape reads `currentLap` separately — prevents jank with 5+ charts open." For the stint timeline specifically, progressive bar reveal AND driver re-sorting both require `currentLap` as a dependency. The pragmatic approach: compute **all stints across the whole race** in a `[laps, drivers]` memo (no currentLap), then in a second `[laps, drivers, currentLap]` memo, filter to visible stints and compute driver order. Cursor shape is its own trivial `[currentLap]` memo.

### Pattern 4: Plotly Gantt via Horizontal Bar Chart
**What:** Plotly does not have a native "Gantt" chart type. Gantt-style bars are achieved using `type: 'bar'`, `orientation: 'h'`, with `base` controlling where each bar starts on the x-axis and `x` (or `width`) controlling bar length.
**When to use:** Any horizontal timeline / per-driver bar chart.
**Example:**
```typescript
// One trace per driver
const trace: Partial<Plotly.PlotData> = {
  type: 'bar',
  orientation: 'h',
  x: stintLengths,       // bar width = stint length in laps
  y: driverLabels,       // one y-category per driver row
  base: stintStartLaps,  // where each bar begins on x-axis
  marker: {
    color: stintColors,    // per-bar compound color
    line: { width: 0 },
  },
  text: stintLabels,       // compound letter centered on bar
  textposition: 'inside',
  insidetextanchor: 'middle',
  hovertemplate: ...,
  showlegend: false,
}
```

**Important:** Using one trace per driver means all bars for a driver share a single y-category entry. Stints for a driver are multiple `x`, `base`, `text`, `marker.color` entries within that one trace. The y-value for each bar entry repeats the driver label string. Plotly stacks them if they overlap — but stints cannot overlap for a single driver, so this is safe.

**Alternative — one trace total:** All 20 drivers in a single trace, y-values are driver label strings. This is simpler but makes per-driver coloring and hover harder. Use multiple `marker.color` array entries.

**Recommended approach:** Single trace with all bars (all drivers, all stints), using a flat array of `x` (lengths), `y` (driver label, repeated per stint), `base` (start laps), `marker.color` (per-stint compound color), `text` (compound letter). This is the standard Plotly Gantt recipe.

### Pattern 5: Dashboard Layout Extension
**What:** The `Dashboard.tsx` currently renders a 2-column grid (gap chart left, standings right). Phase 5 adds a full-width section below it inside the same `main` container.
**When to use:** Adding the analysis section.
**Example:**
```tsx
// Dashboard.tsx
export function Dashboard() {
  const isReplaying = useSessionStore((s) => s.currentLap > 0 && s.isPlaying || ...)
  // OR just render analysis section when stage === 'complete' and currentLap > 0

  return (
    <div className="space-y-4">
      {/* Existing 2-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 flex flex-col gap-3">
          <DriverSelector />
          <GapChart />
        </div>
        <div className="lg:col-span-2 min-h-0 overflow-hidden">
          <StandingsBoard />
        </div>
      </div>

      {/* NEW: Analysis section — only during active replay */}
      {isReplayActive && (
        <div className="space-y-4">
          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground uppercase tracking-widest">
              Strategy &amp; Analysis
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Full-width cards */}
          <div className="bg-card border border-border rounded-lg p-4">
            <StintTimeline />
          </div>
        </div>
      )}
    </div>
  )
}
```

**How to detect "replay active":** `useSessionStore(s => s.isPlaying || s.currentLap > 1)` — or more precisely, the analysis section should appear whenever `stage === 'complete'` and replay has been started (currentLap > 1 or isPlaying). The exact threshold is at Claude's discretion.

### Anti-Patterns to Avoid
- **Putting currentLap in the bars useMemo as the only split:** Don't skip the two-memo split just because it's "only one chart." Future phases add 4+ more charts — the split must be established here.
- **Using `type: 'scatter'` for Gantt bars:** Horizontal bars require `type: 'bar'` with `orientation: 'h'`. Scatter with shapes is far more complex.
- **Grouping stints by Compound:** The STATE.md decision is explicit: group by `Stint` integer column, not `Compound`. FastF1 v3.6.0+ can have `None` compound values mid-race.
- **Animating with Plotly `transition`:** Row re-sorting animations via Plotly layout transitions are unreliable for categorical y-axes. Use CSS transitions on a wrapping div, or accept instant re-sort (Plotly reorders y-categories instantly when layout.yaxis.categoryarray changes).
- **Rendering `StintTimeline` outside `isReplaying` conditional:** The analysis section must only show during active replay, consistent with the standing board and gap chart.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Horizontal timeline bars | Custom SVG/canvas Gantt renderer | Plotly `bar` with `orientation: 'h'` and `base` | Free hover, zoom, responsive resize, dark theme integration |
| Compound color/letter lookup | Inline color maps in each chart | `lib/compounds.ts` shared utility | Already partially defined in `useStandingsData`; centralizing prevents drift |
| Replay cursor shapes | Per-chart inline shape object | `lib/plotlyShapes.ts` factory | Same cursor needed on 5+ future charts; single source |
| Driver position ordering | Custom sort logic per chart | Reuse `laps` + `Position` field pattern from `useStandingsData` | Same pattern already proven |

**Key insight:** The `COMPOUND_DISPLAY` constant in `useStandingsData.ts` is the existing compound map — the shared `lib/compounds.ts` simply extracts and expands it. Do not write a third copy.

---

## Common Pitfalls

### Pitfall 1: Stint Grouping Breaks on None Compound
**What goes wrong:** Using `.Compound` to group laps into stints. When FastF1 returns `None`/null compound, each null lap becomes its own stint fragment.
**Why it happens:** FastF1 v3.6.0+ sometimes returns `None` for compound on certain laps (in/out laps, safety car laps).
**How to avoid:** Group laps by `Stint` integer column. The `Stint` number is stable even when `Compound` is null. The compound for each stint is the most common or last non-null compound value within that `Stint` group.
**Warning signs:** Chart shows 8+ stints per driver instead of 2-4.

### Pitfall 2: Plotly y-axis Categorical Order
**What goes wrong:** Plotly auto-orders categorical y-axis alphabetically when `categoryarray` is not set. Driver names end up in random order.
**Why it happens:** Plotly defaults to first-seen order for categorical axes.
**How to avoid:** Always set `layout.yaxis.categoryarray` explicitly to the desired driver order array. Update it with each `currentLap` tick (driver re-sort by position). Set `layout.yaxis.categoryorder: 'array'`.
**Warning signs:** Drivers appear in alphabetical order instead of race position order.

### Pitfall 3: Bar Width in Plotly Horizontal Charts
**What goes wrong:** The `x` value in a horizontal bar chart is the bar **length**, not the right edge. `base` is the left edge. Total bar span = `base + x`. This is easy to confuse with thinking `x` is the end position.
**Why it happens:** The Plotly `bar` API uses `base` as offset and `x` as size.
**How to avoid:** Compute `x[i] = stintEndLap - stintStartLap` (lap count / length). Set `base[i] = stintStartLap - 1` (0-indexed offset if lap 1 starts at x=1).
**Warning signs:** Bars appear half the expected width, or start at wrong positions.

### Pitfall 4: React Plotly CJS Interop
**What goes wrong:** `import Plot from 'react-plotly.js'` may double-wrap the default export in Vite, causing `Plot is not a function` errors.
**Why it happens:** CJS/ESM interop issue already identified in the project.
**How to avoid:** Use the existing pattern from `GapChart.tsx`:
```typescript
import _Plot from 'react-plotly.js'
const Plot = (typeof (_Plot as any).default === 'function' ? (_Plot as any).default : _Plot) as typeof _Plot
```
**Warning signs:** `Plot is not a function` runtime error in development.

### Pitfall 5: Progressive Reveal + Full-Race Memo Split
**What goes wrong:** If the bars memo depends on `[laps]` only (no currentLap), the bars show the full race timeline immediately — no progressive reveal.
**Why it happens:** Progressive reveal needs `currentLap` to filter which stints to show.
**How to avoid:** The bars computation memo should depend on `[laps, drivers, currentLap]`. Accept that this memo re-fires every replay tick. Since stints are O(20 drivers * ~3 stints) = O(60 items), this is fast. The **cursor** shape stays in its own separate `[currentLap]` memo regardless.
**Warning signs:** All driver stints visible from lap 1, spoiling the race.

### Pitfall 6: Driver Label Format vs. Plotly Y-axis
**What goes wrong:** The decision says labels show "P1 VER" in team color. Plotly categorical y-axis labels are plain text; HTML color styling requires `tickfont` + `ticktext` mapping, which does not support per-tick colors natively.
**Why it happens:** Plotly's y-axis tick coloring is global, not per-tick.
**How to avoid:** Use `layout.yaxis.ticktext` for formatted labels AND render driver labels as a custom HTML overlay OR accept that team color only appears via the bar colors. Recommended approach: driver labels are plain "P1 VER" text (white/muted), and team color is expressed through the bar fill colors themselves. Full per-label team color is a cosmetic enhancement; the compact bar colors already communicate team identity.
**Warning signs:** Every tick label attempting HTML causes rendering failures.

---

## Code Examples

Verified patterns from existing codebase:

### Existing Cursor Shape Pattern (from GapChart.tsx)
```typescript
// Source: /frontend/src/components/GapChart/GapChart.tsx
const cursorShape =
  currentLap > 0
    ? [
        {
          type: 'line' as const,
          x0: currentLap,
          x1: currentLap,
          y0: 0,
          y1: 1,
          yref: 'paper' as const,
          line: {
            color: 'rgba(255,255,255,0.6)',
            width: 1.5,
            dash: 'dash' as const,
          },
        },
      ]
    : []
```

### Existing Plotly Dark Theme Pattern (from GapChart.tsx)
```typescript
// Source: /frontend/src/components/GapChart/GapChart.tsx
const layout: Partial<Plotly.Layout> = {
  template: 'plotly_dark' as unknown as Plotly.Template,
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  margin: { t: 16, r: 8, b: 40, l: 56 },
  showlegend: false,
  hovermode: 'closest',
}
```

### Existing CJS Interop Pattern (from GapChart.tsx)
```typescript
// Source: /frontend/src/components/GapChart/GapChart.tsx
import _Plot from 'react-plotly.js'
const Plot = (typeof (_Plot as any).default === 'function' ? (_Plot as any).default : _Plot) as typeof _Plot
```

### Existing Two-Memo Split Pattern (from useGapData.ts)
```typescript
// Source: /frontend/src/components/GapChart/useGapData.ts
// Memo 1: chart data — deps do NOT include currentLap
const gapSegments = useMemo(() => { ... }, [laps, drivers, selectedDrivers])

// Memo 2: annotations — deps include currentLap
const annotationShapes = useMemo(() => { ... }, [laps, drivers, selectedDrivers, currentLap, safetyCarPeriods])
```

### Existing Compound Display Map (from useStandingsData.ts)
```typescript
// Source: /frontend/src/components/StandingsBoard/useStandingsData.ts
export const COMPOUND_DISPLAY: Record<string, { letter: string; color: string }> = {
  SOFT:         { letter: 'S', color: '#E8002D' },
  MEDIUM:       { letter: 'M', color: '#FFF200' },
  HARD:         { letter: 'H', color: '#FFFFFF' },
  INTERMEDIATE: { letter: 'I', color: '#39B54A' },
  WET:          { letter: 'W', color: '#0067FF' },
}
```
**Note:** The CONTEXT.md specifies slightly different hex values (SOFT=#e10600, MEDIUM=#ffd700, INTERMEDIATE=#00cc00, WET=#0066ff). The lib/compounds.ts should use the CONTEXT.md values as the canonical source; `useStandingsData.ts` can optionally be updated to import from lib. The planner should decide whether to normalize in this phase or leave `useStandingsData.ts` untouched.

### Stint Derivation from LapRow[]
```typescript
// Pattern for grouping laps into stints using Stint integer column
interface Stint {
  driver: string
  stintNumber: number
  compound: string | null   // best guess: last non-null Compound in this Stint group
  startLap: number
  endLap: number
  tyreLifeAtEnd: number | null
}

function deriveStints(laps: LapRow[]): Stint[] {
  // Group by driver + Stint integer
  const groups = new Map<string, LapRow[]>()
  for (const lap of laps) {
    if (lap.LapNumber === null || lap.Stint === null) continue
    const key = `${lap.Driver}::${lap.Stint}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(lap)
  }

  const stints: Stint[] = []
  for (const [key, stintLaps] of groups) {
    const [driver] = key.split('::')
    stintLaps.sort((a, b) => (a.LapNumber ?? 0) - (b.LapNumber ?? 0))
    const startLap = stintLaps[0].LapNumber!
    const endLap = stintLaps[stintLaps.length - 1].LapNumber!
    const stintNumber = stintLaps[0].Stint!
    // Use last non-null compound in this stint group
    const compound = stintLaps.map(l => l.Compound).filter(Boolean).pop() ?? null
    const tyreLifeAtEnd = stintLaps[stintLaps.length - 1].TyreLife
    stints.push({ driver, stintNumber, compound, startLap, endLap, tyreLifeAtEnd })
  }
  return stints
}
```

### LapRow Type (existing, confirmed)
```typescript
// Source: /frontend/src/types/session.ts
export interface LapRow {
  LapNumber: number | null
  Driver: string
  Team: string | null
  LapTime: number | null
  Time: number | null
  PitInTime: number | null
  PitOutTime: number | null
  Compound: string | null
  TyreLife: number | null
  Position: number | null
  Stint: number | null    // <-- exists, use this for grouping
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline per-component compound maps | Shared `lib/compounds.ts` | Phase 5 (this phase) | Future phases import a single source |
| Inline cursor shape per component | Shared `lib/plotlyShapes.ts` factory | Phase 5 (this phase) | Consistent cursor across all 5+ future charts |
| Single-section dashboard | Two-section: grid + analysis | Phase 5 (this phase) | Establishes scrollable layout for phases 6-8 |

**Key architectural decision carried forward from STATE.md:**
- Memoize chart `data` on `[laps]` only; cursor shape reads `currentLap` separately
- Group stints by `Stint` integer (not compound) — FastF1 v3.6.0+ has `None` compound values

---

## Open Questions

1. **Compound color normalization in useStandingsData.ts**
   - What we know: `COMPOUND_DISPLAY` in `useStandingsData.ts` has slightly different hex values than CONTEXT.md decisions
   - What's unclear: Should Phase 5 update `useStandingsData.ts` to import from `lib/compounds.ts`, or leave it untouched to limit scope?
   - Recommendation: Create `lib/compounds.ts` with CONTEXT.md values, leave `useStandingsData.ts` as-is for Phase 5. Update it in a later cleanup task.

2. **"Replay active" detection for analysis section visibility**
   - What we know: The analysis section is "only visible during active replay (same as standings + gap chart)"
   - What's unclear: The current `Dashboard.tsx` doesn't track replay state; the `isReplaying` pattern lives in `RaceDashboardInner.tsx` (old architecture) but current `App.tsx` uses `Dashboard.tsx` directly
   - Recommendation: Use `useSessionStore(s => s.currentLap > 1 || s.isPlaying)` as the condition. This matches replay started semantics.

3. **Row re-sort animation approach**
   - What we know: "Rows re-sort with smooth animation when positions change" — this is Claude's discretion
   - What's unclear: Plotly categorical y-axis doesn't support CSS transitions; changing `categoryarray` causes instant reorder
   - Recommendation: Accept instant reorder for Phase 5. Smooth animation via Plotly is not reliably achievable for categorical axes without custom SVG. The bar colors and position labels already communicate changes.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None currently configured in package.json (no vitest/jest in devDependencies) |
| Config file | None — Wave 0 gap |
| Quick run command | `cd /Users/luckleineschaars/repos/f1-dashboard/frontend && npx vitest run --reporter=verbose` (after Wave 0 setup) |
| Full suite command | `cd /Users/luckleineschaars/repos/f1-dashboard/frontend && npx vitest run` |

**Important note on existing test files:** The `*.test.tsx` files in `src/components/` reference old API shapes (e.g., `GapChartData` type, `visibleLap` prop, `jest.mock`) from a previous architecture. These are stale/orphaned tests that do not match the current codebase. The current stack uses Vite (not CRA/Jest). These files will fail compilation. Phase 5 should treat them as non-functional until vitest is set up and they are updated.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAYOUT-01 | Analysis section renders below grid when replay active | unit/render | `npx vitest run src/components/Dashboard/Dashboard.test.tsx` | ❌ Wave 0 |
| STRAT-01 | Stint timeline shows compound-colored horizontal bars per driver | unit | `npx vitest run src/components/StintTimeline/useStintData.test.ts` | ❌ Wave 0 |
| STRAT-01 | Stints grouped by Stint integer, not Compound | unit | `npx vitest run src/components/StintTimeline/useStintData.test.ts` | ❌ Wave 0 |
| STRAT-01 | Progressive reveal: stints filtered to currentLap | unit | `npx vitest run src/components/StintTimeline/useStintData.test.ts` | ❌ Wave 0 |
| ENHANCE-01 | Cursor shape present at currentLap in layout.shapes | unit | `npx vitest run src/lib/plotlyShapes.test.ts` | ❌ Wave 0 |
| ENHANCE-01 | Cursor memo has separate dep from bars memo | unit | `npx vitest run src/components/StintTimeline/useStintData.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/ src/components/StintTimeline/` (after Wave 0 setup)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/vitest.config.ts` — vitest not in devDependencies; install `vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom` and configure
- [ ] `frontend/src/lib/compounds.test.ts` — covers getCompoundColor, getCompoundLetter edge cases
- [ ] `frontend/src/lib/plotlyShapes.test.ts` — covers makeReplayCursorShape
- [ ] `frontend/src/components/StintTimeline/useStintData.test.ts` — covers stint derivation, progressive reveal, driver ordering
- [ ] `frontend/src/components/Dashboard/Dashboard.test.tsx` — covers analysis section visibility gate

**Note on stale test files:** `src/components/GapChart.test.tsx`, `RaceDashboard.test.tsx`, `SessionSelector.test.tsx`, `StandingsBoard.test.tsx`, `contexts/ReplayContext.test.tsx`, `hooks/useReplayTimer.test.ts` reference old architecture (jest, old types). These should not block Phase 5 — configure vitest to exclude them or update them separately.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read: `/frontend/src/components/GapChart/useGapData.ts` — two-memo split pattern confirmed
- Direct codebase read: `/frontend/src/components/GapChart/GapChart.tsx` — CJS interop workaround, cursor shape, dark theme
- Direct codebase read: `/frontend/src/components/StandingsBoard/useStandingsData.ts` — COMPOUND_DISPLAY map confirmed
- Direct codebase read: `/frontend/src/types/session.ts` — `LapRow.Stint` field confirmed present
- Direct codebase read: `/frontend/src/stores/sessionStore.ts` — `laps`, `drivers`, `currentLap`, `isPlaying` confirmed in store
- Direct codebase read: `/frontend/src/components/Dashboard/Dashboard.tsx` — layout structure confirmed
- Direct codebase read: `/frontend/package.json` — plotly.js ^3.4.0, react-plotly.js ^2.6.0 confirmed installed; no vitest present
- Direct codebase read: `.planning/STATE.md` — "Group stints by Stint integer" and "memoize on [laps] only" decisions confirmed

### Secondary (MEDIUM confidence)
- Plotly.js horizontal bar chart with `base` property — standard documented pattern, consistent with plotly.js ^3.x API; `orientation: 'h'` + `base` array is the canonical Gantt approach
- `layout.yaxis.categoryarray` for explicit ordering — standard Plotly categorical axis feature, stable across v2/v3

### Tertiary (LOW confidence)
- Row re-sort animation via Plotly categorical axes — known to be instant/non-animatable; CSS alternative would require custom overlay. Not researched further as it is Claude's discretion.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed installed in package.json
- Architecture patterns: HIGH — patterns read directly from existing source code
- Pitfalls: HIGH — stale tests and interop issues confirmed by direct code inspection; Plotly Gantt pattern is well-documented
- Validation architecture: MEDIUM — vitest setup inferred from Vite project; stale test files confirmed stale by reading them

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable stack — plotly.js, Vite, zustand; no fast-moving dependencies)
