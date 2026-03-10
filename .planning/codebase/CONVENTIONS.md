# Conventions

## Code Style
- Python code uses 4-space indentation and conventional snake_case naming.
- Modules begin with short triple-quoted docstrings.
- Class and method docstrings are present in `data_fetcher.py` and `data_processor.py`.
- Logging is set up with `logging.basicConfig(level=logging.INFO)` in both `app.py` and `data_fetcher.py`.

## Typing
- Type hints are used selectively.
- `data_fetcher.py` and `data_processor.py` annotate many arguments and return values.
- `app.py` has almost no function structure and therefore little explicit typing.
- Some hints are loose, for example `_make_request()` returns `Optional[Dict]` even though API responses are treated as lists in several callers.

## State And Mutation Patterns
- Stateful objects are mutated in place rather than rebuilt.
- `IntervalCalculator` appends to internal DataFrames and drops duplicates after concatenation.
- `SessionRecorder` accumulates JSON-serializable dictionaries in memory before saving.
- `st.session_state` is the primary coordination mechanism for UI behavior.

## Error Handling
- Network requests catch `requests.exceptions.RequestException` and retry.
- Streamlit tracking logic catches broad `Exception` in the update loop and surfaces the stringified error in the UI.
- File loading in `SessionRecorder.load()` also catches broad `Exception`.
- There is no custom exception hierarchy or user-facing error model.

## Data Conventions
- Positive interval semantics are inconsistent across methods:
- `calculate_interval_at_line()` documents positive as driver1 ahead.
- `calculate_interval_history()` computes `date_start_d2 - date_start_d1`, which also implies positive when driver1 is ahead.
- Plot annotations in `app.py` assume the same sign convention.
- Driver choices in the UI use name acronyms, then map to numeric identifiers through `fetcher.driver_numbers`.

## UI Conventions
- Streamlit widgets are defined inline near the handling logic that responds to them.
- Emoji-heavy labels are used throughout the UI.
- Plot configuration is repeated instead of wrapped in helper functions.

## Gaps In Conventions
- No formatter, linting rules, or import-order conventions are configured.
- No documented branching, release, or review conventions are present in-repo.
- Packaging conventions are not enforced; `main.py`, `app.py`, README, and `pyproject.toml` disagree on the primary execution path.
