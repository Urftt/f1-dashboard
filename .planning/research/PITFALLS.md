# Research: Pitfalls

## Question

What are the main mistakes to avoid when adding replay-synced race analytics to this existing prototype?

## Key Pitfalls

### 1. Treating replay as fake live polling
- Historical replay should not repeatedly hit the API on every UI tick.
- Fetch once, normalize once, then derive state locally for each replay step.

### 2. Leaving replay logic inside a blocking Streamlit loop
- The current `while st.session_state.is_tracking:` pattern will make controls fragile.
- Playback state should be explicit and rerender-friendly.

### 3. Mixing timeline concepts
- Race time, session timestamps, lap numbers, and replay clock are different things.
- The app needs a clear mapping from replay position to available lap/stint records.

### 4. Assuming all telemetry exists for all sessions
- Some endpoints or fields may be incomplete depending on session or year.
- The UI needs graceful degradation when tyre or interval details are missing.

### 5. Over-promising live mode
- OpenF1 historical access is easy; real-time access is more constrained.
- The milestone should validate replay value first instead of chasing fragile live support.

### 6. Skipping tests on calculation logic
- Tyre age, latest lap, and gap history are all easy to get subtly wrong.
- These should be validated with deterministic session fixtures.

## Prevention Strategy

- Preload and cache session data.
- Introduce pure snapshot functions with tests.
- Keep playback controls separate from KPI calculation logic.
- Treat missing fields as normal and render explicit fallback states.
- Keep `v1.0` tightly scoped around replay and core KPIs.

## Best Phase To Address

- Architecture and replay-state issues: earliest implementation phase
- KPI correctness and tests: same phase as domain logic
- UX clarity and fallback states: dashboard integration phase

## Sources

- OpenF1 docs: https://openf1.org/docs/
- OpenF1 overview: https://openf1.org/
