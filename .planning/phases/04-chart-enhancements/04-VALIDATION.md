---
phase: 4
slug: chart-enhancements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend) |
| **Config file** | `backend/pytest.ini` / `backend/conftest.py` |
| **Quick run command** | `cd backend && uv run pytest tests/test_sessions.py -x -q` |
| **Full suite command** | `cd backend && uv run pytest -x -q` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && uv run pytest tests/test_sessions.py -x -q`
- **After every plan wave:** Run `cd backend && uv run pytest -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | GAP-04 | unit | `uv run pytest tests/test_sessions.py::TestSafetyCarParsing -x` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 0 | GAP-04 | unit | `uv run pytest tests/test_sessions.py::TestSafetyCarParsing::test_time_to_lap_mapping -x` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | GAP-04 | unit | `uv run pytest tests/test_sessions.py::TestSSEEndpoint::test_sse_complete_event_contains_safety_car_periods -x` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | GAP-05 | manual | N/A — Plotly rendering, visual verification | N/A | ⬜ pending |
| 04-02-02 | 02 | 1 | GAP-05 | manual | N/A — progressive reveal, visual verification | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_sessions.py` — extend with `TestSafetyCarParsing` class covering `parse_safety_car_periods()` and `_time_to_lap()` functions
- [ ] Verify `session.track_status` availability with `laps=True` — confirm whether `messages=True` required

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pit stop vertical lines render at correct laps | GAP-05 | Plotly shape rendering — visual output | Load gap chart, verify vertical lines appear at pit laps for both drivers |
| SC/VSC yellow shading covers correct lap ranges | GAP-04 | Plotly rect rendering — visual output | Load race with SC (e.g., Bahrain 2024), verify yellow bands match known SC periods |
| Progressive reveal clamps active SC period x1 | GAP-04 | Animation state — visual timing | Use replay slider, verify SC shading grows with currentLap |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
