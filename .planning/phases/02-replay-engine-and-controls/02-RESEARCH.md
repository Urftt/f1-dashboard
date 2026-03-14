# Phase 2 Research: Replay Engine And Controls

## Objective

Plan Phase 2 well enough to deliver:

- `REPL-02`: start replay from race start and advance dashboard state over time
- `REPL-03`: pause and resume replay without losing position
- `REPL-04`: change replay speed while replay is running
- `REPL-05`: scrub or jump to a different replay position

The phase goal is to replace the current one-shot historical replay behavior with explicit, durable replay state that fits Streamlit's rerun model.

## Most Important Planning Insight

The main problem is not missing data. Phase 1 already created a stable lap-granular replay contract in `ReplaySession` plus snapshot helpers in `data_processor.py`.

The real Phase 2 problem is execution flow. `app.py` still drives replay through `st.session_state.is_tracking` and a blocking `while` loop, which is a poor fit for Streamlit reruns and cannot support pause, resume, speed change, and scrubbing cleanly. The planner should treat Phase 2 as a replay-state refactor with thin UI controls, not as a charting task.

## Current Source Of Truth

### Existing replay foundation

- `F1DataFetcher.load_replay_session()` already preloads one historical session into a reusable `ReplaySession`.
- `ReplaySession.max_lap_number` defines the current replay boundary.
- `resolve_replay_lap()` already clamps replay position to the session contract.
- `get_replay_snapshot()` and related helpers already answer per-driver state for a chosen lap.
- Existing tests in `tests/test_replay_foundation.py` already validate replay normalization and snapshot semantics.

### Current UI behavior that blocks Phase 2

- Historical session load sets `st.session_state.replay_position_lap` to `replay_session.max_lap_number`, so replay currently starts at the end instead of race start.
- The Start button only flips `st.session_state.is_tracking` and clears `interval_history`.
- Historical replay then runs once inside the `while st.session_state.is_tracking:` block, computes full history immediately, sets the replay lap to the last lap, renders the full chart, and stops.
- Because replay progression is implicit in the loop instead of explicit in state, there is no durable notion of paused position, playback speed, or target lap.

## Streamlit Constraints That Matter

## Standard Stack

- Keep Streamlit session state as the replay state store.
- Use Streamlit callbacks for control events that mutate replay state.
- Use `st.fragment(run_every=...)` for the playback tick if the team wants a Streamlit-native clock with partial reruns.
- Keep `st.rerun()` as a fallback mechanism, not the primary engine, because Streamlit documents rerun misuse as a source of inefficient or infinite reruns.
- Keep replay math in plain Python helpers and pandas DataFrames; do not introduce threads, asyncio workers, or a backend service for this phase.

## Architecture Patterns

### 1. Explicit replay controller state

Add a small replay-state contract in session state, for example:

- `replay_position_lap: int | None`
- `replay_status: "stopped" | "playing" | "paused"`
- `replay_speed: float`
- `replay_started_at: datetime | None`
- `replay_anchor_lap: int | None`
- `replay_last_tick_at: datetime | None`

The key pattern is anchor-based progression:

- when play starts or resumes, store the current lap as `replay_anchor_lap`
- store the wall-clock start time for that run segment
- on each rerun or fragment tick, compute elapsed wall time and convert it into lap advancement
- derive the new lap from anchor + elapsed*time_scale

This avoids mutating replay position in a long-running loop and makes pause/resume idempotent.

### 2. Extract replay timeline helpers out of `app.py`

Add pure helpers for:

- initializing replay state after session load
- starting playback from race start or current lap
- pausing and resuming without losing lap position
- changing playback speed while preserving current position
- scrubbing to a requested lap with clamping
- deriving the visible interval history up to lap `N`

These helpers belong in `data_processor.py` or a new replay-focused module. A new module is cleaner because `data_processor.py` already mixes interval math and tyre snapshot logic.

### 3. Derived view, not accumulated view

Do not keep replay progression by appending to `interval_history` over time. For historical replay, the full lap history for both drivers is already known after session load.

Better pattern:

- compute or cache the full pairwise interval history once for the selected driver pair
- derive the displayed chart as `history[history["lap_number"] <= replay_position_lap]`
- derive current metrics and tyre KPIs from the same replay lap

This makes pause, speed change, and scrubbing trivial because the UI is just rendering a different prefix of the same history.

### 4. Two-phase UI flow

- Control callbacks mutate replay state.
- Rendering code reads replay state and derives the current chart/stats snapshot.

That separation matters because the current code interleaves button handling, replay stepping, data calculation, and rendering in one control path.

## Recommended Implementation Direction

### Preferred option: fragment-driven playback

Use a dedicated replay fragment that reruns on a short interval only while `replay_status == "playing"`.

Why this is the best fit:

- Streamlit officially supports fragments that rerun independently and on a timer.
- It avoids the blocking `while` loop in `app.py`.
- It keeps the rest of the page stable while only replay-driven elements update.
- It provides a direct place to tick replay position and stop automatically at session end.

Suggested shape:

1. Session load initializes replay state to lap `1` for historical replay, not `max_lap_number`.
2. Driver selection builds or refreshes cached interval history for the active pair.
3. Control buttons call callbacks:
   - Play from start
   - Pause
   - Resume
   - Jump to start/end
   - Slider scrub
   - Speed select
4. A replay fragment computes the effective lap from wall-clock time, clamps it, updates session state, and stops playback when max lap is reached.
5. Chart and metrics read the derived replay lap and render only data up to that lap.

### Acceptable fallback: full-app rerun clock

If fragment use becomes awkward, a simpler fallback is:

- callbacks mutate replay state
- each app rerun computes the effective replay lap
- playback advances through explicit `st.rerun()` calls or another periodic trigger

This is easier to implement but less clean. It increases rerun cost and makes control flow easier to break. Plan around this only if fragments collide with the current layout or widget placement.

## Don’t Hand-Roll

- Do not build a background thread to advance replay state.
- Do not build a custom scheduler or async event loop inside Streamlit.
- Do not keep the current `while st.session_state.is_tracking:` approach and patch more behavior into it.
- Do not model sub-lap or timestamp-accurate replay in this phase. The repo is explicitly lap-granular today, and Phase 3 KPIs depend on that remaining stable.
- Do not append or mutate historical gap rows incrementally when a deterministic filtered view of precomputed history is enough.

## Integration Points

### `app.py`

Primary refactor target.

- Replace `is_tracking` with more explicit replay state.
- Change historical session load to initialize replay state at race start.
- Replace Start/Stop controls with Play/Pause/Resume/Restart plus speed and scrub controls.
- Remove the historical branch that computes full history inside the blocking loop.
- Render current KPIs from `replay_position_lap`, not from whether tracking is active.

### `data_processor.py`

Strong candidate for replay-control helpers.

- `resolve_replay_lap()` is already the clamping seam.
- `IntervalCalculator.calculate_interval_history()` can remain the source for full gap history, but the planner should decide whether to add a helper that filters history to a replay lap.
- Snapshot helpers already make tyre and position cards replay-aware.

### `replay_data.py`

Likely unchanged for Phase 2.

- The existing lap-granular contract is sufficient.
- Avoid expanding the data model unless a helper truly needs extra metadata.

### `data_fetcher.py`

Minimal Phase 2 changes.

- Historical replay should continue to rely on preloaded `ReplaySession`.
- Recorded session replay may remain secondary unless the plan intentionally broadens support. The roadmap only requires a working replay dashboard flow, not parity across all sources in this phase.

## Key Design Decisions The Planner Should Lock Early

1. Replay unit: keep replay progression lap-granular for the entire phase.
2. Session-load behavior: initialize historical replay at lap `1`.
3. State owner: keep replay control state in `st.session_state`.
4. Progression engine: prefer fragment timer ticks over blocking loops.
5. History strategy: precompute pairwise history once per driver pair, then filter by replay lap.
6. Scrub semantics: scrubbing should update position immediately and should not auto-play unless the previous state was playing and the design explicitly restores it.
7. End-of-session behavior: when max lap is reached, set status to paused or stopped deterministically and preserve the final lap.

## Common Pitfalls

- Leaving `replay_position_lap` coupled to `interval_history.max()` as in the current `_resolve_current_replay_lap()` path.
- Treating `interval_history` as both source data and view state.
- Resetting replay to the finish whenever controls rerun.
- Recomputing expensive data on every tick when it can be cached per session and driver pair.
- Making speed changes retroactive against the original play timestamp instead of rebasing from the current effective lap.
- Letting scrub callbacks fight with the playback tick and create lap jumps.
- Expanding support across historical, recorded, and live modes simultaneously.

## Risks

### Highest risks

- `app.py` complexity risk: most of the change pressure lands in a file that is already the main coupling hotspot.
- Replay state drift risk: if play/pause/scrub/speed each mutate different state ad hoc, controls will become nondeterministic.
- Rerun-model risk: if the plan keeps a blocking loop or overuses `st.rerun()`, the app can freeze or rerun excessively.
- Cache invalidation risk: changing selected drivers must invalidate or refresh pairwise interval history cleanly.

### Lower risks

- Recorded-session replay path may diverge from historical replay semantics.
- Existing metric display logic assumes "tracking active" instead of "replay state available" and will need cleanup.

## Test Strategy

Phase 2 should stay mostly unit-testable if the replay engine is helper-driven.

### 1. Pure replay-state tests

Add tests for:

- initializing replay state at lap `1`
- advancing lap from elapsed wall time
- pausing preserves current lap
- resuming continues from paused lap instead of restarting
- speed changes rebase correctly from the current effective lap
- scrubbing clamps to `1..max_lap_number`
- playback stops cleanly at session end

These tests should use deterministic timestamps passed into helpers instead of `datetime.now()` inside assertions.

### 2. Replay-view tests

Add tests for:

- filtering interval history to replay lap `N`
- current metric derivation at a replay lap
- tyre snapshot and chart data remaining aligned after scrub or resume

The current fixture set in `tests/conftest.py` is already a good base for this.

### 3. Thin app-level tests

Keep UI-level tests light. High-value app assertions are:

- loading a historical session resets replay controls to race start
- changing selected drivers invalidates cached pair history
- the rendered replay lap does not jump to the finish on first play

If direct Streamlit testing is awkward, keep these as narrowly scoped helper tests plus manual verification notes.

## Manual Verification Checklist

- Load a historical session and confirm the initial replay lap is `1`.
- Press Play and verify the visible lap advances over time instead of jumping to the finish.
- Pause mid-session and verify the current lap remains stable across reruns.
- Resume and verify replay continues from the paused lap.
- Change speed during playback and verify replay advances faster/slower from the current lap, not from lap `1`.
- Scrub to a later lap and verify chart, positions, and tyre KPIs all update to that lap.
- Scrub while paused and verify no implicit restart occurs unless intentionally designed.
- Reach the final lap and verify playback stops automatically while preserving the final state.

## Plan-Shaping Guidance

The phase should likely break into three plans:

### Plan A: Replay state model and helpers

- introduce explicit replay controller state
- add pure helpers for play, pause, resume, speed rebasing, scrub, and lap derivation
- add unit tests for replay-state transitions

### Plan B: App integration and controls

- replace `is_tracking`/blocking-loop behavior in `app.py`
- initialize historical replay at lap `1`
- add play/pause/resume/speed/scrub controls
- render chart and KPIs from derived replay lap

### Plan C: Verification and edge-case hardening

- handle driver-change invalidation
- stop cleanly at max lap
- verify no regressions in tyre snapshots or interval rendering
- add manual validation notes for replay interaction flow

## Planner Recommendations

- Prefer a new replay-control helper module if the planner wants to keep `data_processor.py` focused on domain calculations.
- Keep the output contract simple: replay controls should operate on lap numbers only in this phase.
- Bias toward deterministic helper APIs that accept `now` as a parameter for testing.
- Treat recorded and live modes as compatibility concerns, not primary scope drivers, unless a concrete requirement forces parity now.

## External Guidance Verified

- Streamlit docs state that each interaction reruns the script and that Session State is the supported way to persist values across reruns.
- Streamlit docs state `st.fragment` can rerun independently and supports `run_every`, which makes it the best native fit for a replay tick.
- Streamlit docs warn that overusing `st.rerun()` can create inefficiency or infinite rerun loops, so it should stay secondary to callbacks and fragments.

## RESEARCH COMPLETE
