# Research: Stack

## Question

What stack additions or changes are needed to deliver a replay-synced race dashboard with evolving KPIs on top of the current Streamlit prototype?

## Existing Context

- Existing app stack is Python, Streamlit, Plotly, Pandas, NumPy, Requests.
- The current code already uses OpenF1 as the data source.
- The milestone focuses on historical replay, not millisecond-accurate live mode.

## Findings

### Data source fit
- OpenF1 is the most direct fit for this milestone because it exposes historical session data without authentication and includes laps, stints, position, race control, weather, and intervals endpoints.
- OpenF1 documents that real-time access requires a paid subscription, which reinforces replay-first scope for `v1.0`.
- OpenF1 `stints` provides tyre compound and tyre age at stint start, which is directly useful for the race statistics table.
- OpenF1 `laps` provides lap durations and sector timings, which are enough for last-lap and sector-comparison style features later.
- OpenF1 `intervals` is documented as race-only real-time data, so it should not be a hard dependency for replay mode.

### App stack
- Streamlit is good enough for a laptop-side replay dashboard if the code avoids long blocking loops and instead uses explicit playback state and derived timeline slices.
- Plotly remains a good choice for the gap graph because the current app already uses it and it handles timeline-style charts well.
- Pandas is a good fit for preloading session datasets and deriving replay snapshots over time.

### Suggested additions
- `pytest` for a minimal automated test suite around replay state derivation and KPI calculations.
- A small domain layer inside the app for:
- preloading session datasets
- building replay snapshots at a target race time
- mapping replay time to visible KPI state
- Optional caching with Streamlit cache primitives for session datasets, especially if replay setup fetches multiple OpenF1 endpoints.

### What not to add in v1.0
- Do not add a second UI framework.
- Do not add a database yet; replay data can remain in memory per session load.
- Do not depend on live-only endpoints for core experience.

## Recommended Stack Direction

- Keep Python + Streamlit + Plotly + Pandas.
- Expand OpenF1 usage beyond `sessions`, `drivers`, and `laps` to include `stints` and likely `position`.
- Add `pytest` for logic tests.
- Restructure application code around replay-state derivation rather than perpetual UI loops.

## Sources

- OpenF1 docs: https://openf1.org/docs/
- OpenF1 overview: https://openf1.org/
- FastF1 docs: https://docs.fastf1.dev/
