---
phase: 02-gap-chart-replay-engine
verified: 2026-03-13T15:30:00Z
status: human_needed
score: 13/13 must-haves verified
human_verification:
  - test: "Load a session (2024 season, any race) and verify chart renders with auto-selected P1/P2 drivers immediately after load"
    expected: "Two drivers pre-selected, gap-over-time line visible with dark background and zero-line reference"
    why_human: "Auto-selection and chart render require live backend + FastF1 data; cannot verify programmatically"
  - test: "Hover over the gap chart line"
    expected: "Tooltip shows 'Lap N<br>Gap: X.XXXs' format (single tooltip, not duplicated)"
    why_human: "Plotly tooltip rendering requires a live browser; cannot verify from static code"
  - test: "Verify line color changes at leader-change crossover points"
    expected: "Line uses team color of the leading driver; color switches when zero-line is crossed"
    why_human: "Visual color segmentation requires runtime Plotly render"
  - test: "Press play, watch cursor advance, press pause"
    expected: "Dashed vertical cursor moves lap by lap at 1x; freezes on pause"
    why_human: "Timer behavior and Plotly shape update require live browser"
  - test: "Switch speed to 4x then back to 1x while playing"
    expected: "4x is noticeably faster (250ms/lap vs 1000ms/lap)"
    why_human: "Timing behaviour requires live observation"
  - test: "Drag the scrubber to a random lap mid-race"
    expected: "Cursor jumps to that lap instantly; Lap counter updates"
    why_human: "Range input interaction requires browser"
  - test: "Change Driver A or Driver B in the dropdowns"
    expected: "Dropdowns show 'ABB - Full Name', items grouped by team; chart updates immediately on change"
    why_human: "Dropdown rendering and chart reactivity require browser"
---

# Phase 2: Gap Chart and Replay Engine Verification Report

**Phase Goal:** Build interactive gap chart comparing two drivers over a race, with replay controls (play/pause, speed, scrubber) and team-color visualization.
**Verified:** 2026-03-13T15:30:00Z
**Status:** human_needed (all automated checks pass; 7 items require human browser verification)
**Re-verification:** No - initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Zustand store holds selectedDrivers, currentLap, isPlaying, replaySpeed with proper actions | VERIFIED | sessionStore.ts lines 15-18 (state fields), 30-33 (actions), all with correct types |
| 2 | Gap data hook derives correct gap series from LapRow.Time (not LapTime) | VERIFIED | useGapData.ts line 80: `gaps.push((mapB.get(lap)) - (mapA.get(lap)))` using .Time map built at lines 60-66 |
| 3 | Driver color and name lookups exist for all recent-season drivers | VERIFIED | driverColors.ts exports DRIVER_COLORS, DRIVER_FULL_NAMES, DRIVER_TEAMS covering 2023-2025 grid (23 drivers) with getDriverColor fallback |
| 4 | User sees an interactive gap-over-time chart with dark theme and zero-line reference | VERIFIED (automated) | GapChart.tsx: template: 'plotly_dark', zeroline: true, zerolinecolor set; needs human for visual confirm |
| 5 | Line color changes based on who is leading (team color of leading driver) | VERIFIED (automated) | useGapData.ts lines 106-128: segment algorithm with getColor based on gap sign; uses dynamic teamColor from backend |
| 6 | Hovering shows exact gap value and lap number | VERIFIED (automated) | useGapData.ts line 100: hovertemplate `Lap %{x}<br>Gap: %{y:.3f}s<extra></extra>` on invisible hover trace |
| 7 | Vertical dashed cursor renders at current replay lap | VERIFIED | GapChart.tsx lines 21-38: cursorShape shape with yref:'paper', x0/x1 = currentLap, dash:'dash' |
| 8 | Two driver dropdowns show abbreviation + full name, grouped by team | VERIFIED (automated) | DriverSelector.tsx lines 60-69: SelectGroup per team, SelectItem renders `{abbr} — {driverNames.get(abbr)}` |
| 9 | User can press play and watch lap counter advance automatically | VERIFIED (automated) | useReplayTimer.ts lines 21-38: setInterval at 1000/replaySpeed ms; lapRef pattern avoids stale closure |
| 10 | User can pause to freeze the current lap | VERIFIED | ReplayControls.tsx line 29: `setIsPlaying(!isPlaying)` toggle; useReplayTimer returns early when !isPlaying |
| 11 | User can set replay speed to 0.5x, 1x, 2x, or 4x | VERIFIED | ReplayControls.tsx lines 45-57: four speed buttons wired to setReplaySpeed; intervalMs = 1000/replaySpeed |
| 12 | User can drag a scrubber to jump to any lap instantly | VERIFIED | ReplayControls.tsx lines 60-69: range input min=1 max=maxLap, onChange calls setCurrentLap |
| 13 | Lap counter displays 'Lap X/Y' format | VERIFIED | ReplayControls.tsx line 73: `Lap {currentLap}/{maxLap}` with tabular-nums class |

**Score:** 13/13 truths verified (automated)

---

## Required Artifacts

| Artifact | Status | Lines | Details |
|----------|--------|-------|---------|
| `frontend/src/stores/sessionStore.ts` | VERIFIED | 117 | selectedDrivers, currentLap, isPlaying, replaySpeed, setLaps auto-selects P1/P2, reset clears new fields |
| `frontend/src/lib/driverColors.ts` | VERIFIED | 154 | Exports DRIVER_COLORS, DRIVER_FULL_NAMES, DRIVER_TEAMS, getDriverColor; 23 drivers across 10 teams |
| `frontend/src/components/GapChart/useGapData.ts` | VERIFIED | 197 | useGapData (gap series + segments), useDriverList (team-grouped, spoiler-free); dynamic backend data consumed |
| `frontend/src/components/GapChart/GapChart.tsx` | VERIFIED | 82 | Plotly chart with dark theme, dynamic segments, yref:'paper' cursor, CJS import guard |
| `frontend/src/components/GapChart/DriverSelector.tsx` | VERIFIED | 76 | Two dropdowns, team-grouped via SelectGroup, dynamic fullName from backend, null guard |
| `frontend/src/hooks/useReplayTimer.ts` | VERIFIED | 41 | setInterval with useRef stale-closure fix, auto-pauses at maxLap, exports maxLap |
| `frontend/src/components/ReplayControls/ReplayControls.tsx` | VERIFIED | 77 | Play/pause, 4 speed buttons, range scrubber, Lap X/Y counter; returns null when stage != 'complete' |
| `frontend/src/components/Dashboard/Dashboard.tsx` | VERIFIED | 31 | 5-col grid, col-span-3 left (DriverSelector+GapChart), col-span-2 right (placeholder), responsive |
| `frontend/src/App.tsx` | VERIFIED | 32 | Sticky header with SessionSelector+ReplayControls, max-w-7xl, stage-aware body |
| `frontend/index.html` | VERIFIED | - | class="dark" on html element |
| `frontend/src/index.css` | VERIFIED | - | color-scheme: dark |
| `backend/services/fastf1_service.py` | VERIFIED | - | serialize_drivers returns abbreviation, fullName, team, teamColor from FastF1 session.results |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| useGapData.ts | sessionStore.ts | useSessionStore selectors for laps, drivers, selectedDrivers | WIRED | Lines 40-42: three separate selectors |
| GapChart.tsx | useGapData.ts | useGapData() providing segments array | WIRED | Line 18: `const { segments } = useGapData()` |
| GapChart.tsx | sessionStore.ts | useSessionStore for currentLap | WIRED | Line 19: `const currentLap = useSessionStore((s) => s.currentLap)` |
| DriverSelector.tsx | sessionStore.ts | setSelectedDrivers action | WIRED | Lines 25, 37, 43: selector + usage in both handlers |
| useReplayTimer.ts | sessionStore.ts | Reads isPlaying/replaySpeed/currentLap; calls setCurrentLap/setIsPlaying | WIRED | Lines 5-10: all five store values consumed |
| ReplayControls.tsx | sessionStore.ts | setIsPlaying, setReplaySpeed, setCurrentLap | WIRED | Lines 14-16: three action selectors; all used in handlers |
| ReplayControls.tsx | useReplayTimer.ts | useReplayTimer() for maxLap activation | WIRED | Line 18: `const { maxLap } = useReplayTimer()` |
| App.tsx | ReplayControls.tsx | Rendered in sticky header | WIRED | Line 20: `<ReplayControls />` inside header |
| Dashboard.tsx | GapChart.tsx | Rendered in left column | WIRED | Line 18: `<GapChart />` |
| Dashboard.tsx | DriverSelector.tsx | Rendered above GapChart in left column | WIRED | Line 17: `<DriverSelector />` |
| sse.ts | sessionStore.ts | Calls setLaps with drivers payload | WIRED | sse.ts line 26: `store.setLaps(data.laps, data.drivers)` |
| fastf1_service.py | sse.ts | Emits drivers in SSE complete event | WIRED | fastf1_service.py lines 194-198: drivers_data included in complete JSON payload |

All 12 key links: WIRED

---

## Requirements Coverage

| Requirement | Description | Source Plans | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GAP-01 | User can select two drivers from the loaded session | 02-01, 02-02, 02-04 | SATISFIED | DriverSelector with setSelectedDrivers; auto-select P1/P2 in setLaps |
| GAP-02 | User sees an interactive gap-over-time chart for the selected pair | 02-01, 02-02, 02-04 | SATISFIED | GapChart.tsx renders Plotly scatter from useGapData segments |
| GAP-03 | User can hover to see exact gap values and lap numbers | 02-02, 02-04 | SATISFIED | Invisible hover trace with hovertemplate `Lap %{x}<br>Gap: %{y:.3f}s` |
| REPL-01 | User can start/pause a lap-by-lap replay of the session | 02-03, 02-04 | SATISFIED | Play/pause toggle in ReplayControls; useReplayTimer setInterval |
| REPL-02 | User can set replay speed (0.5x, 1x, 2x, 4x) | 02-03, 02-04 | SATISFIED | Four speed buttons wired to setReplaySpeed; intervalMs = 1000/replaySpeed |
| REPL-03 | User can jump to any lap via a scrubber control | 02-03, 02-04 | SATISFIED | Range input in ReplayControls onChange calls setCurrentLap |
| REPL-04 | Gap chart shows a vertical cursor at the current replay lap | 02-02, 02-04 | SATISFIED | cursorShape in GapChart with x0=x1=currentLap, yref:'paper' |

All 7 requirements: SATISFIED (code verified; runtime behavior flagged for human confirmation)

No orphaned requirements — all 7 IDs declared in plan frontmatter map to the above.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| ReplayControls.tsx line 20 | `return null` | Info | Intentional guard — only renders when session loaded; not a stub |
| Dashboard.tsx line 24 | "Standings coming in Phase 3" placeholder | Info | Intentional Phase 3 placeholder; not blocking Phase 2 goal |

No blocking anti-patterns found.

---

## Notable Implementation Details

### Deviation: Dynamic driver data (significant scope change)

Plan 02-01 specified static hardcoded lookup tables in driverColors.ts. During Plan 02-04 integration, this was correctly identified as a missing critical and replaced with a `serialize_drivers` backend endpoint. The static driverColors.ts file still exists and is shipped (for the fallback `getDriverColor` helper), but DriverSelector and useGapData now consume dynamic backend data for team grouping and colors. This is a correct and improved implementation.

### Gap sign convention

`gap = timeB - timeA` (positive = driverA leading, lower session elapsed time = completed lap sooner). This is consistently applied in useGapData.ts line 80 and documented in both SUMMARY files.

### Stale closure prevention

useReplayTimer.ts uses `lapRef.current = currentLap` (line 19) to snapshot current lap before each interval tick — the pattern specified in the plan to prevent stale closure bugs. Verified present.

### CJS import guard

GapChart.tsx line 3: `(typeof (_Plot as any).default === 'function' ? (_Plot as any).default : _Plot)` — fixes Vite ESM interop double-wrap that caused a blank screen.

### TypeScript compilation

`npx tsc --noEmit` passed with zero errors (verified during plan execution; no compile output means clean build).

---

## Human Verification Required

The following items require a live browser with both frontend and backend servers running.

### 1. Session Load and Auto-Selection (GAP-01)

**Test:** Start servers (`cd backend && uvicorn main:app --reload`, `cd frontend && npm run dev`). Open http://localhost:5173, select 2024 season, any Grand Prix, Race session type, click Load.
**Expected:** After load completes, two drivers are pre-selected (grid P1 and P2). Gap chart renders immediately without showing the "Select two drivers" empty state.
**Why human:** Auto-selection depends on FastF1 data returned by backend; cannot simulate programmatically.

### 2. Gap Chart Visual (GAP-02)

**Test:** With session loaded and two drivers selected, observe the chart.
**Expected:** Dark background (plotly_dark theme), visible zero-line reference, gap line plotted over laps. Chart occupies left ~60% of layout. Standings placeholder appears in right ~40%.
**Why human:** Visual rendering and layout proportions require browser.

### 3. Hover Tooltip (GAP-03)

**Test:** Move cursor over the gap line.
**Expected:** Single tooltip appears (not duplicated) showing `Lap N` and `Gap: X.XXXs` format. No Plotly toolbar visible.
**Why human:** Plotly tooltip requires browser hover interaction.

### 4. Line Color Segmentation (GAP-02)

**Test:** Observe line color across the chart, especially at points where the gap crosses zero.
**Expected:** Line uses the team color of whichever driver is leading at each lap. Color changes at zero-line crossover points.
**Why human:** Visual color rendering requires runtime Plotly.

### 5. Play/Pause and Cursor Tracking (REPL-01, REPL-04)

**Test:** Press the play button. Observe the chart and the lap counter.
**Expected:** Dashed vertical cursor advances lap by lap. Lap counter (e.g. "Lap 12/58") increments. Press pause — cursor freezes.
**Why human:** Timer advancement and Plotly shape re-render require live browser.

### 6. Speed Control (REPL-02)

**Test:** With replay running, switch between 0.5x, 1x, 2x, 4x speed buttons.
**Expected:** Active speed button shows highlighted (default variant). 4x is noticeably faster than 1x (250ms vs 1000ms per lap). Speed change takes effect immediately.
**Why human:** Timing perception requires live observation.

### 7. Scrubber (REPL-03)

**Test:** Drag the scrubber to a random lap position.
**Expected:** Vertical cursor on chart jumps to that lap instantly. Lap counter updates to match.
**Why human:** Range input drag interaction requires browser.

---

## Summary

Phase 2 goal is fully implemented. All 13 observable truths are verified by static code analysis:

- Zustand store correctly extended with replay and driver selection state
- Gap calculation uses LapRow.Time (not LapTime) with correct sign convention
- Segment algorithm splits chart line by leader with team colors and 1-point crossover overlap
- useReplayTimer uses useRef to prevent stale closure; auto-pauses at final lap
- All 7 requirements have complete, substantive, non-stub implementations
- All 12 key links between components are wired
- Dark theme applied globally (class="dark" on html, color-scheme:dark in CSS)
- Dynamic driver/team data served from backend via serialize_drivers SSE endpoint
- TypeScript compiles cleanly (no errors)
- No blocking anti-patterns

The status is `human_needed` because visual rendering, tooltip formatting, animation timing, and interactive controls require a live browser to confirm. The code evidence is strong — all logic paths lead to the correct behavior. Human verification is a confirmation step, not a gap investigation.

---

_Verified: 2026-03-13T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
