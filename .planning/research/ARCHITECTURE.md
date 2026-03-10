# Research: Architecture

## Question

How should replay-synced race analytics integrate with the current prototype without making the app harder to extend?

## Existing Context

- Current code has a monolithic `app.py`, a fetcher in `data_fetcher.py`, and analysis helpers in `data_processor.py`.
- The current app uses a blocking `while` loop inside Streamlit, which is a poor foundation for replay controls.

## Suggested Integration Points

### Session loading layer
- Expand the fetcher to preload all data needed for replay:
- drivers
- laps
- stints
- optionally position data for richer context later

### Replay state layer
- Introduce an explicit replay controller/state object that tracks:
- loaded session id
- replay status (`stopped`, `playing`, `paused`)
- current replay time
- playback speed
- selected drivers

### Snapshot derivation layer
- Add pure functions that take preloaded data plus replay time and produce:
- current gap history up to replay time
- latest completed lap per selected driver
- tyre compound and tyre age at replay time
- any table rows shown in the UI

### UI layer
- Keep Streamlit focused on controls, layout, and rendering.
- The UI should render from derived snapshot data instead of performing fetch-and-loop logic inline.

## Build Order

1. Fix data loading and normalize session datasets.
2. Implement replay-state model and playback controls.
3. Derive KPI snapshot functions with tests.
4. Connect Plotly and table views to the derived replay snapshot.
5. Add refinement features once the replay loop is trustworthy.

## New vs Modified Code

- Modify `data_fetcher.py` to support stints and cleaner session preload.
- Add replay-focused logic either to `data_processor.py` or a new module such as `replay_engine.py`.
- Simplify `app.py` so it becomes a renderer/controller instead of the place where all business logic lives.

## Sources

- OpenF1 docs: https://openf1.org/docs/
- Streamlit app model discussion inferred from current code structure and Streamlit runtime behavior
