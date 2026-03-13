# Phase 3: Standings Board - Research

**Researched:** 2026-03-13
**Domain:** React data-derived table with live replay sync, row animation, and tire visualization
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Table Layout & Density**
- Comfortable row height — top ~10 drivers visible, scroll for the rest
- Team color bar on left edge of each row (thin vertical stripe)
- Columns: Position + Driver abbreviation + Interval/Gap + Tire compound + Tire age + Pit count
- Abbreviation only (VER, NOR) — no full driver names in the table
- Full driver name available on hover tooltip

**Position Change Indicators**
- Show position change vs previous lap (green triangle gained, red triangle lost, no indicator when unchanged)
- Instant update each lap (no persistence delay, even at high replay speeds)
- Smooth row reorder animation (~200ms) when position order changes between laps

**Tire Visualization**
- Compound shown as single colored letter: S (red), M (yellow), H (white), I (green), W (blue) — F1-standard colors
- Tire age shows laps on current set (TyreLife from FastF1), resets after pit stop
- Brief highlight on the tire cell when compound changes (driver pitted)

**Gap & Interval Format**
- Single column toggleable between "interval to car ahead" and "gap to leader"
- Toggle via clickable column header — header text changes to show current mode (INT / GAP)
- Default mode: interval to car ahead
- Leader row shows "—" (dash) instead of a time value
- 1 decimal place precision (+1.2s)
- Lapped drivers show "+1 LAP", "+2 LAPS" instead of time gap

### Claude's Discretion
- Exact row height and spacing to fit ~10 drivers
- Scroll container implementation
- How to calculate interval from FastF1 lap data (Time field differences)
- Exact animation implementation for row reorder
- Hover tooltip implementation for full driver names
- How to detect lapped cars from the data

### Deferred Ideas (OUT OF SCOPE)
- Expandable/wider standings view (click or hover to widen the right column for more horizontal info) — future enhancement
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STND-01 | User sees a standings board showing driver positions at the current lap | `laps.filter(l => l.LapNumber === currentLap)` sorted by `Position`; already in store |
| STND-02 | Standings show gap to leader and interval to car ahead | Computed from `LapRow.Time` differences; toggle state in local component |
| STND-03 | Standings show tire compound and tire age for each driver | `Compound` and `TyreLife` fields present in `LapRow`; compound → letter+color mapping defined below |
| STND-04 | Standings show pit stop count for each driver | Count of laps where `PitInTime !== null` for each driver up to `currentLap`; no new backend needed |
</phase_requirements>

---

## Summary

Phase 3 is a pure frontend phase. All required data already lives in `sessionStore.laps` and `sessionStore.drivers` — no new backend endpoints are needed. The standings component reads `laps`, filters to `currentLap`, sorts by `Position`, computes gaps/intervals from `LapRow.Time` differences, aggregates pit stop counts from historical laps up to `currentLap`, and renders a scrollable table in the right column (`lg:col-span-2`) of `Dashboard.tsx`.

The technical challenges are scoped to: (1) deriving clean standings data with correct gap/interval arithmetic, (2) detecting lapped cars, (3) row reorder animation, and (4) tile highlight animation on compound change. All are achievable with existing stack (Zustand, Tailwind + `tw-animate-css`, plain React `useMemo`/`useState`). No additional library installs are needed.

The one subtlety is the gap/interval calculation. `LapRow.Time` is the session elapsed time at which the driver *completed* that lap. The gap to leader is `(driver.Time - leader.Time)` at the same lap number. Interval to car ahead is `(driver.Time - carAhead.Time)`. When a driver is on a different lap count than the leader (lapped), position data will already reflect that but the time difference becomes misleading — detect lapped cars via position arithmetic.

**Primary recommendation:** Build one `useStandingsData` hook (pure `useMemo`) that returns a sorted, fully-computed `StandingRow[]` array at the current lap, then a pure `StandingsBoard` component that renders it. Keep all state (gap/interval toggle, highlight tracking) local to the component tree.

---

## Standard Stack

### Core (no new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React + TypeScript | 19.x / 5.9 | Component + hook authoring | Already in project |
| Zustand 5 | ^5.0.11 | Read `laps`, `drivers`, `currentLap` from store | Established project pattern |
| Tailwind CSS v4 | ^4.2.1 | All layout and styling | Dark theme, established pattern |
| tw-animate-css | ^1.4.0 | Row highlight and transition utilities | Already installed |
| `@base-ui/react` | ^1.3.0 | Tooltip for full driver name on hover | Already installed; used for other UI primitives |
| lucide-react | ^0.577.0 | Arrow-up / arrow-down position change icons | Already installed |

### No New Dependencies

All required capabilities exist in the installed stack. No `npm install` step needed for this phase.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   └── StandingsBoard/
│       ├── StandingsBoard.tsx      # Presentational table component
│       └── useStandingsData.ts     # Data derivation hook (useMemo)
├── types/
│   └── session.ts                  # Add StandingRow interface here
```

### Pattern 1: Data Hook (useStandingsData)

**What:** A `useMemo`-based hook that subscribes to `laps`, `drivers`, and `currentLap` from the store, and returns a fully computed `StandingRow[]` array.

**When to use:** Any time expensive derivations run on every render — isolate them in a dedicated hook so the component stays pure.

**Key computed fields:**

```typescript
// Source: derived from LapRow.Time — same approach as useGapData.ts
export interface StandingRow {
  driver: string           // abbreviation
  fullName: string         // from drivers[]
  teamColor: string        // hex from drivers[]
  position: number
  prevPosition: number | null  // position at currentLap - 1 (for delta indicator)
  gap: number | null       // seconds behind leader (null = leader)
  interval: number | null  // seconds behind car ahead (null = leader or lapped)
  isLapped: boolean        // true when on a different lap count than leader
  lapsDown: number         // 0 for on-lead-lap, 1 for +1 LAP, etc.
  compound: string | null  // 'SOFT' | 'MEDIUM' | 'HARD' | 'INTERMEDIATE' | 'WET'
  tyreLife: number | null  // from TyreLife
  pitStops: number         // count of PitInTime !== null rows up to currentLap
  compoundChanged: boolean // true if Compound differs from previous lap (for highlight)
}
```

**Pit stop count calculation:**

```typescript
// Count laps up to and including currentLap where PitInTime is not null
const pitStops = laps.filter(
  (l) => l.Driver === driver && l.LapNumber !== null && l.LapNumber <= currentLap && l.PitInTime !== null
).length
```

**Lapped car detection:**

```typescript
// FastF1 Position is already the on-track race position.
// Lapped cars can be identified when their total completed laps (max LapNumber
// up to currentLap) is less than the leader's.
const leaderLapCount = Math.max(
  ...laps.filter(l => l.Driver === leaderDriver && l.LapNumber !== null && l.LapNumber <= currentLap)
         .map(l => l.LapNumber as number),
  0
)
const driverLapCount = Math.max(
  ...laps.filter(l => l.Driver === driver && l.LapNumber !== null && l.LapNumber <= currentLap)
         .map(l => l.LapNumber as number),
  0
)
const lapsDown = leaderLapCount - driverLapCount
```

Note: `LapRow.Time` can only be directly compared for drivers on the same lap. For lapped cars, show `"+N LAP(s)"` in the gap column, not a time value.

### Pattern 2: Compound Color Map

**What:** Static constant mapping FastF1 compound strings to display letter + color.

```typescript
// Source: F1 official tire color convention (universally recognized)
export const COMPOUND_DISPLAY: Record<string, { letter: string; color: string }> = {
  SOFT:         { letter: 'S', color: '#E8002D' }, // red
  MEDIUM:       { letter: 'M', color: '#FFF200' }, // yellow
  HARD:         { letter: 'H', color: '#FFFFFF' }, // white
  INTERMEDIATE: { letter: 'I', color: '#39B54A' }, // green
  WET:          { letter: 'W', color: '#0067FF' }, // blue
}
```

FastF1 returns `'SOFT'`, `'MEDIUM'`, `'HARD'`, `'INTERMEDIATE'`, `'WET'` — uppercase strings. No normalization needed. The `Compound` field is `string | null`; a null means the lap has no compound data (e.g., in/out lap in some seasons) — render nothing in that cell.

### Pattern 3: Row Reorder Animation

**What:** CSS-only approach using `transition-all` + absolute positioning, OR a simpler `key`-preserving approach.

**Recommended approach:** Use CSS `order` or a transition on `translateY`. The simplest production-safe method for this project is to render the sorted rows and add a Tailwind `transition-all duration-200` on each `<tr>` (or `<div>` row). When `currentLap` changes, React re-renders in the new sorted order and CSS handles the visual. However, for a true animated reorder (rows visually sliding to new positions), CSS transitions on table rows alone do not animate position changes.

**Practical implementation for this project:** Use `div`-based flex rows (not a `<table>` element), and keep row components identified by driver key. Apply `transition-all duration-200` on the container. The browser will animate any layout property changes. This works correctly with Tailwind v4.

```typescript
// Source: Tailwind CSS docs — transition utilities
// tw-animate-css provides additional keyframe animations for the highlight pulse
<div className="flex flex-col transition-all duration-200">
  {rows.map(row => (
    <StandingRowItem key={row.driver} row={row} />
  ))}
</div>
```

Note: True positional FLIP animation (rows sliding to new positions) requires a FLIP library (`@formkit/auto-animate` or `react-flip-toolkit`). For this project's scope (200ms, low complexity), `auto-animate` adds it with a one-liner and zero added configuration — see "Don't Hand-Roll" section.

### Pattern 4: Compound Change Highlight

**What:** Brief CSS animation on the compound cell when `compoundChanged` is true.

```typescript
// tw-animate-css provides animate-pulse and other keyframe classes
// Use a brief bg-highlight flash with conditional class
<span
  className={cn(
    'compound-cell',
    row.compoundChanged && 'animate-pulse duration-700'
  )}
>
  {compoundLetter}
</span>
```

Track compound changes by comparing `Compound` at `currentLap` vs `currentLap - 1` for each driver. This is computed in `useStandingsData`.

### Pattern 5: Tooltip for Full Driver Name

**What:** `@base-ui/react` Tooltip wrapping the driver abbreviation cell.

**Pattern from project:** `@base-ui/react` is already used via `button.tsx`. The Tooltip component follows the same pattern.

```typescript
import { Tooltip } from '@base-ui/react/tooltip'

<Tooltip.Provider>
  <Tooltip.Root>
    <Tooltip.Trigger render={<span>{row.driver}</span>} />
    <Tooltip.Portal>
      <Tooltip.Positioner>
        <Tooltip.Popup className="bg-popover text-popover-foreground ...">
          {row.fullName}
        </Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
</Tooltip.Provider>
```

Note: `@base-ui/react` ^1.3.0 uses composable sub-components. No legacy `Tooltip` import path — verify import from `@base-ui/react/tooltip` as per installed version.

### Pattern 6: Gap/Interval Toggle

**What:** Local `useState` in `StandingsBoard` for `mode: 'interval' | 'gap'`. Clickable `<button>` on the column header.

```typescript
const [gapMode, setGapMode] = useState<'interval' | 'gap'>('interval')

// Header cell
<button onClick={() => setGapMode(m => m === 'interval' ? 'gap' : 'interval')}>
  {gapMode === 'interval' ? 'INT' : 'GAP'}
</button>

// Row cell renders row.interval or row.gap depending on mode
```

### Anti-Patterns to Avoid

- **Computing pit stop counts inside the component render:** Do this in `useStandingsData` so it's memoized. Computing on every render with all laps (up to 1200+ rows for a full race) is a performance issue.
- **Using `<table>` for animated row reorder:** CSS transitions do not animate table row positions across re-sorts. Use `div`-based flex layout instead.
- **Comparing `LapRow.Time` across lapped and lead-lap drivers:** Time values are only meaningful for drivers on the same lap. Always check `lapsDown === 0` before computing a time-based gap.
- **Hardcoding position change delta to persist across multiple laps:** The user decision says instant update each lap. Compare position at `currentLap` vs `currentLap - 1` only — do not accumulate.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animated row reorder (FLIP) | Custom translateY calculations | `@formkit/auto-animate` (~3KB) | FLIP is notoriously tricky; auto-animate handles it with `useAutoAnimate()` hook, 1 line of code |
| Tooltip positioning | Custom popover logic | `@base-ui/react` Tooltip | Already installed; handles portal, focus trap, a11y |
| Tailwind transition utilities | Custom CSS keyframes | `tw-animate-css` classes | Already installed; `animate-pulse` etc. cover highlight needs |
| Compound color constants | Dynamic lookup from API | Static `COMPOUND_DISPLAY` map | FastF1 compound strings are stable across all seasons |

**Key insight:** `@formkit/auto-animate` (if FLIP animation matters) is a single hook `useAutoAnimate` applied to the list container. If the 200ms smooth reorder is a hard requirement rather than "nice to have", install it. If basic instant re-render is acceptable, no install needed.

---

## Common Pitfalls

### Pitfall 1: Position is null for some laps

**What goes wrong:** `LapRow.Position` is `number | null`. Some in/out laps, formation laps, or laps with data gaps return `null`. Sorting by `Position` when some are null causes those drivers to jump to the top or bottom unpredictably.

**Why it happens:** FastF1 returns `NaN` for positions on incomplete/anomalous laps; the backend serializes these as `null`.

**How to avoid:** Sort with `(a.Position ?? 99) - (b.Position ?? 99)` — push null-position drivers to the bottom. Also filter out rows where `LapNumber !== currentLap` strictly; there should be exactly one row per driver per lap.

**Warning signs:** One driver appears at position 1 unexpectedly at certain laps.

### Pitfall 2: Missing current-lap row for a retired driver

**What goes wrong:** A driver who retired before `currentLap` has no row at that lap number. `laps.filter(l => l.LapNumber === currentLap)` will simply not return a row for them.

**Why it happens:** FastF1 stops recording lap data after retirement — no row for subsequent laps.

**How to avoid:** Accept this behavior. The retired driver simply disappears from the standings, which mirrors real F1 timing screens. No special handling needed. If showing all 20 drivers regardless is desired, that would require carrying forward the last known row — but CONTEXT.md does not require it, so omit.

### Pitfall 3: Gap calculation using LapTime instead of Time

**What goes wrong:** Using `LapRow.LapTime` (individual lap duration) to sum up cumulative gaps produces errors because Safety Cars, VSC periods, pit stops, and slow laps accumulate incorrectly.

**Why it happens:** Same issue documented in STATE.md for the GapChart — the project already knows this. `LapRow.Time` is the session-elapsed timestamp at lap completion, not the lap duration.

**How to avoid:** Always use `LapRow.Time` for all inter-driver comparisons. Gap = `driverTime - leaderTime` where both are at the same `LapNumber`.

**Warning signs:** Gaps appear larger than expected, especially after Safety Cars.

### Pitfall 4: Compound changes detected incorrectly at race start

**What goes wrong:** At `currentLap === 1`, there is no previous lap to compare. Checking `compoundChanged` against lap 0 data returns undefined, potentially marking all drivers as "just pitted".

**Why it happens:** Edge case at lap 1 — `currentLap - 1 === 0` has no data.

**How to avoid:** In `useStandingsData`, set `compoundChanged = false` when `currentLap === 1`. For subsequent laps, compare `Compound` at `currentLap` vs `currentLap - 1`.

### Pitfall 5: @base-ui/react Tooltip import path

**What goes wrong:** Importing `Tooltip` from `@base-ui/react` directly may not work — sub-package imports are required.

**Why it happens:** `@base-ui/react` uses subpath exports (e.g., `@base-ui/react/tooltip`, `@base-ui/react/button`). The existing `button.tsx` imports from `@base-ui/react/button` as the established pattern.

**How to avoid:** Import from `@base-ui/react/tooltip`, not from `@base-ui/react`.

---

## Code Examples

Verified from existing codebase patterns:

### Reading from sessionStore (established pattern)

```typescript
// Source: frontend/src/components/GapChart/useGapData.ts
const laps = useSessionStore((s) => s.laps)
const drivers = useSessionStore((s) => s.drivers)
const currentLap = useSessionStore((s) => s.currentLap)
```

### Building driver lookup map (established pattern)

```typescript
// Source: frontend/src/components/GapChart/useGapData.ts
const driverMap = new Map(drivers.map((d) => [d.abbreviation, d]))
const teamColor = driverMap.get(driver)?.teamColor ?? '#888888'
const fullName = driverMap.get(driver)?.fullName ?? driver
```

### Memoized derivation (established pattern)

```typescript
// Source: frontend/src/components/GapChart/useGapData.ts
return useMemo(() => {
  // ... derive data from laps, drivers, currentLap
}, [laps, drivers, currentLap])
```

### Tailwind dark-theme card (established pattern)

```typescript
// Source: frontend/src/components/Dashboard/Dashboard.tsx
<div className="h-full min-h-[200px] bg-card border border-border rounded-lg">
```

### Gap/interval format function

```typescript
// Source: derived from CONTEXT.md spec — 1 decimal, +N.Ns format
function formatGap(seconds: number | null): string {
  if (seconds === null) return '—'
  return `+${seconds.toFixed(1)}s`
}

function formatLappedGap(lapsDown: number): string {
  return lapsDown === 1 ? '+1 LAP' : `+${lapsDown} LAPS`
}
```

### Position delta indicator

```typescript
// Source: CONTEXT.md decisions + lucide-react (already installed)
import { ChevronUp, ChevronDown } from 'lucide-react'

function PositionDelta({ current, prev }: { current: number; prev: number | null }) {
  if (prev === null || current === prev) return null
  if (current < prev) return <ChevronUp className="size-3 text-green-500" />
  return <ChevronDown className="size-3 text-red-500" />
}
```

### Compound cell rendering

```typescript
const COMPOUND_DISPLAY: Record<string, { letter: string; color: string }> = {
  SOFT:         { letter: 'S', color: '#E8002D' },
  MEDIUM:       { letter: 'M', color: '#FFF200' },
  HARD:         { letter: 'H', color: '#FFFFFF' },
  INTERMEDIATE: { letter: 'I', color: '#39B54A' },
  WET:          { letter: 'W', color: '#0067FF' },
}

// In render:
const display = row.compound ? COMPOUND_DISPLAY[row.compound] : null
<span style={{ color: display?.color }} className="font-bold font-mono">
  {display?.letter ?? '—'}
</span>
```

### Team color bar on row left edge

```typescript
// Thin left border using inline style for dynamic color (Tailwind can't do arbitrary hex dynamically)
<div
  className="flex items-center gap-2 px-2 py-1.5 border-l-2"
  style={{ borderLeftColor: row.teamColor }}
>
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `<table>` for sortable lists | `div`+flex rows | Enables CSS transition-based animations |
| Manual FLIP animation | `@formkit/auto-animate` | 1 hook, handles all cases |
| Separate gap and interval columns | Single toggleable column | Less horizontal space, matches F1 broadcast |

---

## Open Questions

1. **Row reorder animation: library or CSS-only?**
   - What we know: `tw-animate-css` is installed, provides keyframe animations. CSS `transition` on flex children does not animate positional reorder without explicit coordinate tracking.
   - What's unclear: Whether the user's intent is "visual rows slide smoothly" (needs FLIP) or "columns update smoothly without jarring flashes" (CSS `transition-all` on row content is sufficient).
   - Recommendation: Implement with CSS `transition-all duration-200` first. If visual row sliding is needed, add `@formkit/auto-animate` (single `useAutoAnimate` call on the list container). The install is small and the API is one line.

2. **Null position data at certain laps**
   - What we know: Position can be null. Sort guard `?? 99` pushes them to bottom.
   - What's unclear: Whether some laps return zero/null positions during Safety Car periods — this could affect standings accuracy.
   - Recommendation: Filter to rows with `Position !== null` first, then render those. Accept that some drivers may briefly disappear at anomalous laps.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest (backend) — no frontend test framework installed |
| Config file | `backend/pytest.ini` |
| Quick run command | `cd /Users/luckleineschaars/repos/f1-dashboard/backend && uv run pytest tests/ -x -q` |
| Full suite command | `cd /Users/luckleineschaars/repos/f1-dashboard/backend && uv run pytest tests/` |

### Phase 3 Testing Notes

Phase 3 is entirely frontend — React components and a data derivation hook. There is no frontend test framework installed (no vitest.config, no jest.config, no `__tests__` directory). Backend tests (pytest) cover the API layer but are not relevant to this phase's deliverables.

All Phase 3 requirements are UI/visual behaviors that can be validated manually or via Playwright (per project feedback in `memory/MEMORY.md` — use Playwright for UI debugging).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STND-01 | Standings table renders all drivers at currentLap in position order | manual-only (no frontend framework) | — | N/A |
| STND-02 | Gap/interval toggle switches column values correctly | manual-only | — | N/A |
| STND-03 | Tire compound and age display correctly per driver | manual-only | — | N/A |
| STND-04 | Pit stop count increments correctly after each pit | manual-only | — | N/A |

All four requirements are pure UI rendering behaviors. They are verified by visual inspection during replay or via Playwright end-to-end test if desired.

### Sampling Rate

- **Per task commit:** Run `uv run pytest tests/ -x -q` in `backend/` to confirm no regressions (this phase does not modify backend)
- **Per wave merge:** Full backend suite
- **Phase gate:** Visual verification of all 5 success criteria before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] No frontend test framework — `useStandingsData` logic (gap math, pit count, lapped detection) is untested automatically. Consider: either accept manual-only validation, or add vitest as a dev dependency to unit-test the hook in isolation.

---

## Sources

### Primary (HIGH confidence)

- `frontend/src/stores/sessionStore.ts` — confirmed `LapRow` fields: `Position`, `Compound`, `TyreLife`, `PitInTime`, `PitOutTime`, `Stint`, `Time`, `LapNumber`, `Driver`, `Team`
- `frontend/src/types/session.ts` — confirmed `LapRow` and `DriverInfo` type definitions
- `frontend/src/components/GapChart/useGapData.ts` — confirmed `useMemo` + store pattern; `LapRow.Time` for gap math
- `frontend/src/components/Dashboard/Dashboard.tsx` — confirmed `lg:col-span-2` right column placeholder
- `frontend/package.json` — confirmed installed dependencies: no new installs needed
- `backend/tests/conftest.py` — confirmed mock `LapRow` data with `Compound`, `TyreLife`, `PitInTime`, `PitOutTime`, `Stint`, `Position`

### Secondary (MEDIUM confidence)

- F1 tire color convention: S=red, M=yellow, H=white, I=green, W=blue — universally established in F1 fandom and broadcast; confirmed by project CONTEXT.md decisions
- `@base-ui/react` subpath import pattern (`@base-ui/react/tooltip`) — inferred from existing `@base-ui/react/button` usage in `button.tsx`

### Tertiary (LOW confidence)

- `@formkit/auto-animate` for FLIP animation — referenced from community knowledge; not verified via Context7 (not yet fetched). If chosen, verify current API before implementing.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed in package.json; no new installs needed
- Architecture: HIGH — patterns directly copied/extended from existing `useGapData.ts` hook
- Data derivation: HIGH — `LapRow` fields confirmed in types and mock fixtures
- Pitfalls: HIGH — gaps/null handling directly from existing codebase and STATE.md decisions
- Row animation: MEDIUM — CSS-only approach confirmed; FLIP library (auto-animate) is LOW until verified

**Research date:** 2026-03-13
**Valid until:** 2026-06-13 (stable — React, Zustand, Tailwind are stable libraries)
