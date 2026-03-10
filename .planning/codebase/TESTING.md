# Testing

## Current State
- No automated test files exist in this branch.
- No test framework dependency is declared in `pyproject.toml`.
- README does not describe an automated test command.

## What Is Tested Today
- In practice, validation appears to be manual through `streamlit run app.py`.
- Historical mode in `app.py` functions as the closest thing to a manual deterministic test path.
- Recorded-session replay in `SessionRecorder` provides another potential manual test harness.

## Natural Test Boundaries
- `IntervalCalculator` in `data_processor.py` is the best unit-test target.
- Candidate methods:
- `calculate_interval_at_line()`
- `calculate_interval_history()`
- `_get_average_lap_time()`
- `detect_events()`
- `RaceAnalyzer.predict_catch_point()`
- `RaceAnalyzer.is_in_drs_range()`

## Harder Areas To Test
- `app.py` is tightly coupled to Streamlit state and widget execution order.
- The tracking loop in `app.py` relies on sleeps and mutable session state.
- `F1DataFetcher` talks directly to the network through `requests.Session`, with no injected transport abstraction.

## Suggested Testing Strategy
- Add `pytest` and build focused unit tests around `data_processor.py`.
- Add fixture DataFrames for lap histories, pit-stop scenarios, and lapped-car cases.
- Mock `F1DataFetcher._make_request()` for API-facing tests.
- Keep UI tests minimal unless the app is refactored into smaller functions.

## Coverage Priorities
- Verify interval sign conventions and lap merge behavior.
- Verify duplicate handling in `update_position_data()` and `update_lap_data()`.
- Verify recorder save/load roundtrips with ISO-formatted timestamps.
- Verify retry behavior and failure fallbacks in `F1DataFetcher`.

## Risks From Missing Tests
- Regressions in interval semantics will be hard to detect visually.
- Packaging and entrypoint issues can persist unnoticed.
- Streamlit rerun behavior can break features without any automated signal.
