---
phase: 03-standings-board
verified: 2026-03-13T17:00:00Z
status: human_needed
score: 5/5 automated must-haves verified
re_verification: false
human_verification:
  - test: "Standings table shows all drivers in position order at current replay lap"
    expected: "All 20 drivers listed, sorted by race position, at the lap shown by the replay cursor"
    why_human: "Requires live session data to confirm position ordering is correct for a real race"
  - test: "Gap/interval toggle switches column between INT and GAP display"
    expected: "Clicking the INT/GAP column header button switches all rows between interval-to-car-ahead and gap-to-leader values"
    why_human: "Button interaction and computed value correctness require visual inspection with real lap time data"
  - test: "Tire compound shown as correct colored letter with tire age, updating on pit stops"
    expected: "S (red), M (yellow), H (white), I (green), W (blue) letters with laps-on-set count; compound letter and age reset when a driver pits"
    why_human: "Color rendering, compound change detection, and tire age accuracy require real session replay"
  - test: "Pit stop count increments correctly as replay advances past pit windows"
    expected: "All drivers start at 0; count increments when replay lap passes a lap where PitInTime is non-null"
    why_human: "Accuracy of pit count requires scrubbing through a real race replay"
  - test: "Standings updates when replay cursor advances (play or scrub)"
    expected: "Table rows reorder and values change as currentLap increments or is dragged to a new value"
    why_human: "Reactive replay sync requires live browser testing"
---

# Phase 3: Standings Board Verification Report

**Phase Goal:** Standings board showing driver positions, gaps, tires and pit stops at current replay lap
**Verified:** 2026-03-13T17:00:00Z
**Status:** human_needed — all automated checks pass; visual/functional verification required
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees a standings table listing all drivers in race position order at the current replay lap | VERIFIED | `useStandingsData` sorts by `realPosition`, `StandingsBoard` renders all rows; wired via `useStandingsData()` call in `StandingsBoard.tsx` |
| 2 | Each row shows gap to the race leader and interval to the car directly ahead, toggleable via column header | VERIFIED | `gapCell` logic in `StandingRowItem` reads `mode` (gap/interval); header `<button>` toggles `useState<GapMode>('interval')` |
| 3 | Each row shows the driver's current tire compound as a colored letter and laps on that tire set | VERIFIED | `COMPOUND_DISPLAY` map drives colored `<span>` with letter; `row.tyreLife` rendered in AGE column |
| 4 | Each row shows how many pit stops the driver has made up to that lap | VERIFIED | `pitCountMap` in `useStandingsData` counts `PitInTime !== null` rows up to `currentLap`; `row.pitStops` rendered in PIT column |
| 5 | When the user advances the replay, the standings table updates to reflect the new lap | VERIFIED | `useMemo` depends on `[laps, drivers, currentLap]`; store selector `useSessionStore((s) => s.currentLap)` re-triggers on replay advance |

**Score: 5/5 truths verified by static analysis**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/components/StandingsBoard/useStandingsData.ts` | Memoized data derivation hook computing StandingRow[] from store | VERIFIED | 171 lines; exports `useStandingsData`, `COMPOUND_DISPLAY`; full gap/interval/pit/DNF logic present |
| `frontend/src/components/StandingsBoard/StandingsBoard.tsx` | Presentational standings table component | VERIFIED | 159 lines; exports `StandingsBoard`; renders header, toggle button, all columns, DNF styling |
| `frontend/src/components/Dashboard/Dashboard.tsx` | Updated dashboard layout importing StandingsBoard | VERIFIED | Imports `StandingsBoard` from `@/components/StandingsBoard/StandingsBoard`; renders in `lg:col-span-2` right column |
| `frontend/src/types/session.ts` | StandingRow type exported | VERIFIED | `StandingRow` interface at line 40; includes all required fields plus DNF additions (`status`, `retiredOnLap`) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useStandingsData.ts` | `sessionStore` | `useSessionStore((s) => s.laps/drivers/currentLap)` | WIRED | Lines 24-26: three store selectors present; `useMemo` depends on all three |
| `StandingsBoard.tsx` | `useStandingsData` | `const rows = useStandingsData()` | WIRED | Line 111; result mapped directly to `StandingRowItem` components |
| `Dashboard.tsx` | `StandingsBoard` | `import { StandingsBoard }` + `<StandingsBoard />` | WIRED | Import at line 3; rendered at line 24 inside `lg:col-span-2` div |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| STND-01 | 03-01-PLAN.md | User sees a standings board showing driver positions at the current lap | SATISFIED | `useStandingsData` derives sorted position list from `currentLap`; `StandingsBoard` renders it |
| STND-02 | 03-01-PLAN.md | Standings show gap to leader and interval to car ahead | SATISFIED | `gap` and `interval` computed from `LapRow.Time`; toggle button switches between modes |
| STND-03 | 03-01-PLAN.md | Standings show tire compound and tire age for each driver | SATISFIED | `COMPOUND_DISPLAY` map renders colored letter; `row.tyreLife` in AGE column |
| STND-04 | 03-01-PLAN.md | Standings show pit stop count for each driver | SATISFIED | `pitCountMap` counts `PitInTime !== null` laps; rendered as `row.pitStops` |

All four phase requirements are claimed by plan 03-01 and plan 03-02, and all are marked complete in `REQUIREMENTS.md`. No orphaned requirements for Phase 3.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `Dashboard.tsx` | 9 | JSDoc comment says "Standings placeholder for Phase 3" | Info | Stale comment — the JSX at line 24 correctly renders `<StandingsBoard />`; no functional impact |

No blocker or warning-level anti-patterns found. The two early-return `return []` statements in `useStandingsData.ts` are correct guard clauses (empty laps array and empty allRows), not stubs.

---

### Human Verification Required

The automated checks confirm all artifacts exist, are substantive, and are wired. The following items require a human to load a real race session (e.g. 2024 Bahrain GP Race) and replay it:

#### 1. Position ordering correctness at current lap

**Test:** Load a race session, observe standings at lap 1 and at lap 30.
**Expected:** Drivers appear in the correct race order matching official results for each lap.
**Why human:** Position values come from FastF1 data; correctness of ordering requires visual cross-check against known results.

#### 2. Gap/interval toggle behavior and value accuracy

**Test:** Click the INT/GAP header button; observe values change across all rows. Toggle back.
**Expected:** INT mode shows seconds to car directly ahead; GAP mode shows cumulative gap to leader; leader row shows "---".
**Why human:** Numeric accuracy of gap/interval computations from `LapRow.Time` requires real data validation.

#### 3. Tire compound and age rendering through a pit stop

**Test:** Scrub to a lap where a driver pits (e.g. lap 15-20 in a standard race). Observe the tire column.
**Expected:** Compound letter changes color (e.g. S to M), tire age resets toward 1, `animate-pulse` fires on the changed row.
**Why human:** Compound change detection (`compoundChanged`) and the pulse animation require real session data and visual observation.

#### 4. Pit stop counter incrementing

**Test:** At lap 1 confirm all PIT cells show 0. Scrub past the main pit window. Confirm counts reach 1 for pitted drivers.
**Expected:** Counts accurately reflect pit stops taken up to the current replay lap.
**Why human:** Depends on `PitInTime` field population in FastF1 data for the chosen session.

#### 5. Replay sync — standings update on play and scrub

**Test:** Press play and watch standings advance. Also drag the replay scrubber rapidly.
**Expected:** Standings re-render at each lap change with no lag or stale data.
**Why human:** Reactive behavior and perceived smoothness require live browser testing.

---

### Build Status

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | Pass (no output = no errors) |
| `npx vite build` | Pass — 1975 modules, built in 1.01s |
| `uv run pytest tests/ -x -q` | Pass — 19 passed in 0.03s |

---

### Commit Verification

All five commits documented in SUMMARY.md are confirmed present in the repository:

| Commit | Description |
|--------|-------------|
| `7de6b6a` | feat(03-01): add StandingRow type and useStandingsData hook |
| `dc2ebe2` | feat(03-01): add StandingsBoard component and wire into Dashboard |
| `e790eed` | fix(03-02): standings board DNF handling, scrolling, and >20 drivers |
| `a05433b` | fix(03-02): cap standings to ~10 visible rows and fix DNF position display |
| `279e865` | fix(03-02): normalize position 99 from API as no-position |

---

_Verified: 2026-03-13T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
