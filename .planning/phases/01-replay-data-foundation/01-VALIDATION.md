---
phase: 1
slug: replay-data-foundation
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-10
---

# Phase 1 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `py_compile` in Waves 1-2, `pytest` added in Wave 3 |
| **Config file** | none - keep discovery simple for this repo |
| **Quick run command** | `python -m py_compile replay_data.py data_fetcher.py data_processor.py app.py` |
| **Full suite command** | `python -m pytest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task-level automated command listed below
- **After Waves 1-2:** Run `python -m py_compile replay_data.py data_fetcher.py data_processor.py app.py`
- **After Wave 3:** Run `python -m pytest`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | REPL-01 | static | `python -m py_compile replay_data.py data_fetcher.py` | ✅ existing files | ⬜ pending |
| 1-01-02 | 01 | 1 | REPL-01 | smoke | `python -c "from data_fetcher import F1DataFetcher; print(hasattr(F1DataFetcher, 'load_replay_session'))"` | ✅ existing files | ⬜ pending |
| 1-02-01 | 02 | 2 | STAT-02 | static | `python -m py_compile replay_data.py data_processor.py app.py` | ✅ existing files | ⬜ pending |
| 1-02-02 | 02 | 2 | STAT-03 | static | `python -m py_compile replay_data.py data_processor.py app.py` | ✅ existing files | ⬜ pending |
| 1-03-01 | 03 | 3 | RELY-03 | unit | `python -m pytest tests/test_replay_foundation.py` | ❌ planned in Plan 03 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers pre-pytest validation through compile and import checks. No separate Wave 0 plan is required for this phase.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Historical session selection remains usable in Streamlit | REPL-01 | Widget flow is tightly coupled to Streamlit reruns | Run `streamlit run app.py`, load a historical session, and confirm drivers and initial metrics populate without errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify without requiring a separate Wave 0 plan
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] No missing references require a separate Wave 0 plan
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-10
