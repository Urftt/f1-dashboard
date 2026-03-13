---
phase: 02-gap-chart-replay-engine
plan: 03
subsystem: ui
tags: [react, zustand, typescript, replay, hooks, setInterval]

# Dependency graph
requires:
  - phase: 02-gap-chart-replay-engine
    provides: sessionStore with currentLap, isPlaying, replaySpeed, laps, setCurrentLap, setIsPlaying, setReplaySpeed; ReplaySpeed type

provides:
  - useReplayTimer hook: setInterval-based timer using useRef to prevent stale closure, exports maxLap
  - ReplayControls component: play/pause button, 0.5x/1x/2x/4x speed buttons, range scrubber, Lap X/Y counter

affects:
  - 02-04-PLAN.md (Dashboard integration mounts ReplayControls in sticky bar)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useRef pattern for stale closure prevention in setInterval hooks
    - Zustand stable selectors — store actions are stable, excluded from useEffect deps

key-files:
  created:
    - frontend/src/hooks/useReplayTimer.ts
    - frontend/src/components/ReplayControls/ReplayControls.tsx

key-decisions:
  - "lapRef.current updated every render; only isPlaying, replaySpeed, maxLap in useEffect deps — avoids stale closure while keeping interval lifecycle correct"
  - "HTML <input type='range'> used for scrubber instead of @base-ui Slider — simpler, sufficient for integer lap steps, no extra dependency"
  - "Auto-restart: pressing play when currentLap >= maxLap resets to lap 1 then plays — better UX than dead play button at race end"

patterns-established:
  - "Stale closure prevention: lapRef.current = currentLap on every render; interval reads lapRef.current not state variable"
  - "Replay controls hidden until stage === 'complete' — no controls visible during loading or idle"

requirements-completed: [REPL-01, REPL-02, REPL-03]

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 2 Plan 03: Replay Timer Summary

**setInterval-based replay timer with stale-closure-safe useRef pattern, and media-player controls bar with play/pause, 4 speed buttons, range scrubber, and Lap X/Y counter**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-13T13:02:09Z
- **Completed:** 2026-03-13T13:03:17Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `useReplayTimer` hook: advances `currentLap` via `setInterval` at `1000/replaySpeed` ms per tick, uses `lapRef.current` to avoid stale closure, auto-pauses and snaps to `maxLap` at race end, exports `maxLap` for UI display
- Created `ReplayControls` component: play/pause toggle, 0.5x/1x/2x/4x speed buttons (active = default variant), HTML range scrubber (flex-1), monospace "Lap X/Y" counter, renders null when `stage !== 'complete'`
- Zero TypeScript errors on both tasks

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useReplayTimer hook** - `1ac0b88` (feat)
2. **Task 2: Create ReplayControls component** - `093cdf7` (feat)

## Files Created/Modified

- `frontend/src/hooks/useReplayTimer.ts` - setInterval timer hook with stale-closure prevention via useRef
- `frontend/src/components/ReplayControls/ReplayControls.tsx` - Media-player style controls bar wired to Zustand store

## Decisions Made

- `lapRef.current` is assigned on every render so the interval closure always reads the latest lap without including `currentLap` in the effect dependency array — adding it would restart the interval on every lap advance, breaking playback speed.
- HTML `<input type="range">` chosen over a more complex slider primitive. Integer lap steps with `step={1}` provide correct granularity; the range input is themeable via `accent-primary` in Tailwind.
- Auto-restart behavior: if user presses play when at `maxLap`, the component resets to lap 1 then starts playing, preventing a dead play button state at race end.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `useReplayTimer` and `ReplayControls` are ready for Dashboard integration in Plan 02-04
- Plan 02-04 needs to import and mount `ReplayControls` in a sticky position within the layout
- No blockers

---
*Phase: 02-gap-chart-replay-engine*
*Completed: 2026-03-13*

## Self-Check: PASSED

- frontend/src/hooks/useReplayTimer.ts: FOUND
- frontend/src/components/ReplayControls/ReplayControls.tsx: FOUND
- Commit 1ac0b88: FOUND
- Commit 093cdf7: FOUND
