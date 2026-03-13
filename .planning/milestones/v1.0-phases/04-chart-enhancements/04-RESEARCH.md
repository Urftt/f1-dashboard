# Phase 4: Chart Enhancements - Research

**Researched:** 2026-03-13
**Domain:** Plotly shapes/annotations + FastF1 track status API
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Vertical solid thin lines at each pit stop lap, thinner than the replay cursor line
- Team-colored lines — each driver's pit uses their team color (consistent with gap line segments)
- Small 3-letter driver abbreviation (e.g., "VER") rendered at the top of each pit line for quick identification
- Hover tooltip shows "VER pit — Lap 12" format
- When both drivers pit on the same lap: two side-by-side lines with slight offset so both colors are visible
- Yellow shading for both SC and VSC, differentiated by opacity — full SC gets stronger shading, VSC gets lighter
- "SC" or "VSC" text label rendered inside the shaded region, at top of chart
- Shading renders behind the gap line (background layer) — line always visible through shading
- Red flag periods: thick red vertical band at the stoppage lap with "RED" label (not a range, since the session stops and no gap data exists during the stoppage)
- Z-ordering: SC shading (back) → pit stop lines (middle) → gap line (front) → cursor (front)
- Progressive reveal: annotations only appear once the replay cursor reaches that lap (matches "no spoilers" principle)
- Scrubbing backward hides annotations beyond the current lap — future events re-hidden
- Active safety car periods grow with replay — shading extends from SC start to current lap while SC is ongoing
- Always show everything — no toggles or filters. Rely on distinct visual styles (team-colored lines vs yellow shading) for readability
- Pit lines render on top of SC shading when a pit occurs during a safety car period

### Claude's Discretion
- Exact yellow shading opacity values for SC vs VSC
- Exact red band width for red flags
- Plotly shapes vs annotations implementation choice
- How to parse FastF1 messages for SC/VSC/red flag events
- Pit line offset amount for same-lap double pits
- Driver abbreviation font size and positioning

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GAP-04 | User sees vertical annotations on laps where either driver pitted | Pit stop laps derivable from existing `laps` store data (`PitInTime !== null`); rendered as Plotly shapes of type `line` with `layer: 'above'`; progressive reveal by filtering to `lap <= currentLap` |
| GAP-05 | User sees yellow shading on laps under Safety Car or VSC | FastF1 `track_status` DataFrame (status codes `'4'`=SC, `'6'`=VSC deployed, `'7'`=VSC ending) must be parsed into lap-indexed periods on the backend; sent in SSE `complete` payload; rendered as Plotly `rect` shapes with `layer: 'below'` |
</phase_requirements>

---

## Summary

Phase 4 adds two categories of visual annotation to the existing Plotly gap chart: pit stop lines and safety car / VSC shading. Both must follow the progressive reveal contract already established by the replay cursor — annotations only materialize as the replay lap advances.

The gap chart currently constructs its `layout.shapes` array for a single cursor line. Phase 4 extends this array with additional shape objects: `type: 'line'` for pit stops and `type: 'rect'` for SC/VSC shading. The `layer` property controls z-ordering: `'below'` pushes SC shading behind data traces while pit lines and the cursor sit `'above'`. Text labels inside shapes use the `label` sub-object (Plotly.js built-in, no separate annotation needed).

Pit stop lap data is fully available in the existing frontend store (`LapRow.PitInTime !== null` indicates a pit lap). No backend changes are needed for pit stop detection — it is pure frontend logic. Safety car data requires a backend change: `session.load(messages=False)` must become `messages=True` and the `session.track_status` DataFrame must be parsed into a list of `{start_lap, end_lap, type}` objects, then included in the SSE `complete` event payload.

**Primary recommendation:** Extend the `useGapData` hook to also return `pitStopShapes` and `scShapes` arrays (both `Partial<Plotly.Shape>[]`), and spread them into `layout.shapes` in `GapChart`. Keep progressive reveal logic co-located with the existing `currentLap` filter pattern used throughout the codebase.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-plotly.js | already installed | Chart rendering with shapes/annotations | Already the chart engine; shapes API is native to Plotly layout |
| plotly.js | already installed (peer dep) | Plotly type definitions via `Plotly.Shape` | TypeScript types for `type: 'rect'`, `layer`, `label` properties |
| fastf1 | already installed | `session.track_status` DataFrame for SC/VSC data | Official F1 data source, already used everywhere |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand | already installed | Store `safetyCarPeriods` alongside `laps` | Follows existing state pattern; avoids prop drilling |
| pydantic | already installed | `SafetyCarPeriod` schema validation | Consistent with existing `LapData` schema pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `layer: 'below'` for SC rects | SVG overlay | Plotly shapes integrate with axis scaling; SVG overlay requires manual coordinate mapping |
| Plotly `label` object (built-in shape text) | Separate `annotations[]` entry | `label` keeps text co-located with shape; annotations require separate coordinate math |
| `track_status` DataFrame | `race_control_messages` + `Flag` field | `track_status` gives clean time-indexed status codes; race_control_messages require message parsing for SC vs VSC distinction |

**Installation:** No new packages required — all needed libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure

No new files needed beyond extending existing modules:

```
frontend/src/components/GapChart/
├── GapChart.tsx          # extend: spread pitShapes + scShapes into layout.shapes
├── useGapData.ts         # extend: add usePitStopShapes() and useScShapes() hooks
                          #         OR add pitShapes/scShapes to GapDataResult
frontend/src/types/session.ts        # add: SafetyCarPeriod interface
frontend/src/stores/sessionStore.ts  # add: safetyCarPeriods: SafetyCarPeriod[]

backend/services/fastf1_service.py   # add: parse_safety_car_periods()
                                     #      load messages=True, use track_status
backend/models/schemas.py            # add: SafetyCarPeriod Pydantic model
```

### Pattern 1: Extending layout.shapes with annotation shapes

**What:** Plotly's `layout.shapes` array accepts objects with `type: 'line'` or `type: 'rect'`. Shapes support a `layer` property (`'below'` | `'between'` | `'above'`) for z-ordering. A `label` sub-object adds inline text without a separate annotation entry.

**When to use:** When visual overlays must track data coordinates (axis-aligned) and respect chart scaling/pan/zoom.

**Example:**
```typescript
// Source: https://plotly.com/python/reference/layout/shapes/
// SC shading rect — layer below traces
const scRect: Partial<Plotly.Shape> = {
  type: 'rect',
  x0: startLap,
  x1: Math.min(endLap, currentLap), // progressive reveal clamp
  y0: 0,
  y1: 1,
  xref: 'x',
  yref: 'paper',             // full chart height regardless of y data range
  fillcolor: 'rgba(255, 200, 0, 0.18)',  // SC opacity (discretion)
  line: { width: 0 },
  layer: 'below',            // behind gap line traces
  label: {
    text: 'SC',
    textposition: 'top left',
    font: { color: 'rgba(255,200,0,0.7)', size: 10 },
  },
}

// Pit stop vertical line — layer above
const pitLine: Partial<Plotly.Shape> = {
  type: 'line',
  x0: pitLap,
  x1: pitLap,
  y0: 0,
  y1: 1,
  xref: 'x',
  yref: 'paper',
  line: { color: teamColor, width: 1, dash: 'solid' },
  layer: 'above',
  label: {
    text: driverAbbr,
    textposition: 'top left',
    font: { color: teamColor, size: 9 },
  },
}
```

### Pattern 2: Progressive reveal via currentLap filter

**What:** Filter shape arrays to only include events where the event lap is <= currentLap before passing to layout.shapes. For ongoing SC periods, clamp `x1` to `currentLap`.

**When to use:** Matches the existing pattern where `segments` in `useGapData` only produces data up to currentLap.

**Example:**
```typescript
// Filter pit stop shapes — only pits that have happened
const visiblePitShapes = allPitShapes.filter(
  (s) => (s as any)._lap <= currentLap
)

// SC shading — only started periods, clamped to currentLap
const visibleScShapes = allScPeriods
  .filter((period) => period.start_lap <= currentLap)
  .map((period) => ({
    ...buildScShape(period),
    x1: Math.min(period.end_lap, currentLap),  // clamp for active periods
  }))
```

### Pattern 3: Same-lap double pit offset

**What:** When both selected drivers pit on the same lap, render two lines with a small x-offset (+/- 0.15 laps) so both colors are visible and neither overlaps.

**Example:**
```typescript
const PIT_OFFSET = 0.15  // in lap units

function buildPitShape(lap: number, color: string, abbr: string, offset: number): Partial<Plotly.Shape> {
  return {
    type: 'line',
    x0: lap + offset,
    x1: lap + offset,
    y0: 0, y1: 1,
    xref: 'x', yref: 'paper',
    line: { color, width: 1 },
    layer: 'above',
    label: { text: abbr, textposition: 'top left', font: { color, size: 9 } },
  }
}
```

### Pattern 4: Backend — parsing track_status into lap-indexed periods

**What:** `session.track_status` is a time-indexed DataFrame. Convert timestamps to lap numbers using `session.laps` to find which lap each status change falls on.

**Example:**
```python
# Source: FastF1 docs — https://docs.fastf1.dev/core.html
def parse_safety_car_periods(session) -> list[dict]:
    """Convert track_status DataFrame to lap-indexed SC/VSC/red flag periods."""
    track_status = session.track_status  # columns: Time, Status, Message
    laps = session.laps

    # Build a sorted list of (lap_number, lap_start_time) for binary search
    # Use session.laps['Time'] (lap end time) as the reference
    # Status '4' = Safety Car, '6' = VSC deployed, '7' = VSC ending, '5' = Red Flag
    SC_STATUS = {'4'}
    VSC_STATUS = {'6', '7'}
    RED_STATUS = {'5'}

    periods = []
    current_period = None

    for _, row in track_status.iterrows():
        status = str(row['Status'])
        ts = row['Time']  # pd.Timedelta

        lap_num = _time_to_lap(ts, laps)  # map timestamp to nearest lap number

        if status in SC_STATUS:
            if current_period is None or current_period['type'] != 'SC':
                if current_period: periods.append(current_period)
                current_period = {'start_lap': lap_num, 'end_lap': lap_num, 'type': 'SC'}
            else:
                current_period['end_lap'] = lap_num

        elif status in VSC_STATUS:
            if current_period is None or current_period['type'] != 'VSC':
                if current_period: periods.append(current_period)
                current_period = {'start_lap': lap_num, 'end_lap': lap_num, 'type': 'VSC'}
            else:
                current_period['end_lap'] = lap_num

        elif status == '1':  # AllClear
            if current_period:
                current_period['end_lap'] = lap_num
                periods.append(current_period)
                current_period = None

        elif status in RED_STATUS:
            if current_period: periods.append(current_period)
            periods.append({'start_lap': lap_num, 'end_lap': lap_num, 'type': 'RED'})
            current_period = None

    if current_period:
        periods.append(current_period)

    return periods
```

### Anti-Patterns to Avoid

- **Storing shapes in Zustand:** Shape objects are derived/view state computed from `safetyCarPeriods` and `currentLap`. Only raw data belongs in the store; shapes are useMemo computations in the hook.
- **Calling `session.load(messages=True)` for lap data alone:** `messages=True` adds overhead. Fetch it in the existing `load_session_stream` call — don't add a second `session.load()` call.
- **Separate `annotations[]` array for pit stop labels:** Plotly shapes support `label` directly. Using a parallel annotations array doubles the bookkeeping and breaks z-ordering since annotations are always `layer: 'above'`.
- **Converting Timestamps to absolute times:** All gap chart x-axis data is lap numbers (integers). Safety car timestamps from `track_status` must be mapped to lap numbers, not used raw.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text labels on chart shapes | Separate annotation objects with manually computed coordinates | Plotly `label` object on shape | Plotly recalculates position on resize/zoom; manual coordinates break |
| Z-ordering chart layers | CSS z-index hacks or SVG manipulation | Plotly `layer: 'below'` on rect shapes | Plotly layer property is the official API; SVG hacks break on re-render |
| Track status to lap mapping | Custom time-series join logic | Binary search against `session.laps['Time']` sorted by lap end timestamp | FastF1 laps are already sorted by session time; standard range query is sufficient |

**Key insight:** Plotly shapes with the `label` property replace the entire Plotly `annotations` API for inline chart labels. Use shapes exclusively.

---

## Common Pitfalls

### Pitfall 1: `layer` TypeScript type mismatch

**What goes wrong:** `layer: 'below'` may be typed as `string` in the `Partial<Plotly.Shape>` type definition in older `@types/plotly.js` versions, causing TypeScript errors or requiring a cast.

**Why it happens:** The `@types/plotly.js` type for `layer` is an enum string union. The value `'between'` was added later.

**How to avoid:** Use `layer: 'below' as any` if the type complains, or verify the installed `@types/plotly.js` version supports `'below'`. The cursor line in `GapChart.tsx` already uses `yref: 'paper' as const` as the precedent for such casts.

**Warning signs:** TypeScript error "Type 'string' is not assignable to type 'above'".

### Pitfall 2: track_status timestamps are pd.Timedelta (not absolute times)

**What goes wrong:** `track_status['Time']` is a session-elapsed `pd.Timedelta` relative to session start — same coordinate system as `laps['Time']` (lap end timestamp). If treated as absolute wall-clock time, lap mapping will fail silently.

**Why it happens:** FastF1 normalizes all time data to session-elapsed Timedelta to enable direct comparison. This is consistent with `LapRow.Time` already serialized as `total_seconds()` float.

**How to avoid:** Map `track_status` timestamps to lap numbers using the same `serialize_timedelta()` total_seconds conversion already used for laps. The lap number for a status change is the lap whose `Time` (end) first exceeds the status timestamp.

**Warning signs:** Safety car periods appearing several laps off from actual events.

### Pitfall 3: Progressive reveal — shapes not hiding on backward scrub

**What goes wrong:** If `allPitShapes` is computed once (without `currentLap` in the dependency array), backward scrubbing won't hide future pit stop lines.

**Why it happens:** `useMemo` caches based on its dependency array. If `currentLap` is omitted, the memo never recomputes on scrub.

**How to avoid:** `currentLap` MUST be in the `useMemo` deps for any shapes that filter by `lap <= currentLap`. Follow the pattern in `useGapData` where `laps` and `selectedDrivers` are explicit deps.

**Warning signs:** Pit lines for future laps appear as soon as data loads, spoiling upcoming strategy.

### Pitfall 4: SC rect `x1` exceeding `currentLap` during active period

**What goes wrong:** If an SC period has no end (still active when replay stops), the rect's `x1` remains at `end_lap` which may be the final lap of the race — revealing that the SC ran to the end.

**Why it happens:** The "growing with replay" requirement means `x1` must be clamped to `Math.min(period.end_lap, currentLap)` at render time.

**How to avoid:** Always clamp `x1 = Math.min(period.end_lap, currentLap)` in the shape builder. This is a frontend concern — the backend sends the full period, the frontend reveals it progressively.

### Pitfall 5: `messages=True` changes FastF1 load behavior

**What goes wrong:** Setting `messages=True` in `session.load()` fetches additional data from the F1 API. This slightly increases load time and may cause failures for older sessions (pre-2018) that lack message data.

**Why it happens:** FastF1 queries additional API endpoints when `messages=True`.

**How to avoid:** Keep `messages=False` (unchanged). Use `session.track_status` instead — it is populated when `laps=True` (already set) and does not require `messages=True`. Verify: `session.track_status` is available after `session.load(laps=True)`.

**Warning signs:** Increased load times or errors on sessions loaded with `messages=True` for old seasons.

---

## Code Examples

Verified patterns from official sources:

### Z-ordered shapes array (combining all shape types)
```typescript
// Source: GapChart.tsx pattern + https://plotly.com/python/reference/layout/shapes/
const layout: Partial<Plotly.Layout> = {
  // ...existing config...
  shapes: [
    ...scShapes,          // layer: 'below' — rendered first (furthest back)
    ...pitShapes,         // layer: 'above' — rendered over SC shading
    ...cursorShape,       // layer: 'above' — replay cursor (already exists)
  ],
}
```

### Rect shape with yref: 'paper' for full chart height
```typescript
// Source: https://plotly.com/python/reference/layout/shapes/
const scShape: Partial<Plotly.Shape> = {
  type: 'rect',
  x0: 12,
  x1: 17,         // clamped to currentLap for active periods
  y0: 0,
  y1: 1,
  xref: 'x',
  yref: 'paper',  // full-height regardless of y data range — same as cursor line
  fillcolor: 'rgba(255, 200, 0, 0.18)',  // SC: stronger; VSC: lighter
  line: { width: 0 },
  layer: 'below' as any,
  label: {
    text: 'SC',
    textposition: 'top left',
    font: { color: 'rgba(255, 200, 0, 0.7)', size: 10 },
  },
}
```

### FastF1 track_status access (after session.load with laps=True)
```python
# Source: https://docs.fastf1.dev/core.html
# track_status is populated when laps=True; messages=True not required
track_status = session.track_status
# Returns DataFrame with columns: Time (pd.Timedelta), Status (str), Message (str)
# Status codes:
#   '1' = Track clear / AllClear
#   '2' = Yellow flag
#   '4' = Safety Car
#   '5' = Red Flag
#   '6' = Virtual Safety Car deployed
#   '7' = Virtual Safety Car ending
```

### Map track_status timestamp to lap number
```python
def _time_to_lap(ts: pd.Timedelta, laps: pd.DataFrame) -> int:
    """Return the lap number whose end time first exceeds ts.
    Falls back to max lap if ts is beyond all recorded laps."""
    ts_seconds = float(ts.total_seconds())
    for _, lap in laps.sort_values('LapNumber').iterrows():
        lap_end = serialize_timedelta(lap.get('Time'))
        if lap_end is not None and lap_end >= ts_seconds:
            return int(lap['LapNumber']) if lap['LapNumber'] is not None else 1
    # Beyond last lap
    max_lap = laps['LapNumber'].max()
    return int(max_lap) if pd.notna(max_lap) else 1
```

### SSE complete payload extension
```python
# backend/services/fastf1_service.py
yield ServerSentEvent(
    data=json.dumps({
        "laps": laps_data,
        "drivers": drivers_data,
        "safetyCarPeriods": safety_car_data,  # new field
    }),
    event="complete",
)
```

```typescript
// frontend/src/lib/sse.ts — onmessage handler update
} else if (ev.event === 'complete') {
  const data = JSON.parse(ev.data) as {
    laps: Parameters<SessionStore['setLaps']>[0]
    drivers?: Parameters<SessionStore['setLaps']>[1]
    safetyCarPeriods?: SafetyCarPeriod[]
  }
  store.setLaps(data.laps, data.drivers, data.safetyCarPeriods)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plotly `annotations[]` for inline chart text | Plotly `shapes[].label` object | Plotly.js v2.x | Shapes with labels avoid coordinate duplication; z-ordering is automatic |
| Separate `layer: 'above'` only (default) | Explicit `layer: 'below'` for background rects | Plotly.js v1.2+ | Allows background shading without obscuring data traces |

**Deprecated/outdated:**
- Using `annotations[]` for chart shape labels: superseded by `shapes[].label` — use `label` inside the shape object directly.

---

## Open Questions

1. **Does `session.track_status` populate with `laps=True` alone (no `messages=True`)?**
   - What we know: The CONTEXT.md notes that `fastf1_service.py` line 184 has `messages=False` and says it "needs to be enabled." However, FastF1 docs suggest `track_status` is separate from `race_control_messages`.
   - What's unclear: Whether `track_status` requires `messages=True` or is loaded with `laps=True`.
   - Recommendation: Test empirically during Wave 0. If `session.track_status` is empty when `messages=False`, enable `messages=True`. If populated, no change needed. The Wave 0 task should print `len(session.track_status)` to confirm.

2. **Plotly shape `label` property availability in installed `@types/plotly.js`**
   - What we know: The `label` sub-object on shapes is documented in Plotly.js reference; it was added in a relatively recent version.
   - What's unclear: Whether the installed `@types/plotly.js` includes `label` in the `Shape` interface.
   - Recommendation: If TypeScript rejects `label`, cast the shape object as `any` (same pattern used for `yref: 'paper' as const` in the cursor shape). Alternative: use a Plotly `annotations[]` entry for labels as a fallback.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend) — see `backend/tests/` |
| Config file | `backend/conftest.py` (importlib mode via `backend/pytest.ini` or pyproject.toml) |
| Quick run command | `cd /Users/luckleineschaars/repos/f1-dashboard/backend && uv run pytest tests/test_sessions.py -x -q` |
| Full suite command | `cd /Users/luckleineschaars/repos/f1-dashboard/backend && uv run pytest -x -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GAP-04 | `parse_safety_car_periods` returns correct lap ranges for SC/VSC events from mock track_status | unit | `uv run pytest tests/test_sessions.py::TestSafetyCarParsing -x` | ❌ Wave 0 |
| GAP-04 | SC period timestamps map to correct lap numbers | unit | `uv run pytest tests/test_sessions.py::TestSafetyCarParsing::test_time_to_lap_mapping -x` | ❌ Wave 0 |
| GAP-04 | SSE `complete` event includes `safetyCarPeriods` field | unit | `uv run pytest tests/test_sessions.py::TestSSEEndpoint::test_sse_complete_event_contains_safety_car_periods -x` | ❌ Wave 0 |
| GAP-05 | Frontend pit stop shapes filter to `lap <= currentLap` | manual-only | N/A — view layer logic, no backend | ❌ Wave 0 |
| GAP-05 | SC rect `x1` clamps to `currentLap` for active periods | manual-only | N/A — Plotly rendering, visual verification | N/A |

### Sampling Rate
- **Per task commit:** `cd /Users/luckleineschaars/repos/f1-dashboard/backend && uv run pytest tests/test_sessions.py -x -q`
- **Per wave merge:** `cd /Users/luckleineschaars/repos/f1-dashboard/backend && uv run pytest -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_sessions.py` — extend with `TestSafetyCarParsing` class covering `parse_safety_car_periods()` and `_time_to_lap()` functions
- [ ] Verify `session.track_status` availability with `laps=True` / confirm whether `messages=True` required — print check in Wave 0 task

*(Frontend shape rendering has no automated test; verified visually via Playwright during verify-work phase.)*

---

## Sources

### Primary (HIGH confidence)
- FastF1 core docs — https://docs.fastf1.dev/core.html — `session.track_status` property, `race_control_messages` property, `messages=True` parameter
- FastF1 API reference — https://docs.fastf1.dev/api.html — `track_status_data()` status codes: '1'=clear, '2'=yellow, '4'=SC, '5'=red, '6'=VSC deployed, '7'=VSC ending
- Plotly shapes reference — https://plotly.com/python/reference/layout/shapes/ — `layer` property values, `label` sub-object with `textposition` and `font`, `yref: 'paper'` behavior
- Existing codebase — `GapChart.tsx`, `useGapData.ts`, `sessionStore.ts`, `fastf1_service.py`, `session.ts` — all read directly

### Secondary (MEDIUM confidence)
- Plotly Python shapes guide — https://plotly.com/python/shapes/ — `type: 'rect'` with `fillcolor`, `opacity`, `layer: 'below'` for background shading
- Plotly JavaScript shapes — https://plotly.com/javascript/shapes/ — confirms `layer` property is in JS API (same as TypeScript)

### Tertiary (LOW confidence)
- WebSearch summary of `race_control_messages` columns (Flag, Category, Message fields) — cross-referenced with FastF1 API docs (HIGH) for status code meanings

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; no new dependencies
- Architecture: HIGH — Plotly shapes API verified in official docs; code patterns read directly from existing source
- FastF1 track_status parsing: MEDIUM — status codes verified in official docs; `messages=True` vs `laps=True` availability is an open question requiring empirical test
- Pitfalls: HIGH — derived from direct code reading and official Plotly type system behavior

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable APIs — FastF1 and Plotly change slowly)
