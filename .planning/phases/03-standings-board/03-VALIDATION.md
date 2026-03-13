---
phase: 3
slug: standings-board
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend) — no frontend test framework installed |
| **Config file** | `backend/pytest.ini` |
| **Quick run command** | `cd /Users/luckleineschaars/repos/f1-dashboard/backend && uv run pytest tests/ -x -q` |
| **Full suite command** | `cd /Users/luckleineschaars/repos/f1-dashboard/backend && uv run pytest tests/` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd /Users/luckleineschaars/repos/f1-dashboard/backend && uv run pytest tests/ -x -q`
- **After every plan wave:** Run `cd /Users/luckleineschaars/repos/f1-dashboard/backend && uv run pytest tests/`
- **Before `/gsd:verify-work`:** Full suite must be green + visual verification of all 5 success criteria
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | STND-01 | manual-only | — | N/A | ⬜ pending |
| 03-01-02 | 01 | 1 | STND-02 | manual-only | — | N/A | ⬜ pending |
| 03-01-03 | 01 | 1 | STND-03 | manual-only | — | N/A | ⬜ pending |
| 03-01-04 | 01 | 1 | STND-04 | manual-only | — | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No frontend test framework installed — `useStandingsData` hook logic (gap math, pit count, lapped detection) cannot be unit-tested automatically
- [ ] Consider adding vitest as dev dependency to unit-test the hook in isolation (optional — can accept manual-only)

*Existing backend infrastructure covers API-layer regression checks but is not relevant to this phase's deliverables.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Standings table renders all drivers in position order at currentLap | STND-01 | Pure UI rendering, no frontend test framework | Load a session, play replay, verify all drivers listed in position order |
| Gap/interval values display correctly | STND-02 | Visual validation of time formatting and toggle | Toggle gap/interval, compare values against known race data |
| Tire compound and age shown per driver | STND-03 | Visual validation of compound colors and lap counts | Verify compound indicator matches known strategy, tire age increments |
| Pit stop count increments after each pit | STND-04 | Visual validation of counter | Scrub through known pit laps, verify count increments |
| Standings update when replay advances | SC-05 | Visual validation of reactivity | Play/scrub replay, verify table re-sorts and updates values |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
