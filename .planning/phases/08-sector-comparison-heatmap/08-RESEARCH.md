# Phase 8: Sector Comparison Heatmap - Research

**Researched:** 2026-03-14
**Domain:** Plotly.js heatmap trace with custom colorscale, new FastAPI lazy endpoint for sector times, progressive reveal with rolling best computation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Replay integration
- **Progressive reveal**: heatmap reveals cells lap-by-lap as replay advances; only laps <= currentLap are shown
- **Rolling bests**: personal best and session best are computed from revealed laps only (1..currentLap). Colors shift as new bests are set during replay -- true spoiler-free mode
- **Cursor indicator**: current lap's 3 sector cells get a highlighted column border (e.g. bright white/light outline) to mark the current replay position. No auto-scroll needed.
- The heatmap is gated by `isReplayActive` (same as other analysis charts)

#### Driver scope
- **Respects DriverToggle**: only shows rows for drivers currently toggled on. Default = top 2 by position, matching other charts
- **Row ordering**: by current race position at currentLap (same as StintTimeline/other charts). Rows re-sort as replay advances.
- Maximum 20 rows if all drivers toggled on

#### Color scheme
- **Session best** = purple override (consistent with RACE-03 requirement: "purple = session best")
- **Personal best** = green anchor (per rolling bests logic above)
- **Gradient**: green -> yellow -> orange -> red, scaled relative to each driver's own lap range (personal best = green end; driver's worst clean sector time = red end). Each driver normalized independently -- shows intra-driver degradation more clearly.
- **Missing / empty cells**: outlaps, SC laps, lap 1 where sector data is absent -- render as visually distinct dark/empty cells (no color fill), clearly distinguishable from colored cells
- **Hover tooltip**: raw sector time + delta to personal best (e.g. "S1: 28.432s | +0.341s vs PB")

#### Layout and density
- **Cells**: narrow fixed-width cells (~8-12px wide), color-only (no text in cell). Sector label shown in hover tooltip only.
- **Horizontal scroll**: the heatmap card scrolls horizontally. All 180 columns (60 laps x 3 sectors) accessible when scrolled.
- **Column structure**: lap groups -- lap number as column header, S1/S2/S3 as 3 narrow sub-columns under each lap header
- **Chart height**: sized to fit visible driver rows (~24-28px per row, same density as StintTimeline)
- **Chart type**: Plotly heatmap trace -- consistent with existing chart tech. Uses `react-plotly.js`.

#### Backend endpoint
- New lazy endpoint (does not slow main session load -- RACE-03 success criterion 3)
- Called when SectorHeatmap component mounts; passes year/event/session_type (same params as main load)
- Returns sector times per driver per lap: `{ driver, lapNumber, s1, s2, s3 }` -- nulls where unavailable
- FastF1 columns: `Sector1Time`, `Sector2Time`, `Sector3Time` (Timedelta -> float seconds, same `serialize_timedelta` pattern)
- Session is already cached in FastF1 cache after main load -- sector endpoint reuses same session object cheaply

#### Loading state
- Simple spinner / skeleton card while sector data loads. Heatmap card area shows a loading indicator, replaced by the Plotly chart when data arrives.
- Same empty state pattern as other analysis charts if sector data is empty/fails.

### Claude's Discretion
- Exact Plotly heatmap configuration (colorscale array, axis tick formatting, margins)
- Exact cell width in pixels (8-12px range)
- Highlighted column border implementation for current lap cursor (shape overlay or trace annotation)
- How "driver's worst clean sector time" is defined (e.g., exclude pit in/out laps from red end of scale)
- Backend endpoint URL and caching strategy (reuse FastF1 cache, no re-fetch)
- Spinner/skeleton visual design
- Whether to create a custom colorscale array or use a named Plotly scale as base

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RACE-03 | User can view a sector comparison heatmap color-coded by relative pace (purple=session best, green=personal best) | Core heatmap implementation: backend sector endpoint, Plotly heatmap trace with custom colorscale, rolling best computation, progressive reveal, driver toggle integration, hover tooltips |
| ENHANCE-04 | All charts progressively reveal data up to current lap during replay (spoiler-free mode) | Already established pattern: filter sector data by `<= currentLap`, compute rolling bests from revealed data only |
</phase_requirements>

---

## Summary

Phase 8 introduces the sector comparison heatmap, which is the most complex chart in the project because it requires a new backend endpoint (first lazy-loaded data source), a novel color-coding algorithm (per-driver normalization with session-best and personal-best overrides), and a wide grid layout with horizontal scrolling. However, the component still follows the established three-file pattern: pure functions + hook + presentational component.

The backend work is straightforward: a new `GET /api/sessions/sectors` endpoint that loads the same FastF1 session (already cached from main load), extracts `Sector1Time`, `Sector2Time`, `Sector3Time` from the laps DataFrame, and serializes them using the existing `serialize_timedelta` pattern. The session.load call with `laps=True` already pulls sector times -- no additional FastF1 data loading is needed.

The frontend is where the complexity lives. The Plotly `heatmap` trace type accepts a 2D `z` array, but the color-coding requirement (per-driver normalization with purple/green overrides) means we cannot use a single heatmap trace with a global colorscale. Instead, we must pre-compute RGBA colors for each cell and use a single-color-mapped approach: normalize each cell's value to [0,1] within its driver's range, apply the gradient, then override session-best cells with purple and personal-best cells with green. The resulting colors can be passed through a Plotly heatmap's `z` values mapped to a custom colorscale, or more practically, we can use a flat colorscale and encode everything into the z-values after normalization. The recommended approach is to compute a color string array and use Plotly annotations or a custom approach. Actually, the simplest and most correct approach is to use the Plotly heatmap `z` array with `null` for missing cells (renders as distinct empty), and apply a custom colorscale. Since each driver needs independent normalization, the z-values should be pre-normalized (0-1 scale per driver) before being placed in the 2D array, with special sentinel values for session-best and personal-best cells.

**Primary recommendation:** Build the heatmap as a Plotly `heatmap` trace with pre-normalized z-values (0.0 = personal best / green, 1.0 = worst / red), using sentinel values (-1.0 = session best / purple) and null for missing cells. Use a custom colorscale that maps 0.0 to green through yellow/orange to red at 1.0. Override session-best cells via a second overlay trace or Plotly shapes. The backend endpoint is a simple non-SSE JSON `GET` returning flat array of sector row objects.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| plotly.js | Current (already installed) | Heatmap chart rendering | Project standard for all analysis charts |
| react-plotly.js | Current (already installed) | React wrapper | CJS interop workaround already in place |
| zustand (useSessionStore) | Current (already installed) | State: laps, drivers, currentLap | Project store |
| FastAPI | Current (already installed) | Backend endpoint | Project backend framework |
| fastf1 | Current (already installed) | Sector time extraction | Sector1Time, Sector2Time, Sector3Time columns |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest + jsdom | Current (already installed) | Unit tests for pure functions | All exported pure functions need tests |
| pytest | Current (already installed) | Backend endpoint + serialization tests | Sector serialization and endpoint tests |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plotly heatmap trace | HTML table with colored cells | Plotly heatmap is consistent with project tech; HTML table would require custom scroll/hover but would give more control over per-cell coloring. Plotly is the locked decision. |
| Pre-normalized z + custom colorscale | Multiple heatmap traces (one per driver) | Single trace with pre-normalized z is simpler; multiple traces would each have their own colorscale but complicate layout |

**Installation:** No new packages needed -- all dependencies already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/components/SectorHeatmap/
  SectorHeatmap.tsx              # Presentational component (Plot wrapper + scroll container)
  useSectorData.ts               # Pure functions + React hook (fetch + compute)
  useSectorData.test.ts          # Vitest unit tests for pure functions

backend/routers/sessions.py      # Add new GET /sessions/sectors endpoint
backend/services/fastf1_service.py  # Add serialize_sectors function
backend/tests/test_sectors.py    # Pytest tests for sector serialization + endpoint
```

Dashboard.tsx gets one new import and one new card `<div>` after the IntervalHistory card.

### Pattern 1: Backend Sector Endpoint (Non-SSE JSON GET)

**What:** A new `GET /api/sessions/sectors` endpoint that returns sector times per driver per lap. Unlike the main SSE load, this is a simple JSON response since the FastF1 session is already cached.

**When to use:** Called lazily when SectorHeatmap mounts (not during initial session load).

**Example:**
```python
# Source: derived from backend/services/fastf1_service.py patterns
def serialize_sectors(session) -> list[dict]:
    """Extract per-driver per-lap sector times from a loaded FastF1 session.

    Returns list of dicts: { driver, lapNumber, s1, s2, s3 }
    where s1/s2/s3 are float seconds or None.
    """
    laps = session.laps
    result = []
    for _, row in laps.iterrows():
        lap_number = row.get("LapNumber")
        driver = row.get("Driver")

        if lap_number is None or pd.isna(lap_number):
            continue
        if driver is None or pd.isna(driver):
            continue

        result.append({
            "driver": str(driver),
            "lapNumber": int(lap_number),
            "s1": serialize_timedelta(row.get("Sector1Time")),
            "s2": serialize_timedelta(row.get("Sector2Time")),
            "s3": serialize_timedelta(row.get("Sector3Time")),
        })
    return result
```

```python
# Source: derived from backend/routers/sessions.py patterns
@router.get("/sessions/sectors")
async def get_sectors(year: int, event: str, session_type: str):
    """Return per-driver per-lap sector times for a loaded session.

    The FastF1 session is loaded via get_session + session.load,
    which reuses the FastF1 disk cache from the main load.
    No SSE needed -- this is a simple JSON response.
    """
    session = await asyncio.to_thread(fastf1.get_session, year, event, session_type)
    await asyncio.to_thread(session.load, laps=True, telemetry=False, weather=False, messages=False)
    sectors = serialize_sectors(session)
    return {"sectors": sectors}
```

**Key insight:** `session.load(laps=True)` already includes sector times in the laps DataFrame. The FastF1 disk cache means this second load is nearly instant (no network fetch). The endpoint does NOT require a new FastF1 call -- it reuses the cached `.ff1pkl` files.

### Pattern 2: Frontend Lazy Fetch in Hook

**What:** The `useSectorData` hook fetches sector data from the backend when the component mounts. Uses local React state (not Zustand) since sector data is only used by this one component.

**When to use:** On SectorHeatmap mount, after the main session is loaded.

**Example:**
```typescript
// Source: derived from frontend/src/api/client.ts patterns
export interface SectorRow {
  driver: string
  lapNumber: number
  s1: number | null
  s2: number | null
  s3: number | null
}

async function fetchSectors(
  year: number,
  event: string,
  sessionType: string
): Promise<SectorRow[]> {
  const params = new URLSearchParams({
    year: String(year),
    event,
    session_type: sessionType,
  })
  const res = await fetch(`/api/sessions/sectors?${params}`)
  if (!res.ok) throw new Error(`Sector fetch failed: ${res.status}`)
  const data = await res.json()
  return data.sectors
}
```

```typescript
// In the hook:
export function useSectorData(visibleDrivers: Set<string>) {
  const year = useSessionStore((s) => s.year)
  const event = useSessionStore((s) => s.event)
  const sessionType = useSessionStore((s) => s.sessionType)
  const laps = useSessionStore((s) => s.laps)
  const drivers = useSessionStore((s) => s.drivers)
  const currentLap = useSessionStore((s) => s.currentLap)

  const [sectorRows, setSectorRows] = useState<SectorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch sector data on mount (when session params are available)
  useEffect(() => {
    if (!year || !event) return
    setLoading(true)
    setError(null)
    fetchSectors(year, event, sessionType)
      .then((rows) => { setSectorRows(rows); setLoading(false) })
      .catch((err) => { setError(err.message); setLoading(false) })
  }, [year, event, sessionType])

  // Memo 1: build sector lookup from raw data -- stable on [sectorRows]
  // Memo 2: compute heatmap z-values, colors, annotations -- on [sectorRows, visibleDrivers, currentLap, laps, drivers]
  // Memo 3: cursor shapes -- on [currentLap]
  // ...
}
```

### Pattern 3: Heatmap Color Computation (Per-Driver Normalization with Overrides)

**What:** For each visible driver, normalize sector times to [0, 1] relative to that driver's personal best (=0) and worst clean sector time (=1). Then override: session best across ALL drivers = purple, personal best = green. Missing cells = null in z array.

**When to use:** In the pure `buildHeatmapData` function, called from memo 2.

**Algorithm:**
1. Filter sector data to laps <= currentLap (progressive reveal)
2. For each sector (S1, S2, S3) across all visible drivers, find the session best (minimum value across all drivers for that sector, rolling)
3. For each driver, find their personal best and worst clean sector time for each sector (rolling)
4. Normalize each cell: `(value - personalBest) / (worstClean - personalBest)`, clamped to [0, 1]
5. Mark session-best cells with a sentinel value (e.g., -1.0)
6. Mark personal-best cells with a sentinel value (e.g., -0.5)
7. Missing cells (null s1/s2/s3, outlaps, SC laps) = null in z

**"Clean" definition (Claude's discretion):** Exclude laps where the corresponding LapRow has `PitInTime !== null` OR `PitOutTime !== null` OR `LapNumber === 1`. This removes pit in/out laps and lap 1 from the "worst" calculation so the red end of the gradient represents genuine degradation, not pit-contaminated times.

**Example:**
```typescript
// Source: novel for Phase 8
export interface HeatmapCell {
  value: number | null    // normalized 0-1, or -1 for session best, -0.5 for personal best, null for missing
  rawTime: number | null  // original sector time in seconds
  delta: number | null    // delta to personal best in seconds
  sector: 1 | 2 | 3
  lapNumber: number
  driver: string
}

export function buildHeatmapData(
  sectorRows: SectorRow[],
  laps: LapRow[],
  drivers: DriverInfo[],
  visibleDrivers: Set<string>,
  currentLap: number
): {
  z: (number | null)[][]           // 2D array: rows=drivers, cols=lap*3 sectors
  x: string[]                      // column labels
  y: string[]                      // row labels (driver abbreviations)
  customdata: (HeatmapCell | null)[][] // for hover tooltips
  driverOrder: string[]            // ordered driver abbreviations
} {
  // 1. Filter to revealed laps
  const revealed = sectorRows.filter((r) => r.lapNumber <= currentLap)

  // 2. Build pit/outlap set from LapRow data
  const isExcludedLap = new Set<string>()
  for (const lap of laps) {
    if (
      lap.LapNumber !== null &&
      lap.LapNumber <= currentLap &&
      (lap.PitInTime !== null || lap.PitOutTime !== null || lap.LapNumber === 1)
    ) {
      isExcludedLap.add(`${lap.Driver}::${lap.LapNumber}`)
    }
  }

  // 3. Compute session bests per sector (rolling, from revealed clean laps)
  // 4. Per driver: compute personal bests and worst clean times
  // 5. Normalize and assign sentinels
  // ... (implementation details)
}
```

### Pattern 4: Plotly Heatmap Colorscale Configuration

**What:** Custom colorscale that maps normalized values to the specified gradient, with special handling for sentinel values.

**Recommended approach:** Since Plotly's heatmap colorscale is a continuous mapping from zmin to zmax, and we need discrete overrides (purple for session best, green for personal best), use a colorscale with sentinel ranges:
- `z = -1.0` -> purple (session best)
- `z = -0.5` -> green (personal best)
- `z = 0.0` -> green (normalized personal best)
- `z = 0.5` -> yellow/orange
- `z = 1.0` -> red (normalized worst)

Set `zmin = -1.0`, `zmax = 1.0`. The colorscale array:

```typescript
const SECTOR_COLORSCALE: [number, string][] = [
  [0.0,  '#9933ff'],   // -1.0: session best (purple)
  [0.20, '#9933ff'],   // still purple zone
  [0.25, '#00cc44'],   // -0.5: personal best (green)
  [0.30, '#00cc44'],   // still green zone
  // Transition zone for personal-best boundary
  [0.50, '#00cc44'],   // 0.0 normalized: personal best (green)
  [0.65, '#cccc00'],   // ~0.3 normalized: yellow
  [0.80, '#ff8800'],   // ~0.6 normalized: orange
  [1.0,  '#cc0000'],   // 1.0 normalized: red (worst)
]
```

**Important:** Set `hoverongaps: false` so null cells (missing data) don't show tooltips. Null values in the z-array render as the plot background color (transparent in our dark theme), creating the "dark empty cell" appearance naturally.

### Pattern 5: Horizontal Scroll Container

**What:** The Plotly chart is rendered at a fixed width based on column count (not responsive), wrapped in a scrollable container div.

**Example:**
```typescript
// Source: novel for Phase 8
const CELL_WIDTH = 10  // px per sector column
const totalColumns = maxLap * 3  // 3 sectors per lap
const chartWidth = Math.max(totalColumns * CELL_WIDTH + 80, 400)  // +80 for y-axis labels

// Outer div scrolls horizontally
<div className="overflow-x-auto">
  <Plot
    data={data}
    layout={layout}
    config={{ responsive: false, displayModeBar: false }}
    style={{ width: `${chartWidth}px`, height: `${chartHeight}px` }}
  />
</div>
```

Note: `responsive: false` in Plotly config so the chart does not shrink to container width. The outer div provides horizontal scroll.

### Pattern 6: Current Lap Cursor Highlight

**What:** Highlight the 3 sector columns for the current lap with a bright border. Implemented as Plotly shapes (rect outlines).

**Example:**
```typescript
export function buildLapCursorShapes(
  currentLap: number,
  maxLap: number,
  driverCount: number
): Partial<Plotly.Shape>[] {
  // Each lap occupies 3 columns: (currentLap-1)*3 to (currentLap-1)*3+2
  const x0 = (currentLap - 1) * 3 - 0.5
  const x1 = (currentLap - 1) * 3 + 2.5

  return [{
    type: 'rect',
    x0,
    x1,
    y0: -0.5,
    y1: driverCount - 0.5,
    xref: 'x',
    yref: 'y',
    line: { color: 'rgba(255, 255, 255, 0.8)', width: 2 },
    fillcolor: 'transparent',
  }]
}
```

### Anti-Patterns to Avoid

- **Fetching sector data during main SSE load:** Would slow initial page render. Sector data must be lazy-loaded separately.
- **Using a global colorscale without per-driver normalization:** Each driver's gradient must be relative to their OWN best/worst. A global scale would make slow drivers always red and fast drivers always green, hiding intra-driver degradation.
- **Building 20 separate heatmap traces (one per driver):** Plotly heatmap traces stack on the same axes poorly. Use a single heatmap trace with all drivers in the z matrix.
- **Using `connectgaps: true` on heatmap:** Would interpolate colors for missing cells. Must be false (default for 2D z arrays).
- **Importing shared functions from other chart hooks:** Per Phase 6 decision, hooks are self-contained. Copy `computeDriverOrder` if needed (or import from StintTimeline since it is a pure function export, not a hook dependency).
- **Adding sector times to the main SSE `complete` event:** Would increase payload size and slow the critical path. Lazy endpoint is the correct pattern.
- **Using Plotly responsive mode for the heatmap:** Would shrink the chart to container width, making cells unreadably small for 60-lap races. Use fixed width with horizontal scroll.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timedelta to float seconds | Custom conversion | `serialize_timedelta` from `fastf1_service.py` | Handles NaT, None, pd.Timedelta edge cases |
| Driver ordering by position | Custom sort | `computeDriverOrder` from `useStintData.ts` | Already handles fallback positions, currentLap filtering |
| Driver visibility state | Custom toggle state | `useVisibleDrivers` + `DriverToggle` | Shared across all Phase 6-8 charts |
| Pit/outlap detection | Custom lap classification | Check `PitInTime !== null \|\| PitOutTime !== null \|\| LapNumber === 1` from LapRow | Same pattern used across LapTimeChart, IntervalHistory |
| CJS interop for react-plotly.js | Custom import | Existing `const Plot = ...` workaround | Already solved in every chart component |
| Plotly dark theme | Custom colors | `template: 'plotly_dark'`, `paper_bgcolor: 'transparent'`, `plot_bgcolor: 'transparent'` | Project standard |

**Key insight:** The novel work in this phase is (1) the backend sector serialization, (2) the per-driver normalization algorithm with rolling bests and sentinel values, and (3) the horizontal scroll layout. Everything else is established patterns.

---

## Common Pitfalls

### Pitfall 1: FastF1 Sector Times Are Timedelta, Not Float

**What goes wrong:** Accessing `row["Sector1Time"]` returns a `pd.Timedelta` or `pd.NaT`, not a float. Directly serializing to JSON fails.

**Why it happens:** FastF1 stores all timing data as pandas Timedelta objects.

**How to avoid:** Always use `serialize_timedelta()` to convert. It handles `NaT` -> `None`, `pd.Timedelta` -> `float(td.total_seconds())`.

**Warning signs:** `TypeError: Object of type Timedelta is not JSON serializable` in backend logs.

### Pitfall 2: Null Values in Plotly Heatmap Render as Background Color

**What goes wrong:** Null values in the z-array render as the background color, which in a transparent/dark theme is visually indistinguishable from "no data." This is actually CORRECT behavior for our use case (dark empty cells for missing data), but developers might try to force a specific color.

**Why it happens:** Plotly heatmap does not have a native `nancolor` property (unlike some other charting libraries). Null/NaN values are simply gaps.

**How to avoid:** Accept this behavior -- it naturally creates the "dark empty cells" specified in the requirements. Do NOT try to use a sentinel z-value for missing cells; use actual `null` in the z array.

**Warning signs:** Attempting to use 0.0 for missing cells and then trying to distinguish "personal best" from "missing" in the colorscale.

### Pitfall 3: Colorscale Sentinel Values Must Have Sharp Boundaries

**What goes wrong:** If the colorscale transitions smoothly from purple (-1.0) through green (-0.5) to the gradient (0.0-1.0), intermediate z-values between sentinels produce muddy in-between colors.

**Why it happens:** Plotly interpolates colors between colorscale stops.

**How to avoid:** Use duplicate stops at boundaries to create sharp transitions. For example: `[0.20, '#9933ff'], [0.25, '#00cc44']` creates an abrupt purple-to-green transition with no blending.

**Warning signs:** Cells that should be pure purple showing a purple-green blend.

### Pitfall 4: Per-Driver Normalization When All Sectors Are the Same Time

**What goes wrong:** If a driver has only one revealed lap, personalBest === worstClean, so the denominator `(worstClean - personalBest)` is zero. Division by zero produces NaN.

**Why it happens:** Early in replay (currentLap = 1 or 2), drivers may have very few data points.

**How to avoid:** Guard against zero denominator: if `worstClean === personalBest`, all that driver's cells should be green (personal best). Use `personalBest` sentinel (-0.5) for the value.

**Warning signs:** NaN values appearing in the z-array early in replay, rendering as gaps instead of green.

### Pitfall 5: Column Index Mapping (Lap 1 Sector 1 Is Column 0)

**What goes wrong:** Off-by-one errors when mapping `(lapNumber, sectorIndex)` to the flat column index in the z-array. Lap 1 S1 = column 0, Lap 1 S2 = column 1, etc.

**Why it happens:** Natural confusion between 1-indexed lap numbers and 0-indexed array positions.

**How to avoid:** Formula: `colIndex = (lapNumber - 1) * 3 + (sectorIndex - 1)` where sectorIndex is 1, 2, or 3.

**Warning signs:** Sector data appearing shifted by one column, or S3 of lap N overlapping with S1 of lap N+1.

### Pitfall 6: Session.load Is Still Blocking Despite Cache

**What goes wrong:** Even though FastF1 disk cache makes the load fast, `session.load()` is still a blocking call that reads pickle files from disk. If called on the main async event loop, it blocks all other requests.

**Why it happens:** FastF1 is not async-aware.

**How to avoid:** Always wrap in `asyncio.to_thread()`, matching the existing pattern in `load_session_stream`.

**Warning signs:** Backend becomes unresponsive during sector data fetch.

### Pitfall 7: Heatmap Y-Axis Order Is Bottom-to-Top by Default

**What goes wrong:** Plotly heatmap renders the first row of the z-array at the BOTTOM of the chart. If driverOrder is [P1, P2, ...P20], P1 appears at the bottom.

**Why it happens:** Standard matrix convention -- row 0 is at y=0 (bottom).

**How to avoid:** Set `yaxis.autorange: 'reversed'` in the layout to flip the y-axis so P1 appears at the top. Alternatively, reverse the z-array and y-labels.

**Warning signs:** Race leader appearing at the bottom of the heatmap.

---

## Code Examples

### Verified Patterns from Existing Codebase

### Backend: serialize_timedelta (reuse directly)
```python
# Source: backend/services/fastf1_service.py
def serialize_timedelta(td: Any) -> float | None:
    """Convert pd.Timedelta to total seconds (float). Returns None for NaT/None."""
    if td is None:
        return None
    try:
        if pd.isna(td):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(td, pd.Timedelta):
        return float(td.total_seconds())
    return None
```

### Backend: Existing router pattern (GET endpoint)
```python
# Source: backend/routers/sessions.py
# The existing endpoint is SSE-based, but the sector endpoint will be simpler:
# A standard JSON GET endpoint following the same URL pattern
@router.get("/sessions/sectors")
async def get_sectors(year: int, event: str, session_type: str):
    ...
```

### Frontend: react-plotly.js CJS Interop Workaround
```typescript
// Source: frontend/src/components/IntervalHistory/IntervalHistory.tsx
import _Plot from 'react-plotly.js'
const Plot = (typeof (_Plot as any).default === 'function' ? (_Plot as any).default : _Plot) as typeof _Plot
```

### Frontend: Plotly Dark Theme Application
```typescript
// Source: frontend/src/components/PositionChart/PositionChart.tsx
const layout: Partial<Plotly.Layout> = {
  template: 'plotly_dark' as unknown as Plotly.Template,
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
}
```

### Frontend: Dashboard Card Insertion Point
```typescript
// Source: frontend/src/components/Dashboard/Dashboard.tsx
// New card goes AFTER the IntervalHistory card:
{/* Sector Heatmap card */}
<div className="bg-card border border-border rounded-lg p-4">
  <SectorHeatmap visibleDrivers={visibleDrivers} />
</div>
```

### Frontend: computeDriverOrder (reuse from StintTimeline)
```typescript
// Source: frontend/src/components/StintTimeline/useStintData.ts
export function computeDriverOrder(
  laps: LapRow[],
  drivers: DriverInfo[],
  currentLap: number
): DriverOrderEntry[] {
  const positionAtLap = new Map<string, number>()
  for (const lap of laps) {
    if (lap.LapNumber === currentLap && lap.Position !== null) {
      positionAtLap.set(lap.Driver, lap.Position)
    }
  }
  // ... returns sorted entries by position
}
```

### Frontend: Loading/Empty State Pattern
```typescript
// Source: frontend/src/components/IntervalHistory/IntervalHistory.tsx
if (intervalTraces.length === 0) {
  return (
    <div className="flex h-[400px] items-center justify-center">
      <p className="text-sm text-muted-foreground">No interval data available</p>
    </div>
  )
}
```

### Frontend: makeLap Test Helper (use 'key' in overrides)
```typescript
// Source: frontend/src/components/PositionChart/usePositionData.test.ts
// CRITICAL: use 'key' in overrides (not ??) to allow explicit null values
Time: 'Time' in overrides ? (overrides.Time as number | null) : 5400.0,
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Include all data in main SSE load | Lazy-load specialized data per component | Phase 8 (new) | Faster initial load, sector data fetched on demand |
| Global colorscale for all drivers | Per-driver normalization with sentinels | Phase 8 (new) | Shows intra-driver degradation, not just inter-driver comparison |
| Responsive chart sizing | Fixed-width + horizontal scroll | Phase 8 (new) | Necessary for 180-column grids; other charts use responsive |

**Deprecated/outdated:**
- None relevant -- this is new functionality.

---

## Open Questions

1. **Exact colorscale sentinel mapping**
   - What we know: Need purple for session best, green for personal best, green-yellow-orange-red gradient for normalized values
   - What's unclear: Exact colorscale stop values depend on visual testing. The sentinel approach (-1.0 for session best, -0.5 for personal best) requires careful colorscale boundary definition.
   - Recommendation: Start with the proposed colorscale, adjust stops during implementation based on visual output. The key constraint is sharp boundaries between purple/green/gradient zones.

2. **computeDriverOrder import vs. duplication**
   - What we know: Phase 6 decision says hooks are self-contained (no cross-component hook imports). But `computeDriverOrder` is a pure exported function, not a hook.
   - Recommendation: Import `computeDriverOrder` from `useStintData.ts` since it's a pure function export. If the convention truly forbids cross-component imports, duplicate it. Planner's discretion.

3. **Maximum lap count for column width calculation**
   - What we know: Need to know max lap count to compute chart width. Can derive from sector data or from main laps data.
   - Recommendation: Derive from `Math.max(...sectorRows.map(r => r.lapNumber))` after fetch. If sector data is empty, fall back to max LapNumber from store laps.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (frontend) | Vitest (jsdom environment) |
| Framework (backend) | pytest + pytest-asyncio |
| Config file (frontend) | `frontend/vitest.config.ts` |
| Config file (backend) | `backend/conftest.py` |
| Quick run command (frontend) | `cd /home/james-turing/repos/f1-dashboard/frontend && npx vitest run --reporter=verbose src/components/SectorHeatmap/` |
| Quick run command (backend) | `cd /home/james-turing/repos/f1-dashboard/backend && python -m pytest tests/test_sectors.py -v` |
| Full suite command (frontend) | `cd /home/james-turing/repos/f1-dashboard/frontend && npx vitest run` |
| Full suite command (backend) | `cd /home/james-turing/repos/f1-dashboard/backend && python -m pytest` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RACE-03 | serialize_sectors returns correct driver/lap/s1/s2/s3 with null for NaT | unit (backend) | `pytest tests/test_sectors.py::test_serialize_sectors` | No, Wave 0 |
| RACE-03 | GET /sessions/sectors returns 200 with sectors array | integration (backend) | `pytest tests/test_sectors.py::test_sectors_endpoint` | No, Wave 0 |
| RACE-03 | buildHeatmapData returns correct z-matrix dimensions (drivers x laps*3) | unit (frontend) | `npx vitest run src/components/SectorHeatmap/useSectorData.test.ts` | No, Wave 0 |
| RACE-03 | Session best cells get sentinel z-value -1.0 | unit (frontend) | same | No, Wave 0 |
| RACE-03 | Personal best cells get sentinel z-value -0.5 | unit (frontend) | same | No, Wave 0 |
| RACE-03 | Missing sector data (null s1/s2/s3) produces null in z-array | unit (frontend) | same | No, Wave 0 |
| RACE-03 | Excluded laps (pit in/out, lap 1) produce null in z-array | unit (frontend) | same | No, Wave 0 |
| RACE-03 | Per-driver normalization: personal best = 0.0, worst clean = 1.0 | unit (frontend) | same | No, Wave 0 |
| RACE-03 | Zero-denominator guard: single data point driver gets personal best sentinel | unit (frontend) | same | No, Wave 0 |
| RACE-03 | Hover customdata contains raw time + delta to PB | unit (frontend) | same | No, Wave 0 |
| RACE-03 | buildLapCursorShapes returns rect shape at correct x-coordinates | unit (frontend) | same | No, Wave 0 |
| ENHANCE-04 | Progressive reveal: only laps <= currentLap included in z-matrix | unit (frontend) | same | No, Wave 0 |
| ENHANCE-04 | Rolling bests: session/personal bests computed from revealed laps only | unit (frontend) | same | No, Wave 0 |

### Sampling Rate
- **Per task commit (frontend):** `cd /home/james-turing/repos/f1-dashboard/frontend && npx vitest run src/components/SectorHeatmap/useSectorData.test.ts`
- **Per task commit (backend):** `cd /home/james-turing/repos/f1-dashboard/backend && python -m pytest tests/test_sectors.py -v`
- **Per wave merge:** Full suite for both frontend and backend
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/src/components/SectorHeatmap/useSectorData.test.ts` -- covers RACE-03 + ENHANCE-04 pure function tests
- [ ] `frontend/src/components/SectorHeatmap/useSectorData.ts` -- pure functions + hook
- [ ] `frontend/src/components/SectorHeatmap/SectorHeatmap.tsx` -- presentational component
- [ ] `backend/tests/test_sectors.py` -- sector serialization + endpoint tests

*(No new framework install needed -- vitest + jsdom + pytest already configured)*

---

## Sources

### Primary (HIGH confidence)
- `backend/services/fastf1_service.py` -- `serialize_timedelta`, `serialize_laps`, `load_session_stream` patterns; confirmed Timedelta handling
- `backend/routers/sessions.py` -- existing router pattern, query parameter style
- `backend/main.py` -- router mounting pattern (`/api` prefix), FastF1 cache initialization
- `frontend/src/types/session.ts` -- LapRow type: confirmed no sector fields exist (must come from new endpoint)
- `frontend/src/stores/sessionStore.ts` -- year, event, sessionType available for sector fetch params
- `frontend/src/components/StintTimeline/useStintData.ts` -- `computeDriverOrder` pure function
- `frontend/src/components/IntervalHistory/IntervalHistory.tsx` -- hover pattern, CJS interop, empty state
- `frontend/src/components/LapTimeChart/useLapTimeData.ts` -- outlier detection pattern (PitInTime/PitOutTime/LapNumber === 1)
- `frontend/src/components/Dashboard/Dashboard.tsx` -- integration point after IntervalHistory card
- `frontend/src/api/client.ts` -- API_BASE, fetchJson pattern for non-SSE endpoints
- `frontend/src/lib/sse.ts` -- SSE pattern (confirmed sector endpoint should NOT use SSE)

### Secondary (MEDIUM confidence)
- [Plotly.js heatmap reference](https://plotly.com/javascript/reference/heatmap/) -- z data format, colorscale, xgap/ygap, hoverongaps, connectgaps, hovertemplate
- [Plotly community: heatmap NaN handling](https://community.plotly.com/t/coloring-of-null-values-in-heatmap/30457) -- null values render as background color (no native nancolor property)
- [Plotly.js GitHub issue #3631](https://github.com/plotly/plotly.js/issues/3631) -- confirms no configurable color encoding for missing values

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and in use
- Architecture: HIGH -- patterns directly verified from existing codebase files; backend endpoint is a straightforward addition
- Backend sector extraction: HIGH -- `serialize_timedelta` already handles Timedelta conversion; `Sector1Time`/`Sector2Time`/`Sector3Time` are standard FastF1 columns (verified from FastF1 documentation)
- Frontend heatmap color algorithm: MEDIUM -- the colorscale sentinel approach is a reasonable design but the exact colorscale stop values will need visual tuning
- Plotly heatmap null handling: HIGH -- verified from official docs and community forum that null z-values render as background color
- Pitfalls: HIGH -- derived from direct reading of existing code patterns and Plotly documentation

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable stack -- Plotly, Zustand, FastAPI, FastF1 versions locked)
