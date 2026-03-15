---
phase: 06-lap-time-chart-position-chart
verified: 2026-03-14T13:17:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Lap time scatter chart renders correctly in browser with real session data"
    expected: "Scatter points visible, outlier laps dimmed to 30% opacity, trend lines overlaid per stint"
    why_human: "Visual opacity rendering cannot be verified programmatically; Plotly per-point opacity array requires visual inspection"
  - test: "Driver toggle checkboxes change visible drivers in both LapTimeChart and PositionChart"
    expected: "Toggling a driver off removes them from both charts immediately"
    why_human: "Shared visibleDrivers state threading across components requires interactive browser verification"
  - test: "Position chart hover highlighting works"
    expected: "Hovering a driver line thickens it to width 3 and dims all others to 0.3 opacity"
    why_human: "React state hover interaction cannot be verified with static code analysis"
  - test: "Dashboard analysis section order is correct"
    expected: "Section appears: StintTimeline -> DriverToggle -> LapTimeChart -> PositionChart"
    why_human: "Visual layout order requires browser inspection"
---

# Phase 06: Lap Time Chart + Position Chart Verification Report

**Phase Goal:** Lap-time scatter chart with stint trend lines and position-change chart
**Verified:** 2026-03-14T13:17:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can toggle individual drivers on/off via a team-grouped checkbox panel | VERIFIED | `DriverToggle.tsx` renders team-grouped checkboxes via `useDriverList()`, wired in `Dashboard.tsx` line 64 |
| 2 | User can view a lap time scatter chart for selected drivers with outlier laps at 30% opacity | VERIFIED | `buildLapTimeTraces` produces per-point opacity array (0.3/1.0); `LapTimeChart.tsx` renders Plotly scattergl; 5 passing tests confirm behavior |
| 3 | User can see per-stint linear trend lines overlaid on the lap time chart | VERIFIED | `computeAllTrendLines` computes per-driver-stint regression; `useLapTimeData` returns `trendTraces`; `LapTimeChart` spreads them into `data` prop |
| 4 | SC/VSC periods appear as shaded regions on the lap time chart | VERIFIED | `buildSCShapes` in `useLapTimeData.ts` produces rect shapes; 5 passing tests confirm progressive reveal and fill colors |
| 5 | Replay cursor appears on the lap time chart synced to current lap | VERIFIED | Memo 3 in `useLapTimeData` calls `makeReplayCursorShape(currentLap)` from `plotlyShapes.ts`; cursor included in `layout.shapes` |
| 6 | Default visibility is top 2 drivers by lap 1 position | VERIFIED | `computeDefaultVisible` filters lap 1 positions, sorts, slices top 2; 5 passing tests confirm behavior |
| 7 | User can view a position chart showing drivers' positions over laps with P1 at the top | VERIFIED | `PositionChart.tsx` uses `autorange: 'reversed'` and `dtick: 1`; `buildPositionTraces` confirmed by 8 tests |
| 8 | Only toggled-on drivers appear in the position chart | VERIFIED | `usePositionData(visibleDrivers)` receives shared `visibleDrivers` from `Dashboard`; test "returns only visible drivers traces" passes |
| 9 | Driver abbreviation labels appear at the end of each line | VERIFIED | `buildEndOfLineAnnotations` places annotation at last lap per driver; 7 passing tests confirm xanchor, xshift, showarrow |
| 10 | SC/VSC periods appear as shaded regions on the position chart | VERIFIED | `buildSCShapes` duplicated in `usePositionData.ts`; 4 passing tests confirm progressive reveal; shapes included in layout |
| 11 | Replay cursor appears on the position chart synced to current lap | VERIFIED | Memo 3 in `usePositionData` calls `makeReplayCursorShape(currentLap)`; shapes spread into `layout.shapes` |
| 12 | Hovering a driver line highlights it and dims all others | VERIFIED | `PositionChart.tsx` uses `useState(hoveredTraceIndex)`; `onHover`/`onUnhover` callbacks set index; data remapped with `opacity: 0.3 / 1` and `width: 1.5 / 3` per trace |
| 13 | Progressive reveal: only laps up to currentLap are shown | VERIFIED | Both `buildLapTimeTraces` and `buildPositionTraces` filter `LapNumber <= currentLap`; `buildSCShapes` clamps `end_lap` to `currentLap`; tests confirm |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/components/DriverToggle/useVisibleDrivers.ts` | Shared visible-drivers state hook | VERIFIED | 49 lines; exports `useVisibleDrivers` and `computeDefaultVisible`; reads from `useSessionStore` |
| `frontend/src/components/DriverToggle/DriverToggle.tsx` | Team-grouped checkbox panel UI | VERIFIED | 72 lines; exports `DriverToggle`; renders team-grouped checkboxes with team colors; wired to `useDriverList` + `useSessionStore` |
| `frontend/src/components/LapTimeChart/useLapTimeData.ts` | Lap time scatter traces, trend line traces, SC shapes | VERIFIED | 299 lines; exports `useLapTimeData`, `linearRegression`, `isOutlierLap`, `buildLapTimeTraces`, `computeAllTrendLines`, `buildSCShapes` |
| `frontend/src/components/LapTimeChart/LapTimeChart.tsx` | Plotly scatter chart rendering lap times | VERIFIED | 66 lines; exports `LapTimeChart`; CJS interop, dark theme, full layout including shapes and trend traces |
| `frontend/src/components/PositionChart/usePositionData.ts` | Position line traces, annotations, SC shapes | VERIFIED | 202 lines; exports `usePositionData`, `buildPositionTraces`, `buildEndOfLineAnnotations`, `buildSCShapes` |
| `frontend/src/components/PositionChart/PositionChart.tsx` | Plotly scattergl chart with hover highlighting | VERIFIED | 105 lines; exports `PositionChart`; state-based hover highlighting, `autorange: 'reversed'`, CJS interop |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useVisibleDrivers.ts` | `useSessionStore` | reads laps for default selection | VERIFIED | Line 3: `import { useSessionStore }`, line 21: `useSessionStore((s) => s.laps)` |
| `useLapTimeData.ts` | `useSessionStore` | reads laps, drivers, currentLap, safetyCarPeriods | VERIFIED | Lines 241-244: four separate store selectors |
| `useLapTimeData.ts` | `frontend/src/lib/plotlyShapes.ts` | `makeReplayCursorShape` for cursor | VERIFIED | Line 5: `import { makeReplayCursorShape }`, line 294: called in Memo 3 |
| `Dashboard.tsx` | `DriverToggle + LapTimeChart` | `visibleDrivers` prop threading | VERIFIED | Lines 27, 64, 69: `useVisibleDrivers()` called at top level; `visibleDrivers` passed to both components |
| `usePositionData.ts` | `useSessionStore` | reads laps, drivers, currentLap, safetyCarPeriods | VERIFIED | Lines 163-166: four separate store selectors |
| `usePositionData.ts` | `frontend/src/lib/plotlyShapes.ts` | `makeReplayCursorShape` for cursor | VERIFIED | Line 5: `import { makeReplayCursorShape }`, line 197: called in Memo 3 |
| `PositionChart.tsx` | hover state fallback | hover/unhover opacity changes via `useState` | VERIFIED | Lines 28-48: `hoveredTraceIndex` state; trace opacity/width recomputed in render |
| `Dashboard.tsx` | `PositionChart` | `visibleDrivers` prop from `useVisibleDrivers` | VERIFIED | Line 7: import; line 74: `<PositionChart visibleDrivers={visibleDrivers} />` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| STRAT-02 | 06-01-PLAN.md | User can view a lap time chart plotting selected drivers' lap times as a scatter plot across laps | SATISFIED | `LapTimeChart.tsx` + `useLapTimeData.ts` fully implement scattergl scatter chart |
| STRAT-03 | 06-01-PLAN.md | User can see per-stint trend lines overlaid on the lap time chart to visualize degradation rate | SATISFIED | `computeAllTrendLines` produces per-driver-stint regression; `LapTimeChart` renders them as dotted lines |
| ENHANCE-02 | 06-01-PLAN.md + 06-02-PLAN.md | All time-series charts show SC/VSC period shading | SATISFIED | `buildSCShapes` implemented in both `useLapTimeData.ts` and `usePositionData.ts` with progressive reveal |
| ENHANCE-03 | 06-01-PLAN.md | Multi-driver charts have a driver visibility toggle | SATISFIED | `DriverToggle` + `useVisibleDrivers` implemented; shared state threads to both LapTimeChart and PositionChart |
| RACE-01 | 06-02-PLAN.md | User can view a position chart showing all drivers' positions over laps (P1 at top) | SATISFIED | `PositionChart.tsx` with `autorange: 'reversed'`, end-of-line labels, hover highlighting |

**Orphaned requirements check:** REQUIREMENTS.md maps STRAT-02, STRAT-03, RACE-01, ENHANCE-02, ENHANCE-03 to Phase 6. All five appear in plan frontmatter and are satisfied. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `useLapTimeData.ts` | 265 | `(t as any).name` cast | Info | TypeScript escape hatch for Plotly type limitation — acceptable, no runtime risk |
| `usePositionData.ts` | 192 | `// eslint-disable-next-line react-hooks/exhaustive-deps` | Info | Intentional: memo depends on `lapsByDriver` (derived from `laps`) rather than `laps` directly — documented pattern |

No blocker or warning anti-patterns found. Both info-level items are intentional and documented.

### Human Verification Required

#### 1. Lap time chart visual rendering

**Test:** Load a race session, start replay, observe the lap time chart
**Expected:** Scatter points visible per driver; pit laps and lap 1 visibly dimmer than clean laps; dotted trend lines overlaid per stint
**Why human:** Per-point opacity arrays in Plotly scattergl require visual inspection to confirm rendering

#### 2. Driver toggle cross-chart state sharing

**Test:** Load a session, toggle a driver off in DriverToggle, check both LapTimeChart and PositionChart
**Expected:** Driver disappears from both charts simultaneously
**Why human:** Shared React state threading with Set<string> requires interactive browser verification

#### 3. Position chart hover highlighting

**Test:** Hover over a driver line in the position chart
**Expected:** Hovered line thickens and stays at full opacity; all other lines thin and dim to 30%
**Why human:** React state hover interaction with Plotly re-renders requires live browser testing

#### 4. Dashboard analysis section order

**Test:** Load a session and start replay
**Expected:** Analysis section renders: StintTimeline, then DriverToggle, then LapTimeChart, then PositionChart (top to bottom)
**Why human:** Visual layout order requires browser inspection

### Gaps Summary

No gaps found. All 13 observable truths verified against the codebase. All 6 required artifacts exist, are substantive (non-stub), and are wired. All 8 key links confirmed. All 5 requirements (STRAT-02, STRAT-03, RACE-01, ENHANCE-02, ENHANCE-03) satisfied with implementation evidence. 99 tests pass, TypeScript compiles clean.

Four items flagged for human verification cover visual rendering and interactive behavior that cannot be confirmed by static code analysis.

---

_Verified: 2026-03-14T13:17:00Z_
_Verifier: Claude (gsd-verifier)_
