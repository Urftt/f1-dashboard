---
phase: 7
slug: interval-history
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom environment) |
| **Config file** | `frontend/vitest.config.ts` |
| **Quick run command** | `cd frontend && npm test -- --reporter=verbose src/components/IntervalHistory/` |
| **Full suite command** | `cd frontend && npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npm test -- --reporter=verbose src/components/IntervalHistory/`
- **After every plan wave:** Run `cd frontend && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | RACE-02 | unit | `npm test -- src/components/IntervalHistory/useIntervalData.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | RACE-02 | unit | `npm test -- src/components/IntervalHistory/useIntervalData.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 1 | RACE-02 | unit | `npm test -- src/components/IntervalHistory/useIntervalData.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | RACE-02, ENHANCE-04 | unit | `npm test -- src/components/IntervalHistory/useIntervalData.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 1 | ENHANCE-04 | unit | `npm test -- src/components/IntervalHistory/useIntervalData.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/components/IntervalHistory/useIntervalData.test.ts` — stubs for RACE-02 + ENHANCE-04 pure function tests
- [ ] `frontend/src/components/IntervalHistory/useIntervalData.ts` — pure functions must exist before tests can import them
- [ ] `frontend/src/components/IntervalHistory/IntervalHistory.tsx` — presentational component

*Existing infrastructure covers framework requirements — vitest + jsdom already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hover highlighting visually dims non-hovered traces | RACE-02 | Visual opacity/width effect not testable in jsdom | Hover over a trace in browser; other traces should dim to 0.5 opacity |
| DRS green zone visually rendered | RACE-02 | Plotly shape rendering not testable in unit tests | Load chart; green shaded zone visible below 1.0s line |
| Replay cursor syncs with currentLap slider | ENHANCE-04 | Requires Plotly rendering + store interaction | Move replay slider; vertical cursor should track |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
