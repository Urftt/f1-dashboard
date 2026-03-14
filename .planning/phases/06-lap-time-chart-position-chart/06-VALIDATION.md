---
phase: 6
slug: lap-time-chart-position-chart
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `frontend/vitest.config.ts` |
| **Quick run command** | `cd frontend && npm test -- --reporter=verbose` |
| **Full suite command** | `cd frontend && npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npm test -- --reporter=verbose`
- **After every plan wave:** Run `cd frontend && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | STRAT-02 | unit | `npm test -- src/components/LapTimeChart/useLapTimeData.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | STRAT-02 | unit | `npm test -- src/components/LapTimeChart/useLapTimeData.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | STRAT-03 | unit | `npm test -- src/components/LapTimeChart/useLapTimeData.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-04 | 01 | 1 | STRAT-03 | unit | `npm test -- src/components/LapTimeChart/useLapTimeData.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | RACE-01 | unit | `npm test -- src/components/PositionChart/usePositionData.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 1 | RACE-01 | unit | `npm test -- src/components/PositionChart/usePositionData.test.ts` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 1 | ENHANCE-02 | unit | `npm test -- src/components/LapTimeChart/useLapTimeData.test.ts` | ❌ W0 | ⬜ pending |
| 06-04-01 | 04 | 1 | ENHANCE-03 | unit | `npm test -- src/components/DriverToggle/useVisibleDrivers.test.ts` | ❌ W0 | ⬜ pending |
| 06-04-02 | 04 | 1 | ENHANCE-03 | unit | `npm test -- src/components/DriverToggle/useVisibleDrivers.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/components/LapTimeChart/useLapTimeData.test.ts` — stubs for STRAT-02, STRAT-03, ENHANCE-02
- [ ] `frontend/src/components/PositionChart/usePositionData.test.ts` — stubs for RACE-01
- [ ] `frontend/src/components/DriverToggle/useVisibleDrivers.test.ts` — stubs for ENHANCE-03

*Existing infrastructure covers framework installation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SC/VSC shaded regions render visually correct | ENHANCE-02 | Visual rendering verification | Open lap time chart during SC period, verify yellow/orange shaded bands appear at correct lap ranges |
| Position chart y-axis inverted (P1 at top) | RACE-01 | Layout verification | Open position chart, verify P1 appears at top of y-axis |
| Driver toggle updates both charts simultaneously | ENHANCE-03 | Cross-component visual sync | Toggle driver off, verify both lap time and position charts update |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
