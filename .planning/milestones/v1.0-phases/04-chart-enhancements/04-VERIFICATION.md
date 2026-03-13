---
phase: 04-chart-enhancements
verified: 2026-03-13T00:00:00Z
status: passed
score: 14/14 automated must-haves verified
human_verification:
  - test: "Load a race with pit stops and safety cars (e.g. 2023 Australian GP Race). Select two drivers. Verify pit stop vertical lines appear at correct laps with team colors and 3-letter driver abbreviation label at the top."
    expected: "Team-colored vertical solid lines (1px) appear at each pit lap for both selected drivers. Driver abbreviation label visible at top of each line."
    why_human: "Plotly shape rendering and label positioning cannot be verified programmatically."
  - test: "Hover over a pit stop line on the gap chart."
    expected: "Tooltip shows format 'VER pit — Lap 12' (actual abbreviation and lap number). Tooltip appears reliably when hovering near the vertical line."
    why_human: "Plotly hover behavior on invisible two-point line traces requires visual confirmation."
  - test: "Load a race with a safety car period. Select two drivers. Verify SC/VSC shading is visible."
    expected: "Yellow shading covers the SC lap range (stronger opacity 0.18). Lighter yellow for VSC (opacity 0.08). 'SC' or 'VSC' text label visible at top-left of shaded region."
    why_human: "Color opacity differentiation between SC and VSC requires visual inspection."
  - test: "Load a race with a red flag (e.g. 2022 British GP). Select two drivers."
    expected: "Red band with border visible at the red flag lap(s). 'RED' label at top-left of band."
    why_human: "Red flag band rendering requires visual confirmation."
  - test: "Press play on the replay and watch annotations appear progressively."
    expected: "Pit stop lines and SC shading only appear as replay cursor reaches that lap. Scrubbing backward hides annotations beyond current lap. Active SC shading grows with cursor from start_lap to currentLap."
    why_human: "Progressive reveal is time-dependent animated behavior that cannot be verified statically."
  - test: "Verify z-ordering: SC shading behind gap line, pit lines on top of shading, cursor on top of pit lines."
    expected: "Gap colored line is visible on top of yellow SC shading. Pit lines are visible on top of shading. White dashed cursor is the topmost element."
    why_human: "Z-order requires visual inspection of layered chart elements."
  - test: "Load a clean race with no safety car (e.g. 2023 Bahrain GP). Select two drivers."
    expected: "Chart looks unchanged — no yellow shading, no unexpected shapes. Pit stop lines still appear correctly."
    why_human: "Visual regression check requires human inspection."
  - test: "If both selected drivers pit on the same lap, verify offset rendering."
    expected: "Two separate vertical lines visible, offset by approximately 0.15 laps in opposite directions (one at pitLap-0.15, one at pitLap+0.15). Each line shows its respective driver abbreviation."
    why_human: "Sub-lap offset rendering and label readability require visual confirmation."
---

# Phase 04: Chart Enhancements Verification Report

**Phase Goal:** Users can read the gap chart without external context — pit stops and safety car periods are visible as annotations and shading directly on the chart
**Verified:** 2026-03-13
**Status:** human_needed (all automated checks passed; visual/behavioral verification required)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Backend parses track_status into lap-indexed safety car periods with correct type (SC/VSC/RED) | VERIFIED | `parse_safety_car_periods()` at line 132 of fastf1_service.py; status_map correctly maps '4'->SC, '6'/'7'->VSC, '5'->RED; 11 TestSafetyCarParsing tests pass |
| 2 | SSE complete event includes safetyCarPeriods array alongside laps and drivers | VERIFIED | `load_session_stream()` lines 348-356: calls `parse_safety_car_periods(session)` and includes `"safetyCarPeriods": safety_car_data` in complete event JSON |
| 3 | Frontend store holds safetyCarPeriods and exposes them to consumers | VERIFIED | `sessionStore.ts` line 13: `safetyCarPeriods: SafetyCarPeriod[]` in SessionState; line 50: in initialState; line 96: `safetyCarPeriods: safetyCarPeriods ?? []` in setLaps |
| 4 | User sees vertical team-colored lines at laps where either selected driver pitted | VERIFIED (code) | `useGapData.ts` lines 183-257: pitStopShapes built with `type: 'line'`, `line: { color: colorA/colorB, width: 1 }`; filtered by `l.LapNumber <= currentLap` | NEEDS HUMAN (visual) |
| 5 | Pit lines show driver abbreviation label at top | VERIFIED (code) | `useGapData.ts` line 201-207: `label: { text: driverA, textposition: 'top left', font: { color: colorA, size: 9 } }` | NEEDS HUMAN (visual) |
| 6 | Hovering a pit stop line shows 'VER pit — Lap 12' format tooltip | VERIFIED (code) | `useGapData.ts` lines 210-221: invisible two-point line traces with `hoverinfo: 'text'` and `text: ['${driverA} pit — Lap ${pitLap}', ...]` | NEEDS HUMAN (interactive) |
| 7 | Same-lap double pits render side-by-side with slight offset | VERIFIED (code) | `useGapData.ts` lines 179-188: Set intersection detects collision; driverA offset -0.15, driverB offset +0.15 | NEEDS HUMAN (visual) |
| 8 | User sees yellow shading for SC periods and lighter yellow for VSC periods | VERIFIED (code) | `useGapData.ts` lines 274-279: SC `rgba(255,200,0,0.18)`, VSC `rgba(255,200,0,0.08)` | NEEDS HUMAN (visual) |
| 9 | SC/VSC shading has text label ('SC' or 'VSC') at top of shaded region | VERIFIED (code) | `useGapData.ts` lines 299-304: `label: { text: period.type, textposition: 'top left', font: { color: labelColor, size: 10 } }` | NEEDS HUMAN (visual) |
| 10 | Red flag shows as thick red vertical band with 'RED' label | VERIFIED (code) | `useGapData.ts` lines 282-284: RED fillcolor `rgba(255,0,0,0.25)` with border `rgba(255,0,0,0.5)` width 2; label `'RED'` | NEEDS HUMAN (visual) |
| 11 | Annotations only appear once replay cursor reaches that lap (progressive reveal) | VERIFIED (code) | `useGapData.ts` lines 163-176: pit laps filtered `l.LapNumber <= currentLap`; SC periods line 265: `if (period.start_lap > currentLap) continue`; `currentLap` in useMemo deps line 309 | NEEDS HUMAN (behavioral) |
| 12 | Scrubbing backward hides annotations beyond current lap | VERIFIED (code) | Same progressive reveal logic as #11; `currentLap` in useMemo deps ensures recompute on every lap change | NEEDS HUMAN (behavioral) |
| 13 | Active SC periods grow with replay — shading extends from start to current lap | VERIFIED (code) | `useGapData.ts` line 268: `const x1 = Math.min(period.end_lap, currentLap)` | NEEDS HUMAN (behavioral) |
| 14 | Z-order: SC shading (back) -> pit lines (middle) -> gap line (front) -> cursor (front) | VERIFIED (code) | `GapChart.tsx` lines 58-62: `[...scShapes, ...pitStopShapes, ...cursorShape]`; scShapes `layer: 'below'`, pitStopShapes `layer: 'above'` | NEEDS HUMAN (visual) |

**Automated score:** 14/14 truths have correct code implementation

---

## Required Artifacts

### Plan 01 Artifacts (GAP-05)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/services/fastf1_service.py` | `parse_safety_car_periods()` and `_time_to_lap()` | VERIFIED | Both functions present at lines 81 and 132; substantive implementations with full logic |
| `backend/models/schemas.py` | `SafetyCarPeriod` Pydantic model | VERIFIED | `class SafetyCarPeriod(BaseModel)` at line 44 with `start_lap: int`, `end_lap: int`, `type: str` |
| `backend/tests/test_sessions.py` | `TestSafetyCarParsing` test class | VERIFIED | Class present at line 223 with 11 tests covering all behavior cases |
| `frontend/src/types/session.ts` | `SafetyCarPeriod` TypeScript interface | VERIFIED | `export interface SafetyCarPeriod` at line 34 with correct union type `'SC' \| 'VSC' \| 'RED'` |
| `frontend/src/stores/sessionStore.ts` | `safetyCarPeriods` state field and updated `setLaps` | VERIFIED | Field at line 13; updated setLaps signature line 27; implementation line 83-96 |
| `frontend/src/lib/sse.ts` | SSE handler passes `safetyCarPeriods` to store | VERIFIED | Lines 22-28: parses `safetyCarPeriods` from complete event; passes to `store.setLaps(data.laps, data.drivers, data.safetyCarPeriods)` |

### Plan 02 Artifacts (GAP-04, GAP-05)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/components/GapChart/useGapData.ts` | `pitStopShapes`, `pitStopHoverTraces`, `scShapes` in `GapDataResult` | VERIFIED | `GapDataResult` interface at lines 29-36 includes all three arrays; `annotationShapes` useMemo block at lines 143-309 builds all three |
| `frontend/src/components/GapChart/GapChart.tsx` | Extended shapes array with SC rects, pit lines, cursor, and pit hover traces in data | VERIFIED | Destructures all three at line 18; composes shapes at lines 58-62; spreads hover traces at line 78 |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `fastf1_service.py` | SSE complete event | `parse_safety_car_periods()` called in `load_session_stream()` | WIRED | Line 348: `safety_car_data = parse_safety_car_periods(session)`; line 354: `"safetyCarPeriods": safety_car_data` in event JSON |
| `frontend/src/lib/sse.ts` | `frontend/src/stores/sessionStore.ts` | SSE complete handler passes `safetyCarPeriods` to `setLaps` | WIRED | Line 28: `store.setLaps(data.laps, data.drivers, data.safetyCarPeriods)` — three-argument call with safety car data |

### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useGapData.ts` | `sessionStore.ts` | reads `safetyCarPeriods`, `laps`, `drivers`, `selectedDrivers`, `currentLap` from store | WIRED | Lines 47-51: all five store selectors present; `safetyCarPeriods` used in annotationShapes useMemo at line 263 |
| `GapChart.tsx` | `useGapData.ts` | destructures `pitStopShapes`, `pitStopHoverTraces`, `scShapes`; spreads into layout.shapes and Plot data | WIRED | Line 18: destructures all three; lines 59-61: spread into shapes; line 78: hover traces spread into `data` prop |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GAP-04 | 04-02-PLAN.md | User sees vertical annotations on laps where either driver pitted | SATISFIED | `pitStopShapes` (team-colored vertical lines) and `pitStopHoverTraces` ("VER pit — Lap N" tooltips) built in `useGapData.ts`, rendered in `GapChart.tsx` |
| GAP-05 | 04-01-PLAN.md, 04-02-PLAN.md | User sees yellow shading on laps under Safety Car or VSC | SATISFIED | Backend `parse_safety_car_periods()` parses SC/VSC/RED periods; data flows via SSE to store; `scShapes` built in `useGapData.ts` with correct colors, rendered in `GapChart.tsx` with `layer: 'below'` |

Both requirements assigned to Phase 4 in REQUIREMENTS.md traceability table are satisfied. No orphaned requirements found.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `GapChart.tsx` | 14 | "Hover tooltip showing..." in JSDoc | Info | Comment only — not a code stub; no impact |

No blockers. No stubs. No empty implementations.

---

## Human Verification Required

### 1. Pit Stop Lines Visual Rendering

**Test:** Load a race with pit stops (e.g. 2023 Australian GP Race). Select two drivers. Observe the gap chart.
**Expected:** Team-colored vertical solid lines (1px) appear at each pit lap for both selected drivers. Driver abbreviation (3-letter) label is visible at the top of each line.
**Why human:** Plotly shape label rendering and color accuracy cannot be verified statically.

### 2. Pit Stop Hover Tooltip

**Test:** Hover over a pit stop line on the gap chart.
**Expected:** Tooltip appears showing "VER pit — Lap 12" format with actual driver abbreviation and lap number. Tooltip triggers reliably when hovering near the vertical line position.
**Why human:** Plotly hover behavior on invisible two-point line traces (y: [0,1], line.width: 0) requires interactive confirmation that the hover fires correctly.

### 3. SC/VSC Shading Differentiation

**Test:** Load a race with both SC and VSC periods. Select two drivers.
**Expected:** SC shading is visibly more opaque (stronger yellow) than VSC shading (lighter yellow). Both show their respective text label ('SC' or 'VSC') at the top-left of the shaded region.
**Why human:** Opacity differentiation between SC (0.18) and VSC (0.08) requires visual inspection.

### 4. Red Flag Band

**Test:** Load a race with a red flag (e.g. 2022 British GP Race). Select two drivers.
**Expected:** A red vertical band with a border is visible at the red flag lap(s). 'RED' label appears at top-left. Band is visually distinct from SC/VSC yellow shading.
**Why human:** Red flag band rendering requires visual confirmation.

### 5. Progressive Reveal — Forward

**Test:** With a race loaded and two drivers selected, press play on the replay from lap 1.
**Expected:** Pit stop lines appear one by one as the replay cursor reaches each pit lap. SC shading appears when cursor reaches its start lap and grows rightward as replay advances through the period.
**Why human:** Animated time-dependent behavior cannot be verified statically.

### 6. Progressive Reveal — Backward Scrub

**Test:** Advance replay to a lap after a pit stop, then drag the scrubber back before that lap.
**Expected:** Pit stop line disappears when scrubber moves before the pit lap. SC shading shrinks or disappears when scrubbing back before or during the SC period.
**Why human:** Reactivity on scrub-backward requires interactive testing.

### 7. Z-Order Verification

**Test:** Load a race with a SC period that contains a pit stop within it. Select two drivers including the driver who pitted during SC.
**Expected:** Gap line visible on top of yellow SC shading. Pit line visible on top of shading. White dashed replay cursor visible on top of everything including pit lines.
**Why human:** Z-ordering of overlapping Plotly layers requires visual inspection.

### 8. Same-Lap Double Pit Offset

**Test:** Find a race lap where both selected drivers pitted on the same lap. Select those drivers.
**Expected:** Two separate vertical lines visible, slightly offset from each other (not overlapping). Each shows its respective driver abbreviation label.
**Why human:** Sub-lap pixel-level offset and label readability require visual confirmation.

### 9. Clean Race Regression

**Test:** Load a race with no safety car (e.g. 2023 Bahrain GP). Select two drivers.
**Expected:** Chart looks identical to previous phase — no yellow shading, no unexpected shapes. Pit stop lines still appear correctly. Gap line and cursor are unaffected.
**Why human:** Visual regression check requires human inspection.

---

## Gaps Summary

No automated gaps found. All 14 observable truths have correct code implementations. All 8 artifacts are present and substantive. Both key links in both plans are wired end-to-end. Requirements GAP-04 and GAP-05 are fully implemented.

Verification is blocked only on human visual/behavioral inspection — automated code analysis cannot confirm Plotly renders shapes correctly, hover tooltips fire, opacity differences are perceptible, or progressive reveal feels correct during live replay.

---

_Verified: 2026-03-13_
_Verifier: Claude (gsd-verifier)_
