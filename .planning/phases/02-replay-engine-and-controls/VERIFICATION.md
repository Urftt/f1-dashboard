# Phase 02 Verification

Status: human_needed

Phase: `02-replay-engine-and-controls`
Goal: Make replay progression explicit and controllable through state instead of long-running blocking loops.
Verified on: 2026-03-10

## Verdict

Automated and static verification support the Phase 02 implementation:

- historical replay is driven by explicit controller state instead of inferred chart state or a historical blocking loop
- start, pause, resume, speed-change, scrub, and jump semantics are implemented in pure helpers and covered by deterministic tests
- the historical Streamlit branch uses controller-driven rendering plus a fragment tick path for replay advancement

Phase 02 is not marked `passed` because `02-VALIDATION.md` explicitly reserves final sign-off for manual Streamlit verification of fragment-driven playback and control interaction timing, and that manual UI run was not executed in this verification pass.

## Requirement Accounting

### REPL-02

Requirement: User can start replay from race start and have dashboard state advance over time.

Evidence:

- Replay initializes at lap 1 and playback advancement is derived from elapsed time over immutable controller state in [replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/replay_controls.py#L30), [replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/replay_controls.py#L50), and [replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/replay_controls.py#L99).
- Historical session load initializes controller-owned replay session state instead of using the old historical tracking loop in [app.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/app.py#L93) and [app.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/app.py#L262).
- Historical replay ticks are driven by `@st.fragment(run_every="250ms")` and `advance_replay_state(...)` in [app.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/app.py#L234).
- Regression coverage proves lap-1 initialization, first play, and non-jump-to-finish behavior in [tests/test_replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/tests/test_replay_controls.py#L33), [tests/test_replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/tests/test_replay_controls.py#L45), and [tests/test_replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/tests/test_replay_controls.py#L279).

Assessment: satisfied by code and automated tests; still pending manual Streamlit confirmation per phase validation contract.

### REPL-03

Requirement: User can pause and resume replay without losing the current replay position.

Evidence:

- Pause and resume preserve the effective lap and re-anchor playback in [replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/replay_controls.py#L67) and [replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/replay_controls.py#L83).
- Historical UI wiring delegates Pause and Resume to controller helpers in [app.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/app.py#L310).
- Deterministic tests cover pause/resume continuity in [tests/test_replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/tests/test_replay_controls.py#L76) and [tests/test_replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/tests/test_replay_controls.py#L90).

Assessment: satisfied by code and automated tests; manual UI timing confirmation still outstanding.

### REPL-04

Requirement: User can change replay speed while a replay is running.

Evidence:

- Speed changes rebase from the current effective lap and clamp to the supported range in [replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/replay_controls.py#L123) and [replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/replay_controls.py#L222).
- Historical UI speed changes flow through controller state, not ad hoc mutation, in [app.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/app.py#L211) and [app.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/app.py#L323).
- Deterministic tests cover running and paused speed-change behavior in [tests/test_replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/tests/test_replay_controls.py#L126) and [tests/test_replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/tests/test_replay_controls.py#L152).

Assessment: satisfied by code and automated tests; manual Streamlit interaction still unconfirmed.

### REPL-05

Requirement: User can scrub or jump to a different replay position.

Evidence:

- Scrub and jump helpers clamp to session bounds and preserve controller invariants in [replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/replay_controls.py#L142), [replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/replay_controls.py#L159), and [replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/replay_controls.py#L168).
- Visible history is filtered from cached full history by controller-owned replay lap in [data_processor.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/data_processor.py#L245), [data_processor.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/data_processor.py#L302), and [data_processor.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/data_processor.py#L359).
- Historical scrub UI is wired through `scrub_replay_state(...)` in [app.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/app.py#L222) and [app.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/app.py#L332).
- Deterministic tests cover scrub clamping, jump behavior, prefix filtering, cache refresh semantics, and view-model alignment in [tests/test_replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/tests/test_replay_controls.py#L172), [tests/test_replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/tests/test_replay_controls.py#L192), [tests/test_replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/tests/test_replay_controls.py#L233), [tests/test_replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/tests/test_replay_controls.py#L302), and [tests/test_replay_controls.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/tests/test_replay_controls.py#L336).

Assessment: satisfied by code and automated tests; widget-level manual behavior remains to be observed in Streamlit.

## Must-Have Check

- Plan `02-01` requirement IDs match `REQUIREMENTS.md`: `REPL-02`, `REPL-03`.
- Plan `02-02` requirement IDs match `REQUIREMENTS.md`: `REPL-04`, `REPL-05`.
- Plan `02-03` requirement IDs match `REQUIREMENTS.md`: `REPL-02`, `REPL-03`, `REPL-04`, `REPL-05`.
- Every requirement ID referenced by Phase 02 plans is present in `.planning/REQUIREMENTS.md` and accounted for above.
- Historical replay no longer uses the historical blocking `while st.session_state.is_tracking` path. That loop remains only in the non-historical recorded/live branch in [app.py](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/app.py#L530).

## Commands Run

- `python -m py_compile app.py replay_controls.py data_processor.py`
- `python -m pytest tests/test_replay_controls.py`
- `python -m pytest`

Results:

- `py_compile`: passed
- `tests/test_replay_controls.py`: 16 passed
- full pytest suite: 22 passed

## Remaining Human Check

Required to move from `human_needed` to `passed`:

- Run the Streamlit historical-session flow manually and confirm Play, Pause, Resume, speed change, and scrub/jump behavior match `02-VALIDATION.md`.
- Confirm fragment-driven ticking behaves correctly in the actual UI and that chart prefix plus tyre/KPI state remain aligned during interaction.
