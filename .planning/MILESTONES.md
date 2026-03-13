# Milestones

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

