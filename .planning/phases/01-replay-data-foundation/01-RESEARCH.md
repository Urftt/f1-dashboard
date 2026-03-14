# Phase 1 Research: Replay Data Foundation

## Objective

Plan Phase 1 well enough to deliver:

- `REPL-01`: user can load a historical race session for replay
- `STAT-02`: current tyre compound at a replay position
- `STAT-03`: current tyre age at a replay position
- `RELY-03`: automated coverage for core replay and KPI calculations

The phase goal is to make historical replay data loadable once, normalize the required datasets, and expose tyre-aware snapshot calculations in a form that can be tested outside the Streamlit loop.

## Most Important Planning Insight

This worktree is still the older Streamlit and OpenF1 prototype. Phase 1 should improve that prototype into a usable replay foundation rather than plan around a backend that does not exist here.

The key constraint is architectural: `app.py` currently owns session loading, driver selection, lap-data preload, and the blocking tracking loop through `st.session_state`. The best Phase 1 shape is to extract replay-oriented data loading and snapshot logic into reusable Python modules while keeping the existing Streamlit shell working.

## Current Source Of Truth

### Historical session load path

- `app.py` supports a "Historical Session" mode in the sidebar.
- `F1DataFetcher.get_recent_sessions()` retrieves recent sessions from the OpenF1 `sessions` endpoint.
- `F1DataFetcher.load_session()` validates a chosen `session_key`, stores it in `current_session_key`, and loads drivers.
- `F1DataFetcher.get_lap_data()` fetches lap rows for selected drivers from the OpenF1 `laps` endpoint.
- `app.py` pushes the returned DataFrame into `IntervalCalculator.update_lap_data()`.

This already proves the repo can load a historical session, but it is coupled to widget flow and only loads data after driver selection.

### Replay and KPI logic path

- `IntervalCalculator.calculate_interval_history()` merges lap rows for two drivers and computes gap trend data.
- `IntervalCalculator.get_current_interval()` derives a current replay snapshot from the accumulated lap history.
- `SessionRecorder` can save and replay recorded session data, which is useful as a deterministic local harness.

### Missing Phase 1 capability

There is no canonical replay data model for:

- preloading all needed historical session data once
- exposing per-driver tyre compound and tyre age at a chosen replay position
- reusing the same replay snapshot logic independently of the Streamlit control loop

## What Must Be True After Phase 1

1. A historical session can be loaded once and reused for replay without depending on repeated UI-triggered fetches.
2. The application has a normalized replay dataset that includes enough lap metadata for tyre compound and tyre age lookups.
3. Replay snapshot calculations are callable without the blocking Streamlit `while st.session_state.is_tracking:` loop.
4. Core replay and KPI calculations are covered by automated tests.

## Implementation Constraints

### Architectural constraints

- Avoid building more behavior directly into `app.py`; Phase 1 should reduce, not deepen, UI/data coupling.
- `F1DataFetcher` currently combines API transport, session state, and normalization concerns. Planning should separate those concerns enough to make calculations testable.
- `IntervalCalculator` is the best current seam for pure logic, but it only models gap history today and does not yet own tyre semantics.

### Data constraints

- OpenF1 lap rows are the available historical source in this worktree.
- `get_lap_data()` returns a pandas DataFrame and only normalizes `date_start`.
- Phase 1 needs to confirm which OpenF1 lap fields are present for tyre-related KPIs and define fallbacks when values are missing.
- Replay position is safest to define as lap-granular in this phase because the current app already visualizes lap-based progress.

### Product constraints

- Keep the Streamlit app usable during the refactor. Phase 1 should strengthen the prototype, not replace the UI shell.
- Do not widen scope into advanced analytics, multiple-driver comparisons, or live-session reliability beyond what is required for replay foundations.
- Session preload should be deterministic enough to support historical rewatching and future recorded-session flows.

## Recommended Phase 1 Architecture

### 1. Canonical replay session loader

Create or formalize a load path that:

- validates the selected historical session
- loads driver metadata once
- preloads lap data needed for replay
- stores that loaded result in a reusable replay-friendly structure

This can start inside `data_fetcher.py`, but the plan should move the reusable parts out of Streamlit event handlers.

### 2. Normalized replay data model

Add a replay-oriented representation for the loaded session, for example:

- session metadata
- ordered driver list
- normalized lap rows per driver
- replay lap index or elapsed ordering
- compound and tyre-age source fields

The exact type can be plain dicts or lightweight dataclasses. The important point is to stop treating raw API DataFrames and Streamlit state as the only contract.

### 3. Pure snapshot derivation

Extract functions that answer:

- what data is visible at replay lap `N`
- what is the current tyre compound for driver `D`
- what is the current tyre age for driver `D`

These should not require Streamlit widgets or live polling to execute.

### 4. Thin UI orchestration

After extraction, `app.py` should mainly:

- trigger session loading
- capture user choices
- call replay helpers
- render charts and metrics

This is how the phase satisfies the roadmap criterion that the data layer should no longer depend on the blocking UI loop.

## Relevant Code Paths

### High-value paths to reuse

- `app.py`
  - historical session selection and load flow
  - current driver-selection UI
  - tracking loop and current metric display
- `data_fetcher.py`
  - `F1DataFetcher.get_recent_sessions()`
  - `F1DataFetcher.load_session()`
  - `F1DataFetcher.get_driver_list()`
  - `F1DataFetcher.get_lap_data()`
  - `SessionRecorder`
- `data_processor.py`
  - `IntervalCalculator.update_lap_data()`
  - `IntervalCalculator.calculate_interval_history()`
  - `IntervalCalculator.get_current_interval()`
  - `_get_average_lap_time()`

### Likely refactor targets

- move replay-session normalization out of `app.py`
- add tyre lookup helpers in `data_processor.py` or a new replay-focused module
- add a test package and fixture data to exercise replay calculations without hitting OpenF1

## Codebase Reality Check

The roadmap and requirement set are valid, but the implementation baseline is rough:

- no automated tests exist
- `pyproject.toml` has no test dependency or command guidance
- the package entrypoint points to `app:main`, but `app.py` does not expose a usable `main`
- the tracking flow relies on a blocking Streamlit loop and mutable session state
- README instructions mention testing, but only suggest manual `streamlit run app.py`

Phase 1 should therefore plan for both feature progress and basic engineering cleanup needed to support replay semantics safely.

## Recommended Scope For Phase 1

### In scope

- preload historical session data for replay
- define and normalize replay data structures
- derive tyre compound and tyre age at a replay position
- make replay/KPI calculations callable outside the UI loop
- add automated tests for replay foundation logic

### Out of scope

- full replay transport controls such as pause, resume, speed, and scrubbing
- broader live-session improvements
- advanced interval modelling beyond current lap-based semantics
- large UI redesigns

## Common Pitfalls

- Leaving historical session loading spread across Streamlit callbacks and fetcher internals.
- Implementing tyre lookup directly inside widget code instead of reusable helpers.
- Depending on live API calls in tests rather than fixture DataFrames or recorded sessions.
- Overcommitting to sub-lap replay semantics before the repo has a stable lap-granular foundation.
- Expanding Phase 1 into replay controls that belong in Phase 2.

## Risks

### Highest planning risks

- **Coupling risk:** planning that keeps `app.py` as the main home for replay logic will make later phases harder.
- **Data-shape risk:** OpenF1 lap payloads may not always include tyre fields consistently.
- **Test gap risk:** without a Wave 0 test setup, replay semantics can regress silently.
- **Entrypoint risk:** the repo still has a broken script target, which may complicate validation expectations if left untouched.

### Domain risk to settle during planning

For this phase, the safest replay definition is:

- replay position is a completed lap number
- tyre compound and tyre age come from the latest known lap row for that driver at or before that lap

That matches the current lap-based UI and avoids premature modelling complexity.

## Test Strategy

Phase 1 should add tests at three layers.

### 1. Pure calculation tests

Highest-value targets:

- session normalization from raw OpenF1-like lap rows
- tyre compound lookup at replay lap `N`
- tyre age lookup at replay lap `N`
- interval history semantics after normalization
- missing-field fallback behavior

### 2. Fetcher and recorder tests

Good medium-value targets:

- request retry and failure handling in `F1DataFetcher._make_request()`
- `SessionRecorder.save()` and `load()` roundtrips
- recorded session DataFrame reconstruction

### 3. Minimal UI-adjacent coverage

Keep this thin. The Streamlit shell is hard to test directly, so the plan should prefer extracting logic until the UI needs only limited smoke validation.

## Validation Architecture

Nyquist-style validation is appropriate because the main risk is semantic correctness of replay data and tyre-aware snapshots, not visual polish.

### Validation layers

1. **Load validation**
   - prove a chosen historical session can be transformed into a reusable replay dataset
2. **Snapshot validation**
   - prove replay position `lap=N` returns the correct tyre compound and tyre age for each driver
3. **Persistence validation**
   - prove recorded-session data can be saved and replayed without breaking timestamp fields

### Required fixtures

- two-driver green-flag lap progression
- compound change after a pit stop
- missing compound field
- missing tyre-age field
- inconsistent or duplicate lap rows

### Suggested assertions

- normalized lap ordering is stable
- duplicate lap rows collapse deterministically
- interval calculations preserve sign conventions
- tyre age resets or changes correctly when source data changes
- snapshot helpers return predictable empty values when data is incomplete

## Planning Decisions To Make Explicitly

The Phase 1 plan should answer:

1. Does the normalized replay model live inside `data_processor.py` or a new dedicated module?
2. Is session preload done for all drivers up front or only the user-selected subset?
3. What fallback should the UI show when tyre compound or tyre age is missing?
4. Is the broken package entrypoint part of this phase or deferred to reliability hardening?
5. How much of recorded-session support should be reused as a deterministic test harness?

## Recommended Plan Shape

The phase should likely break into three plans:

1. Extract and normalize replay-session loading for historical data.
2. Implement replay snapshot helpers for tyre-aware KPIs and integrate them into the Streamlit flow.
3. Add automated test infrastructure and fixture-backed tests for replay calculations.

## Bottom Line

Phase 1 should turn the current Streamlit prototype into a replay-capable foundation with a reusable data layer, explicit tyre-aware snapshot semantics, and real test coverage. The right move is not a big rewrite. It is to carve stable replay logic out of the current UI-driven flow and make it safe to build on in later phases.
