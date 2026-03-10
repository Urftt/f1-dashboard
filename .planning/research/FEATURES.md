# Research: Features

## Question

How do replay-synced race dashboards typically work for the kind of insight this milestone needs?

## Existing Context

- Existing product idea is a second-screen dashboard for watching or rewatching F1.
- The user wants race progression to feel live after pressing start at lights out.

## Table Stakes

- Select a race session to load
- Select drivers to compare
- Press start and see the dashboard advance over race time
- Pause and resume playback
- Change playback speed
- Scrub or jump through race time
- View an updating two-driver gap graph
- View a compact statistics panel that updates with replay time

## Strong v1.0 Features

- Driver pair selection with a stable gap visualization
- Race statistics table with:
- last completed lap time
- current tyre compound
- tyre age in laps
- replay time indicator showing current race timestamp or lap context
- clear empty/error states when a session lacks required fields

## Useful Future Differentiators

- Sector-by-sector comparison view
- Pit window and stint trend overlays
- Strategy comparison cards across multiple drivers
- Race control overlays such as safety car, VSC, or incidents
- Weather overlays for context

## Anti-Features For This Milestone

- Overloading the first milestone with too many cards or charts
- Pursuing live timing parity with broadcast tooling
- Building predictive strategy models before the replay base is stable

## Complexity Notes

- Replay controls are mostly state-management work.
- Accurate tyre context depends on stitching stint and lap data together cleanly.
- Gap progression should be derived from preloaded historical data rather than simulated guesses.

## Sources

- OpenF1 docs: https://openf1.org/docs/
- FastF1 docs: https://docs.fastf1.dev/
