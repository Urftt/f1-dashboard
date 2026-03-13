# Pitfalls Research

**Domain:** F1 Strategy & Analysis Views — v1.1 addition to existing React + FastAPI + FastF1 dashboard
**Researched:** 2026-03-13
**Confidence:** HIGH (FastF1 findings verified against official docs and GitHub issues; Plotly findings verified against plotly.js issues and community forum; integration findings from existing codebase inspection)

---

## Critical Pitfalls

### Pitfall 1: Interval History Cannot Be Built from a Standard Public FastF1 API Column

**What goes wrong:**
Developers assume FastF1 exposes `IntervalToPositionAhead` or `GapToLeader` as lap-level columns they can read directly. Neither column exists in the public API. The only access path is through `fastf1.api`, which is explicitly marked as private and "potentially removed or changed in future releases." Any code that calls `fastf1.api` directly will break silently on the next FastF1 version bump.

**Why it happens:**
The field names `IntervalToPositionAhead` and `GapToLeader` appear in FastF1 GitHub issues and discussions, so developers assume they are queryable columns. They are internal timing stream fields that FastF1 uses for alignment — not exposed via the public `session.laps` DataFrame.

**How to avoid:**
Compute interval history manually from data already in the codebase: the `Time` column (session time at lap end) and the `Position` column. Sort drivers by `Position` on each lap, then compute the delta in `Time` between consecutive positions. This is exactly how the existing gap chart works — use the same pattern. The existing `serialize_laps` function already serializes `Time` and `Position` per lap, so no new backend data is needed for most cases. Handle position ties and pit laps explicitly.

```python
# Interval = session time difference between this driver and the car in position - 1
# For each lap, sort by Position, then diff the Time column
laps_at_lap_n = session.laps[session.laps['LapNumber'] == n].sort_values('Position')
laps_at_lap_n['IntervalToAhead'] = laps_at_lap_n['Time'].diff()
```

**Warning signs:**
- Any `import fastf1.api` in interval calculation code
- Interval values showing `None` or unexpectedly flat lines for all cars
- TypeError when FastF1 version is bumped

**Phase to address:**
Phase implementing interval history — design computation before writing frontend. Verify the calculation against a known race broadcast gap (e.g., lap 20 Hungarian GP 2023 showed HAM ~1.2s behind VER; check your numbers match).

---

### Pitfall 2: Stint Timeline Breaks on UNKNOWN or None Compound Values

**What goes wrong:**
Stint timeline visualizations filter for `Compound in ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET']`. Since FastF1 v3.6.0, compound backfilling was corrected — laps that previously showed a compound now correctly show `None` when the raw stream had no compound data. The 2025 Belgian GP also had intermediate stints incorrectly labelled as medium. Code that assumes `Compound` is always a known string will silently drop stints or crash on `None`.

**Why it happens:**
The existing `serialize_laps` function already handles `None` compound (returns `null` in JSON) — the bug happens on the frontend or in backend aggregation when mapping compound values to colors without a null guard. Visualizing stints requires grouping consecutive laps with the same compound, and if a lap in the middle of a stint has `None` compound, the stint gets split into fragments.

**How to avoid:**
In backend stint aggregation: treat `None` as "carry forward from previous lap in same stint" using the `Stint` integer (which is always populated). Group by `(Driver, Stint)` first, then derive compound as the mode or first non-null value within that group. Never group only by compound change — use the `Stint` column as the authoritative stint boundary.

```python
# Correct: use Stint column as ground truth for boundaries
stints = laps.groupby(['Driver', 'Stint']).agg(
    compound=('Compound', lambda x: x.dropna().mode().iloc[0] if x.dropna().any() else 'UNKNOWN'),
    start_lap=('LapNumber', 'min'),
    end_lap=('LapNumber', 'max'),
    laps=('LapNumber', 'count'),
)
```

**Warning signs:**
- Stint bars are fragmented for some drivers but not others
- Some drivers show more stints than the actual race had pit stops
- `None` or `'nan'` appearing in the compound color mapping, causing a KeyError

**Phase to address:**
Phase implementing stint timeline — write a backend aggregation test covering: (1) a driver with a None-compound lap in the middle of a stint, (2) a driver who retires before their final stint completes.

---

### Pitfall 3: Position Chart with 20 Drivers as 20 Separate Traces Causes Plotly Performance Collapse

**What goes wrong:**
A straightforward implementation of the position chart creates one Plotly trace per driver (20 traces × ~58 laps each = 1,160 data points total). This sounds small, but Plotly.js performance scales with trace count, not total point count. Benchmarks show rendering time going from ~80ms at 1 trace to ~650ms at 1,000 traces — and re-renders on every replay tick at 1 trace/driver trigger full Plotly diffs for all 20 traces simultaneously. At 2x replay speed this causes visible jank.

**Why it happens:**
Developers see only 20 drivers × 58 laps and think the dataset is tiny. The cost is per-trace overhead for layout calculation, hover detection zones, and legend rendering — not per-point rendering.

**How to avoid:**
Three mitigations, in order of impact:
1. Use `scattergl` (WebGL) trace type instead of `scatter`. The existing GapChart uses `scatter` — position chart should use `scattergl` since it has many more data series.
2. Wrap the full `data` array in `useMemo`, keyed on `laps` (already loaded once). Position never changes for historical data — only the cursor position changes. Separate the cursor shape from the traces so only the cursor shape updates on replay ticks, not all 20 traces.
3. Pass `layout.datarevision` to force-trigger updates instead of relying on object identity diffing.

**Warning signs:**
- React DevTools shows position chart re-rendering on every replay tick
- Browser framerate drops below 30fps during replay at 2x speed
- Chrome performance profiler shows `Plotly.react` taking >100ms per tick

**Phase to address:**
Phase implementing position chart — build with `scattergl` from the start. Do not refactor from `scatter` later; it is a prop-level change but the chart shape API differs for WebGL.

---

### Pitfall 4: Sector Heatmap Cell Count Blows Past Plotly's Comfortable Rendering Threshold

**What goes wrong:**
A full sector heatmap has 20 drivers × 58 laps × 3 sectors = 3,480 cells. Plotly heatmaps with arrays in this range take 10–30 seconds to render on first draw (community-reported for 2,000×1,000 arrays; our 3×20×58 is much smaller but Plotly's per-cell cost is high). The bigger issue: every re-render redraws the entire heatmap — if the component re-renders when `currentLap` changes in the Zustand store, the heatmap will stutter on every replay tick.

**Why it happens:**
The sector heatmap will subscribe to the same `useSessionStore` as every other component. If it subscribes to `currentLap` (to highlight the current lap column), it will re-render on every replay tick. The heatmap data itself never changes — only the highlight does.

**How to avoid:**
Separate the static heatmap trace from the current-lap indicator. The heatmap `z` data is computed once from `laps` (which never changes after session load). Memoize the entire `data` array with `useMemo(() => ..., [laps])`. The current lap cursor can be a separate `shapes` entry updated via `layout.shapes` without re-computing the heatmap data at all. Use Plotly's `Plotly.relayout` path if needed, not a full React re-render.

Also: limit the heatmap to at most 10 drivers by default (let the user add more). The sector heatmap is primarily useful for comparing a shortlist of drivers — 20 drivers at once produces an unreadable wall of color.

**Warning signs:**
- Sector heatmap takes >3 seconds to appear after session load
- Replay controls stutter while the heatmap is visible
- React DevTools shows heatmap component in the re-render flame graph on every lap tick

**Phase to address:**
Phase implementing sector heatmap — memoization strategy must be decided at design time, not retrofitted after noticing jank.

---

### Pitfall 5: Lap Time Chart Shows Meaningless Spikes from In/Out Laps and Safety Car Laps

**What goes wrong:**
A lap time chart that plots raw `LapTime` for all laps shows massive spikes on pit entry laps (20–40 seconds slower than a flying lap), pit exit laps (5–15 seconds slower), and safety car laps (10–30 seconds slower). These spikes dominate the Y-axis scale, compressing the actually interesting degradation signal into a flat band at the bottom of the chart. Users cannot see tire degradation.

**Why it happens:**
`LapTime` is always populated for all completed laps — it is not NaN for slow laps. Developers plot what they get. The `IsAccurate` flag exists but is not serialized by the current backend. Developers also forget that safety car laps are not flagged as inaccurate in `IsAccurate` — they need to be excluded separately using the `safetyCarPeriods` data already in the store.

**How to avoid:**
Apply three filters before plotting:
1. Exclude inlaps: `PitInTime is not NaT / not null`
2. Exclude outlaps: `PitOutTime is not NaT / not null`
3. Exclude safety car laps: cross-reference lap number against `safetyCarPeriods` already in the Zustand store

Do NOT use `pick_quicklaps()` on the backend for this chart — `pick_quicklaps()` uses a statistical threshold relative to the session median and will silently exclude legitimate long-stint laps from older cars. Use explicit rule-based filtering instead. Render excluded laps as hollow markers (not removed) so users can see where they are, but use a different marker style.

**Warning signs:**
- Y-axis range extends to 100+ seconds for any race
- Degradation trend is invisible because the scale is dominated by pit laps
- Multiple data points far below the main cluster for every stint

**Phase to address:**
Phase implementing lap time chart — filtering must be designed before the chart, not added as a fix after seeing the initial output.

---

### Pitfall 6: Adding Five New Charts Causes Every Component to Re-render on Replay Tick

**What goes wrong:**
The current `useSessionStore` is a single Zustand slice. Every component that calls `useSessionStore((s) => s.currentLap)` re-renders on every lap tick. With the v1.0 codebase (GapChart + StandingsBoard), this is two components re-rendering. With five new charts, this becomes seven components re-rendering simultaneously on every tick — potentially at 2x replay speed (every ~500ms). Even if each render is cheap, the cumulative cost of seven Plotly `react()` diffs per tick is significant.

**Why it happens:**
Zustand's subscription model is correct — components only re-render when their selected slice changes. But all seven charts subscribe to `currentLap`. The fix is not in Zustand; it is in chart architecture: charts should not re-render their full data on every lap tick. Only the cursor position should update.

**How to avoid:**
Establish an architectural pattern across all new charts: the chart data (`data` prop) is computed once from `laps` with `useMemo`, memoized until `laps` changes. Only the cursor `shape` reads `currentLap`. Use `layout.shapes` to update the cursor without touching `data`. The GapChart already does this correctly for its cursor — new charts should follow the same pattern from the start.

If the position chart or lap time chart needs to highlight the current lap (e.g., grey out future laps), consider using Plotly's `layout.datarevision` + a separate overlay trace for the highlight, rather than recomputing all 20 traces.

**Warning signs:**
- React DevTools profiler shows all chart components highlighted on every replay tick
- `useMemo` dependency arrays include `currentLap` for any component that renders 20+ traces
- Any chart component's render function calls `laps.filter(...)` directly (without memoization)

**Phase to address:**
First chart added in v1.1 — establish the cursor-separation pattern immediately. Retrofitting five components later is expensive.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Plot all 20 position chart drivers as `scatter` (not `scattergl`) | No code change from existing charts | Visible jank at 2x replay with 20 traces updating | Never for position chart — use `scattergl` |
| Compute sector heatmap `z` data inside the render function | Simpler code | Heatmap recomputes on every replay tick | Never — always memoize |
| Use `fastf1.api` for interval data | Direct access to stream fields | Breaks on any FastF1 minor version; maintainer warns it is private | Never — compute from public `Time` and `Position` |
| Show all 20 drivers in sector heatmap by default | "More data" feels complete | Unreadable color wall; render time triples | Show top 8 by default with ability to expand |
| Skip `IsAccurate` filtering on lap time chart | Faster to implement | Pit laps and SC laps dominate Y-axis, destroying degradation signal | Never for lap time chart |
| New charts each fetch their own endpoint | Isolation | Additional backend roundtrips; data already in store from v1.0 SSE load | Only if chart requires data not currently serialized (e.g. sector times) |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| FastF1 `Stint` column | Treating compound changes as stint boundaries | Use the integer `Stint` column as ground truth; compound changes within a stint (UNKNOWN → SOFT) are data corrections, not pit stops |
| FastF1 sector times | Assuming `Sector1Time/Sector2Time/Sector3Time` are always populated | `IsAccurate=False` laps can have `NaT` sector times; outlap sector 1 is almost always `NaT` because the lap clock hasn't fully synced |
| Existing `serialize_laps` backend function | Adding sector time fields and assuming pandas `NaT` serializes to `null` | `NaT` does NOT auto-serialize to JSON null via FastAPI — must pass through `serialize_timedelta()` which is already in the codebase |
| Zustand `laps` array | Directly deriving chart data in component render | Always wrap in `useMemo` with `[laps]` dependency; `laps` is a stable reference after session load |
| Plotly `useResizeHandler` on 5+ charts | Each chart independently listens for window resize events | All five charts should use `useResizeHandler={true}` with `style={{ width: '100%', height: '100%' }}` and a fixed container height — do not pass explicit `width`/`height` to the Plot component |
| `react-plotly.js` `data` prop identity | Passing a new array literal `[...traces]` inline causes Plotly to re-diff on every React render | Always assign data to a `useMemo` result; never construct inline |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Position chart with 20 `scatter` traces updating on every replay tick | Chart lags 0.5–2s behind replay controls; jank at 2x speed | Use `scattergl`; separate cursor from data traces; memoize data | Immediately at 2x replay speed with 20 drivers |
| Sector heatmap `z` recomputed in render | First paint after session load takes 3–10 seconds for heatmap | `useMemo(() => computeHeatmapZ(laps), [laps])` | On every render — adds up quickly |
| Five charts each subscribing to `currentLap` with no memoization | Cascade of Plotly `react()` calls on every lap tick | Cursor shape = derived from `currentLap`; chart data = derived from `laps` only | At >2 charts watching `currentLap` simultaneously |
| New backend endpoint that calls `session.load()` again | 30–60s load time on second chart type opened | Reuse session from in-memory store; only call `session.load()` once per session key | On first request if in-memory cache not checked |
| Sending raw sector time DataFrames as new API response | Large JSON payload (58 laps × 20 drivers × 3 sectors = 3480 rows) | Aggregate on backend; send only pre-computed heatmap `z` matrix + driver index | Immediately for heatmap — send a 20×58×3 matrix, not 3480 individual rows |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Lap time chart Y-axis shows raw seconds (90–110s) with no compound coloring | Cannot distinguish stint pace from individual lap variation | Color each point by compound (SOFT=red, MEDIUM=yellow, HARD=white, etc.); break the line at pit stop boundaries |
| Position chart shows all 20 drivers at equal visual weight | Visual noise — no way to focus on drivers of interest | Bold/highlight selected drivers (from `selectedDrivers` in store); dim the rest to 30% opacity |
| Sector heatmap shows absolute times (sector 1 = 28.3s) | User cannot tell if 28.3s is fast or slow without reference | Color cells by delta from fastest sector time that lap, not by absolute time |
| Stint timeline shows all retired/DNF drivers at full height | DNF drivers take same space as race finishers | Sort timeline: race finishers first, DNFs last, flagged by "DNF on lap X" label |
| Interval history chart shows flat zero for the race leader | Misleading — leader appears to have zero interval, others have positive | Show leader's gap as NaN/hidden; only show intervals for P2–P20; or show gap to leader instead |
| Five new charts dumped into the scrollable layout without grouping | Infinite scroll with no orientation | Group charts into labeled sections: "Tire Strategy" (stint timeline, lap time), "Race Order" (position chart, interval history), "Sector Analysis" (heatmap) |

---

## "Looks Done But Isn't" Checklist

- [ ] **Stint timeline:** Renders for the happy path — verify it also handles: (1) driver with UNKNOWN compound stint, (2) driver who retires before completing a stint, (3) session with fewer than 3 compounds used
- [ ] **Lap time chart:** Shows points — verify Y-axis is not dominated by pit lap spikes; confirm in/out laps are visually excluded or clearly distinguished
- [ ] **Position chart:** Draws 20 lines — verify replay cursor moves without causing full chart re-render; confirm `scattergl` is used, not `scatter`
- [ ] **Sector heatmap:** Displays color matrix — verify `None`/`NaT` sector times are shown as grey "no data" cells, not crashes; verify it does not re-render on every replay tick
- [ ] **Interval history:** Shows gap lines — verify the calculation matches known race intervals (not just "looks plausible"); confirm it handles the race leader row without showing zero or NaN errors
- [ ] **All five charts:** Memoization — confirm `data` prop for each chart is wrapped in `useMemo` with `[laps]` (not `[laps, currentLap]`) as dependency
- [ ] **Backend:** New sector time serialization — verify `Sector1Time/Sector2Time/Sector3Time` are passed through `serialize_timedelta()`, producing `null` in JSON for NaT, not a serialization error
- [ ] **Dashboard layout:** Five charts added — verify sticky header still works; scrolling to bottom does not cause replay controls to disappear; Plotly mode bar remains accessible on each chart

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Interval built on `fastf1.api` (breaks on FastF1 upgrade) | MEDIUM | Replace with `Time` + `Position` delta calculation; output format stays the same |
| Stint compound grouped by compound-change instead of `Stint` column | MEDIUM | Rewrite aggregation logic; re-test all stint boundary edge cases |
| Position chart performance jank | LOW | Change `type: 'scatter'` to `type: 'scattergl'`; add `useMemo` to data array |
| Sector heatmap re-rendering on replay tick | LOW | Add `useMemo` with `[laps]` dependency; move currentLap cursor to `shapes` |
| Lap time chart scale dominated by pit laps | LOW | Add three-line filter (no inlap, no outlap, no SC lap) in backend aggregation |
| All charts re-rendering on every tick | MEDIUM | Audit all `useSessionStore` subscriptions; extract cursor-only components; memoize data |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Interval history using private `fastf1.api` | Phase: interval history endpoint design | Confirm zero `fastf1.api` imports in new backend code; verify interval matches broadcast for one known race lap |
| Stint compound None/UNKNOWN handling | Phase: stint timeline backend aggregation | Unit test covering a driver with a `None` compound lap mid-stint; output must show one continuous stint bar |
| Position chart trace-count performance | Phase: position chart component | Open React DevTools profiler during 2x replay; position chart must not appear in re-render flame graph during lap ticks |
| Sector heatmap replay tick re-renders | Phase: sector heatmap component | Add `console.count('heatmap render')` during dev; advancing 10 laps must not trigger 10 heatmap renders |
| Lap time chart pit lap spikes | Phase: lap time chart backend endpoint | Plot chart for 2024 Australian GP; Y-axis must be in 85–100s range, not 60–160s range |
| All five charts re-rendering on tick | Phase: first new chart added (establish pattern) | React DevTools profiler during replay: only cursor-related components should highlight per tick |
| Sector time NaT serialization | Phase: backend sector endpoint | Add test that serializes a lap with `NaT` sector times; assert JSON output contains `null`, not a 500 error |

---

## Sources

- [FastF1 ENH Issue #735 — IntervalToPositionAhead / GapToLeader via fastf1.api (private)](https://github.com/theOehrly/Fast-F1/issues/735)
- [FastF1 BUG Issue #768 — Tyre compound data differences after v3.6.0](https://github.com/theOehrly/Fast-F1/issues/768)
- [FastF1 BUG Issue #779 — Wrong tyre compound data (2025 Belgian GP intermediate/medium)](https://github.com/theOehrly/Fast-F1/issues/779)
- [FastF1 Discussion #517 — Generated data, tyres, lap times accuracy philosophy](https://github.com/theOehrly/Fast-F1/discussions/517)
- [FastF1 PR #716 — Restrict compound backfill to last UNKNOWN](https://github.com/theOehrly/Fast-F1/pull/716)
- [FastF1 Accurate Calculations howto — 4-5 Hz sample rate, integration error, interpolation warnings](https://docs.fastf1.dev/howto_accurate_calculations.html)
- [FastF1 Timing and Telemetry Data — IsAccurate criteria, inlap/outlap definitions](http://docs.fastf1.dev/core.html)
- [FastF1 Tyre Strategies Example — correct Stint-based aggregation pattern](https://docs.fastf1.dev/gen_modules/examples_gallery/plot_strategy.html)
- [plotly/plotly.js Issue #3227 — Performance collapses with many traces (trace count, not point count)](https://github.com/plotly/plotly.js/issues/3227)
- [plotly/plotly.js Issue #7489 — Performance issues with many traces vs. single traces](https://github.com/plotly/plotly.js/issues/7489)
- [plotly/plotly.js Issue #3416 — Multiple charts on one page performance](https://github.com/plotly/plotly.js/issues/3416)
- [Plotly Community — Heatmap slow for large data arrays](https://community.plotly.com/t/heatmap-is-slow-for-large-data-arrays/21007)
- [react-plotly.js README — data prop identity and datarevision behavior](https://github.com/plotly/react-plotly.js)
- [Zustand Discussion #2642 — More re-renders than expected; selector patterns](https://github.com/pmndrs/zustand/discussions/2642)

---
*Pitfalls research for: F1 Strategy & Analysis Views — v1.1 (stint timeline, lap time chart, position chart, sector heatmap, interval history)*
*Researched: 2026-03-13*
