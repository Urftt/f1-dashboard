# Project Research Summary

**Project:** F1 Strategy & Analysis Dashboard — v1.1 (Five New Analysis Views)
**Domain:** F1 race data visualization — adding analysis charts to existing React + FastAPI + FastF1 dashboard
**Researched:** 2026-03-13
**Confidence:** HIGH

## Executive Summary

This is a subsequent-milestone research effort, not a greenfield project. The existing v1.0 stack (React 19 + Vite 8, Plotly.js 3.4.0, FastAPI, FastF1, Zustand) is fully sufficient for all five new charts. No new packages are needed. Every chart type — horizontal bar (stint timeline), scatter/line (lap time, position, interval history), and heatmap (sector comparison) — is covered by the Plotly.js version already installed. The only data gap is sector times (`Sector1Time`, `Sector2Time`, `Sector3Time`), which FastF1 exposes in its default laps DataFrame but are not yet included in the existing `serialize_laps()` backend function or API response. One backend endpoint must be added for the sector heatmap; the other four features are pure frontend work on data already in the Zustand store.

The recommended implementation approach follows the v1.0 convention strictly: each chart lives in its own component directory with a `use[Feature]Data.ts` hook (pure `useMemo` over store data) and a thin Plotly wrapper component. This separation is not optional — it is the performance architecture. The critical insight across all five charts is that chart data must be memoized on `[laps]` only, while the replay cursor is a separate `shapes` entry derived from `currentLap`. Any component that recomputes its Plotly `data` array on every replay tick will cause visible jank when five charts are open simultaneously.

The top risks are performance (position chart with 20 traces, heatmap re-renders on replay ticks, cascade of seven components watching `currentLap`) and data quality (stint compound `None` values from FastF1 v3.6.0+, pit lap spikes dominating the lap time chart Y-axis, interval history computed from a private FastF1 API that could break silently). All three risk categories have known preventions. The key discipline is to establish the memoization pattern on the first chart built — it carries to all subsequent charts for free.

---

## Key Findings

### Recommended Stack

No dependency changes are required for v1.1. The existing `plotly.js@^3.4.0` covers all five chart types natively. The `heatmap` trace type (not `heatmapgl`, which was removed in Plotly.js v3) handles the sector grid at 20 drivers × 58 laps × 3 sectors. The position chart should use `scattergl` (WebGL) rather than `scatter` to handle 20 concurrent traces during replay without frame drops — this is a one-word prop change but must be chosen at build time, not retrofitted.

FastF1 `>=3.5.3` (already installed) exposes all required data fields via the public `session.laps` DataFrame: `Stint`, `Compound`, `TyreLife`, `Sector1/2/3Time`, `Position`, `Time`. The one non-obvious constraint: `IntervalToPositionAhead` is not in the public Laps API and must be derived from `Time` column arithmetic per lap.

**Core technologies:**
- Plotly.js `^3.4.0`: all five chart types — no new charting library needed
- react-plotly.js `^2.6.0`: same `<Plot data={...} layout={...} />` API already used by GapChart
- FastF1 `>=3.5.3`: all required columns confirmed public; sector times available when `laps=True` (existing load flag)
- pandas `>=2.3.0`: `groupby(['Driver','Stint','Compound']).agg()` is the correct stint aggregation pattern
- Zustand (existing store, unchanged): all five features derive from existing `laps[]`, `drivers[]`, `safetyCarPeriods[]`, `currentLap`, `selectedDrivers`

### Expected Features

**Must have — table stakes for v1.1 launch:**
- Stint timeline (horizontal bar chart) — the canonical strategy visualization; every F1 analytics tool has this
- Lap time chart (scatter per driver) — primary pace and degradation view; must filter pit/SC laps to be readable
- Position chart (spaghetti chart, y-axis inverted) — shows overtakes and strategy plays across the race
- Sector comparison heatmap — specialist but widely expected in F1 data tools; color-coded delta to session best per sector
- Interval history chart (gap-to-car-ahead) — not on most competitor tools; answers "was driver X ever in DRS range?"
- Replay cursor integration on all new charts — positions new charts as replay companions, not static analysis

**Should have — differentiators (add if time allows during phases):**
- Driver visibility toggle on lap time chart and position chart (20 lines without filtering is noise)
- Safety car shading on all new time-series charts (reuses existing `safetyCarPeriods` data; zero new data)
- Stint pace trend lines (per-stint linear regression overlay on lap time chart)

**Defer to v2+:**
- Qualifying sector heatmap (different session structure; race heatmap first)
- Fuel-corrected lap times (not available via FastF1; misleading without actual fuel load data)
- Telemetry side-by-side drill-down (completely different data model and pipeline)
- Live data interval history via OpenF1

**Anti-features (do not build):**
- Real-time chart re-rendering as replay advances — cursor-only updates are correct; full re-renders are not
- Side-by-side telemetry (speed/throttle/brake trace) — separate data model, separate pipeline, out of scope

### Architecture Approach

The v1.0 architecture requires minimal extension. The Zustand store is unchanged. The existing SSE endpoint is unchanged. Four of the five new charts require zero new API endpoints. Each new chart follows the established `use[Feature]Data.ts` + `[Feature].tsx` pattern. The only structural addition is a new `analysis.py` FastAPI router with one endpoint (`GET /api/sessions/sector-times`) for the heatmap's lazy-loaded sector data, and a corresponding `serialize_sector_times()` function in `fastf1_service.py`.

**Major new components (all following v1.0 conventions):**
1. `StintTimeline/` — `useStintData` groups `laps[]` by `(Driver, Stint)`, builds horizontal bar traces per compound
2. `LapTimeChart/` — `useLapTimeData` filters out pit/SC laps, builds scatter traces per driver; includes `MultiDriverSelector`
3. `PositionChart/` — `usePositionData` builds `scattergl` traces per driver, y-axis inverted
4. `IntervalHistory/` — `useIntervalData` generalizes the interval math already in `useStandingsData.ts` to all laps
5. `SectorHeatmap/` — `useSectorData` fetches `/api/sessions/sector-times` lazily, stores result in local state (not global store)
6. `analysis.py` (backend) — new router with `GET /api/sessions/sector-times`; session already in FastF1 disk cache after initial SSE load
7. `fastf1_service.serialize_sector_times()` — converts `Timedelta` sector columns to float seconds via existing `serialize_timedelta()` util

**Shared utility extractions recommended during v1.1:**
- `COMPOUND_DISPLAY` color map → `lib/compounds.ts` (currently inline in `useStandingsData.ts`)
- Interval-to-car-ahead math → `lib/lapMath.ts` (currently inline in `useStandingsData.ts` lines 131–139)
- Cursor line shape builder → `lib/plotlyShapes.ts` (currently inline in `GapChart.tsx`)

### Critical Pitfalls

1. **Interval history built on `fastf1.api` private API** — `IntervalToPositionAhead` is not in the public Laps DataFrame; `fastf1.api` is explicitly private and breaks silently on version bumps. Compute from `Time` + `Position` columns per lap (same pattern as existing gap chart).

2. **Stint compound `None`/`UNKNOWN` fragmentation** — Since FastF1 v3.6.0, some laps correctly show `None` compound; grouping by compound changes (not the `Stint` integer) fragments stints into spurious bars. Use `groupby(['Driver', 'Stint'])` as ground truth; derive compound as the mode of non-null values within the stint group.

3. **Position chart performance collapse with 20 `scatter` traces** — Plotly.js trace-count overhead causes visible jank at 2x replay speed. Use `scattergl` (WebGL) from the start; memoize all 20 traces on `[laps]`; only the cursor shape reads `currentLap`.

4. **Sector heatmap re-renders on every replay tick** — If `useSectorData` or `SectorHeatmap` subscribes to `currentLap`, the heatmap redraws on every tick. Memoize `z` matrix on `[laps]`; represent current-lap highlight as a `layout.shapes` update only.

5. **Lap time chart Y-axis dominated by pit lap spikes** — Raw `LapTime` includes 20–40s pit laps and 10–30s SC laps; degradation signal becomes invisible. Explicitly exclude inlaps (`PitInTime != null`), outlaps (`PitOutTime != null`), and SC laps (cross-reference `safetyCarPeriods` from store). Do not use `pick_quicklaps()` — it silently drops valid slow laps.

6. **Cascade re-renders across all five charts on every replay tick** — Seven components watching `currentLap` simultaneously, each triggering Plotly diffs, causes cumulative jank. Establish cursor-separation pattern on the first chart: data array memoized on `[laps]`, cursor shape on `[currentLap]`. This must be set up on chart 1 and followed for all subsequent charts.

---

## Implications for Roadmap

Build order is driven by two constraints: (1) sector heatmap requires a new backend endpoint while the other four features do not, and (2) the memoization/cursor-separation pattern must be established on the first chart built so it propagates to all subsequent charts at no additional cost.

### Phase 1: Foundation — Stint Timeline + Dashboard Layout

**Rationale:** Simplest chart data-wise (straightforward group-by on existing `laps[]`); establishes the new analysis-row layout in `Dashboard.tsx`; extracts shared utilities (`COMPOUND_DISPLAY`, cursor line shape builder) that all subsequent charts reuse; validates the memoization pattern that prevents performance regressions on every later chart.

**Delivers:** Visible strategy timeline for any loaded race; shared `lib/compounds.ts` and `lib/plotlyShapes.ts` utilities; scrollable analysis section in Dashboard.

**Addresses:** Stint timeline (table stakes), compound color coding (table stakes), replay cursor integration (differentiator).

**Avoids:** Stint fragmentation from `None` compounds — use `Stint` integer as group-by ground truth; unit test a driver with a mid-stint `None` compound lap before shipping.

**Research flag:** Standard patterns — no `/gsd:research-phase` needed. FastF1 official docs have an exact stint aggregation example; Plotly horizontal bar with `base` is documented.

---

### Phase 2: Lap Time Chart + Position Chart

**Rationale:** Both charts are pure frontend (no new API), both use existing `laps[]`, and together they tell the core race pace + race order story. Building them together allows `MultiDriverSelector` to be shared. Position chart validates `scattergl` performance under replay before the more complex interval history chart is added.

**Delivers:** Per-driver lap time scatter with compound coloring and pit/SC filtering; 20-driver position spaghetti chart with inverted y-axis; `MultiDriverSelector` reusable component; `lib/lapMath.ts` utility extracted for use in Phase 3.

**Addresses:** Lap time chart (table stakes), position chart (table stakes), driver visibility toggle (differentiator), safety car shading on new charts (differentiator).

**Avoids:** Lap time Y-axis spike problem (explicit inlap/outlap/SC filtering before plotting); position chart jank (`scattergl` from the start, profiled before adding more charts).

**Research flag:** Standard patterns — no `/gsd:research-phase` needed. Filtering logic is explicit (no statistical methods); `scattergl` is a documented WebGL trace type.

---

### Phase 3: Interval History Chart

**Rationale:** Most complex client-side logic of the pure-frontend charts (per-lap position-ordered join to compute gap-to-car-ahead). Building after position chart means `lib/lapMath.ts` is already extracted and the cursor pattern is established. Isolating this complexity into its own phase keeps Phase 2 focused.

**Delivers:** Gap-to-car-ahead time-series for selected drivers; DRS window reference line (1.0s); full interval history tied to replay cursor; spot-check validation of gap values against a known broadcast.

**Addresses:** Interval history (key differentiator — unique to this tool among most competitor tools).

**Avoids:** Use of `fastf1.api` private API — compute from `Time` + `Position` only. Validate calculation against one known race broadcast gap (e.g., lap 20 of 2023 Hungarian GP) before shipping.

**Research flag:** No deeper research needed — derivation approach confirmed in FastF1 GitHub issues; mirrors existing gap chart implementation.

---

### Phase 4: Sector Comparison Heatmap (Backend + Frontend)

**Rationale:** The only feature requiring backend changes. Isolated last to prevent backend risk from blocking the four pure-frontend charts. The new endpoint does not interact with any existing endpoint, making it safe to add independently.

**Delivers:** Per-driver per-lap per-sector time heatmap with delta coloring; lazy-loaded endpoint (sector data only fetched when heatmap mounts); backend `SectorTimeRow` Pydantic model; `serialize_sector_times()` service function.

**Addresses:** Sector comparison heatmap (table stakes), driver selector for heatmap rows.

**Avoids:** Bloating the SSE payload with sector times (lazy endpoint is correct); sector `NaT` serialization bug (must pass through `serialize_timedelta()`, not direct pandas serialization); heatmap re-renders on replay tick (memoize `z` matrix on `[laps]`); defaulting to 20 drivers in heatmap (show top 8, let user expand).

**Research flag:** No deeper research needed — FastF1 sector time columns are confirmed public; `asyncio.to_thread` pattern is established; session will already be in disk cache after the initial SSE load.

---

### Phase Ordering Rationale

- Phases 1–3 deliver high-value visualizations with zero backend risk; they can ship incrementally and be validated independently.
- Phase 4 is isolated: its one new endpoint does not modify any existing endpoint or data model shared with the four working charts.
- Shared utility extraction (compounds, lapMath, plotlyShapes) is front-loaded into Phases 1–2 so every subsequent phase benefits without extra work.
- The memoization/cursor-separation performance pattern is established in Phase 1 (simplest chart) and carried forward — retrofitting it across five charts at the end would be costly.

### Research Flags

All four phases use standard, well-documented patterns. No phase requires `/gsd:research-phase` before execution:
- **Phase 1:** FastF1 official docs have an exact stint aggregation example; Plotly horizontal bar with `base` is in the reference.
- **Phase 2:** Standard Plotly scatter patterns; `scattergl` is documented; `MultiDriverSelector` is a checkbox list.
- **Phase 3:** Derivation approach confirmed in FastF1 GitHub issues; mirrors existing gap chart implementation in codebase.
- **Phase 4:** Plotly heatmap with diverging colorscale is documented; `asyncio.to_thread` pattern is established in codebase.

The main validation needed is empirical (not research): check interval calculations against known broadcast gaps after Phase 3, and profile replay performance after adding the first two charts in Phase 2.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All Plotly.js trace types verified against official docs; FastF1 columns verified against docs.fastf1.dev; `heatmapgl` removal in v3 confirmed. No new dependencies. |
| Features | HIGH | FastF1 data availability verified per-feature against official docs and codebase inspection. Sector time absence from existing API response confirmed by code inspection of `serialize_laps()`. UX patterns cross-referenced against TracingInsights, PITWALL, FastF1 example gallery. |
| Architecture | HIGH | Based on direct codebase inspection, not inference. All integration points (`serialize_laps`, Zustand store fields, SSE endpoint) inspected against actual source files. |
| Pitfalls | HIGH | Each critical pitfall backed by a FastF1 GitHub issue or Plotly.js issue with a direct link and evidence. Compound `None` pitfall is version-specific (FastF1 v3.6.0+) and documented in the bug tracker. |

**Overall confidence:** HIGH

### Gaps to Address

- **Interval calculation accuracy:** The derivation from `Time` + `Position` columns is the correct approach (confirmed in FastF1 issues), but absolute values should be spot-checked against one known broadcast gap before Phase 3 is considered complete. The 2023 Hungarian GP lap 20 gap between VER and HAM is the suggested test case (referenced in PITFALLS.md).
- **Sector time NaT density:** FastF1 produces `NaT` for outlap sector 1 and some SC laps. The heatmap design assumes grey "no data" cells, but the actual density of `NaT` values across a typical race has not been measured. If more than ~20% of cells are `NaT`, the UX design should adapt. Check during Phase 4 implementation with one sample race before shipping.
- **Plotly heatmap render time at 20 drivers:** Community reports of slow heatmap renders apply to much larger grids (>1000 cells). The 20×58×3 = 3480-cell grid should be fine, but first-render time should be profiled in Phase 4 before adding the replay cursor interaction.
- **Dashboard scroll UX with five new charts:** The proposed layout (stint timeline full-width, 2-column lap time + position, heatmap full-width, interval history) has not been user-tested. Implement labeled grouping sections — "Tire Strategy", "Race Order", "Sector Analysis" — to prevent disorienting infinite scroll.

---

## Sources

### Primary (HIGH confidence)
- https://plotly.com/javascript/reference/bar/ — `base` property for horizontal Gantt-style bars confirmed
- https://plotly.com/javascript/reference/heatmap/ — diverging colorscale, `zmid` property confirmed
- https://plotly.com/javascript/version-3-changes/ — `heatmapgl` removed in v3; `heatmap` is correct replacement
- https://docs.fastf1.dev/core.html — `Stint`, `Compound`, `TyreLife`, `Sector1/2/3Time`, `Position` confirmed as public Laps DataFrame columns
- https://docs.fastf1.dev/gen_modules/examples_gallery/plot_strategy.html — official FastF1 stint aggregation pattern using `groupby(['Driver','Stint','Compound'])`
- https://github.com/theOehrly/Fast-F1/issues/735 — `IntervalToPositionAhead` confirmed NOT in public Laps API; manual derivation is the documented workaround
- https://github.com/theOehrly/Fast-F1/issues/768 — compound `None` bug introduced in FastF1 v3.6.0; use `Stint` integer as ground truth
- https://github.com/theOehrly/Fast-F1/issues/779 — wrong tyre compound (2025 Belgian GP intermediate/medium mislabelling)
- https://github.com/plotly/plotly.js/issues/3227 — Plotly performance collapses with trace count, not point count
- Direct codebase inspection: `backend/services/fastf1_service.py`, `backend/models/schemas.py`, `backend/routers/sessions.py`, `frontend/src/stores/sessionStore.ts`, `frontend/src/types/session.ts`, `frontend/src/components/GapChart/`, `frontend/src/components/StandingsBoard/useStandingsData.ts`, `frontend/src/components/Dashboard/Dashboard.tsx`

### Secondary (MEDIUM confidence)
- https://tracinginsights.com/ — sector heatmap and lap time chart UX patterns reference
- https://f1-visualization.vercel.app/ — position chart inversion convention and hover behavior reference
- https://github.com/WarmBed/PITWALL — sector comparison color conventions (purple/green best marking)
- https://community.plotly.com/t/heatmap-is-slow-for-large-data-arrays/21007 — heatmap render performance community report
- https://python.plainenglish.io/visualizing-f1-2025-with-python-30-charts-that-reveal-hidden-patterns-91c5a81f44f6 — sector time heatmap implementation reference
- https://medium.com/formula-one-forever/fastf1-playbook-10-notebooks-to-master-formula-1-data-in-2026-23c347a462b3 — position chart and lap time chart patterns

---
*Research completed: 2026-03-13*
*Ready for roadmap: yes*
