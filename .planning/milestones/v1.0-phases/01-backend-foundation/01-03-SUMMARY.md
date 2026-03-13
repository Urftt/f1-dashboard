---
phase: 01-backend-foundation
plan: 03
subsystem: ui
tags: [react, typescript, zustand, fetch-event-source, shadcn, tailwind, sse, vite]

# Dependency graph
requires:
  - phase: 01-backend-foundation/01-01
    provides: FastAPI backend with /api/schedule, /api/sessions/load SSE endpoint
  - phase: 01-backend-foundation/01-02
    provides: React + Vite scaffold with shadcn/ui, Zustand, fetch-event-source installed
provides:
  - Zustand session store (useSessionStore) with year/event/sessionType/stage/progress/laps/error/isCompact state
  - Typed API client: fetchSchedule, fetchSessionTypes
  - SSE client: loadSession using fetch-event-source with openWhenHidden=true
  - SessionSelector component with cascading dropdowns and compact mode
  - LoadingProgress component with inline progress bar, stage label, error/retry
  - EmptyState component for idle state
  - App.tsx layout wiring all components together
affects:
  - 02-gap-chart (consumes laps from useSessionStore)
  - 03-replay (consumes session state from useSessionStore)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Zustand store with granular setYear/setEvent actions that cascade resets
    - fetch-event-source with openWhenHidden=true to prevent reconnect on tab background
    - SSE onerror rethrows to suppress retry (single-load pattern)
    - Cascading dropdowns: year change resets event+sessionType, event change resets sessionType
    - base-ui Select onValueChange receives string|null — narrow with null guard before calling typed handlers

key-files:
  created:
    - frontend/src/types/session.ts
    - frontend/src/stores/sessionStore.ts
    - frontend/src/lib/api.ts
    - frontend/src/lib/sse.ts
    - frontend/src/components/SessionSelector/SessionSelector.tsx
    - frontend/src/components/SessionSelector/YearSelect.tsx
    - frontend/src/components/SessionSelector/EventSelect.tsx
    - frontend/src/components/SessionSelector/SessionTypeSelect.tsx
    - frontend/src/components/LoadingProgress/LoadingProgress.tsx
    - frontend/src/components/Dashboard/EmptyState.tsx
  modified:
    - frontend/src/App.tsx

key-decisions:
  - "fetch-event-source onerror rethrows to prevent automatic SSE reconnect on session load failure"
  - "base-ui Select onValueChange type is (string|null) — null guard required before passing to typed store actions"
  - "loadSession passes full store object (not individual actions) to avoid stale closure issues with Zustand"

patterns-established:
  - "Pattern: Zustand store actions cascade resets — setYear resets event+sessionType, setEvent resets sessionType to Race"
  - "Pattern: SSE client uses openWhenHidden=true to prevent reconnect when tab backgrounded during long loads"
  - "Pattern: Component fetches (fetchSchedule, fetchSessionTypes) wrapped in useEffect with loading flag, empty array on error"

requirements-completed: [SESS-01, SESS-02, SESS-03, SESS-04, SESS-05]

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 1 Plan 03: Session Selector UI Summary

**React session selector with cascading dropdowns (Year/Event/Session Type), SSE-powered inline progress bar, Zustand store, compact mode after load, and empty state — wired to FastAPI backend**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-13T11:20:02Z
- **Completed:** 2026-03-13T11:22:21Z
- **Tasks:** 2 (+ 1 auto-fix)
- **Files modified:** 11

## Accomplishments

- Full Zustand store with session selection, loading stage, progress tracking, lap data, and compact mode
- Typed API client for schedule and session types endpoints
- SSE client using fetch-event-source with reconnect prevention (openWhenHidden, onerror rethrow)
- Cascading dropdowns: Year (2018–current, defaults to current year) → Event (cached events marked with lightning bolt) → Session Type (defaults to Race)
- Inline LoadingProgress with percentage + stage label, error state with Retry button
- Compact selector mode after successful load showing "Event Year — SessionType" summary with Change button

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, Zustand store, and API/SSE client layer** - `6a78554` (feat)
2. **Task 2: Session selector UI and loading progress components** - `97ad075` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `frontend/src/types/session.ts` - EventSummary, SessionTypeInfo, LapRow, LoadingStage types
- `frontend/src/stores/sessionStore.ts` - Zustand store with cascading reset actions
- `frontend/src/lib/api.ts` - fetchSchedule, fetchSessionTypes typed API client
- `frontend/src/lib/sse.ts` - loadSession SSE client using fetch-event-source
- `frontend/src/components/SessionSelector/SessionSelector.tsx` - Orchestrator with expand/compact modes
- `frontend/src/components/SessionSelector/YearSelect.tsx` - Year dropdown 2018-current
- `frontend/src/components/SessionSelector/EventSelect.tsx` - Event dropdown with cached indicator
- `frontend/src/components/SessionSelector/SessionTypeSelect.tsx` - Session type dropdown
- `frontend/src/components/LoadingProgress/LoadingProgress.tsx` - Progress bar + error/retry
- `frontend/src/components/Dashboard/EmptyState.tsx` - Idle empty state message
- `frontend/src/App.tsx` - Main layout with fade-in transition on load complete

## Decisions Made

- Used `onerror` rethrow in fetch-event-source to prevent automatic SSE reconnect on failure — single-load pattern matches the session loading UX (no silent retry)
- Passed full Zustand store object to `loadSession` rather than individual action functions, avoiding stale closure issues if the component re-renders during load
- `base-ui/react` Select `onValueChange` callback type is `(string | null)`, not `string` — added null guard in EventSelect and SessionTypeSelect to satisfy TypeScript strict mode

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Narrowed onValueChange type for base-ui Select**
- **Found during:** Task 2 (build verification)
- **Issue:** `@base-ui/react` Select's `onValueChange` callback signature is `(value: string | null, ...) => void`, not `(value: string) => void`. Passing `onChange: (v: string) => void` directly caused a TypeScript type error on both EventSelect and SessionTypeSelect.
- **Fix:** Wrapped callback with null guard: `onValueChange={(v) => { if (v !== null) onChange(v) }}`
- **Files modified:** `frontend/src/components/SessionSelector/EventSelect.tsx`, `frontend/src/components/SessionSelector/SessionTypeSelect.tsx`
- **Verification:** `npm run build` passed cleanly after fix
- **Committed in:** `97ad075` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix required for correct TypeScript compilation. No scope creep.

## Issues Encountered

- `npx tsc --noEmit` passed but `npm run build` (`tsc -b`) failed due to stricter composite project mode catching the base-ui type mismatch. Used `tsc -b` (build mode) as the definitive compilation check going forward.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Complete frontend pipeline: Year/Event/SessionType selection → SSE load → Zustand store populated with LapRow[]
- All session data accessible via `useSessionStore((s) => s.laps)` for Phase 2 gap chart
- Compact selector mode ensures header stays minimal once a session is loaded
- Frontend builds cleanly; TypeScript strict mode passes
- Ready for Phase 2: gap chart component consuming laps from the Zustand store

---
*Phase: 01-backend-foundation*
*Completed: 2026-03-13*

## Self-Check: PASSED

- frontend/src/types/session.ts: FOUND
- frontend/src/stores/sessionStore.ts: FOUND
- frontend/src/lib/api.ts: FOUND
- frontend/src/lib/sse.ts: FOUND
- frontend/src/components/SessionSelector/SessionSelector.tsx: FOUND
- frontend/src/components/LoadingProgress/LoadingProgress.tsx: FOUND
- frontend/src/components/Dashboard/EmptyState.tsx: FOUND
- commit 6a78554: FOUND
- commit 97ad075: FOUND
