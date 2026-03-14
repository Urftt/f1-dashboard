---
phase: 02
slug: replay-engine-and-controls
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-10
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.x |
| **Config file** | [pyproject.toml](/home/james-turing/repos/f1-dashboard/.worktrees/codex-gsd/pyproject.toml) |
| **Quick run command** | `python -m pytest tests/test_replay_controls.py` |
| **Full suite command** | `python -m pytest` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python -m pytest tests/test_replay_controls.py`
- **After every plan wave:** Run `python -m pytest`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | REPL-02 | unit | `python -m pytest tests/test_replay_controls.py -k start_or_tick` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | REPL-03 | unit | `python -m pytest tests/test_replay_controls.py -k pause_or_resume` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | REPL-04 | unit | `python -m pytest tests/test_replay_controls.py -k speed` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | REPL-05 | unit | `python -m pytest tests/test_replay_controls.py -k scrub_or_jump` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 3 | REPL-02 | integration | `python -m pytest tests/test_replay_controls.py -k lap1_or_first_play` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 3 | REPL-05 | integration | `python -m pytest tests/test_replay_controls.py -k driver_pair_or_visible_history` | ❌ W0 | ⬜ pending |
| 02-03-03 | 03 | 3 | REPL-02, REPL-03, REPL-04, REPL-05 | integration | `python -m pytest` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_replay_controls.py` — helper and replay-state coverage for REPL-02 through REPL-05
- [ ] shared fixtures for replay controller state and interval-history filtering, added to `tests/conftest.py` if needed
- [ ] app-facing seam coverage for lap-1 initialization, first-play behavior, and driver-pair cache invalidation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Timer-driven playback inside Streamlit UI | REPL-02, REPL-03, REPL-04 | Fragment/rerun behavior is awkward to assert fully in unit tests | Load a historical session, press Play, observe lap progression, pause, resume, change speed, confirm state remains stable |
| Scrub and jump control feel | REPL-05 | Widget interaction timing is user-facing and depends on Streamlit reruns | Move slider or jump controls while paused and while playing, confirm chart and KPI state match selected lap without unexpected restart |
| Historical branch blocker removal proof | REPL-02 | Final Streamlit wiring still needs manual confirmation even with seam tests | Confirm the historical flow advances through the new tick path and that the old blocking `is_tracking` loop is no longer used for historical playback |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
