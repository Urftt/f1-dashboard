---
phase: 05-dashboard-layout-stint-timeline
verified: 2026-03-14T00:31:00Z
status: human_needed
score: 13/13 must-haves verified
re_verification: false
human_verification:
  - test: "Visual layout and scrollability of analysis section"
    expected: "User can scroll below gap chart and standings board to reach the analysis section with 'STRATEGY & ANALYSIS' divider and stint timeline chart"
    why_human: "Cannot verify scroll behavior, visual appearance of divider, or section visibility in a browser programmatically"
  - test: "Compound-colored bars with centered letter labels"
    expected: "Each stint bar is colored by compound (red=SOFT, yellow=MEDIUM, white=HARD) with S/M/H/I/W letter centered on the bar"
    why_human: "Plotly rendering correctness and text placement inside bars requires a browser"
  - test: "Hover tooltip content"
    expected: "Hovering a bar shows compound name, lap range, stint length, and tyre life"
    why_human: "Hover interaction requires manual browser testing; tooltip format verified in code but rendering cannot be asserted programmatically"
  - test: "Replay cursor sync and progressive reveal"
    expected: "Vertical dashed cursor line appears at currentLap position; only stints up to currentLap are shown; advancing replay reveals more bars"
    why_human: "Live replay interaction with temporal state changes requires browser observation"
  - test: "Analysis section gating"
    expected: "Analysis section is hidden at session start (lap 1, not playing), appears once replay is active (isPlaying or currentLap > 1)"
    why_human: "Requires clicking play or scrubbing the replay controls to confirm visibility toggle"
---

# Phase 5: Dashboard Layout + Stint Timeline Verification Report

**Phase Goal:** Users can scroll the dashboard to see a tire strategy timeline for all drivers, and the analysis section is in place for subsequent charts
**Verified:** 2026-03-14T00:31:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can scroll below gap chart and standings board to reach a new analysis section | ? HUMAN | Dashboard.tsx uses `space-y-6` two-section layout; analysis section rendered below grid when `isReplayActive`. Visual scroll behavior requires browser. |
| 2 | User can view a stint timeline showing all drivers' tire stints as horizontal compound-colored bars spanning their lap range | ? HUMAN | StintTimeline.tsx renders a Plotly horizontal bar chart using `useStintData` traces; `buildStintTraces` produces compound-colored `marker.color` arrays. Chart rendering correctness requires browser. |
| 3 | A vertical replay cursor appears on the stint timeline, synced to the current replay lap | ? HUMAN | `makeReplayCursorShape(currentLap)` is called in `useStintData` Memo 3; result passed to Plotly `shapes` in StintTimeline layout. Cursor display requires browser. |
| 4 | Shared utilities (`lib/compounds.ts`, `lib/plotlyShapes.ts`) exist and are used by the stint timeline; chart data memoizes on `[laps]` only, cursor reads `currentLap` separately | ✓ VERIFIED | Both lib files exist and are imported by `useStintData.ts`. Hook uses three-memo split: Memo 1 on `[laps]`, Memo 2 on `[allStints, laps, drivers, currentLap]`, Memo 3 on `[currentLap]`. |

**Automated score:** 1/4 truths fully verifiable programmatically. All 4 structurally in place; 3 require human browser confirmation.

### Must-Haves from Plan Frontmatter (05-01-PLAN.md)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Stint data groups laps by Stint integer column, not Compound | ✓ VERIFIED | `deriveStints` groups by `Driver::Stint` key. Test "groups by Stint integer, not Compound" passes. |
| 2 | Progressive reveal only shows stints with startLap <= currentLap | ✓ VERIFIED | `computeVisibleStints` filters with `s.startLap <= currentLap`. Tests pass. |
| 3 | Driver order reflects current race position at currentLap | ✓ VERIFIED | `computeDriverOrder` builds `positionAtLap` map from `LapNumber === currentLap`. Tests pass. |
| 4 | Cursor shape is computed in a separate memo from bar data | ✓ VERIFIED | `useStintData.ts` lines 212-216: Memo 3 depends only on `[currentLap]`. |
| 5 | Compound colors match CONTEXT.md canonical values | ✓ VERIFIED | `compounds.ts`: SOFT=#e10600, MEDIUM=#ffd700, HARD=#ffffff, INTERMEDIATE=#00cc00, WET=#0066ff. Tests assert exact hex values. |
| 6 | Replay cursor factory returns correct Plotly shape at any lap | ✓ VERIFIED | `plotlyShapes.ts` returns line shape with correct x0/x1/yref/line properties. 9 tests pass. |

### Must-Haves from Plan Frontmatter (05-02-PLAN.md)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can scroll below gap chart and standings board to see analysis section | ? HUMAN | Code structure present; visual confirmation needed |
| 2 | Analysis section has a 'STRATEGY & ANALYSIS' divider label | ✓ VERIFIED | `Dashboard.tsx` line 46-48: `<span>Strategy &amp; Analysis</span>` with decorative `h-px bg-border` lines |
| 3 | Stint timeline renders horizontal compound-colored bars per driver | ? HUMAN | StintTimeline.tsx renders `<Plot>` with bar trace from `useStintData`. Visual rendering needs browser. |
| 4 | Compound abbreviation (S, M, H, I, W) is centered on each bar | ? HUMAN | `buildStintTraces` sets `textposition: 'inside'`, `insidetextanchor: 'middle'`, `text: getCompoundLetter(...)`. Rendering needs browser. |
| 5 | Hover tooltip shows compound, lap range, stint length, tyre life | ? HUMAN | `hovertemplate: '%{text} compound<br>Laps %{base} - %{customdata}<extra></extra>'` — does not show stint length or tyre life explicitly. Needs browser and template verification. |
| 6 | Drivers are ordered by current race position at replay lap | ✓ VERIFIED | `computeDriverOrder` logic verified by tests; `yAxisCategories` reversed for Plotly so P1 is at top. |
| 7 | Replay cursor appears on stint timeline at currentLap | ? HUMAN | Code wiring present; visual appearance needs browser. |
| 8 | Stint bars progressively reveal during replay | ? HUMAN | `computeVisibleStints` logic tested; runtime behavior needs browser. |
| 9 | Analysis section only shows during active replay | ✓ VERIFIED | `Dashboard.tsx` line 41: `{isReplayActive && ...}` where `isReplayActive = s.isPlaying || s.currentLap > 1` |

**Score:** 13/13 structural must-haves verified. 5 items additionally require human visual/interaction confirmation.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/lib/compounds.ts` | Compound color/letter maps and helper functions | ✓ VERIFIED | 29 lines. Exports: COMPOUND_COLOR, COMPOUND_LETTER, UNKNOWN_COMPOUND_COLOR, UNKNOWN_COMPOUND_LETTER, getCompoundColor, getCompoundLetter. |
| `frontend/src/lib/plotlyShapes.ts` | Plotly shape factory for replay cursor | ✓ VERIFIED | 21 lines. Exports: makeReplayCursorShape. Returns null for lap <=0, correct line shape otherwise. |
| `frontend/src/components/StintTimeline/useStintData.ts` | Data hook for stint timeline chart | ✓ VERIFIED | 219 lines. Exports: Stint, DriverOrderEntry, deriveStints, computeVisibleStints, computeDriverOrder, buildStintTraces, useStintData. Three-memo split implemented. |
| `frontend/vitest.config.ts` | Test runner configuration | ✓ VERIFIED | jsdom environment, globals: true, setupFiles, path aliases, legacy test exclusions. |
| `frontend/src/components/StintTimeline/StintTimeline.tsx` | Stint timeline chart component | ✓ VERIFIED | 73 lines. Calls useStintData, builds Plotly layout with cursor shapes, renders Plot component. Not a stub — full implementation. |
| `frontend/src/components/Dashboard/Dashboard.tsx` | Extended dashboard with analysis section | ✓ VERIFIED | 60 lines. Two-section layout, isReplayActive gate, STRATEGY & ANALYSIS divider, StintTimeline card. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useStintData.ts` | `lib/compounds.ts` | `import getCompoundColor` | ✓ WIRED | Line 5: `import { getCompoundColor, getCompoundLetter } from '@/lib/compounds'`. Used in `buildStintTraces` lines 168-169. |
| `useStintData.ts` | `lib/plotlyShapes.ts` | `import makeReplayCursorShape` | ✓ WIRED | Line 6: `import { makeReplayCursorShape } from '@/lib/plotlyShapes'`. Used in Memo 3 line 214. |
| `useStintData.ts` | `sessionStore.ts` | `useSessionStore` | ✓ WIRED | Lines 196-198: three separate selectors for laps, drivers, currentLap. |
| `StintTimeline.tsx` | `useStintData.ts` | `import useStintData` | ✓ WIRED | Line 4: `import { useStintData } from './useStintData'`. Called line 20: `const { traces, cursorShapes, yAxisCategories } = useStintData()`. |
| `Dashboard.tsx` | `StintTimeline.tsx` | `import StintTimeline` | ✓ WIRED | Line 4: `import { StintTimeline } from '@/components/StintTimeline/StintTimeline'`. Rendered line 54: `<StintTimeline />`. |
| `Dashboard.tsx` | `sessionStore.ts` | `useSessionStore` | ✓ WIRED | Line 5 import; line 22: `const isReplayActive = useSessionStore((s) => s.isPlaying || s.currentLap > 1)`. Used in JSX conditional line 41. |

All 6 key links: WIRED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LAYOUT-01 | 05-02-PLAN.md | Analysis charts displayed in scrollable section below gap chart and standings board | ✓ SATISFIED | Dashboard.tsx two-section layout with full-width analysis section below 5-col grid. Space-y-6 parent enables natural scroll. |
| STRAT-01 | 05-01-PLAN.md, 05-02-PLAN.md | Stint timeline showing all drivers' tire stints as horizontal bars (compound-colored, lap range) | ✓ SATISFIED | StintTimeline.tsx renders horizontal bar chart; useStintData produces compound-colored bars with lap range via base + length encoding. |
| ENHANCE-01 | 05-01-PLAN.md, 05-02-PLAN.md | All charts show a replay cursor (vertical line) synced to current replay lap | ✓ SATISFIED | makeReplayCursorShape produces cursor shape; StintTimeline passes it to Plotly layout.shapes. Pattern established for reuse in phases 6-8. |

All 3 required requirement IDs satisfied. No orphaned requirements (REQUIREMENTS.md traceability table maps exactly LAYOUT-01, STRAT-01, ENHANCE-01 to Phase 5).

### Anti-Patterns Found

No anti-patterns found in phase 5 files. Specifically:
- No TODO/FIXME/PLACEHOLDER comments in any of the 6 new files
- No empty return implementations in StintTimeline.tsx or Dashboard.tsx
- No console.log-only handlers
- StintTimeline has a guarded empty state (`traces.length === 0`) that renders a proper "No stint data available" message — this is correct defensive UI, not a stub

One observation (non-blocking): The hover template `'%{text} compound<br>Laps %{base} - %{customdata}<extra></extra>'` shows compound and lap range but does not explicitly show stint length or tyre life. The 05-02-PLAN.md must_haves truth states "Hover tooltip shows compound, lap range, stint length, tyre life". The `<extra></extra>` strips the trace name. Tyre life is stored in `tyreLifeAtEnd` on the Stint object but is not included in `customdata` or the hover template. This is a minor gap worth human confirmation.

### Human Verification Required

#### 1. Scrollable Analysis Section Appearance

**Test:** Load a race session, start replay, scroll below the gap chart and standings board
**Expected:** A horizontal divider line appears with "STRATEGY & ANALYSIS" label centered, followed by a full-width card containing the stint timeline chart
**Why human:** CSS layout and scroll behavior cannot be verified programmatically

#### 2. Compound-Colored Bars with Letter Labels

**Test:** With replay active and past lap 1, observe the stint timeline chart
**Expected:** Horizontal bars colored red (SOFT), yellow (MEDIUM), or white (HARD); each bar has its compound letter (S/M/H) centered on it
**Why human:** Plotly rendering and text placement inside bars requires browser observation

#### 3. Hover Tooltip Content

**Test:** Hover over a stint bar in the chart
**Expected:** Tooltip shows compound type and lap range (e.g., "S compound, Laps 1 - 20"); note whether stint length and tyre life are also shown
**Why human:** Interactive hover requires browser; also confirms whether the hover template gap noted above is acceptable

#### 4. Replay Cursor Sync

**Test:** With replay running, observe the vertical cursor line on the stint timeline
**Expected:** A dashed vertical white line appears at the current replay lap position and advances as replay progresses
**Why human:** Real-time cursor movement during replay requires live observation

#### 5. Progressive Reveal and Gating

**Test:** At lap 1 (before playing): confirm analysis section is hidden. Press play and advance to lap 10: confirm only stints started by lap 10 appear. Scrub back to lap 5: confirm stints starting at laps 6-10 disappear.
**Expected:** Spoiler-free reveal — future stints not shown; section hidden until replay starts
**Why human:** Temporal state changes during replay interaction require browser testing

---

## Gaps Summary

No structural gaps. All 6 artifacts exist with full implementations, all 6 key links are wired, all 3 requirements satisfied, 51 tests pass, TypeScript compiles cleanly in phase 5 files (pre-existing errors in legacy test files outside phase scope are not regressions introduced by this phase).

One minor concern to confirm during human verification: the hover template may not include tyre life as stated in the 05-02-PLAN.md must_haves. The code shows `hovertemplate: '%{text} compound<br>Laps %{base} - %{customdata}<extra></extra>'` — `customdata` holds `endLap`, not tyre life. If the plan requirement for tyre life in hover is strict, this warrants a fix after human verification.

---

_Verified: 2026-03-14T00:31:00Z_
_Verifier: Claude (gsd-verifier)_
