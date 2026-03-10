# Integrations

## Summary
- The only active external integration in this branch is the OpenF1 HTTP API.
- There is no authentication, payment, messaging, or database integration.

## OpenF1 API
- Base URL is configured as `https://api.openf1.org/v1` in `config.py`.
- `F1DataFetcher` in `data_fetcher.py` wraps API access through a shared `requests.Session`.
- Endpoints used:
- `sessions` via `get_recent_sessions()`, `get_latest_session()`, and `load_session()`
- `drivers` via `_load_drivers()`
- `position` via `get_position_data()` and `stream_live_positions()`
- `laps` via `get_lap_data()`

## Request Behavior
- Timeout is controlled by `API_TIMEOUT` in `config.py`.
- Retries use `RETRY_ATTEMPTS` with exponential backoff in `F1DataFetcher._make_request()`.
- Failures are logged through the module logger and returned as `None`.
- The fetcher does not apply schema validation or structured error objects.

## Integration Data Flow
- `app.py` triggers fetcher methods from Streamlit button handlers.
- Session selection loads driver metadata into `st.session_state`.
- Lap data is fetched and handed to `IntervalCalculator.update_lap_data()` in `data_processor.py`.
- Position replay for recordings is handled locally and does not call the network.

## Local File Integration
- `SessionRecorder` in `data_fetcher.py` persists recordings to `recorded_sessions/*.json`.
- Saved JSON contains `metadata`, `position_data`, and `lap_data`.
- The recorder converts datetime-like objects to ISO strings before writing.

## Authentication And Secrets
- No API keys or auth providers are configured.
- `dotenv` is loaded, but no required environment variables are used by the code on this branch.

## Missing Or Partial Integrations
- Live session streaming UI in `app.py` is stubbed with comments and a sleep loop rather than using `F1DataFetcher.stream_live_positions()`.
- Recorded-session plotting is also marked as incomplete in `app.py`.
- There are no outbound webhooks, telemetry sinks, or error-reporting services.

## Operational Risks
- OpenF1 availability is a hard dependency for live and historical session loading.
- Request failures degrade to empty data and UI errors without recovery workflows.
- API response field names are assumed directly in code, so upstream schema changes would likely break runtime behavior.
