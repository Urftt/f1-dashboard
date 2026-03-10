# Concerns

## Highest-Risk Issues
- `pyproject.toml` declares `f1-dashboard = "app:main"`, but `app.py` has no `main()` function, so the package script is broken.
- README instructs users to install from `requirements.txt`, but that file is absent in this branch.
- `app.py` contains placeholder comments for live streaming and recorded-session plot updates, so advertised features are only partially implemented.

## Streamlit Execution Risks
- The `while st.session_state.is_tracking:` loop in `app.py` is likely to fight Streamlit’s rerun model and can lead to brittle or blocking behavior.
- Long-running loops with `time.sleep()` in the UI layer make responsiveness and cancellation harder.
- Heavy inline logic in `app.py` will become difficult to maintain as more dashboard features land.

## Data And API Risks
- `F1DataFetcher._make_request()` is typed as returning a dict, but calling code often expects a list response.
- OpenF1 response fields are consumed without validation, so upstream schema drift would produce runtime failures.
- Historical and live data paths assume fields such as `date_start`, `session_key`, `position`, and `name_acronym` always exist.

## Domain Logic Risks
- Gap calculations are based on lap crossing times and simple averages; they may misrepresent safety car, pit, or lapping situations.
- `_get_average_lap_time()` filters lap times to a hard-coded `60 < lap_time < 150` range, which is simplistic and track-dependent.
- `detect_events()` recalculates average lap time inside a loop, which is inefficient for larger datasets.

## Quality Risks
- There is no automated test coverage.
- Broad exception handling hides failure modes and weakens debuggability.
- Logging is configured in multiple modules, which can create inconsistent application logging behavior.

## Product And Maintenance Risks
- The README promises more functionality than the code currently delivers, which will mislead contributors and users.
- `fastf1` is declared but unused, which suggests dependency drift or abandoned integration work.
- `main.py` looks like scaffolding left behind from project initialization rather than an intentional interface.

## Refactor Candidates
- Extract data-source workflows from `app.py` into smaller service functions.
- Introduce a clear application entrypoint and align README and packaging metadata around it.
- Separate plotting helpers from control flow.
- Add tests around `data_processor.py` before changing gap semantics.
