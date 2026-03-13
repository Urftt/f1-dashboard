---
phase: 5
slug: dashboard-layout-stint-timeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `frontend/vitest.config.ts` — Wave 0 installs |
| **Quick run command** | `cd frontend && npx vitest run src/lib/ src/components/StintTimeline/` |
| **Full suite command** | `cd frontend && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run src/lib/ src/components/StintTimeline/`
- **After every plan wave:** Run `cd frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 0 | LAYOUT-01 | unit/render | `npx vitest run src/components/Dashboard/Dashboard.test.tsx` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | STRAT-01 | unit | `npx vitest run src/components/StintTimeline/useStintData.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | STRAT-01 | unit | `npx vitest run src/components/StintTimeline/useStintData.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | STRAT-01 | unit | `npx vitest run src/components/StintTimeline/useStintData.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-05 | 01 | 1 | ENHANCE-01 | unit | `npx vitest run src/lib/plotlyShapes.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-06 | 01 | 1 | ENHANCE-01 | unit | `npx vitest run src/components/StintTimeline/useStintData.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/vitest.config.ts` — install vitest, @vitest/ui, jsdom, @testing-library/react, @testing-library/jest-dom; configure vitest
- [ ] `frontend/src/lib/compounds.test.ts` — stubs for getCompoundColor, getCompoundLetter edge cases
- [ ] `frontend/src/lib/plotlyShapes.test.ts` — stubs for makeReplayCursorShape
- [ ] `frontend/src/components/StintTimeline/useStintData.test.ts` — stubs for stint derivation, progressive reveal, driver ordering
- [ ] `frontend/src/components/Dashboard/Dashboard.test.tsx` — stubs for analysis section visibility gate

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stint bars visually match F1 compound colors | STRAT-01 | Visual color accuracy | Open dashboard, start replay, verify bar colors match expected compound colors |
| Scroll to analysis section UX | LAYOUT-01 | UX/scroll interaction | Start replay, scroll below gap chart and standings, verify analysis section is reachable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
