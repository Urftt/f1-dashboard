# Feature Research

**Domain:** F1 Strategy & Analysis Dashboard (v1.1 — five new analysis views)
**Researched:** 2026-03-13
**Confidence:** HIGH (FastF1 data model verified via official docs and GitHub issues; UX patterns verified against TracingInsights, f1-visualization.vercel.app, FastF1 example gallery, PITWALL)

---

## Scope Note

This file covers only the **five new v1.1 features**. All v1.0 features (session selector, gap chart, replay engine, standings board, pit annotations, SC shading) are already built and not re-researched here.

Existing data already in the Zustand store and available to all new components:
- `laps[]` — per-driver per-lap rows with: `LapNumber`, `Driver`, `Team`, `LapTime`, `Time`, `PitInTime`, `PitOutTime`, `Compound`, `TyreLife`, `Position`, `Stint`
- `drivers[]` — abbreviation, fullName, team, teamColor (hex)
- `safetyCarPeriods[]` — start_lap, end_lap, type
- `currentLap` — replay cursor (integer)
- `selectedDrivers` — [driverA, driverB] abbreviations

The backend already serializes `Sector1Time`, `Sector2Time`, `Sector3Time` from FastF1 but **does not yet expose them in the API response** — these need to be added to the schema and serialize_laps() for the heatmap feature. All other new features can be computed purely from what is already loaded.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that belong in a strategy analysis tool. Missing them makes the product feel incomplete relative to the domain.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Stint timeline (tire strategy bar chart) | Every F1 strategy visualization shows tire stints as horizontal bars — it is the canonical way to read race strategy | MEDIUM | Horizontal bars per driver, one row per driver, color by compound (standard: red=SOFT, yellow=MEDIUM, white=HARD, green=INT, blue=WET), x-axis = laps, bar width = stint length. FastF1: `Stint`, `Compound`, `TyreLife`, `LapNumber` per row gives everything needed. Pit stop boundaries visible at bar transitions. |
| Lap time chart (multi-driver scatter/line) | The primary way to read race pace and degradation — every analytics tool has this | HIGH | X-axis: lap number. Y-axis: lap time in seconds. One trace per selected driver, team color. Scatter preferred over connected line to avoid misleading visual across pit laps and outliers. Safety car laps must be visually de-emphasized (greyed out or marked). Pit laps excluded from trend. Trendline per stint optional but expected. |
| Position chart (spaghetti chart) | Shows overtakes and strategy plays across the full field — standard F1 broadcast graphic | MEDIUM | X-axis: lap number. Y-axis: position (1 at top, 20 at bottom — inverted). All 20 drivers as separate lines, team colors. Major interaction: hover shows driver at position on that lap. Pit stops visible as brief position drops. SC/VSC periods shaded. |
| Sector comparison heatmap | Specialist tool but widely expected in F1 data tools; sector times reveal *where* a driver is gaining or losing | HIGH | Grid: rows = laps (or selected drivers), columns = S1/S2/S3. Color scale: purple = overall best (session), green = personal best, white/neutral = slower. Cell shows sector time as float seconds. User selects which drivers to include. Requires `Sector1Time`, `Sector2Time`, `Sector3Time` — not yet in API response. |
| Compound color coding | Without compound-matched colors the strategy charts are unreadable | LOW | Use established convention: SOFT=red (#E8002D), MEDIUM=yellow (#FFF200), HARD=white (#FFFFFF), INTERMEDIATE=green (#39B54A), WET=blue (#0067FF). Already used in standings board — reuse. |
| Chart hover tooltips | Every Plotly chart expects hover showing exact values — absence feels broken | LOW | Lap time chart: show driver, lap, time (mm:ss.mmm), compound, stint. Position chart: show driver, lap, position. Heatmap: show driver, lap, sector, time. |

### Differentiators (Competitive Advantage)

Features that make this tool more useful than a static screenshot from a competitor tool.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Interval history chart (gap-to-car-ahead over laps) | Shows hunting vs. managing phases — not available on any broadcast or most tools; directly answers "was Norris ever in attack range of Verstappen?" | HIGH | X-axis: lap number. Y-axis: gap-to-car-ahead in seconds. One line per selected driver. Includes DRS window (1.0s) as a horizontal reference line. Data challenge: FastF1's public `Laps` DataFrame does NOT include `IntervalToPositionAhead` as a direct column — it must be computed by matching session `Time` values: for each lap, find the driver one position ahead on that lap, look up their session `Time` value, compute the delta. This is a backend computation, not a trivial frontend derive. |
| Replay cursor integration across all charts | Connects all five new charts to the existing replay engine — charts that respond to the current lap make this a replay companion, not a static analysis tool | LOW per chart | All new charts receive `currentLap` from the Zustand store. Render a vertical cursor line at `currentLap` on all time-series charts (stint timeline, lap time chart, position chart, interval history). The heatmap highlights the current-lap row. |
| Driver visibility toggle | With 20 drivers on a position chart or lap time chart, users need to filter to battles they care about | LOW | Checkbox list of drivers. Toggle traces on/off without re-fetching. Already have team colors per driver — show colored dot next to each driver in the toggle list. |
| Stint pace trend lines | On the lap time chart, a per-stint trend line quantifies degradation rate — useful for strategy comparison | MEDIUM | Compute linear regression per driver per stint, overlay as a thin dashed line on the scatter plot. Makes degradation slope visible at a glance. Implement as frontend-only post-fetch computation. |
| Safety car annotation on all charts | Users already understand SC shading from the gap chart — carry that visual language to all new charts | LOW | Reuse existing `safetyCarPeriods` data. Shade SC laps yellow, VSC laps green-yellow, on all new time-series charts. Zero new data required. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Per-lap fuel-corrected lap times | Popular in professional F1 analysis tools | Fuel load correction requires knowing starting fuel weight and per-lap burn rate — neither is available via FastF1 historical data. Implementing it with estimates would produce misleading results. | Show raw lap times; label early-stint laps as "fuel heavy" context in tooltips |
| Qualifying sector heatmap | Sector comparison makes most sense in qualifying | Qualifying sectors behave differently — drivers do multiple flying laps, outlaps, cooldown laps. The "personal best" framing works but the session structure needs separate handling (filter to flying laps only). | Defer qualifying heatmap to a later milestone; race stint heatmap is the primary use case |
| Side-by-side telemetry overlay (speed/throttle/brake trace) | Looks impressive, commonly requested | Telemetry is sampled at 100ms intervals, completely different data model from lap data. Would require separate API endpoints, different state management, and introduces significant performance risk in the React render loop. | Out of scope; add as a separate drill-down feature in v2 after establishing the analysis views |
| Real-time update of charts as replay advances | Feels natural for the replay companion use case | Re-rendering all five charts on every lap advance would be expensive — Plotly re-renders are not cheap. A better pattern is: charts are full-race static, replay cursor moves as a cosmetic overlay. | Cursor line updates (cheap) on each lap advance; charts themselves do not re-render |
| 3D or animated position map | Visually impressive demo | FastF1 positional data is low resolution; animation would be choppy. Already out of scope in PROJECT.md. | Standings board covers positional information adequately |

---

## Feature Dependencies

```
Stint Timeline
    └──requires──> laps[] in store (Stint, Compound, LapNumber per row)
    └──enhances──> Replay cursor (currentLap vertical line, already in store)

Lap Time Chart
    └──requires──> laps[] in store (LapTime, LapNumber, Compound, Stint per row)
    └──enhances──> Replay cursor
    └──enhances──> Safety car shading (safetyCarPeriods already in store)

Position Chart
    └──requires──> laps[] in store (Position, LapNumber per row)
    └──enhances──> Replay cursor
    └──enhances──> Safety car shading

Sector Comparison Heatmap
    └──requires──> Sector1Time, Sector2Time, Sector3Time in API response
                       └──requires──> Backend schema update (not yet exposed)
                       └──requires──> serialize_laps() to include sector columns
    └──requires──> IsAccurate flag to filter garbage laps

Interval History Chart
    └──requires──> laps[] in store (Position, Time, LapNumber per driver)
    └──requires──> Backend computation of gap-to-car-ahead per driver per lap
                       └──requires──> New API endpoint or extension of session load response
    └──enhances──> Replay cursor
    └──enhances──> Safety car shading

All five new charts
    └──enhances──> selectedDrivers (for default driver focus in lap time and heatmap views)
    └──enhances──> drivers[] (for team colors and toggle lists)
```

### Dependency Notes

- **Sector heatmap is the only feature requiring new backend work before it can render.** All other four features can be built purely from data already in the store. The stint timeline, lap time chart, position chart, and interval history all derive from `laps[]` which is already loaded.
- **Interval history requires either a new backend computation or a frontend derive.** The gap-to-car-ahead for each driver at each lap can be computed on the frontend from `laps[]` by: (1) build a map of `{lap: {driver: sessionTime}}`, (2) for each driver at each lap, find the driver at (position - 1) on that lap, (3) diff their session `Time` values. This avoids a new API endpoint but is O(drivers × laps) work — acceptable for race data sizes.
- **Replay cursor is free.** All new charts just read `currentLap` from the existing Zustand store. No new state required.
- **Safety car shading is free.** `safetyCarPeriods` already in store. Reuse the same Plotly `shapes` pattern from the gap chart.

---

## MVP Definition

This is the v1.1 milestone launch definition, not a product MVP.

### Launch With (v1.1)

All five features are in scope for this milestone. Ordered by implementation dependency:

- [ ] Stint timeline — no new data needed; straightforward Plotly horizontal bar chart; builds familiarity with new chart components before harder features
- [ ] Lap time chart — no new data needed; most analytically useful after the gap chart; medium complexity
- [ ] Position chart — no new data needed; highest visual complexity (20 lines) but data is simple
- [ ] Interval history — can be derived frontend-side from existing `laps[]`; requires careful per-lap position-ordered join
- [ ] Sector comparison heatmap — requires backend schema change (add sector times to serialize_laps); most complex; do last

### Defer From v1.1

- [ ] Qualifying sector heatmap — race heatmap first; qualifying is a separate session logic branch
- [ ] Fuel-corrected lap times — data not available via FastF1; misleading without it
- [ ] Stint pace trend lines (per-stint linear regression) — can add as enhancement once lap time chart is working

### Future (v2+)

- [ ] Live data interval history via OpenF1 — different data pipeline; validates UX with historical first
- [ ] Telemetry side-by-side drill-down — different data model entirely
- [ ] Qualifying analysis views — sector bests, evolution of lap times across quali sessions

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Stint timeline | HIGH | LOW | P1 |
| Lap time chart | HIGH | MEDIUM | P1 |
| Position chart | HIGH | MEDIUM | P1 |
| Interval history | HIGH | MEDIUM | P1 |
| Sector comparison heatmap | HIGH | HIGH | P1 |
| Replay cursor on all new charts | MEDIUM | LOW | P1 |
| Safety car shading on all new charts | MEDIUM | LOW | P1 (reuse existing) |
| Driver visibility toggle | MEDIUM | LOW | P2 |
| Stint pace trend lines | MEDIUM | MEDIUM | P2 |
| Qualifying heatmap variant | LOW | MEDIUM | P3 |
| Fuel-corrected lap times | LOW | HIGH (and misleading) | Anti-feature |

**Priority key:**
- P1: Must have for v1.1 launch
- P2: Add if time allows during v1.1 phases
- P3: Future milestone

---

## Expected Behaviors and Interactions Per Feature

### Stint Timeline

**Expected behavior:**
- One horizontal bar row per driver, sorted by final finishing position
- Each bar segment = one stint; segment width = stint lap count; color = compound
- Pit stop transitions visible as bar boundaries with optional lap number label
- Bars span lap 1 to final lap; drivers who retired have shorter bars
- SC/VSC periods shaded as background rectangles (same as gap chart convention)

**Interactions:**
- Hover on a bar segment: show driver, stint number, compound, laps on tire, start lap, end lap
- Replay cursor: vertical line at `currentLap` scrolls across all rows
- Click on a segment: optionally jump replay to that lap (P2 enhancement)

**Data required:** `Stint`, `Compound`, `LapNumber`, `TyreLife` per driver per lap — all in `laps[]`

### Lap Time Chart

**Expected behavior:**
- Scatter plot (not connected line) — each point is one lap time for one driver
- Axes: X = LapNumber, Y = lap time in seconds (or mm:ss format)
- Points colored by driver's team color
- Pit laps (where `PitInTime` is not null or `PitOutTime` is not null) styled differently (hollow point or X marker) to flag outlier laps
- SC/VSC laps greyed out or marked to prevent misleading degradation reads
- Deleted laps (when FastF1 `IsAccurate = False`) excluded from display

**Interactions:**
- Default: show all drivers (20 lines is too many — default to `selectedDrivers` [A, B] from store)
- Driver toggle: checkbox list to add/remove drivers
- Hover: driver abbreviation, lap number, lap time (mm:ss.mmm), compound, stint, tyre age
- Replay cursor: vertical line at `currentLap`
- Zoom: Plotly's built-in zoom/pan is sufficient

**Data required:** `LapTime`, `LapNumber`, `Compound`, `Stint`, `PitInTime`, `PitOutTime` — all in `laps[]`

### Position Chart

**Expected behavior:**
- Line chart, one line per driver, team color
- Y-axis inverted: P1 at top, P20 at bottom — standard F1 broadcast convention
- All 20 drivers shown by default; toggling is important
- Lines are continuous; gaps where a driver retired are handled by dropping the line
- Pit stop laps show a brief position dip (accurate to data — pit window laps have position jumps)
- SC/VSC periods shaded

**Interactions:**
- Default: all drivers shown but de-emphasized except `selectedDrivers`
- Hover: show all drivers' positions at that lap in a unified tooltip (like MultiViewer race trace)
- Click on a line: highlight that driver (raise z-index, thicken line, dim others)
- Replay cursor: vertical line at `currentLap`

**Data required:** `Position`, `LapNumber` per driver per lap — in `laps[]`

### Sector Comparison Heatmap

**Expected behavior:**
- Grid where rows = selected drivers (2–6 max for readability) and columns = S1/S2/S3 per lap
- Alternative layout: rows = laps, columns = drivers × sectors (3 columns per driver)
- Recommended layout: rows = drivers, sub-columns = S1/S2/S3, lap selectable via dropdown or replay cursor
- Color scale per sector column independently (so S1 and S2 aren't compared to each other)
- Purple cell = overall session best for that sector; green cell = personal best; white = slower; shades of red = progressively slower than personal best
- Cell text: sector time as seconds.milliseconds (e.g. 28.341)
- Pit laps and SC laps marked but not excluded — user can see degraded sector times

**Interactions:**
- Lap range selector: show all laps or focus on a specific stint
- Driver selector: add/remove rows (up to ~6 before it becomes unreadable)
- Hover: driver, lap, sector, time, delta to session best, delta to personal best
- Click on row (driver): highlight that driver in other charts (cross-chart selection — P2)

**Data required:** `Sector1Time`, `Sector2Time`, `Sector3Time` — **NOT YET IN API RESPONSE**
Backend change required: add `Sector1Time`, `Sector2Time`, `Sector3Time` to `serialize_laps()` in `fastf1_service.py` and `LapRow` type in TypeScript.

### Interval History Chart

**Expected behavior:**
- Line chart: X = lap number, Y = gap to car immediately ahead (seconds)
- One line per selected driver (default: `selectedDrivers` [A, B])
- Y-axis: 0 = right behind the car ahead; higher = further back; inverted is confusing — keep 0 at bottom
- Horizontal reference line at 1.0s = DRS window (the most actionable threshold)
- Horizontal reference line at 0s = on the car ahead (overlapping)
- SC/VSC periods shaded
- Pit laps show large spikes (driver drops back after pit stop) — label these clearly or exclude
- A driver in P1 (no car ahead) is shown as null / gap dropped from chart for those laps

**Interactions:**
- Driver toggle: add/remove drivers (position chart and interval chart are most useful as companions)
- Hover: driver, lap, interval, car ahead on that lap (driver abbreviation)
- Replay cursor: vertical line at `currentLap`

**Data derivation (frontend-computed):**
For each driver D at each lap L:
1. Get D's `Position` at lap L
2. Find driver P at `Position - 1` at lap L
3. Compute `interval = P.Time[L] - D.Time[L]` (using cumulative session time `Time` column)
4. If Position = 1, interval = null

This approach matches how the existing gap chart was implemented ("Gap via session Time not LapTime" — from PROJECT.md key decisions). It avoids the FastF1 private API issue with `IntervalToPositionAhead`.

**Data required:** `Position`, `Time`, `LapNumber` per driver per lap — all in `laps[]`. No new data needed.

---

## FastF1 Data Availability for v1.1

| New Feature | Required FastF1 Fields | Available in Store Now? | Action Needed |
|-------------|------------------------|------------------------|---------------|
| Stint timeline | Stint, Compound, LapNumber, TyreLife | YES | None |
| Lap time chart | LapTime, LapNumber, Compound, Stint, PitInTime | YES | None |
| Position chart | Position, LapNumber | YES | None |
| Interval history | Position, Time, LapNumber | YES | None (frontend derive) |
| Sector heatmap | Sector1Time, Sector2Time, Sector3Time | NO | Add to serialize_laps() + LapRow type |

One backend change unlocks the heatmap. All other features are pure frontend work on existing data.

---

## Sources

- [FastF1 Official Docs — Timing and Telemetry Data](https://docs.fastf1.dev/core.html) — HIGH confidence; confirms Sector1Time/Sector2Time/Sector3Time in Laps DataFrame; confirms IsPersonalBest and IsAccurate flags
- [FastF1 GapToLeader/IntervalToPositionAhead GitHub Issue #735](https://github.com/theOehrly/Fast-F1/issues/735) — HIGH confidence; confirms IntervalToPositionAhead is NOT in public Laps DataFrame; recommends manual computation
- [FastF1 gap-per-lap computation Discussion #503](https://github.com/theOehrly/Fast-F1/discussions/503) — HIGH confidence; confirms session Time-based derivation approach
- [TracingInsights F1 Analytics](https://tracinginsights.com/) — MEDIUM confidence; competitor reference for sector heatmap and lap time chart UX patterns
- [F1 Visualization (Vercel)](https://f1-visualization.vercel.app/) — MEDIUM confidence; reference for position chart inversion convention and hover behavior
- [PITWALL — F1 telemetry workstation (GitHub)](https://github.com/WarmBed/PITWALL) — MEDIUM confidence; reference for sector comparison and lap table color conventions (purple/green best marking)
- [Visualizing F1 2025 with Python — 30 Charts](https://python.plainenglish.io/visualizing-f1-2025-with-python-30-charts-that-reveal-hidden-patterns-91c5a81f44f6) — MEDIUM confidence; sector time heatmap implementation reference
- [FastF1 Playbook 2026](https://medium.com/formula-one-forever/fastf1-playbook-10-notebooks-to-master-formula-1-data-in-2026-23c347a462b3) — MEDIUM confidence; position chart and lap time chart patterns

---

*Feature research for: F1 Strategy & Analysis Dashboard — v1.1 milestone (five new analysis views)*
*Researched: 2026-03-13*
