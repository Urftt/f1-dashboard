---
phase: 02-gap-chart-replay-engine
plan: "04"
subsystem: ui
tags: [react, plotly, dashboard, dark-theme, fastapi, sse]

# Dependency graph
requires:
  - phase: 02-gap-chart-replay-engine
    provides: GapChart, DriverSelector, ReplayControls, useReplayTimer, useGapData — all individual Phase 2 components
  - phase: 01-backend-foundation
    provides: SSE session loading, SessionSelector, EmptyState, LoadingProgress, sessionStore

provides:
  - Two-column dashboard layout with sticky header integrating all Phase 2 components
  - Global dark theme applied via class="dark" on <html> and color-scheme CSS
  - Working end-to-end product loop: select drivers, see gap chart, replay lap by lap
  - Dynamic driver/team data from backend via serialize_drivers endpoint
  - Human-verified all 7 requirements: GAP-01, GAP-02, GAP-03, REPL-01, REPL-02, REPL-03, REPL-04

affects: [03-standings, 04-live-data, future-phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "react-plotly.js CJS default import: must use `(Plot as any).default ?? Plot` to avoid double-wrap crash"
    - "Dynamic driver data: serialize_drivers sends team/fullName/teamColor from FastF1 session; no hardcoded lookup tables"
    - "Plotly template type: cast string literal via `unknown as Plotly.Template` to satisfy TS2559"
    - "Single invisible hover trace prevents tooltip duplicates from overlapping chart segments"

key-files:
  created:
    - frontend/src/components/Dashboard/Dashboard.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/index.css
    - frontend/index.html
    - frontend/src/components/GapChart/GapChart.tsx
    - frontend/src/components/GapChart/DriverSelector.tsx
    - frontend/src/components/GapChart/useGapData.ts
    - frontend/src/lib/sse.ts
    - frontend/src/stores/sessionStore.ts
    - frontend/src/types/session.ts
    - backend/services/fastf1_service.py

key-decisions:
  - "react-plotly.js CJS default export double-wrap: fix by checking for .default on the imported value before use"
  - "Driver/team data: served dynamically from FastF1 session via serialize_drivers — no hardcoded lookup tables"
  - "Plotly hovermode: closest instead of x-unified prevents tooltip from obscuring the gap line"
  - "Single invisible hover trace: overlay a transparent scatter trace to unify tooltip without visual duplication"
  - "Auto-select fallback: use first two drivers from results when grid positions unavailable (qualifying sessions)"

patterns-established:
  - "Global dark theme: class='dark' on <html> element + color-scheme: dark in CSS; shadcn/ui variables resolve automatically"
  - "Sticky header pattern: sticky top-0 z-10 bg-background/95 backdrop-blur border-b containing session controls"
  - "60/40 dashboard split: grid-cols-5 with col-span-3 left and col-span-2 right; stacks to grid-cols-1 on mobile"
  - "Dynamic backend data: serialize_drivers endpoint returns team colors and full names at session load time"

requirements-completed: [GAP-01, GAP-02, GAP-03, REPL-01, REPL-02, REPL-03, REPL-04]

# Metrics
duration: 55min
completed: 2026-03-13
---

# Phase 2 Plan 04: Dashboard Integration Summary

**Two-column dark-themed dashboard wiring all Phase 2 components together: sticky header with session/replay controls, gap chart left column with dynamic driver selection, standings placeholder right — human-verified end-to-end**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-03-13T13:06:00Z
- **Completed:** 2026-03-13T14:57:45Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint — approved)
- **Files modified:** 12

## Accomplishments

- Created Dashboard.tsx with 60/40 responsive grid: GapChart + DriverSelector in left column, standings placeholder in right column
- Refactored App.tsx with sticky header (SessionSelector + ReplayControls) and stage-aware body (EmptyState / LoadingProgress / Dashboard)
- Applied global dark theme via `class="dark"` on `<html>` and `color-scheme: dark` in CSS; removed max-w-4xl layout constraint
- Fixed three production blockers (react-plotly.js render crash, Plotly template type error, tooltip duplication) and added dynamic driver/team data from backend
- Human verified all 7 requirements: driver auto-selection, gap chart rendering, tooltips, play/pause, speed control, scrubber, and cursor tracking

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Dashboard layout and refactor App.tsx with dark theme** - `ca6e734` (feat)
2. **Task 1a: Fix Plotly template type cast** - `a228f88` (fix)
3. **Task 1b: Fix black screen, dynamic driver data, and tooltip issues** - `c6db2c2` (fix)
4. **Task 2: Human verification checkpoint** - APPROVED (no commit — verification only)

## Files Created/Modified

- `frontend/src/components/Dashboard/Dashboard.tsx` — Two-column layout; renders DriverSelector + GapChart left, placeholder right
- `frontend/src/App.tsx` — Sticky header with SessionSelector + ReplayControls; stage-aware body
- `frontend/src/index.css` — Added `color-scheme: dark` for global dark mode
- `frontend/index.html` — Added `class="dark"` to `<html>` element
- `frontend/src/components/GapChart/GapChart.tsx` — Fixed CJS import double-wrap, Plotly template type cast, invisible hover trace for clean tooltips
- `frontend/src/components/GapChart/DriverSelector.tsx` — Switched from hardcoded lookup to dynamic session driver data
- `frontend/src/components/GapChart/useGapData.ts` — Extended to consume dynamic driver/team data from store
- `frontend/src/lib/sse.ts` — Parse and store serialize_drivers payload from SSE stream
- `frontend/src/stores/sessionStore.ts` — Added drivers map to store shape
- `frontend/src/types/session.ts` — Added DriverInfo type with team, fullName, teamColor fields
- `backend/services/fastf1_service.py` — Added serialize_drivers; emits team, fullName, teamColor for each driver; added Team field to lap serialization

## Decisions Made

- **react-plotly.js CJS default export:** The npm package ships CommonJS; Vite's ESM interop double-wraps the default export, causing a render crash. Fixed by checking `(Plot as any).default ?? Plot` at import time.
- **Dynamic driver data:** Replaced hardcoded team-color lookup tables with a `serialize_drivers` call at session load. FastF1 provides accurate team colors and full names from the session object.
- **Plotly hovermode `closest`:** `x unified` mode placed the tooltip over the line making it unreadable. `closest` keeps the tooltip near the cursor without obscuring data.
- **Invisible hover trace:** Adding a single transparent scatter trace spanning all data points prevents tooltips from appearing duplicated when Plotly renders overlapping colored line segments.
- **Auto-select fallback for qualifying:** Grid position is unavailable for qualifying sessions. Fall back to the first two drivers from the results array when `GridPosition` is null.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] react-plotly.js CJS default export double-wrap causes blank screen**
- **Found during:** Task 1 (integration and verification)
- **Issue:** Vite ESM interop wraps the CJS default; calling `new Plot()` on the wrapper (not the Plotly component) caused a silent render crash
- **Fix:** Import guard: `const PlotComponent = (Plot as any).default ?? Plot`
- **Files modified:** `frontend/src/components/GapChart/GapChart.tsx`
- **Verification:** Chart renders correctly; TypeScript build passes
- **Committed in:** `c6db2c2`

**2. [Rule 1 - Bug] Plotly template string fails TypeScript type check (TS2559)**
- **Found during:** Task 1 (tsc --noEmit verification)
- **Issue:** `layout.template` field expects `Plotly.Template` object; passing the string `"plotly_dark"` caused a build-blocking type error
- **Fix:** Cast via `"plotly_dark" as unknown as Plotly.Template`
- **Files modified:** `frontend/src/components/GapChart/GapChart.tsx`
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** `a228f88`

**3. [Rule 1 - Bug] Tooltip shows duplicated values from overlapping line segments**
- **Found during:** Task 1 (integration and verification)
- **Issue:** Gap chart is rendered as multiple colored segments (per-lap color may change); Plotly fires hover events for each segment at the same x, duplicating tooltip content
- **Fix:** Added a single invisible scatter trace covering all x values as the sole hover source; set all segment traces to `hoverinfo: 'skip'`
- **Files modified:** `frontend/src/components/GapChart/GapChart.tsx`
- **Verification:** Hover shows exactly one tooltip per lap position
- **Committed in:** `c6db2c2`

**4. [Rule 2 - Missing Critical] Backend must send driver/team data dynamically**
- **Found during:** Task 1 (integration and verification)
- **Issue:** DriverSelector and GapChart used hardcoded team-color lookup tables; teams and colors change each season and are unavailable for custom sessions
- **Fix:** Added `serialize_drivers` to `fastf1_service.py` and emitted driver payload over SSE; extended `sessionStore`, `useGapData`, and `DriverSelector` to consume dynamic data
- **Files modified:** `backend/services/fastf1_service.py`, `frontend/src/lib/sse.ts`, `frontend/src/stores/sessionStore.ts`, `frontend/src/types/session.ts`, `frontend/src/components/GapChart/useGapData.ts`, `frontend/src/components/GapChart/DriverSelector.tsx`
- **Verification:** Dropdowns show correct team grouping and colors from session data
- **Committed in:** `c6db2c2`

---

**Total deviations:** 4 auto-fixed (2 bugs, 1 bug/tooltip, 1 missing critical)
**Impact on plan:** All fixes were necessary for a working, type-safe, correct product. No scope creep.

## Issues Encountered

- react-plotly.js has no TypeScript-friendly ESM build; CJS interop via Vite requires a runtime default-export guard. Documented as pattern for future Plotly usage.
- FastF1 `GridPosition` is null for qualifying and practice sessions; auto-select logic extended to fall back to result order.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Phase 2 requirements (GAP-01 through GAP-03, REPL-01 through REPL-04) are human-verified and committed
- Dashboard layout has a standings placeholder in the right column — ready for Phase 3 (standings implementation)
- Dynamic driver/team data pipeline is in place; Phase 3 can reuse the same SSE serialization pattern
- No blockers

---
*Phase: 02-gap-chart-replay-engine*
*Completed: 2026-03-13*
