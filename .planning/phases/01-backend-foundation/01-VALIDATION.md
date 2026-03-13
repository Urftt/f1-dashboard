---
phase: 1
slug: backend-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + httpx (async FastAPI testing) on backend; Vitest on frontend |
| **Config file** | `backend/pytest.ini` (Wave 0 installs) / `frontend/vitest.config.ts` (Wave 0 installs) |
| **Quick run command** | `cd backend && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ && cd ../frontend && npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/ -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ && cd ../frontend && npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | SESS-01 | integration | `pytest tests/test_schedule.py::test_get_schedule_2018 -x` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 0 | SESS-02 | unit | `pytest tests/test_schedule.py::test_only_completed_events -x` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 0 | SESS-03 | unit | `pytest tests/test_schedule.py::test_session_types -x` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 0 | SESS-04 | integration | `pytest tests/test_sessions.py::test_sse_progress_events -x` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 0 | SESS-05 | integration | `pytest tests/test_sessions.py::test_cache_hit_faster -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/__init__.py` — test package init
- [ ] `backend/tests/conftest.py` — shared fixtures (FastAPI test client, mock FastF1 calls)
- [ ] `backend/tests/test_schedule.py` — covers SESS-01, SESS-02, SESS-03
- [ ] `backend/tests/test_sessions.py` — covers SESS-04, SESS-05
- [ ] `backend/pytest.ini` — pytest configuration
- [ ] Framework install: `uv add --dev pytest httpx pytest-asyncio` in backend/
- [ ] `frontend/vitest.config.ts` — Vitest config for React components

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SSE progress bar updates visually in real time | SESS-04 | Visual UI behavior | 1. Select a session not in cache 2. Observe progress bar animates smoothly 3. Verify percentage increases monotonically |
| Cached load feels instant (<1s) | SESS-05 | Perceived performance | 1. Load a session 2. Load same session again 3. Verify UI responds within 1 second |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
