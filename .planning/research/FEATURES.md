# Feature Research

**Domain:** F1 Race Replay Dashboard (second-screen companion)
**Researched:** 2026-03-13
**Confidence:** HIGH (FastF1 data model verified via official docs; UX patterns verified against MultiViewer, f1-dash, TracingInsights, undercut-f1)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any F1 replay tool must have. Missing these makes the product feel broken or unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Session picker (year + event + session type) | Users need to load any historical race before anything else works | LOW | FastF1 provides event schedule; expose year → event → session type cascade. Session types: Race, Qualifying, Sprint |
| Loading progress feedback | FastF1 downloads and caches data; first load can take 10–30s | LOW | Show progress bar or spinner with status text (e.g. "Loading lap data…"). No feedback = users assume it crashed |
| Driver gap chart over time | The stated core value; every F1 analytics tool has this | HIGH | X-axis: lap number. Y-axis: gap in seconds. Zero line = equal. Positive = Driver A ahead. FastF1 `Position` + `LapTime` columns required |
| Zero-line reference on gap chart | Without it users can't read who is ahead | LOW | Dashed horizontal line at 0, labeled "Driver A ahead / Driver B ahead" in quadrants |
| Hover tooltips on gap chart | Standard for any Plotly chart; users expect exact values on hover | LOW | Show: lap number, gap value in seconds, both driver names |
| Standing board per lap | Users want to know overall race order, not just two drivers | MEDIUM | Columns: Position, Driver (abbrev + team color), Gap to leader, Interval, Compound, Pit stops. Keyed to current replay lap |
| Tire compound display in standings | Compound (SOFT/MEDIUM/HARD/WET/INT) is broadcast-standard information | LOW | FastF1 `Compound` column. Color-code by compound: red/yellow/white/green/blue |
| Pit stop count in standings | Every broadcast shows this; absence is noticed | LOW | Derived from FastF1 `Stint` increments or `PitInTime` not-null |
| Replay start/stop control | Core replay UX; without it the board is static | MEDIUM | Play/pause button. Advances lap counter on a timer interval |
| Lap-by-lap stepping | Users want to jump to a specific moment | LOW | Slider or input for lap number. Instantly updates standings board and gap chart cursor |
| Playback speed control | Watching lap-by-lap at 1x is too slow; users need 2x/4x | LOW | Discrete options: 0.5x, 1x, 2x, 4x. Affects timer interval between lap advances |

### Differentiators (Competitive Advantage)

Features that make this tool more valuable than screenshotting the F1 app.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Driver-selectable gap chart (pick any two) | Broadcasts only show the leader gap; this answers "is Verstappen catching Norris?" | MEDIUM | Dropdown selectors for Driver A / Driver B. Gap = Driver B time ahead of Driver A (positive when B is ahead) |
| Pit stop annotations on gap chart | Users can immediately explain gap spikes without remembering strategy | LOW | Vertical dashed lines or dot markers at laps where either driver pitted. FastF1 `PitInTime` / `Stint` changes |
| Safety car / VSC lap shading | Gap closures during SC/VSC are misleading without context | MEDIUM | FastF1 `TrackStatus` column: '4' = Safety Car, '6' = VSC. Shade those lap ranges on the chart in yellow |
| Replay lap cursor on gap chart | Shows where in the race the replay currently is | LOW | Vertical line on gap chart that moves as replay advances |
| Tire compound color on standings row | Instant visual: who is on old softs vs fresh hards | LOW | Colored pill/badge next to compound abbreviation (standard color map) |
| Tire age (laps on current set) | Tells users whether a tire is fresh or degrading | LOW | FastF1 `TyreLife` column; display as "S 12" meaning 12 laps on softs |
| Gap to leader vs interval toggle | Power users want both views; gap-to-leader for strategy, interval for battles | LOW | Toggle on gap chart. Gap-to-leader computes each driver vs P1 each lap |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Animated car positions on track map | Looks impressive, demos well | FastF1 historical positional data has low resolution (sampled, not per-frame). Building it correctly requires significant effort and produces mediocre results. F1 restricted granular positional data in 2024 | Use a standings board with position column; the data story is clearer |
| Live race data (OpenF1 WebSocket) | Users want it for race weekends | Adds a separate async data pipeline, API key management, connection lifecycle, and failure modes. Mixing live + historical in one codebase doubles complexity | Scope to v2 milestone; validate UX with historical replay first |
| Sector time micro-charts | Popular in analytics tools | FastF1 sector times require per-driver per-lap joins; rendering mini-charts per row in a standings table is complex React state | Show sector times in a separate detail view, not inline in the standings table |
| Telemetry overlay (speed/throttle/brake) | Technically impressive | Telemetry data is high-frequency (100ms samples); streaming it through the API per-lap replay is a different problem entirely | Out of scope for v1; add as a drill-down view in v2 |
| Race predictions / pace models | F1 fans love strategy | Requires substantial domain modeling; distracts from the core UX goal | Defer entirely; not what makes this tool useful as a second screen |

---

## Feature Dependencies

```
Session Picker
    └──requires──> Data Load + Cache
                       └──requires──> FastF1 Backend Endpoint

Standings Board (per lap)
    └──requires──> Session loaded
    └──requires──> All drivers' lap data

Gap Chart (two-driver)
    └──requires──> Session loaded
    └──requires──> Two driver selections
    └──enhances──> Replay Lap Cursor (shows current lap on chart)

Replay Engine (play/pause/speed)
    └──requires──> Session loaded
    └──requires──> Standings Board (drives what it updates)
    └──enhances──> Gap Chart (advances cursor)

Lap Step / Scrubber
    └──requires──> Replay Engine exists
    └──conflicts──> Auto-play running simultaneously (pause before jump)

Pit Stop Annotations
    └──requires──> Gap Chart exists
    └──requires──> FastF1 PitInTime data loaded

Safety Car Shading
    └──requires──> Gap Chart exists
    └──requires──> FastF1 TrackStatus data loaded

Tire Age Display
    └──requires──> Standings Board exists
    └──requires──> FastF1 TyreLife column loaded

Gap-to-Leader vs Interval Toggle
    └──requires──> Gap Chart exists
    └──requires──> All drivers' position data loaded (not just two)
```

### Dependency Notes

- **Session loading gates everything:** All features depend on a successful FastF1 session load. The backend must cache aggressively (FastF1's built-in cache) to avoid re-downloading on page refresh.
- **Replay engine drives both the standings board and the chart cursor:** These two components share a single "current lap" state; the replay engine is their source of truth.
- **Lap scrubber conflicts with auto-play:** If the user jumps to lap 30 while replay is running, the replay must pause first or immediately sync to the jumped lap. Don't let them diverge.
- **Gap-to-leader toggle requires all drivers loaded:** Unlike the two-driver gap chart, computing gap to leader means having every driver's lap data in memory. Load all drivers upfront so this doesn't require a separate fetch.

---

## MVP Definition

### Launch With (v1)

Minimum to validate the concept as a second-screen companion.

- [ ] Session picker — without it nothing loads
- [ ] Loading progress feedback — required UX hygiene; FastF1 can be slow
- [ ] Driver gap chart (two-driver, selectable) — the stated core value of the product
- [ ] Zero-line reference + hover tooltips on gap chart — gap chart is unreadable without them
- [ ] Standings board (position, driver, gap to leader, interval, compound, tire age, pit count) — second-screen companion needs race context
- [ ] Replay engine (play/pause, lap advance, playback speed 0.5x/1x/2x/4x) — "replay" is in the product name; static views are not MVP
- [ ] Lap scrubber / jump-to-lap — lets the user investigate a specific moment without watching the whole race
- [ ] Replay lap cursor on gap chart — connects the replay to the chart

### Add After Validation (v1.x)

Add once the core loop (load → replay → analyze) is working.

- [ ] Pit stop annotations on gap chart — trigger: users ask "why did the gap spike here?"
- [ ] Safety car / VSC shading on gap chart — trigger: users are confused by gap collapses under SC
- [ ] Gap-to-leader vs interval toggle — trigger: users want to see strategy, not just a battle

### Future Consideration (v2+)

Defer until v1 is validated.

- [ ] Live race data via OpenF1 — defer: adds async pipeline complexity; get UX right first
- [ ] Telemetry drill-down (speed/throttle/brake per lap) — defer: different data cadence, complex rendering
- [ ] Qualifying session support — defer: gap chart semantics differ (delta to best lap, not race position)
- [ ] Sprint session support — defer: same as qualifying, low urgency

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Session picker + data load | HIGH | LOW | P1 |
| Loading progress feedback | HIGH | LOW | P1 |
| Driver gap chart (two-driver) | HIGH | MEDIUM | P1 |
| Zero-line + hover tooltips | HIGH | LOW | P1 |
| Standings board | HIGH | MEDIUM | P1 |
| Replay engine (play/pause/speed) | HIGH | MEDIUM | P1 |
| Lap scrubber | HIGH | LOW | P1 |
| Replay cursor on gap chart | MEDIUM | LOW | P1 |
| Pit stop annotations | MEDIUM | LOW | P2 |
| SC/VSC lap shading | MEDIUM | LOW | P2 |
| Gap-to-leader toggle | MEDIUM | LOW | P2 |
| Tire age in standings | MEDIUM | LOW | P2 |
| Sector times detail view | LOW | MEDIUM | P3 |
| Telemetry overlay | LOW | HIGH | P3 |
| Live data (OpenF1) | HIGH | HIGH | P3 (v2) |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when core is stable
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | MultiViewer Race Trace | f1-dash | undercut-f1 (TUI) | Our Approach |
|---------|----------------------|---------|-------------------|--------------|
| Gap chart | Gap to leader + Delta to Average; team colors; hover shows full field | Gap between drivers; live only | Text-based timing table | Interactive Plotly chart; two-driver focus; pit annotations |
| Standings board | Not a standings board; pure chart | Live timing table with intervals, compounds | Live timing table | Static-ish table keyed to current replay lap |
| Replay / scrubbing | No replay; live only | No replay; live only | Replay of recorded sessions; variable delay | Full replay engine with speed control and lap scrubber |
| Tire info | Not shown | Compound visible | Compound visible | Compound + tire age (laps) |
| Pit stop markers | Dot on race trace line | Status column ("IN PIT") | Status column | Vertical annotation on gap chart |
| Safety car context | Yellow shading on chart | Race control messages | Race control messages | Yellow lap-range shading on gap chart |
| Historical data | Live sessions only | Live sessions only | Live sessions only | Historical only via FastF1 (live in v2) |

The gap in the market: no existing open tool combines (1) historical FastF1 data, (2) a two-driver selectable gap chart, and (3) a replay engine with a synchronized standings board. That combination is the product.

---

## FastF1 Data Availability Confirmation

These columns are confirmed available from FastF1's `Laps` object and are sufficient to build all v1 features:

| Dashboard Feature | FastF1 Column(s) |
|------------------|-----------------|
| Standings position per lap | `Position` |
| Gap to leader / interval | Computed from `LapTime` cumulative sum per driver, then diff |
| Tire compound | `Compound` (SOFT/MEDIUM/HARD/INTERMEDIATE/WET) |
| Tire age | `TyreLife` |
| Pit stop detection | `PitInTime` not-null, or `Stint` increment |
| Safety car / VSC laps | `TrackStatus` ('4' = SC, '6' = VSC) |
| Lap numbers | `LapNumber` |
| Stint number | `Stint` |

No computed fields require external APIs. Everything comes from a single `session.load()` call.

---

## Sources

- [FastF1 Official Docs — Timing and Telemetry Data (core.html)](http://docs.fastf1.dev/core.html) — HIGH confidence
- [FastF1 Introduction](https://docs.fastf1.dev/) — HIGH confidence
- [MultiViewer Race Trace docs](https://multiviewer.app/docs/usage/race-trace) — MEDIUM confidence (current, authoritative for the feature pattern)
- [f1-dash.com](https://f1-dash.com) — MEDIUM confidence (live product, competitor reference)
- [undercut-f1 GitHub](https://github.com/JustAman62/undercut-f1) — MEDIUM confidence (open source replay tool, feature reference)
- [IAmTomShaw/f1-race-replay GitHub](https://github.com/IAmTomShaw/f1-race-replay) — MEDIUM confidence (open source reference implementation)
- [Formula Live Pulse — Live Timing Features](https://www.f1livepulse.com/en/features/live-timing/) — MEDIUM confidence (live product feature list)
- [Enhancing F1 Data Analysis with FastF1 (pit stop article)](https://medium.com/@sabbasi3/enhancing-formula-1-data-analysis-adding-pit-stop-information-with-fastf1-7f0b09361053) — MEDIUM confidence
- [What Does Interval Mean in F1?](https://www.topracingshop.com/blog/what-does-interval-mean-in-f1.html) — LOW confidence (domain explanation only)

---

*Feature research for: F1 Race Replay Dashboard — second-screen companion*
*Researched: 2026-03-13*
