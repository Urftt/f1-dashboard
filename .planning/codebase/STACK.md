# Stack

## Summary
- Primary language: Python 3.12+ from `pyproject.toml`.
- App style: single-process Streamlit dashboard in `app.py`.
- Visualization: Plotly graph objects via `plotly.graph_objects`.
- Data layer: `requests` for HTTP and `pandas`/`numpy` for processing.
- Environment loading: `python-dotenv` in `config.py`.

## Runtime And Packaging
- Project metadata lives in `pyproject.toml`.
- Build backend is `hatchling`.
- Console script is declared as `f1-dashboard = "app:main"`, but `app.py` does not define `main`.
- `main.py` contains a trivial `main()` that prints text and is not the actual app entrypoint.
- Actual runtime entrypoint is `streamlit run app.py`, as documented in `README.md`.

## Core Dependencies
- `streamlit` drives UI state and page layout in `app.py`.
- `plotly` renders interval history charts in `app.py`.
- `pandas` stores session, lap, and position data across `app.py`, `data_fetcher.py`, and `data_processor.py`.
- `numpy` is used in `data_processor.py` for average lap-time calculations.
- `requests` is used in `data_fetcher.py` for OpenF1 API calls.
- `python-dotenv` is loaded in `config.py` for local environment configuration.
- `fastf1`, `jupyter`, and `ipykernel` are declared in `pyproject.toml` but not referenced by the checked-in application code.

## Developer Tooling
- Type-checking dependencies are listed under `[dependency-groups].dev` in `pyproject.toml`.
- No formatter, linter, or test runner configuration is present in `pyproject.toml`.
- No CI configuration is present in this branch.

## Configuration Surface
- `config.py` centralizes API URL, retry counts, update interval, plot styling, driver colors, and Streamlit page settings.
- `config.py` creates `recorded_sessions/` on import via `RECORDED_SESSIONS_DIR.mkdir(exist_ok=True)`.
- `DEBUG` is controlled by the `DEBUG` environment variable.

## Storage
- Persistent local storage is file-based JSON under `recorded_sessions/`.
- No database, cache, or queue is present in this branch.

## Notable Mismatches
- README refers to `requirements.txt`, but that file does not exist in this worktree.
- Packaging entrypoint in `pyproject.toml` does not match executable code layout.
- The repository name in README is `f1-interval-dashboard`, while the package name is `f1-dashboard`.
