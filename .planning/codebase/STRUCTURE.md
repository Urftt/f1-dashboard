# Structure

## Top-Level Layout
- `app.py`: main Streamlit dashboard and UI workflow.
- `config.py`: constants, environment loading, and local path setup.
- `data_fetcher.py`: API client and recording utilities.
- `data_processor.py`: interval and race-analysis functions.
- `main.py`: placeholder script, not the main dashboard entrypoint.
- `pyproject.toml`: packaging and dependency metadata.
- `README.md`: usage guidance, some of which is stale for this branch.

## Functional Grouping
- UI and orchestration are concentrated in `app.py`.
- External I/O is concentrated in `data_fetcher.py`.
- Analytical transforms are concentrated in `data_processor.py`.
- Shared constants are concentrated in `config.py`.

## Missing Expected Directories
- No `tests/` directory exists.
- No `src/` package layout exists.
- No `frontend/`, `backend/`, or multi-service split exists on this branch.
- No `.planning/` directory existed before this mapping run.

## Naming Patterns
- Module names are simple and domain-oriented: `data_fetcher`, `data_processor`, `config`.
- Classes use CamelCase: `F1DataFetcher`, `SessionRecorder`, `IntervalCalculator`, `RaceAnalyzer`.
- Methods use snake_case consistently across the codebase.
- Constants are uppercase in `config.py`.

## Coupling Hotspots
- `app.py` imports many constants directly from `config.py`.
- `app.py` reaches into `fetcher.driver_numbers` instead of using an accessor.
- `app.py` manually coordinates session loading, lap loading, tracking, and plotting in one file.

## Generated Or Runtime Paths
- `recorded_sessions/` is created dynamically by importing `config.py`.
- Saved recording file path is `{RECORDED_SESSIONS_DIR}/{session_name}.{RECORDING_FORMAT}` in `data_fetcher.py`.

## Observed Inconsistencies
- README documents `requirements.txt`, but the file is absent.
- README describes more complete live/replay behavior than the code currently implements.
- `main.py` and the `project.scripts` mapping suggest a CLI shape that the rest of the code does not follow.

## Recommended Mental Model
- Treat this repository as a prototype Streamlit app rather than a packaged library.
- Most future changes will either expand `app.py` or require extracting services/components from it.
