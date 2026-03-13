# Requirements: F1 Race Replay Dashboard

**Defined:** 2026-03-13
**Core Value:** Users can see the gap between any two drivers plotted over time — the single most missing piece of F1 broadcast data.

## v1.0 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Session Management

- [x] **SESS-01**: User can select a historical F1 season (2018 onwards)
- [x] **SESS-02**: User can browse Grand Prix events within a season
- [x] **SESS-03**: User can select session type (Race, Qualifying, FP1/2/3)
- [x] **SESS-04**: User sees loading progress with percentage during FastF1 data fetch
- [x] **SESS-05**: Loaded sessions are cached so reloads are instant

### Gap Chart

- [ ] **GAP-01**: User can select two drivers from the loaded session
- [ ] **GAP-02**: User sees an interactive gap-over-time chart for the selected pair
- [ ] **GAP-03**: User can hover to see exact gap values and lap numbers
- [ ] **GAP-04**: User sees vertical annotations on laps where either driver pitted
- [ ] **GAP-05**: User sees yellow shading on laps under Safety Car or VSC

### Replay

- [ ] **REPL-01**: User can start/pause a lap-by-lap replay of the session
- [ ] **REPL-02**: User can set replay speed (0.5x, 1x, 2x, 4x)
- [ ] **REPL-03**: User can jump to any lap via a scrubber control
- [ ] **REPL-04**: Gap chart shows a vertical cursor at the current replay lap

### Standings

- [ ] **STND-01**: User sees a standings board showing driver positions at the current lap
- [ ] **STND-02**: Standings show gap to leader and interval to car ahead
- [ ] **STND-03**: Standings show tire compound and tire age for each driver
- [ ] **STND-04**: Standings show pit stop count for each driver

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Live Data

- **LIVE-01**: User can connect to live race data via OpenF1 API
- **LIVE-02**: Dashboard updates in real-time during live sessions

### Advanced Analytics

- **ANLYT-01**: User can view tire strategy predictions
- **ANLYT-02**: User can view driver telemetry overlays

## Out of Scope

| Feature | Reason |
|---------|--------|
| Live data integration (OpenF1) | Build historical/replay UX first, add live complexity in v2 |
| Animated track position map | FastF1 positional data resolution too low for quality results |
| Telemetry overlay in standings | Different data cadence, 10x data volume — separate concern |
| Mobile app | Laptop second-screen only |
| Multi-user / deployment | Personal local tool |
| Qualifying/Sprint gap charts | Gap semantics differ from races; Position is NaN in non-race sessions |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SESS-01 | Phase 1 | Complete |
| SESS-02 | Phase 1 | Complete |
| SESS-03 | Phase 1 | Complete |
| SESS-04 | Phase 1 | Complete |
| SESS-05 | Phase 1 | Complete |
| GAP-01 | Phase 2 | Pending |
| GAP-02 | Phase 2 | Pending |
| GAP-03 | Phase 2 | Pending |
| GAP-04 | Phase 4 | Pending |
| GAP-05 | Phase 4 | Pending |
| REPL-01 | Phase 2 | Pending |
| REPL-02 | Phase 2 | Pending |
| REPL-03 | Phase 2 | Pending |
| REPL-04 | Phase 2 | Pending |
| STND-01 | Phase 3 | Pending |
| STND-02 | Phase 3 | Pending |
| STND-03 | Phase 3 | Pending |
| STND-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-13*
*Last updated: 2026-03-13 after roadmap creation — all requirements mapped*
