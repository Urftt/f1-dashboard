# Stack Research

**Domain:** F1 Strategy & Analysis Dashboard — v1.1 additions (stint timeline, lap time chart, position chart, sector heatmap, interval history)
**Researched:** 2026-03-13
**Confidence:** HIGH (chart capabilities verified against Plotly.js official docs; FastF1 columns verified against docs.fastf1.dev)

---

## Executive Summary

**No new packages are required.** Every visualization in v1.1 is achievable with the existing stack:
plotly.js 3.4.0 (already installed at ^3.4.0) covers all five chart types, and FastF1's public `session.laps` DataFrame already exposes every column needed — `Stint`, `Compound`, `TyreLife`, `Sector1/2/3Time`, `LapTime`, `Position`, `Time`. The only non-obvious case is interval history: `IntervalToPositionAhead` is **not** in the public Laps API, so gap-to-car-ahead must be derived from `Time` column arithmetic (same approach already used for the gap chart in v1.0).

---

## Recommended Stack

### Core Technologies — No Changes

All core technologies from v1.0 remain unchanged. The table below is a focused addendum for v1.1 only.

### Chart Capabilities by New Feature

| Feature | Plotly.js Trace Type | Key Properties | Confidence |
|---------|---------------------|----------------|------------|
| Stint timeline | `bar` | `orientation:'h'`, `base: startLap`, `width: stintLength`, per-compound `marker.color` | HIGH — `base` property confirmed in Plotly.js reference |
| Lap time chart | `scatter` | `mode:'lines+markers'`, one trace per driver, `x: LapNumber`, `y: LapTime` | HIGH — standard scatter, already used in GapChart |
| Position chart | `scatter` | `mode:'lines'`, one trace per driver, `x: LapNumber`, `y: Position`, `yaxis.autorange:'reversed'` | HIGH — standard multi-line scatter |
| Sector comparison heatmap | `heatmap` | `z: delta_seconds[][]`, `colorscale: 'RdBu'`, `zmid: 0`, `x: drivers`, `y: laps` | HIGH — heatmap with diverging colorscale confirmed in Plotly.js docs |
| Interval history | `scatter` | `mode:'lines'`, `x: LapNumber`, `y: intervalSeconds`, one trace per selected driver | HIGH — derived from `Time` column arithmetic |

### Supporting Libraries — No New Additions

| Library | Current Version | Status | Notes |
|---------|----------------|--------|-------|
| plotly.js | ^3.4.0 | Already installed | Heatmap, bar-with-base, and scatter all native; `heatmapgl` was removed in v3 but plain `heatmap` is the correct replacement and fully supported |
| react-plotly.js | ^2.6.0 | Already installed | Wraps plotly.js; same `<Plot data={...} layout={...} />` API used by GapChart applies to all new charts |
| FastF1 | >=3.5.3 | Already installed | All required columns (`Stint`, `Compound`, `Sector1Time`, `Position`, `Time`) are in the public Laps DataFrame |
| pandas | >=2.3.0 | Already installed | `groupby(['Driver','Stint','Compound']).agg()` is the correct pattern for stint aggregation |

### Development Tools — No Changes

---

## Installation

No new packages needed for v1.1. The existing stack is sufficient.

```bash
# Nothing to install — all chart types are covered by plotly.js already in package.json
# Verify current installs
npm list plotly.js react-plotly.js
```

If FastF1 needs updating to access newer data:
```bash
uv add "fastf1>=3.8.1"
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Plotly.js `bar` with `base` property (stint timeline) | D3.js custom Gantt | D3 requires significant custom code; Plotly's `bar` trace with `base` and `orientation:'h'` achieves the same result with the existing chart wrapper, consistent dark theme, and built-in hover |
| Plotly.js `heatmap` with `zmid:0` (sector heatmap) | Custom CSS grid with color interpolation | CSS grid gives no interactivity (hover, zoom); Plotly heatmap supports diverging colorscale out of the box with `RdBu` or custom `[[0,'red'],[0.5,'white'],[1,'green']]` |
| `Time` column arithmetic for interval history | FastF1 `IntervalToPositionAhead` field | `IntervalToPositionAhead` is only available through `fastf1.api` which is private and subject to removal; deriving from `Time` per lap is the documented-safe approach and mirrors the v1.0 gap chart logic |
| Plotly.js multi-line `scatter` (position chart) | Victory Charts / Recharts | No new dependency; Plotly already handles multi-trace with legend, hover, and consistent dark theme |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `fastf1.api.fetch_data` for `IntervalToPositionAhead` | FastF1 explicitly marks `fastf1.api` as private/internal and warns it may be removed in future versions | Compute interval-to-car-ahead by sorting `session.laps` by `LapNumber` + `Position` and subtracting consecutive `Time` values per lap |
| Adding a new charting library (ECharts, Recharts, Victory) | Creates dual-chart-library overhead with inconsistent dark themes, two sets of type definitions, and a larger bundle for no capability gain — Plotly covers all five chart types | Extend existing Plotly usage |
| `heatmapgl` trace type | Removed in Plotly.js v3; will throw runtime error | Use `heatmap` trace type (same API, software-rendered, identical for the 20-driver × 70-lap grid sizes used here) |
| Blocking FastF1 calls in new router endpoints | `session.laps` access is synchronous; calling in an async route without `asyncio.to_thread` blocks the event loop | `await asyncio.to_thread(lambda: session.laps[...])` — same pattern already used in v1.0 gap chart endpoint |

---

## Stack Patterns for New Features

**Stint Timeline — data shape:**
```python
# Backend: group laps by Driver + Stint + Compound, count laps
stints = (
    session.laps[["Driver", "Stint", "Compound", "LapNumber"]]
    .groupby(["Driver", "Stint", "Compound"])
    .agg(StintLength=("LapNumber", "count"), StartLap=("LapNumber", "min"))
    .reset_index()
)
# Serialize with .to_dict(orient='records')
```
```typescript
// Frontend: one bar trace per compound per driver
// base = startLap, x = stintLength, y = driverAbbr, orientation = 'h'
```

**Sector Comparison Heatmap — data shape:**
```python
# Backend: pivot sector times into a 2D grid, compute delta from column median
sector_df = session.laps[["Driver", "LapNumber", "Sector1Time", "Sector2Time", "Sector3Time"]]
# For each sector column: convert Timedelta to float seconds, subtract per-lap median
# Output: { drivers: string[], laps: number[], z: number[][] } — negative = faster than median
```
```typescript
// Frontend: zmid=0, colorscale='RdBu' (red=slow, blue=fast), reversescale=true
```

**Interval History — data derivation:**
```python
# Backend: compute gap-to-car-ahead from Time column
# Sort each lap by Position, subtract Time[pos] from Time[pos-1]
laps_sorted = session.laps.sort_values(["LapNumber", "Position"])
# For each lap group: shift Time by -1 within group to get time of car ahead
# Result: one series per driver of gap_to_ahead_seconds per lap
```

**Position Chart — data shape:**
```python
# Backend: session.laps[["Driver", "LapNumber", "Position"]]
# Serialize per-driver as array of {lap, position} objects
```
```typescript
// Frontend: yaxis.autorange = 'reversed' so P1 is at top; one scatter trace per driver
```

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| plotly.js@^3.4.0 | react-plotly.js@^2.6.0 | Already verified working in v1.0; all new chart types use same trace API |
| fastf1>=3.5.3 | Python 3.12 | `Stint`, `Compound`, `Sector1/2/3Time`, `Position` columns available in 3.5.3+; `TyreLife` added in ~3.3 |
| pandas>=2.3.0 | fastf1>=3.5.3 | FastF1 3.x requires pandas 2.x; groupby/agg patterns used for stints are stable pandas 2.x API |

---

## Sources

- https://plotly.com/javascript/reference/bar/ — `base` property confirmed for Gantt/timeline-style bars (HIGH confidence)
- https://plotly.com/javascript/horizontal-bar-charts/ — `orientation:'h'` confirmed (HIGH confidence)
- https://plotly.com/javascript/reference/heatmap/ — custom diverging colorscale, `zmid` property confirmed (HIGH confidence)
- https://plotly.com/javascript/version-3-changes/ — `heatmapgl` removed in v3, `heatmap` is correct replacement (HIGH confidence)
- https://docs.fastf1.dev/core.html — Laps DataFrame columns: `Stint`, `Compound`, `TyreLife`, `Sector1/2/3Time`, `Position` all confirmed public (HIGH confidence)
- https://docs.fastf1.dev/gen_modules/examples_gallery/plot_strategy.html — Official FastF1 stint aggregation pattern using `groupby(['Driver','Stint','Compound']).count()` (HIGH confidence)
- https://github.com/theOehrly/Fast-F1/issues/735 — `IntervalToPositionAhead` confirmed NOT in public Laps API; manual derivation from `Time` is the recommended workaround (HIGH confidence)

---

*Stack research for: F1 Strategy & Analysis Dashboard v1.1*
*Researched: 2026-03-13*
