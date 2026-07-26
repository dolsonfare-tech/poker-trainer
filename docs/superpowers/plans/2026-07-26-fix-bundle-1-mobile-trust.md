# Fix Bundle 1 — Mobile & Trust Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the 7 founder-approved playtest-critical audit fixes (CA-039, CA-045, CA-042, CA-041, CA-013, CA-040, CA-038) with a permanent mechanical check per fix.

**Architecture:** Six code tasks against existing components/CSS + one close-out. Each fix follows the ratchet law: the same commit adds an invariants rule, jest pin, or e2e guard that would catch a regression. No new dependencies, no schema changes.

**Tech Stack:** Existing repo tooling — React (CRA), jest + @testing-library, the `e2e/` plain-Playwright harness, `scripts/check-invariants.mjs`.

**Source of truth for finding details:** `docs/audit/2026-07-25-cohesion-audit.md` §3.4 (CA-038…045) and §3.2 (CA-013). Safety tag `pre-audit-fixes` exists at f19ec22.

## Global Constraints

- After EVERY code change: `npm run check:invariants` then `CI=true npm test` must pass. Tasks touching gameplay/dashboard components or App.css also require `npm run e2e:build && npm run e2e` green before commit (Definition of Done gate 6).
- Ratchet law: every fix leaves a permanent mechanical check in the same commit — a fix without a check is a triage failure.
- Honest labeling: no copy may overclaim (never "Correct play"); scores/tallies say "correct"; per CLAUDE.md.
- Do not touch `scenarios.js`, `observations.js`, `api/coach-read.js`, or the coach prompt.
- All streak math lives in `calcStreak`/helpers in `src/utils/userStorage.js` — components never re-derive streak arithmetic inline.
- Never `await` inside the `onAuthStateChange` callback (App.jsx auth listener is out of scope anyway).
- Commit per task; message format `fix(CA-0XX): <summary>`.

---

### Task 1: CA-039 + CA-045 — honest streak display for lapsed users; no nag for zero-session accounts

**Files:**
- Modify: `src/utils/userStorage.js` (add + export `streakAlive`)
- Modify: `src/components/Dashboard.jsx:12-23` (`StreakWarning`) and the stats-row streak chip (renders `user.streak`, near `Dashboard.jsx:470-520` — locate `DAY STREAK`)
- Test: `src/utils/userStorage.test.js`, `src/components/Dashboard.test.js`

**Interfaces:**
- Produces: `streakAlive(user, now = new Date())` → boolean, exported from `src/utils/userStorage.js`. True iff playing today would CONTINUE the stored streak: `lastSessionDate` is today or yesterday, OR the gap is Rebuy-covered (`gapDays - 1 <= (user.rebuys ?? 0)` — mirrors `calcStreak`'s consume rule). False when `!user.lastSessionDate` or `user.streak === 0`.
- Consumes: existing `toLocalDateString`; date-diff math consistent with `calcStreak` (read it first at `userStorage.js:531-620` and reuse its day-difference approach — do NOT invent a new one).

- [ ] **Step 1: Write failing jest tests for `streakAlive`** in `src/utils/userStorage.test.js` (follow the existing `calcStreak` describe-block style with fixed date strings):

```js
describe('streakAlive', () => {
  const now = new Date('2026-07-26T20:00:00');
  it('true when last session was today', () =>
    expect(streakAlive({ streak: 3, lastSessionDate: '2026-07-26', rebuys: 0 }, now)).toBe(true));
  it('true when last session was yesterday', () =>
    expect(streakAlive({ streak: 3, lastSessionDate: '2026-07-25', rebuys: 0 }, now)).toBe(true));
  it('true when gap is covered by rebuys (2-day gap, 1 rebuy)', () =>
    expect(streakAlive({ streak: 7, lastSessionDate: '2026-07-24', rebuys: 1 }, now)).toBe(true));
  it('false when gap exceeds rebuys (2-day gap, 0 rebuys)', () =>
    expect(streakAlive({ streak: 7, lastSessionDate: '2026-07-24', rebuys: 0 }, now)).toBe(false));
  it('false for a 205-day-stale streak', () =>
    expect(streakAlive({ streak: 3, lastSessionDate: '2026-01-01', rebuys: 2 }, now)).toBe(false));
  it('false when streak is 0 or lastSessionDate missing', () => {
    expect(streakAlive({ streak: 0, lastSessionDate: '2026-07-25' }, now)).toBe(false);
    expect(streakAlive({ streak: 3 }, now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify they fail** — `CI=true npx react-scripts test --watchAll=false userStorage.test` → FAIL (`streakAlive` not exported).

- [ ] **Step 3: Implement `streakAlive` in `src/utils/userStorage.js`** next to `calcStreak`, reusing its day-diff idiom. Export it.

- [ ] **Step 4: Write failing Dashboard tests** in `src/components/Dashboard.test.js` (follow existing render helpers/mocks in that file):
  - Stale streak (streak 3, `lastSessionDate` 205 days ago, after-6pm system time via `jest.useFakeTimers().setSystemTime`): the "on the line" banner does NOT render, and the stats chip does NOT show "3" (shows 0).
  - Live streak (yesterday): banner DOES render with the count.
  - Zero sessions (`sessionsCompleted: 0`, no play today, after 6pm): NO `db-streak-warning` at all (CA-045).
  - Existing-user neutral case (`sessionsCompleted > 0`, streak 0, no play today, after 6pm): the "🃏 You haven't played today" line still renders (pin — CA-045 must not over-suppress).

- [ ] **Step 5: Run to verify the new Dashboard tests fail.**

- [ ] **Step 6: Implement the Dashboard changes:**

```jsx
function StreakWarning({ user }) {
  const now = new Date();
  const playedToday = user.lastSessionDate === toLocalDateString(now);
  if (playedToday || now.getHours() < 18) return null;
  if (!user.sessionsCompleted) return null;                     // CA-045
  const alive = streakAlive(user, now);
  return (
    <div className="db-streak-warning">
      {alive && user.streak > 0
        ? <>🔥 Your <b>{user.streak}-day streak</b> is on the line — play one session before midnight.</>
        : <>🃏 You haven't played today — one session keeps the reads sharp.</>}
    </div>
  );
}
```

  Stats-row chip: where it currently renders `user.streak`, render `streakAlive(user) ? user.streak : 0`. Also check `StreakStatus`/`milestoneProximity` call sites: proximity lines must use the same effective streak (a dead streak must not show "2 more to a full week"). Import `streakAlive` into Dashboard.jsx.

- [ ] **Step 7: Run the full jest suite** — `CI=true npm test` → all pass (fix any legitimately stale pins ONLY if the old pin asserted the dishonest behavior; note each in the commit body).

- [ ] **Step 8: Gates + e2e** — `npm run check:invariants && npm run e2e:build && npm run e2e` → green (Dashboard touched → gate 6).

- [ ] **Step 9: Commit** — `git add -A src/utils/userStorage.js src/utils/userStorage.test.js src/components/Dashboard.jsx src/components/Dashboard.test.js && git commit -m "fix(CA-039,CA-045): honest streak display for lapsed users; suppress nag at zero sessions"`

---

### Task 2: CA-042 — clamp the locked-schema countdown

**Files:**
- Modify: `src/components/Dashboard.jsx:624` (the `SCHEMA_UNLOCK_SESSIONS - sessionsCompleted` line)
- Test: `src/components/Dashboard.test.js`

**Interfaces:** none new — display-only clamp.

- [ ] **Step 1: Write failing test** — render Dashboard with a user seeded `sessionsCompleted: 12`, `schema: null` (mirror the audit repro): assert the locked-schema card does NOT contain `-7` and DOES contain the refresh message.

- [ ] **Step 2: Verify it fails.**

- [ ] **Step 3: Implement** at the countdown site:

```jsx
{(() => {
  const left = Math.max(0, SCHEMA_UNLOCK_SESSIONS - sessionsCompleted);
  return left > 0
    ? `Play ${left} more session${left !== 1 ? 's' : ''} to unlock your player profile`
    : 'Play a session to refresh your profile';
})()}
```

  (Match the surrounding JSX structure — keep the 🔒 wrapper element and classes unchanged.)

- [ ] **Step 4: Full jest + invariants** → green.

- [ ] **Step 5: Commit** — `git commit -m "fix(CA-042): clamp locked-schema countdown, refresh copy at zero"`

---

### Task 3: CA-041 — VillainGuide closes on Escape

**Files:**
- Modify: `src/components/VillainGuide.jsx` (component starts line 149; existing `useEffect` at 153)
- Test: create `src/components/VillainGuide.test.js`

**Interfaces:** none new — `onClose` prop already exists.

- [ ] **Step 1: Write failing test** in new `src/components/VillainGuide.test.js` (import pattern from Dashboard.test.js; VillainGuide needs `onClose` and optionally `focus`/`initialTab` props):

```jsx
import { render, fireEvent } from '@testing-library/react';
import VillainGuide from './VillainGuide';

it('closes on Escape', () => {
  const onClose = jest.fn();
  render(<VillainGuide onClose={onClose} />);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('does not close on other keys', () => {
  const onClose = jest.fn();
  render(<VillainGuide onClose={onClose} />);
  fireEvent.keyDown(document, { key: 'Enter' });
  expect(onClose).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Verify both fail (first one).**

- [ ] **Step 3: Implement** — add inside the component:

```jsx
useEffect(() => {
  const onKey = (e) => { if (e.key === 'Escape') onClose(); };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}, [onClose]);
```

- [ ] **Step 4: Full jest + invariants** → green.

- [ ] **Step 5: Commit** — `git commit -m "fix(CA-041): VillainGuide closes on Escape"`

---

### Task 4: CA-013 — non-blocking Google Fonts + invariants ratchet

**Files:**
- Modify: `public/index.html:48` (the fonts.googleapis.com stylesheet link; preconnects at 46-47 stay)
- Modify: `scripts/check-invariants.mjs` (new rule `fonts-async`)

**Interfaces:**
- Produces: invariants rule id `fonts-async` — fails if `public/index.html` contains a fonts.googleapis.com stylesheet `<link>` WITHOUT the `media="print"` async pattern.

- [ ] **Step 1: Replace the blocking link** with the media-print swap + noscript fallback:

```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700;1,900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700;1,900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet"></noscript>
```

- [ ] **Step 2: Add the `fonts-async` rule** to `scripts/check-invariants.mjs` (follow the existing rule structure/reporting in that file): read `public/index.html`; for every line matching `fonts.googleapis.com/css2` with `rel="stylesheet"`, require `media="print"` OR the line be inside `<noscript>`; otherwise report an error naming the rule.

- [ ] **Step 3: Prove the ratchet** — temporarily revert index.html (`git stash` the html change or edit back), run `npm run check:invariants` → must FAIL with `fonts-async`; restore the fix, run again → PASS. Record both outputs in your report.

- [ ] **Step 4: Visual verification** — `npm run e2e:build`, serve per `e2e/server.mjs`, load in Playwright: fonts render (Playfair logo, JetBrains labels) and no console errors. Screenshot for the report. (FOUT flash is acceptable and expected — `display=swap` already chose swap behavior.)

- [ ] **Step 5: Full gates** — invariants + `CI=true npm test` → green.

- [ ] **Step 6: Commit** — `git commit -m "fix(CA-013): async Google Fonts load + fonts-async invariant"`

---

### Task 5: CA-040 — 44px hit areas on feedback/guide controls + e2e guard

**Files:**
- Modify: `src/App.css` (classes: `.fb-disagree-toggle`, `.fb-disagree-chip`, `.tr-guide-link`, `.vg-close`, `.vg-tab`, `.tr-next-btn`, `.db-account-btn`)
- Modify: `e2e/` — add tap-target assertions (extend the geometry spec; read `e2e/smoke.spec.mjs` + `e2e/helpers.mjs` first and follow their assertion style)

**Interfaces:**
- Produces: e2e assertions that the listed selectors' effective hit area (boundingBox height, or height+padding) is ≥ 44px on mobile viewport.

- [ ] **Step 1: Extend e2e first (failing guard)** — in the geometry/smoke spec, at viewport 390×844, navigate to each surface (feedback overlay → measure `.fb-disagree-toggle` and one `.fb-disagree-chip`; Table Reads feedback → `.tr-guide-link`, `.tr-next-btn`; VillainGuide open → `.vg-close`, `.vg-tab`; dashboard → `.db-account-btn`) and assert `boundingBox().height >= 44`. Run `npm run e2e` → new checks FAIL (current sizes 13–43px).

- [ ] **Step 2: Fix in App.css** — for each class add `min-height: 44px` (and `min-width: 44px` for `.vg-close`) with `display: inline-flex; align-items: center;` where needed so text stays vertically centered. Visual weight stays quiet: keep font sizes/colors; grow padding/hit area only. If growing the element would wreck a layout (e.g. `.fb-disagree-toggle` inline in feedback text), use the padding + negative-margin hit-area idiom instead: `padding: 12px; margin: -12px;`.

- [ ] **Step 3: Rebuild + rerun e2e** — `npm run e2e:build && npm run e2e` → ALL checks green (new tap-target guard + pre-existing geometry).

- [ ] **Step 4: Screenshot check** — feedback overlay + VillainGuide at 390×844 and desktop; confirm no visual regression (elements not visibly ballooned).

- [ ] **Step 5: Full jest + invariants** → green.

- [ ] **Step 6: Commit** — `git commit -m "fix(CA-040): 44px hit areas on disagree/guide controls + e2e tap-target guard"`

---

### Task 6: CA-038 — mobile fold: actions + ticker visible during play, dashboard CTA above fold

**Files:**
- Modify: `src/App.css` (mobile media queries — gameplay `sc2-*` blocks and dashboard `db-*` blocks)
- Possibly modify: `src/components/ScenarioCard.jsx` (only if a structural change is unavoidable — prefer CSS)
- Modify: `e2e/` — mobile-fold geometry guard

**Interfaces:**
- Produces: e2e mobile-fold assertions (the permanent check): at 390×844 — (a) on a dealt hand, ALL `.sc2-actions` buttons' bottom edges ≤ 844 AND the ticker ("How you got here" container) top edge < 844 (at least partially visible) without any scroll; (b) on the dashboard, the primary CTA (`.db-cta-btn`) bottom edge ≤ 844.

**Acceptance criteria (behavioral — CSS approach is implementer's choice):**
1. First-time phone player sees table + all action buttons + at least the top of the ticker without scrolling, on hand 1, both difficulties.
2. Desktop layout unchanged (existing desktop e2e geometry guards stay green — they are the regression net).
3. No element overlap (the existing bubble-vs-board overlap guards must stay green at both viewports).
4. Approach freedom, in preference order: (i) compress vertical chrome at `max-height`-ish mobile breakpoints — header/logo block ≈90px today, table felt height, ticker margins; (ii) sticky bottom action bar (`position: sticky/fixed` for `.sc2-actions` with backdrop) if compression alone can't fit 844px; justify whichever you choose in the report. Remember the July 18 lesson pinned in CLAUDE.md: `.sc2-table` needs its explicit `width:100%` — do not remove it, and screenshot the canvas after ANY `.sc2-stage`/`.sc2-table` change.

- [ ] **Step 1: Write the failing e2e mobile-fold guard** (assertions above, in the geometry spec, viewport 390×844). Run → FAIL (documents current broken state).

- [ ] **Step 2: Implement the mobile CSS pass.** Iterate with Playwright screenshots at 390×844 (hand 1 gameplay, dashboard) until the guard's measurements pass. Also spot-check 390×740 (smaller Android) — buttons must still be reachable, scroll allowed there if needed; guard only pins 844.

- [ ] **Step 3: Rebuild + full e2e** — `npm run e2e:build && npm run e2e` → ALL green (new mobile guard + all desktop geometry + streaks + notebook).

- [ ] **Step 4: Screenshot evidence** — gameplay + dashboard at 390×844 and 1280×800, attached to the report.

- [ ] **Step 5: Full jest + invariants** → green.

- [ ] **Step 6: Commit** — `git commit -m "fix(CA-038): mobile fold — actions/ticker/CTA visible without scroll + e2e mobile geometry guard"`

---

### Task 7: Bundle close-out

**Files:**
- Modify: `docs/audit/2026-07-25-cohesion-audit.md` (§7 Triage Outcomes — mark bundle 1 done with commit hashes)

- [ ] **Step 1: Full gate sweep** — `npm run check:invariants && CI=true npm test && npm run audit:scenarios && npm run audit:observations && npm run simulate:schemas && npm run e2e:build && npm run e2e` → all green.

- [ ] **Step 2: Verify ratchet completeness** — list each CA → its permanent check: CA-039/045 (jest pins), CA-042 (jest pin), CA-041 (jest), CA-013 (invariants `fonts-async`), CA-040 (e2e tap-target guard), CA-038 (e2e mobile-fold guard). All six checks must exist in committed code.

- [ ] **Step 3: Update the audit doc** — in §7, under bundle 1, append `— DONE <date> (commits <range>)` and per-CA check names. Commit `docs: bundle 1 complete in triage outcomes`.

- [ ] **Step 4: Remind the founder** — deploy is a founder push; nothing here needs SQL. Note that mobile Lighthouse should be re-measured post-deploy (CA-013 expected to move LCP materially).
