# Milestones

## v1.1 Strategy & Analysis Dashboard (Shipped: 2026-03-15)

**Phases:** 5-8 | **Plans:** 7 | **Files:** 59 changed | **Timeline:** 2026-03-14 → 2026-03-15
**Git range:** feat(05-01) → feat(08-02)

**Delivered:** Five analysis views added to a scrollable dashboard — stint timeline, lap time chart with degradation stats, position chart, interval history with DRS reference, and sector comparison heatmap — giving users deeper strategic insight into race data.

**Key accomplishments:**
1. Scrollable analysis dashboard with "Strategy & Analysis" section below gap chart
2. Stint timeline showing all drivers' tire strategies with compound-colored bars
3. Lap time chart with per-stint trend lines, slope/σ annotations, and std dev bands
4. Position chart with hover highlighting and end-of-line driver labels
5. Interval history showing gap-to-car-ahead with DRS threshold and SC/VSC shading
6. Sector comparison heatmap with session/personal best color coding and SC exclusion toggle

**Requirements:** 11/11 satisfied
**Tech debt:** 7 items (Phase 8 missing verification docs, Nyquist drafts incomplete, hover tooltip minor gap)

---

## v1.0 F1 Race Replay Dashboard (Shipped: 2026-03-13)

**Phases:** 1-4 | **Plans:** 12 | **Commits:** 71 | **Timeline:** 2026-03-13
**Git range:** feat(01-01) → feat(04-02)

**Delivered:** A fully functional F1 race replay dashboard with interactive gap charts, standings board, and replay engine using historical FastF1 data.

**Key accomplishments:**
1. FastAPI backend with FastF1 data pipeline, SSE progress streaming, and disk caching
2. Interactive Plotly gap chart with team-color driver lines and hover tooltips
3. Lap-by-lap replay engine with play/pause, speed control (0.5x-4x), and scrubber
4. Standings board showing positions, gaps, tire compounds, tire age, and pit counts
5. Pit stop annotations and safety car/VSC shading on gap chart
6. Session selector with cascading year/event/session dropdowns

**Requirements:** 18/18 satisfied
**Tech debt:** 4 minor items (orphaned model, hardcoded cache check, unused file, stale comment)

---

