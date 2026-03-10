# Architecture

## Summary
- This branch is a small monolithic Streamlit application with minimal layering.
- The code is split into UI orchestration, external data access, and interval-analysis logic.
- State is shared through Streamlit session state rather than explicit application services.

## Primary Modules
- `app.py`: Streamlit entrypoint, page layout, user interactions, and tracking loop.
- `data_fetcher.py`: OpenF1 API client plus local session recording and replay helpers.
- `data_processor.py`: pure-ish data transformation and race-analysis routines.
- `config.py`: constants and environment bootstrapping.
- `main.py`: unused placeholder CLI entrypoint.

## Data Flow
1. A user picks a data source in `app.py`.
2. `F1DataFetcher` loads sessions and drivers from OpenF1.
3. Selected driver acronyms are mapped to driver numbers using `fetcher.driver_numbers`.
4. Lap or position data is loaded into `IntervalCalculator`.
5. `IntervalCalculator.calculate_interval_history()` derives gap and closing-rate series.
6. `app.py` renders the resulting history in a Plotly figure.

## State Management
- Long-lived app objects are stored in `st.session_state`, including:
- `fetcher`
- `calculator`
- `is_tracking`
- `interval_history`
- `selected_session`
- `last_update`
- This makes rerun behavior implicit and couples UI events tightly to application state.

## Execution Model
- Streamlit reruns the script from top to bottom on widget interaction.
- `app.py` also contains a `while st.session_state.is_tracking:` loop for active tracking.
- That loop blocks inside the request-response cycle, which is a fragile fit for Streamlit’s rerun model.

## Domain Logic
- `IntervalCalculator` derives intervals from lap crossing times, not sector telemetry.
- Different-lap gaps are approximated using average lap time from `_get_average_lap_time()`.
- `RaceAnalyzer` provides predictive helpers but is not wired into the UI.

## Persistence Model
- Recordings are stored as JSON files under `recorded_sessions/`.
- There is no database schema, migration flow, or repository abstraction.

## Entry Points
- Real application entrypoint: `streamlit run app.py`.
- Declared package entrypoint: `pyproject.toml` -> `app:main` (currently broken).
- Placeholder CLI: `python main.py`.

## Architectural Constraints
- The app assumes OpenF1 response shapes directly in multiple call sites.
- There is no separation between application services and Streamlit widget code.
- Most coordination happens inline in `app.py`, so feature growth will concentrate complexity there.
