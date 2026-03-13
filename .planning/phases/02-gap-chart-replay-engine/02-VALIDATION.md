---
phase: 2
slug: gap-chart-replay-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (backend); no frontend test runner configured |
| **Config file** | `backend/pytest.ini` |
| **Quick run command** | `cd backend && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/ -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/`
- **Before `/gsd:verify-work`:** Full suite must be green + manual smoke test of chart and replay controls
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | GAP-01 | unit | `cd backend && python -m pytest tests/test_gap.py::test_driver_list -x` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | GAP-02 | unit | `cd backend && python -m pytest tests/test_gap.py::test_gap_calculation -x` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | GAP-03 | manual-only | Hover over chart data point; verify "Lap N: +X.XXXs" format | N/A | ⬜ pending |
| 02-03-01 | 03 | 2 | REPL-01 | manual-only | Click play; verify lap counter advances. Click pause; verify it stops | N/A | ⬜ pending |
| 02-03-02 | 03 | 2 | REPL-02 | manual-only | Set 4x; verify playback is 4x faster than 1x | N/A | ⬜ pending |
| 02-03-03 | 03 | 2 | REPL-03 | manual-only | Drag scrubber to lap 30; verify chart cursor at lap 30 | N/A | ⬜ pending |
| 02-03-04 | 03 | 2 | REPL-04 | manual-only | Advance replay; verify dashed line tracks lap number | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_gap.py` — stubs for GAP-01 (driver list from laps), GAP-02 (gap calculation uses Time not LapTime)
- No frontend test infrastructure needed for Phase 2 (manual-only per project scope)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tooltip shows "Lap N: +X.XXXs" format | GAP-03 | UI rendering behavior | Hover over chart data point; verify tooltip format |
| Play/pause toggles isPlaying state | REPL-01 | UI interaction | Click play; verify lap counter advances. Click pause; verify it stops |
| Speed buttons change interval correctly | REPL-02 | UI timing behavior | Set 4x; verify playback is 4x faster than 1x |
| Scrubber drag jumps to correct lap | REPL-03 | UI drag interaction | Drag scrubber to lap 30; verify chart cursor at lap 30 |
| Cursor renders at current lap | REPL-04 | UI rendering | Advance replay; verify dashed line tracks lap number |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
