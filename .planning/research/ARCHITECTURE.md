# Architecture Research

**Domain:** F1 Strategy & Analysis Dashboard — v1.1 integration into existing React+FastAPI+FastF1 stack
**Researched:** 2026-03-13
**Confidence:** HIGH (based on direct code inspection of the existing codebase; no guesses about external APIs)

---

## Context: What Already Exists

This is a subsequent-milestone document. The v1.0 architecture is fully implemented and working. All analysis below describes integration points only — what is new, what is modified, and what is left untouched.

**Existing architecture summary:**

- React 19 + Vite 8 frontend. Single Zustand store (`sessionStore.ts`) holds all shared state.
- All session data (laps, drivers, safety car periods) arrives in one SSE `complete` event via `GET /api/sessions/load`.
- `LapRow[]` is the universal data type. Every chart derives from this. Already includes: `LapNumber`, `Driver`, `Team`, `LapTime`, `Time`, `PitInTime`, `PitOutTime`, `Compound`, `TyreLife`, `Position`, `Stint`.
- Components follow the pattern: `use[Feature]Data.ts` hook (pure `useMemo` over store) + `[Feature].tsx` Plotly chart component.
- No new API endpoints were needed for v1.0 beyond session load and schedule.

---

## System Overview — v1.1 Target State

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           Browser (React + TS)                            │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────┐             │
│  │SessionSel│  │GapChart  │  │StandingsBoard│  │ReplayCtrls│            │
│  └──────────┘  └──────────┘  └──────────────┘  └──────────┘             │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │              NEW: v1.1 Analysis View Row (scrollable)              │  │
│  │  ┌───────────────┐  ┌────────────┐  ┌───────────┐  ┌──────────┐  │  │
│  │  │ StintTimeline │  │LapTimeChart│  │PositionCh.│  │SectorHeat│  │  │
│  │  └───────────────┘  └────────────┘  └───────────┘  └──────────┘  │  │
│  │  ┌──────────────────────────┐                                     │  │
│  │  │     IntervalHistory      │                                     │  │
│  │  └──────────────────────────┘                                     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                    Zustand sessionStore                            │  │
│  │  year · event · sessionType · stage · laps · drivers ·            │  │
│  │  safetyCarPeriods · selectedDrivers · currentLap · isPlaying ·    │  │
│  │  replaySpeed  [all unchanged from v1.0]                           │  │
│  └──────────────────────┬─────────────────────────────────────────┘   │
│                         │ SSE on session load (unchanged)               │
├─────────────────────────┼──────────────────────────────────────────────┤
│                    FastAPI (Python)                                       │
├─────────────────────────┼──────────────────────────────────────────────┤
│  ┌──────────────┐  ┌────┴──────────────┐  ┌──────────────────────────┐  │
│  │ /api/schedule│  │ /api/sessions/load│  │  NEW: /api/sessions/     │  │
│  │  (unchanged) │  │  SSE (unchanged)  │  │  sector-times            │  │
│  └──────────────┘  └───────────────────┘  └──────────────────────────┘  │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                fastf1_service.py                                   │  │
│  │  get_completed_events · get_session_types · serialize_laps ·       │  │
│  │  serialize_drivers · parse_safety_car_periods · load_session_stream│  │
│  │  [all unchanged]                                                   │  │
│  │  NEW: serialize_sector_times()                                     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## What Is New vs Modified vs Unchanged

### Backend

| File | Status | Change |
|------|--------|--------|
| `backend/main.py` | **Modified** | Register new `analysis` router |
| `backend/routers/sessions.py` | **Unchanged** | SSE load endpoint stays as-is |
| `backend/routers/schedule.py` | **Unchanged** | Schedule endpoints unchanged |
| `backend/routers/analysis.py` | **New** | `GET /api/sessions/sector-times` endpoint |
| `backend/models/schemas.py` | **Modified** | Add `SectorTimeRow`, `SectorTimesResponse` Pydantic models |
| `backend/services/fastf1_service.py` | **Modified** | Add `serialize_sector_times()` function |

### Frontend

| File | Status | Change |
|------|--------|--------|
| `frontend/src/components/Dashboard/Dashboard.tsx` | **Modified** | Add scrollable analysis views section below existing 2-column layout |
| `frontend/src/stores/sessionStore.ts` | **Unchanged** | No new state needed — all 5 features derive from existing `laps[]` |
| `frontend/src/types/session.ts` | **Modified** | Add `SectorTimeRow` type |
| `frontend/src/lib/api.ts` | **Modified** | Add `fetchSectorTimes()` |
| `frontend/src/components/StintTimeline/` | **New** | Chart component + `useStintData` hook |
| `frontend/src/components/LapTimeChart/` | **New** | Chart component + `useLapTimeData` hook + driver selector |
| `frontend/src/components/PositionChart/` | **New** | Chart component + `usePositionData` hook |
| `frontend/src/components/SectorHeatmap/` | **New** | Chart component + `useSectorData` hook |
| `frontend/src/components/IntervalHistory/` | **New** | Chart component + `useIntervalData` hook |

---

## Feature Integration Analysis

### 1. Stint Timeline

**Data source:** `laps[]` from Zustand store — already contains `Stint`, `Compound`, `LapNumber`, `TyreLife`, `PitInTime`.

**No new API endpoint needed.** All required data is present in the existing `LapRow` type.

**Frontend pattern:**
- `useStintData` hook: groups `laps[]` by `Driver` then by `Stint` number, extracts `[startLap, endLap, compound, tyreLifeAtStart]` per stint
- `StintTimeline` component: Plotly horizontal bar chart (`type: 'bar'`, `orientation: 'h'`), one trace per compound type, y-axis = driver abbreviations, x-axis = lap numbers
- Replay integration: optional — a vertical cursor line at `currentLap` (same pattern as `GapChart`) shows "where we are" in each stint

**Compound color mapping:** Reuse `COMPOUND_DISPLAY` from `useStandingsData.ts` (existing constant — no duplication needed, just import or extract to shared util).

**Driver ordering:** Sort by lap 1 `Position` (same approach as `useDriverList` in `useGapData.ts`).

### 2. Lap Time Chart

**Data source:** `laps[]` from Zustand store — already contains `LapTime` (seconds), `LapNumber`, `Driver`, `Compound`, `PitInTime`.

**No new API endpoint needed.**

**Frontend pattern:**
- `useLapTimeData` hook: filters laps by selected drivers (multi-select), builds one `LapTime` vs `LapNumber` series per driver
- Outlier filtering: laps where `LapTime === null` OR laps where `PitInTime !== null` (pit laps — outliers) should be hidden or visually differentiated
- `LapTimeChart` component: Plotly scatter-lines, one trace per selected driver colored by `teamColor`
- Driver selection: new `MultiDriverSelector` component (reuses the team-grouped list from `useDriverList`), or reuse the existing `DriverSelector` with multi-select mode
- Replay integration: cursor line at `currentLap` — progressive reveal pattern (`LapNumber <= currentLap`)

**Key implementation note:** `LapTime` is already serialized as `float | null` (total seconds) in `serialize_laps()` — no backend change needed.

### 3. Position Chart (Spaghetti Chart)

**Data source:** `laps[]` from Zustand store — already contains `Position`, `LapNumber`, `Driver`.

**No new API endpoint needed.**

**Frontend pattern:**
- `usePositionData` hook: builds one `Position` vs `LapNumber` trace per driver
- All drivers are shown (not user-selected) — this chart tells the whole-race story
- `PositionChart` component: Plotly scatter-lines, y-axis inverted (position 1 = top), one trace per driver colored by `teamColor`
- Replay integration: cursor line at `currentLap`, traces clipped to `LapNumber <= currentLap`

**Y-axis:** Invert with `yaxis: { autorange: 'reversed' }` in Plotly layout.

**Performance note:** 20 drivers × ~60 laps = ~1200 points. Plotly handles this trivially. No memoization concern beyond the existing pattern.

### 4. Sector Comparison Heatmap

**Data source:** FastF1 `session.laps[['Sector1Time', 'Sector2Time', 'Sector3Time']]` — these fields are NOT in the existing `LapRow` type and are NOT serialized in `load_session_stream`.

**New API endpoint required.**

**Backend changes:**
- Add `serialize_sector_times(session)` to `fastf1_service.py` — iterates `session.laps`, serializes `Sector1Time`, `Sector2Time`, `Sector3Time` (Timedelta → float seconds), `LapNumber`, `Driver`
- Add `GET /api/sessions/sector-times?year=Y&event=E&session_type=S` endpoint in new `analysis.py` router
- This endpoint uses the same session-load pattern: `asyncio.to_thread` + per-session `asyncio.Lock` from `app.state.session_locks`
- Response: `SectorTimeRow[]` — `{ driver: str, lap_number: int, s1: float | None, s2: float | None, s3: float | None }`

**Why not fold into the SSE complete payload?**
Sector times are ~3x more data per lap row than the current payload. The SSE event already transfers ~1400 rows. Adding sector fields would bloat the initial load by ~60% with data not needed until user opens the heatmap. A lazy-loaded endpoint on demand is the correct trade-off.

**Frontend pattern:**
- `useSectorData` hook: fetches sector times from new endpoint when session is loaded; computes relative pace per sector per lap (Z-score or percentile vs session best) for color mapping
- `SectorHeatmap` component: Plotly heatmap (`type: 'heatmap'`), x-axis = lap numbers, y-axis = drivers, z = relative sector pace; one heatmap per sector (S1/S2/S3) or tabbed
- Fetch trigger: `useEffect` on `year + event + sessionType` (same pattern as SSE load)
- Loading state: local `useState` in the hook — does not pollute global store

**Color scale:** Diverging color scale (green = fast relative to field, red = slow). Plotly `colorscale: 'RdYlGn'` reversed.

### 5. Interval History

**Data source:** `laps[]` from Zustand store — `Time` (session elapsed seconds), `LapNumber`, `Driver`, `Position`.

**No new API endpoint needed.**

**Frontend pattern:**
- `useIntervalData` hook: for each lap, compute gap to the car directly ahead (sorted by `Position` at that lap), using `Time` difference — the same calculation that `useStandingsData` already performs per-lap for the current replay lap
- Key insight: the full interval calculation is already implemented in `useStandingsData.ts` lines 131–139. `useIntervalData` is a generalization of that logic: run it for ALL laps, not just `currentLap`
- `IntervalHistory` component: Plotly scatter-lines, one trace per driver, y-axis = interval to car ahead (seconds), x-axis = lap number
- Driver selection: multi-select (same `MultiDriverSelector` as LapTimeChart), default to top 5 by final position to avoid visual overload
- Replay integration: cursor line at `currentLap`

---

## New Component File Structure

```
frontend/src/components/
├── StintTimeline/
│   ├── StintTimeline.tsx          # Plotly horizontal bar chart
│   └── useStintData.ts            # Derives stint groups from laps[]
│
├── LapTimeChart/
│   ├── LapTimeChart.tsx           # Plotly scatter-lines, multi-driver
│   ├── useLapTimeData.ts          # Filters/shapes lap time series
│   └── MultiDriverSelector.tsx   # Checkbox-style driver selection
│
├── PositionChart/
│   ├── PositionChart.tsx          # Plotly scatter-lines, y-axis inverted
│   └── usePositionData.ts         # All-driver position traces
│
├── SectorHeatmap/
│   ├── SectorHeatmap.tsx          # Plotly heatmap, tabbed S1/S2/S3
│   └── useSectorData.ts           # Fetches from /api/sessions/sector-times
│
└── IntervalHistory/
    ├── IntervalHistory.tsx        # Plotly scatter-lines
    └── useIntervalData.ts         # Generalizes useStandingsData interval logic

backend/
├── routers/
│   └── analysis.py                # New: GET /api/sessions/sector-times
├── models/
│   └── schemas.py                 # Modified: add SectorTimeRow
└── services/
    └── fastf1_service.py          # Modified: add serialize_sector_times()
```

---

## New API Endpoint Specification

### `GET /api/sessions/sector-times`

**Query params:** `year: int`, `event: str`, `session_type: str`

**Response model:**
```python
class SectorTimeRow(BaseModel):
    driver: str          # abbreviation e.g. "VER"
    lap_number: int
    s1: float | None     # Sector1Time total seconds, None for pit/invalid laps
    s2: float | None     # Sector2Time total seconds
    s3: float | None     # Sector3Time total seconds
```

**Response:** `list[SectorTimeRow]`

**Backend implementation notes:**
- Session must already be loaded (user arrives at this view after session load, so session will be in FastF1's disk cache). Use same `asyncio.to_thread` pattern.
- The session-level lock from `app.state.session_locks[session_key]` prevents duplicate concurrent loads.
- `Sector1Time`, `Sector2Time`, `Sector3Time` are `pd.Timedelta` in FastF1 — use existing `serialize_timedelta()` utility.
- Invalid sector times (NaT) serialize to `None`.

---

## Data Flow — New Features

### Stint Timeline, Lap Time Chart, Position Chart, Interval History

```
Session SSE complete event fires
    ↓
sessionStore.setLaps(laps, drivers, safetyCarPeriods)  [unchanged]
    ↓
Dashboard renders — v1.1 analysis row becomes visible
    ↓
use[Feature]Data hooks run useMemo over laps[]  [all client-side]
    ↓
[Feature] Plotly charts render
    ↓
Replay currentLap advances
    ↓
useMemo dependencies include currentLap → charts re-render with cursor/clip
```

No HTTP requests after session load for these four features.

### Sector Heatmap

```
Session SSE complete event fires
    ↓
sessionStore.setLaps(...)  [unchanged]
    ↓
Dashboard renders — SectorHeatmap becomes visible
    ↓
useSectorData: useEffect fires, calls fetchSectorTimes(year, event, sessionType)
    ↓
GET /api/sessions/sector-times?year=Y&event=E&session_type=S
    ↓
fastf1_service.serialize_sector_times() — session already in FastF1 disk cache
    (asyncio.to_thread → ~2s from disk cache)
    ↓
SectorTimeRow[] stored in local useSectorData state
    ↓
SectorHeatmap renders
```

The fetch for sector times is independent of the SSE load; it happens lazily when the heatmap mounts. Since the session is already cached on disk after the initial SSE load, this takes ~2s.

---

## State Management — What Changes

The Zustand `sessionStore` requires **no changes**. All five new features derive from:

| Store field | Used by |
|-------------|---------|
| `laps: LapRow[]` | Stint timeline, lap time chart, position chart, interval history |
| `drivers: DriverInfo[]` | All five (for `teamColor` and `fullName`) |
| `safetyCarPeriods: SafetyCarPeriod[]` | Optionally: SC shading on lap time chart and interval history |
| `currentLap: number` | All five (cursor line / progressive reveal) |
| `year`, `event`, `sessionType` | SectorHeatmap `useSectorData` fetch trigger |

Sector times are local state inside `useSectorData` — they do not belong in the global store because they are view-specific and lazily loaded.

---

## Dashboard Layout Change

**Current Dashboard.tsx:** Two-column grid (gap chart 3/5 + standings board 2/5), rendered when `stage === 'complete'`.

**v1.1 Dashboard.tsx:** Add a second section below the existing two-column layout. Full-width, vertically stacked, one chart per row (or two per row at large breakpoints).

```tsx
// Conceptual layout
<div className="space-y-4">
  {/* Existing v1.0 layout — unchanged */}
  <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
    <div className="lg:col-span-3">
      <DriverSelector />
      <GapChart />
    </div>
    <div className="lg:col-span-2">
      <StandingsBoard />
    </div>
  </div>

  {/* New v1.1 analysis views */}
  <StintTimeline />
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <LapTimeChart />
    <PositionChart />
  </div>
  <SectorHeatmap />
  <IntervalHistory />
</div>
```

Height: Each chart should be `h-[350px]` to `h-[400px]` (matching existing GapChart sizing pattern).

---

## Build Order

Dependencies determine build order. Sector heatmap is the only feature requiring backend work; the other four are pure frontend.

**Phase 1 — Pure frontend, no backend changes (can be built in parallel):**

1. **Stint Timeline** — Simplest chart. `useStintData` is a straightforward group-by on existing data. Good first chart to establish the analysis-row layout pattern in `Dashboard.tsx`.

2. **Position Chart** — No data transformation complexity; one trace per driver from `Position` + `LapNumber`. Validates the full-width scrollable layout.

3. **Lap Time Chart** — Requires `MultiDriverSelector` (new component). Build selector after position chart confirms layout. Pit lap filtering adds minor complexity.

4. **Interval History** — Most complex client-side logic (generalize `useStandingsData` interval math to all laps). Build last of the four pure-frontend features.

**Phase 2 — Backend + frontend:**

5. **Sector Heatmap** — Requires backend endpoint. Build after the four pure-frontend charts are working. Add `analysis.py` router, `serialize_sector_times()`, `SectorTimeRow` model, then the frontend `useSectorData` fetch + `SectorHeatmap` component.

**Rationale for this order:**
- Phases 1–4 deliver visible value immediately with zero backend risk.
- Phase 5 is isolated — its new endpoint does not interact with any existing endpoint.
- If sector times turn out to have data quality issues (NaT-heavy laps, missing sectors), this is contained to one feature and does not block the others.

---

## Architectural Patterns — New Features Follow Existing Conventions

All five new features use the same pattern already established in v1.0:

### Pattern: Data Hook + Plotly Component

**What:** Each feature is split into a `use[Feature]Data.ts` hook (pure `useMemo` over store, no side effects) and a `[Feature].tsx` component (Plotly wrapper only, reads hook result).

**Why this works here:** The same data (`laps[]`, `drivers[]`, `currentLap`) is consumed by multiple features. Hooks keep the derivation logic testable in isolation. Components stay thin.

**Example (Stint Timeline):**
```typescript
// useStintData.ts
export function useStintData() {
  const laps = useSessionStore(s => s.laps)
  const drivers = useSessionStore(s => s.drivers)
  return useMemo(() => buildStintTraces(laps, drivers), [laps, drivers])
}

// StintTimeline.tsx
export function StintTimeline() {
  const traces = useStintData()
  return <Plot data={traces} layout={stintLayout} useResizeHandler style={{ width: '100%', height: '100%' }} />
}
```

### Pattern: Cursor Line at currentLap

**What:** All replay-synchronized charts include a vertical dashed line at `currentLap`. Already established in `GapChart.tsx`.

**Apply to:** Stint timeline (shows current stint), lap time chart (shows current lap), position chart (shows current position), interval history (shows current interval).

**Not applicable to:** Sector heatmap (grid is static — all laps visible at once).

---

## Anti-Patterns to Avoid

### Anti-Pattern: Adding Sector Times to the SSE Payload

**What people might do:** Add `Sector1Time`/`Sector2Time`/`Sector3Time` to `serialize_laps()` and include them in the `complete` SSE event.

**Why it's wrong:** Sector times are three additional `float | None` values per lap row. At ~1400 rows, this adds ~30-40 KB to an already ~1.4 MB payload. More importantly, sector times are only needed when the user views the heatmap — adding them to the initial load penalizes every session load even when the heatmap is never opened.

**Do this instead:** Lazy-load via a dedicated endpoint on heatmap mount.

### Anti-Pattern: Global Store for Sector Times

**What people might do:** Add `sectorTimes: SectorTimeRow[]` to `sessionStore.ts`.

**Why it's wrong:** Sector times are view-specific data consumed only by `SectorHeatmap`. Putting them in the global store leaks view concerns into shared state, increases store complexity, and makes the store's test surface larger for no benefit.

**Do this instead:** Local `useState` inside `useSectorData`, reset when `year/event/sessionType` changes.

### Anti-Pattern: One Giant Analysis Component

**What people might do:** Build a single `AnalysisPanel.tsx` that renders all five charts.

**Why it's wrong:** Mixing five independent data derivations in one component creates tight coupling, makes each chart harder to test and reason about, and prevents independent lazy-loading.

**Do this instead:** Keep each chart in its own directory with its own hook (existing v1.0 convention).

### Anti-Pattern: Re-Running Interval Math for Every currentLap Change

**What people might do:** In `useIntervalData`, run the interval computation inside a `useMemo` that depends on `currentLap`.

**Why it's wrong:** Interval history shows all laps at once — the full time-series for all laps, not just up to `currentLap`. Running it per-lap would compute a partial dataset and throw away the rest.

**Do this instead:** Compute the full interval time-series in a `useMemo([laps, drivers])` (no `currentLap` dependency). `currentLap` is only used for the cursor line shape, not for data filtering.

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `useStintData` ↔ `sessionStore` | `useSessionStore` selector | Reads `laps`, `drivers` — no writes |
| `useLapTimeData` ↔ `sessionStore` | `useSessionStore` selector | Reads `laps`, `drivers`, `currentLap` |
| `usePositionData` ↔ `sessionStore` | `useSessionStore` selector | Reads `laps`, `drivers`, `currentLap` |
| `useIntervalData` ↔ `sessionStore` | `useSessionStore` selector | Reads `laps`, `drivers` (not currentLap for data) |
| `useSectorData` ↔ `sessionStore` | `useSessionStore` selector (year/event/sessionType) | Triggers fetch; stores result locally |
| `useSectorData` ↔ `/api/sessions/sector-times` | `fetch` via `lib/api.ts` | Lazy-loaded; abortable on unmount |
| `analysis.py` router ↔ `fastf1_service.py` | Direct Python call | `asyncio.to_thread(serialize_sector_times, session)` |
| `analysis.py` router ↔ `app.state.session_locks` | FastAPI `Request` access | Reuses existing per-session lock mechanism |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| FastF1 (sector times) | Existing `asyncio.to_thread` pattern | `session.laps[['Sector1Time','Sector2Time','Sector3Time']]` — already loaded when `laps=True` in `session.load()` |

**Key fact:** `Sector1Time`, `Sector2Time`, `Sector3Time` are part of FastF1's default laps DataFrame when `laps=True` (already the existing load flag). No additional `session.load()` call or new FastF1 configuration is needed.

---

## Shared Utility Opportunities

The following logic is currently duplicated or inline-only — v1.1 is a good time to extract:

| Utility | Currently | Extract To |
|---------|-----------|------------|
| `COMPOUND_DISPLAY` (letter + color map) | `useStandingsData.ts` | `frontend/src/lib/compounds.ts` — needed by StintTimeline and LapTimeChart |
| Interval-to-car-ahead calculation | `useStandingsData.ts` lines 131–139 | `frontend/src/lib/lapMath.ts` — needed by `useIntervalData` |
| Cursor line shape builder | Inline in `GapChart.tsx` | Extract to `frontend/src/lib/plotlyShapes.ts` — used by all 5 new charts |

These extractions are optional quality-of-life improvements, not blockers.

---

## Sources

- Direct code inspection: `backend/services/fastf1_service.py`, `backend/models/schemas.py`, `backend/routers/sessions.py`, `backend/main.py`
- Direct code inspection: `frontend/src/stores/sessionStore.ts`, `frontend/src/types/session.ts`, `frontend/src/components/GapChart/useGapData.ts`, `frontend/src/components/GapChart/GapChart.tsx`, `frontend/src/components/StandingsBoard/useStandingsData.ts`, `frontend/src/components/Dashboard/Dashboard.tsx`
- FastF1 laps DataFrame fields: https://docs.fastf1.dev/core.html#fastf1.core.Laps

---
*Architecture research for: F1 Strategy & Analysis Dashboard — v1.1 integration*
*Researched: 2026-03-13*
