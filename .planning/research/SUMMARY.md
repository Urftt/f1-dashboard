# Research Summary

## Milestone

`v1.0` focuses on a replay-synced historical race dashboard rather than true live timing.

## Stack Additions

- Keep the existing Python + Streamlit + Plotly + Pandas stack.
- Expand OpenF1 usage to include `stints` for tyre data and keep `laps` as the basis for lap timing.
- Add `pytest` for deterministic calculation tests.

## Feature Table Stakes

- Session selection
- Driver pair selection
- Replay start/pause/resume
- Playback speed control
- Scrub or jump through replay time
- Gap graph that progresses through the race
- Basic race statistics table

## Recommended Architecture

- Preload session datasets once.
- Derive replay snapshots locally from a replay clock.
- Separate playback state from Streamlit rendering.
- Keep business logic out of the UI loop where possible.

## Watch Out For

- Do not implement replay by repeatedly polling historical endpoints.
- Do not rely on live-only interval endpoints for the core experience.
- Do not keep the current blocking `while` loop as the control mechanism.
- Expect partial or missing data and handle it explicitly.

## Source Notes

- OpenF1 documents free historical access and paid real-time access, which supports the replay-first milestone choice.
- OpenF1 documents `laps` and `stints` fields that are sufficient for the initial KPI set.

## Sources

- OpenF1 docs: https://openf1.org/docs/
- OpenF1 overview: https://openf1.org/
- FastF1 docs: https://docs.fastf1.dev/
