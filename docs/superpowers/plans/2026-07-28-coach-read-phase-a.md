# Coach's Read Phase A — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Coach's Read from the session summary, shorten that page so the chain button clears the mobile fold, and add a deterministic recent-form strip to the dashboard.

**Architecture:** Phase A of `docs/superpowers/specs/2026-07-28-coach-read-scope-design.md`. Reads keep being written exactly as they are today, once per session, and keep landing on the dashboard through the existing `LastSessionRead`. **Nothing in this plan touches `api/coach-read.js`, the prompt, the payload, or the cadence.** New derived state (`recentSessions`) follows the established derived-state pattern: rebuilt from the append-only `sessions` log in `db.js`, and maintained in memory by `applySessionResults` for localStorage mode.

**Tech Stack:** Create React App, React 19, jest + @testing-library/react, Playwright (via the framework-less `e2e/` harness).

## Global Constraints

- **Gates after every task:** `npm run gates` (invariants → both content audits → jest → `simulate:schemas` → `playtest:personas` → `CI=true npm run build` → bundle). Never run a subset.
- **e2e:** `npm run e2e:build` then `npm run e2e`. A plain build bakes Supabase keys in and boots to SignIn; `e2e/run.mjs` now fails fast if you forget.
- **`npm run gates` and `npm run build` overwrite `build/`.** Re-run `npm run e2e:build` afterwards if a preview server is up.
- **Line budgets (invariant 21):** `Dashboard.jsx` ≤ 250 (currently 219), any module under `src/components/dashboard/` ≤ 160, `src/hooks/*` ≤ 220.
- **Test co-location (invariant 22):** every module under `src/components/dashboard/` needs a non-empty co-located `*.test.js` or the build fails.
- **Frozen clock (invariant 23):** any test pinning a literal date must use `jest.useFakeTimers()` + `jest.setSystemTime()`, or inject a fixed date. `toLocalDateString` reads the real `Date`.
- **Honest labeling:** "Recommended Play", never "Correct", in per-hand grading copy.
- **Date formatting** is owned by `src/utils/dates.js` (`toLocalDateString`, `formatShortDate`). Never format a date anywhere else.
- **No `evidence`/prompt/cadence changes.** Those are Phase B.
- Commit after every task. Do not batch commits.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/components/SessionSummary.jsx` | modify — delete coach block, drop 3 props, collapse `HandReview` | 1, 2 |
| `src/components/SessionSummary.test.js` | modify — delete 3 coach tests, add negative control + collapse tests | 1, 2 |
| `src/App.jsx` | modify — stop passing 3 coach props | 1 |
| `src/hooks/useSessionRun.js` | modify — drop now-dead coach display state | 1 |
| `e2e/smoke.spec.mjs` | modify — invert the coach assertions | 1 |
| `src/App.css` | modify — `ss-hr-*` clamp/expand styles, `db-form-*` strip styles | 2, 5 |
| `e2e/mobilefold.spec.mjs` | modify — summary chain button above the fold | 2 |
| `src/utils/spacedrep.js` | modify — export `remediationQueueDepth` | 4 |
| `src/utils/spacedrep.test.js` | modify — cover the new export | 4 |
| `src/utils/db.js` | modify — derive `recentSessions` in `assembleUser` | 3 |
| `src/utils/db.test.js` | modify — cover `recentSessionsFromSessions` | 3 |
| `src/utils/session.js` | modify — maintain `recentSessions` in `applySessionResults` | 3 |
| `src/utils/session.test.js` | modify — cover the in-memory append | 3 |
| `src/utils/recentForm.js` | **create** — window constants, `appendRecentSession`, `deriveRecentForm` | 3, 4 |
| `src/utils/recentForm.test.js` | **create** — the ≥5-attempt gate in both directions | 3, 4 |
| `src/components/dashboard/RecentForm.jsx` | **create** — presentational strip | 5 |
| `src/components/dashboard/RecentForm.test.js` | **create** — co-location requirement | 5 |
| `src/components/Dashboard.jsx` | modify — render the strip | 5 |

---

### Task 1: Remove the Coach's Read from the session summary

**Files:**
- Modify: `src/components/SessionSummary.jsx` — delete `COACH_DAILY_LIMIT` (line 12), the `parseCoachRead` import (line 2), the `<div className="ss-coach-read">` block (lines 194–234), and the `coachRead`, `coachLoading`, `coachLimited` props (line 102)
- Modify: `src/App.jsx:219-221` — delete the three prop lines
- Modify: `src/hooks/useSessionRun.js:34-36,207` — delete the now-dead display state
- Modify: `src/components/SessionSummary.test.js` — delete the three coach tests and the two `baseProps` keys
- Modify: `e2e/smoke.spec.mjs:40-41`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `SessionSummary` no longer accepts `coachRead`, `coachLoading`, or `coachLimited`. `useSessionRun()` no longer returns them. No later task reintroduces them.

- [ ] **Step 1: Write the failing negative-control test**

Replace the block at `src/components/SessionSummary.test.js:179-212` (the three tests under the `── Coach's Read rendering ──` banner) with this. Also delete `coachRead: ''` and `coachLoading: false` from `baseProps` (lines 20–21).

```jsx
// ── The summary is AI-free (Phase A, July 2026) ────────────────────────────
// The read moved to the dashboard because a spinner sitting between the player
// and the next hand reads as a gate even though it never blocked. If a coach
// block ever returns here, that friction returns with it and nothing else in
// the suite would notice — this is the guard.
test('the summary renders no coach block and no loading state', () => {
  render(<SessionSummary {...baseProps} />);
  expect(document.querySelector('.ss-coach-read')).toBeNull();
  expect(document.querySelector('.ss-coach-structured')).toBeNull();
  expect(document.querySelector('.thinking')).toBeNull();
  expect(screen.queryByText(/Coach's Read/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Reading your session/i)).not.toBeInTheDocument();
});

test('the chaining CTA is present and needs no waiting', () => {
  render(<SessionSummary {...baseProps} />);
  const cta = screen.getByRole('button', { name: /Deal Next Session/i });
  expect(cta).toBeInTheDocument();
  expect(cta).toBeEnabled();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npx jest src/components/SessionSummary.test.js -t "renders no coach block"`
Expected: FAIL — `.ss-coach-read` is found, because the block is still rendered.

- [ ] **Step 3: Delete the coach block from the component**

In `src/components/SessionSummary.jsx`:

Delete line 2 entirely:
```jsx
import { parseCoachRead } from '../utils/coachRead';
```

Delete lines 10–12 entirely:
```jsx
// Mirrors DAILY_LIMIT in api/coach-read.js — display only; the cap is
// enforced server-side.
const COACH_DAILY_LIMIT = 5;
```

Change the props signature (line 102) from:
```jsx
export default function SessionSummary({ sessionHistory = [], coachRead, coachLoading, coachLimited = false, difficulty, userSkills = {}, recentHands = [], streakSecured = null, rebuyUsed = false, streakBroken = false, activeDaysLast30 = null, prevBest = null, guest = false, onGuestSignIn, onPlayAgain, onRestart }) {
```
to:
```jsx
export default function SessionSummary({ sessionHistory = [], difficulty, userSkills = {}, recentHands = [], streakSecured = null, rebuyUsed = false, streakBroken = false, activeDaysLast30 = null, prevBest = null, guest = false, onGuestSignIn, onPlayAgain, onRestart }) {
```

Delete the whole `<div className="ss-coach-read"> … </div>` block (lines 194–234), which begins:
```jsx
      <div className="ss-coach-read">
        <div className="ss-coach-label">🧠 Coach's Read</div>
```
and ends with the closing `</div>` immediately before:
```jsx
      <div className="summary-sub" style={{ marginBottom: '12px' }}>Session Impact</div>
```

- [ ] **Step 4: Stop passing the props from App**

In `src/App.jsx`, delete lines 219–221:
```jsx
              coachRead={coachRead}
              coachLoading={coachLoading}
              coachLimited={coachLimited}
```

- [ ] **Step 5: Delete the dead display state from the hook**

In `src/hooks/useSessionRun.js`, delete lines 34–36:
```jsx
  const [coachRead, setCoachRead]                 = useState('');
  const [coachLoading, setCoachLoading]           = useState(false);
  const [coachLimited, setCoachLimited]           = useState(false);
```
and delete `coachRead, coachLoading, coachLimited,` from the returned object (line 207).

Then replace the tail of `handleFetchCoachRead` (lines 127–136). It currently ends:

```jsx
    if (!isGuest) setCoachLoading(true);
    const { user: updated, coachText, limited } = await submitSession({
      user: prevUser, hands, sessionHistory, difficulty, isGuest,
      remote: hasSupabase ? { saveRemoteUser, recordSession } : null,
    });
    if (updated) setUser(updated);
    setCoachRead(coachText);
    if (limited) setCoachLimited(true);
    if (!isGuest) setCoachLoading(false);
  };
```

It must become:

```jsx
    // The read is still fetched and still persisted — submitSession writes it to
    // sessions.coach_read and folds it into user.coachReads, which is what feeds
    // the dashboard. Only the SUMMARY's display state is gone (Phase A): nothing
    // on this screen renders the read, so there is nothing to hold in state and
    // nothing to show a spinner for.
    const { user: updated } = await submitSession({
      user: prevUser, hands, sessionHistory, difficulty, isGuest,
      remote: hasSupabase ? { saveRemoteUser, recordSession } : null,
    });
    if (updated) setUser(updated);
  };
```

Leave the function name alone — it still fetches the read, and Phase B rewrites this call site anyway.

Run `grep -rn "coachRead\|coachLoading\|coachLimited" src/App.jsx src/hooks/useSessionRun.js src/components/SessionSummary.jsx` and confirm there are **zero** matches in all three files.

- [ ] **Step 6: Run the component tests**

Run: `CI=true npx jest src/components/SessionSummary.test.js`
Expected: PASS, including both new tests.

- [ ] **Step 7: Invert the e2e assertions**

In `e2e/smoke.spec.mjs`, replace lines 40–41:
```js
  check('structured coach read renders', summary.includes(STRUCTURED_READ.headline));
  check('watch-for line renders', summary.includes(STRUCTURED_READ.watchFor));
```
with:
```js
  // Phase A negative control (July 2026): the read moved to the dashboard. A
  // coach block here is the friction regression — a spinner between the player
  // and the next hand — and nothing else in the suite would catch it.
  check('summary carries NO coach read', !summary.includes(STRUCTURED_READ.headline));
  check('summary carries NO watch-for line', !summary.includes(STRUCTURED_READ.watchFor));
  check('summary shows no loading state', (await page.locator('.thinking').count()) === 0);
```

`STRUCTURED_READ` stays imported — it is still used by `stubCoach(page)` at line 9.

- [ ] **Step 8: Run the gates and the e2e suite**

Run: `npm run gates`
Expected: PASS.

Run: `npm run e2e:build && npm run e2e`
Expected: PASS, `smoke.spec.mjs` included.

- [ ] **Step 9: Commit**

```bash
git add src/components/SessionSummary.jsx src/components/SessionSummary.test.js src/App.jsx src/hooks/useSessionRun.js e2e/smoke.spec.mjs
git commit -m "feat(summary): remove the Coach's Read from the session summary

Phase A of the coach-read re-scope. The read never blocked - the summary
painted before the fetch and the chain button was always enabled - but it sat
above that button with a 'Reading your session...' spinner in it, so players
waited on a gate that was not there.

Reads keep being written once per session and keep landing on the dashboard
through LastSessionRead. No prompt, payload or cadence change; the eval:coach
law does not fire.

Ratchets: a jest negative control asserting no coach block and no .thinking
spinner, and the smoke.spec assertions inverted from 'read renders' to 'read
absent' - the friction regression is otherwise invisible to every test."
```

---

### Task 2: Collapse Hands to Review so the chain button clears the fold

**Files:**
- Modify: `src/components/SessionSummary.jsx:38-99` — `HandReview` becomes clamp-and-expand
- Modify: `src/App.css` — add `ss-hr-*` collapse styles near the existing `ss-hand-review` rules
- Modify: `src/components/SessionSummary.test.js` — expansion tests
- Modify: `e2e/mobilefold.spec.mjs` — the fold guard

**Interfaces:**
- Consumes: `SessionSummary` props from Task 1 (no coach props).
- Produces: `HandReview` renders a `.ss-hr-row` button always, and `.ss-hr-detail` only when expanded. The fold guard depends on both class names.

**Why:** measured at 390×844 on a 3-miss session, the page is 1549px after Task 1 and the chain button sits at y=1375 — 531px below the fold. `Hands to Review` is 889px of that. Collapsing takes it to roughly 180px, the page to ~840px, and the button to about y=666. The player already received elaborated feedback on each of these hands during the session; this list is a recap and the resurface ladder (F3/R1) is what drives relearning.

- [ ] **Step 1: Write the failing collapse tests**

Append to `src/components/SessionSummary.test.js`. `baseProps.sessionHistory` must contain at least one hand whose `result !== 'correct'` for these to render — reuse whatever incorrect-hand fixture the file already builds for the `Hands to Review` section.

```jsx
// ── Hands to Review: collapsed by default (July 2026) ──────────────────────
// Measured at 390x844, this section was 889px of a 1549px page and pushed the
// chain button 531px below the fold. Collapsed rows keep the recap one tap
// away without burying the primary action. e2e/mobilefold.spec.mjs measures
// the consequence; this pins the behaviour.
test('review rows are collapsed by default — no detail rendered', () => {
  render(<SessionSummary {...baseProps} />);
  expect(document.querySelectorAll('.ss-hr-row').length).toBeGreaterThan(0);
  expect(document.querySelector('.ss-hr-detail')).toBeNull();
});

test('tapping a review row expands that row in place', () => {
  render(<SessionSummary {...baseProps} />);
  fireEvent.click(document.querySelectorAll('.ss-hr-row')[0]);
  expect(document.querySelectorAll('.ss-hr-detail').length).toBe(1);
  expect(document.querySelectorAll('.ss-hr-row')[0]).toHaveAttribute('aria-expanded', 'true');
});

test('tapping an expanded row collapses it again', () => {
  render(<SessionSummary {...baseProps} />);
  const row = document.querySelectorAll('.ss-hr-row')[0];
  fireEvent.click(row);
  fireEvent.click(row);
  expect(document.querySelector('.ss-hr-detail')).toBeNull();
  expect(row).toHaveAttribute('aria-expanded', 'false');
});
```

Ensure `fireEvent` is imported at the top of the file: `import { render, screen, fireEvent } from '@testing-library/react';`

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npx jest src/components/SessionSummary.test.js -t "collapsed by default"`
Expected: FAIL — `.ss-hr-row` does not exist yet.

- [ ] **Step 3: Rewrite HandReview as clamp-and-expand**

Replace the whole `HandReview` function in `src/components/SessionSummary.jsx` (lines 38–99) with:

```jsx
// `move`: 'up' | 'down' when this hand's skill changed rating this session —
// shown on the skill chip so the hand connects to its rating move without a
// separate skill list (the old rows + slide-over double-listed hands and
// only covered changed skills; founders found it confusing, July 8).
//
// Collapsed by default (July 2026). Full-size rows made this section 889px of
// a 1549px page at 390x844 and pushed the chain button below the fold. The
// player already got elaborated feedback on each of these hands DURING the
// session and the resurface ladder (F3/R1) is what drives relearning, so the
// summary's job here is a recap that stays one tap away, not a re-teach.
function HandReview({ entry, move = null }) {
  const [open, setOpen] = useState(false);
  const { scenario, choiceVal, result } = entry;
  const userOption    = scenario.options.find(o => o.val === choiceVal);
  const correctOption = scenario.options.find(o => o.val === scenario.correct);
  const handStr       = scenario.hand.map(c => c.r + c.s).join(' ');
  const boardStr      = scenario.board ? scenario.board.join(' ') : ''; // preflop scenarios have board: null
  const showCorrect = choiceVal !== scenario.correct;

  return (
    <div className="ss-hand-review">
      <button
        className="ss-hr-row"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className="ss-hr-arrow">{open ? '▾' : '▸'}</span>
        <span className="ss-hr-cards">
          <span className="ss-hr-hand">{handStr}</span>
          {boardStr && <><span className="ss-hr-divider">·</span><span className="ss-hr-board">{boardStr}</span></>}
        </span>
        <span className="ss-hr-skill">
          {SKILL_NAMES[scenario.skill]}
          {move && (
            <span className="ss-hr-skill-move" data-dir={move}>
              {move === 'up' ? ' ↑' : ' ↓'}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="ss-hr-detail">
          <div className="ss-hr-context">
            {scenario.body && (
              <span className="ss-hr-situation">{personalizeBody(scenario)}</span>
            )}
            {/* The gold READ line renders at decision time (comprehension audit
                C1) — ~10 scenarios grade on it, so the review card must carry it
                too or the player reviews a grading justified by invisible info. */}
            {scenario.tableContext && (
              <span className="ss-hr-read">
                <span className="ss-hr-ctx-label">Read: </span>
                {scenario.tableContext}
              </span>
            )}
            {scenario.pot && (
              <span className="ss-hr-pot">
                <span className="ss-hr-ctx-label">Pot: </span>
                {scenario.pot}
                {scenario.toCall && <> · To call: {scenario.toCall}</>}
              </span>
            )}
          </div>
          <div className="ss-hr-plays">
            <div className="ss-hr-play">
              <span className="ss-hr-play-label">You played</span>
              <span className="ss-hr-play-name" style={{ color: RESULT_COLOR[result] }}>
                {choiceVal ? (userOption?.label ?? choiceVal) : 'Action passed you by'}
              </span>
            </div>
            {showCorrect && (
              <div className="ss-hr-play">
                {/* "Recommended", not "Correct" — honest-labeling pass, July 2026 */}
                <span className="ss-hr-play-label">Recommended</span>
                <span className="ss-hr-play-name" style={{ color: '#56c878' }}>
                  {correctOption?.label ?? scenario.correct}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

Add the React import at the top of `src/components/SessionSummary.jsx` (it currently imports no hooks):

```jsx
import { useState } from 'react';
```

- [ ] **Step 4: Add the collapse styles**

In `src/App.css`, immediately after the existing `.ss-hand-review` rule block, add:

```css
/* Collapsed review row (July 2026). Full-size rows made Hands to Review 889px
   of a 1549px page at 390x844 and pushed the chain button below the fold.
   Same clamp-and-expand register as .db-notebook-row on the dashboard. */
.ss-hr-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  min-height: 44px;            /* tap-target floor, guarded by taptargets.spec */
}
.ss-hr-arrow {
  font-size: 0.7rem;
  color: var(--cream-faint);
  flex-shrink: 0;
}
.ss-hr-row .ss-hr-cards {
  flex: 1;
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.ss-hr-row .ss-hr-skill { flex-shrink: 0; }
.ss-hr-detail { padding: 0 12px 12px; }
```

- [ ] **Step 5: Run the component tests**

Run: `CI=true npx jest src/components/SessionSummary.test.js`
Expected: PASS.

- [ ] **Step 6: Add the mobile fold guard**

In `e2e/mobilefold.spec.mjs`, insert this immediately before the final `await page.close();`. It uses `playSession`, so add it to the import at line 9: `import { baseUser, seedAndOpen, stubCoach, playSession, STRUCTURED_READ } from './helpers.mjs';`

```js
  // ── Session summary: the chain button must clear the fold ──
  // Measured July 2026: with full-size review rows the summary was 1814px tall
  // and "Deal Next Session" sat at y=1640 on an 844px screen — nearly two
  // screens of scrolling to continue. Removing the coach read got it to 1375;
  // collapsing Hands to Review got it above the fold. This guard is what stops
  // the page silently growing back: every future addition answers to it.
  await page.evaluate(() => window.scrollTo(0, 0));
  await playSession(page);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);

  const chain = await page.locator('.restart-btn').boundingBox();
  check('summary chain button fully above the fold', !!chain && chain.y + chain.height <= VIEW.height,
    chain ? `bottom=${Math.round(chain.y + chain.height)} fold=${VIEW.height}` : 'missing');

  const collapsed = await page.locator('.ss-hr-detail').count();
  check('review rows start collapsed', collapsed === 0, `expanded=${collapsed}`);
```

- [ ] **Step 7: Run the gates and e2e**

Run: `npm run gates`
Expected: PASS.

Run: `npm run e2e:build && npm run e2e`
Expected: PASS. `mobilefold.spec.mjs` must report `summary chain button fully above the fold`.

**If the fold check fails**, do not raise the viewport or delete the check. Read the reported `bottom=` value and shorten the page further — the next largest blocks are `.ss-missed-section`'s heading and `.ss-impact-list`. Report the number rather than working around it.

- [ ] **Step 8: Screenshot the summary at 390×844 and look at it**

The `.sc2-stage`/`.sc2-table` screenshot law does not cover this page, but the collapse changes a whole section's geometry. With `npm run e2e:build` already run, write this to `e2e/shot.local.mjs`, run it, then delete it (a `*.local.mjs` name is ignored by `run.mjs`, which only globs `*.spec.mjs`):

```js
import { chromium } from 'playwright';
import { startServer } from './server.mjs';
import { baseUser, seedAndOpen, stubCoach, playSession } from './helpers.mjs';

const server = await startServer('./build', 4199);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await stubCoach(page);
await seedAndOpen(page, 'http://localhost:4199', baseUser(), { cr_last_difficulty: 'intermediate' });
await playSession(page);
await page.waitForTimeout(400);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: '/tmp/summary-collapsed.png', fullPage: true });
console.log('page height', await page.evaluate(() => document.body.scrollHeight));
await browser.close();
server.close();
```

Confirm the collapsed rows are legible and tappable, and that the reported page height is near ~840px rather than the 1549px it was before this task.

- [ ] **Step 9: Commit**

```bash
git add src/components/SessionSummary.jsx src/components/SessionSummary.test.js src/App.css e2e/mobilefold.spec.mjs
git commit -m "feat(summary): collapse Hands to Review so the chain button clears the fold

Measured at 390x844 on a 3-miss session: after removing the coach block the
page was still 1549px with 'Deal Next Session' at y=1375, and Hands to Review
was 889px of it. Collapsed rows take the section to ~180px and the button
above the fold, with no sticky bar and no reordering.

Rejected moving the buttons to the top: that puts the chain CTA above both the
reward cluster and the review list, so players tap through and see neither.

Safe for learning - the player already got elaborated feedback on each hand
during the session, and the resurface ladder (F3/R1) is what drives relearning.

Ratchet: an e2e fold guard asserting the chain button clears 844px, so every
future addition to this page has to answer to it."
```

---

### Task 3: Derive `recentSessions`

**Files:**
- Create: `src/utils/recentForm.js`
- Create: `src/utils/recentForm.test.js`
- Modify: `src/utils/db.js` — add `recentSessionsFromSessions`, wire into `assembleUser`
- Modify: `src/utils/db.test.js`
- Modify: `src/utils/session.js` — maintain the array in `applySessionResults`
- Modify: `src/utils/session.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `RECENT_SESSIONS_CAP = 12` and `RECENT_FORM_WINDOW = 6` from `src/utils/recentForm.js`
  - `appendRecentSession(recentSessions, session) -> RecentSession[]` — newest first, capped
  - `recentSessionsFromSessions(sessionRows) -> RecentSession[]` from `src/utils/db.js`
  - `RecentSession = { date: 'YYYY-MM-DD', correct: number, total: number, hands: [{ skill, result }] }`
  - `user.recentSessions` exists on every assembled/updated user

Newest first, matching `coachReads`. Twelve because trailing-6 plus previous-6 is what the strip's comparison needs.

- [ ] **Step 1: Write the failing tests for the appender**

Create `src/utils/recentForm.test.js`:

```js
import { RECENT_SESSIONS_CAP, appendRecentSession } from './recentForm';

const session = (date, correct, total = 5) => ({
  date, correct, total,
  hands: Array.from({ length: total }, (_, i) => ({
    skill: 'potodds', result: i < correct ? 'correct' : 'incorrect',
  })),
});

test('a new session goes on the front — newest first, like coachReads', () => {
  const out = appendRecentSession([session('2026-07-01', 1)], session('2026-07-02', 4));
  expect(out).toHaveLength(2);
  expect(out[0].date).toBe('2026-07-02');
  expect(out[1].date).toBe('2026-07-01');
});

test('the list is capped and drops the OLDEST, never the newest', () => {
  const existing = Array.from({ length: RECENT_SESSIONS_CAP }, (_, i) =>
    session(`2026-06-${String(i + 1).padStart(2, '0')}`, 3));
  const out = appendRecentSession(existing, session('2026-07-02', 5));
  expect(out).toHaveLength(RECENT_SESSIONS_CAP);
  expect(out[0].date).toBe('2026-07-02');
  expect(out.map(s => s.date)).not.toContain('2026-06-01');
});

test('a missing or malformed prior list is treated as empty, not a crash', () => {
  expect(appendRecentSession(undefined, session('2026-07-02', 2))).toHaveLength(1);
  expect(appendRecentSession(null, session('2026-07-02', 2))).toHaveLength(1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `CI=true npx jest src/utils/recentForm.test.js`
Expected: FAIL — `Cannot find module './recentForm'`.

- [ ] **Step 3: Create the module**

Create `src/utils/recentForm.js`:

```js
// ─── Recent form ───────────────────────────────────────────────────────────
// The deterministic half of the dashboard's feedback (Phase A, July 2026). The
// AI read speaks over a 10-session window because a skill needs ~5 attempts
// before it can be named; this strip speaks over SIX because its value is the
// comparison ("19 of 30, up from 16") and a comparison needs two windows of
// history — a 10-session strip would show no direction until session 20.
//
// The two windows differ ON PURPOSE. Do not unify them.

// Trailing-6 plus previous-6 is the most the strip ever reads.
export const RECENT_SESSIONS_CAP = 12;
export const RECENT_FORM_WINDOW = 6;

// Newest first, same ordering as coachReads. Cap drops the oldest.
export function appendRecentSession(recentSessions, session) {
  const prior = Array.isArray(recentSessions) ? recentSessions : [];
  return [session, ...prior].slice(0, RECENT_SESSIONS_CAP);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `CI=true npx jest src/utils/recentForm.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing test for the Supabase rebuild**

Append to `src/utils/db.test.js`:

```js
test('recentSessionsFromSessions rebuilds newest-first and caps at the window pair', () => {
  const rows = Array.from({ length: RECENT_SESSIONS_CAP + 3 }, (_, i) => ({
    created_at: `2026-07-${String(i + 1).padStart(2, '0')}T12:00:00Z`,
    correct_count: i % 5,
    hands: [{ skill: 'potodds', result: 'correct' }, { skill: 'bluffing', result: 'incorrect' }],
  }));
  const out = recentSessionsFromSessions(rows);
  expect(out).toHaveLength(RECENT_SESSIONS_CAP);
  // rows arrive created_at ASCENDING; the newest row must end up first
  expect(out[0].total).toBe(2);
  expect(out[0].correct).toBe((RECENT_SESSIONS_CAP + 2) % 5);
});

test('recentSessionsFromSessions counts correct from hands, not the stored column', () => {
  // correct_count is a client-written integrity field (CA-001). The hands log
  // is the append-only truth, so the strip must count from it.
  const out = recentSessionsFromSessions([{
    created_at: '2026-07-02T12:00:00Z',
    correct_count: 99,
    hands: [{ skill: 'potodds', result: 'correct' }, { skill: 'potodds', result: 'incorrect' }],
  }]);
  expect(out[0].correct).toBe(1);
  expect(out[0].total).toBe(2);
});
```

Add `recentSessionsFromSessions` to the existing `db` import at the top of the file, and `RECENT_SESSIONS_CAP` from `./recentForm`.

**Note:** the first test uses a fixed set of dates and never reads the real clock, so no fake timers are needed. If you add any assertion on a *derived* date, freeze the clock per invariant 23.

- [ ] **Step 6: Run to verify it fails**

Run: `CI=true npx jest src/utils/db.test.js -t "recentSessionsFromSessions"`
Expected: FAIL — not exported.

- [ ] **Step 7: Implement the rebuild**

In `src/utils/db.js`, add this immediately after `coachReadsFromSessions` (around line 72), and import `RECENT_SESSIONS_CAP` from `./recentForm` at the top:

```js
// Recent-form window, rebuilt from the append-only session log — self-healing
// across devices, same pattern as recentHands/coachReads. Rows arrive
// created_at ascending (oldest first); reverse to newest-first and cap at the
// window pair the strip compares. `correct` is counted from the hands log, NOT
// from correct_count: that column is client-written (CA-001) and the log is the
// append-only truth.
export function recentSessionsFromSessions(sessionRows) {
  const out = [];
  for (const r of sessionRows ?? []) {
    const hands = (r.hands ?? []).map(h => ({ skill: h.skill, result: h.result }));
    out.push({
      date: toLocalDateString(new Date(r.created_at)),
      correct: hands.filter(h => h.result === 'correct').length,
      total: hands.length,
      hands,
    });
  }
  out.reverse();  // ascending rows → newest first
  return out.length > RECENT_SESSIONS_CAP ? out.slice(0, RECENT_SESSIONS_CAP) : out;
}
```

Then wire it into `assembleUser` — add this line directly beneath the `coachReads:` line (around line 112):

```js
    // Recent-form window for the dashboard strip — derived like coachReads.
    recentSessions: recentSessionsFromSessions(sessionRows),
```

- [ ] **Step 8: Run to verify it passes**

Run: `CI=true npx jest src/utils/db.test.js`
Expected: PASS.

- [ ] **Step 9: Write the failing test for the localStorage path**

Append to `src/utils/session.test.js`:

```js
test('applySessionResults records the session in the recent-form window', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-07-28T12:00:00'));
  const user = { ...baseUser(), recentSessions: [] };
  const hands = [
    { scenarioId: 'sc_001', skill: 'potodds', result: 'correct', choiceVal: 'call' },
    { scenarioId: 'sc_002', skill: 'bluffing', result: 'incorrect', choiceVal: 'fold' },
  ];
  const out = applySessionResults(user, hands, null);
  expect(out.recentSessions).toHaveLength(1);
  expect(out.recentSessions[0]).toMatchObject({ date: '2026-07-28', correct: 1, total: 2 });
  jest.useRealTimers();
});
```

Use whatever the file's existing user fixture helper is called in place of `baseUser()`.

- [ ] **Step 10: Run to verify it fails**

Run: `CI=true npx jest src/utils/session.test.js -t "recent-form window"`
Expected: FAIL — `out.recentSessions` is `undefined`.

- [ ] **Step 11: Implement the in-memory update**

In `src/utils/session.js`, import at the top:
```js
import { appendRecentSession } from './recentForm';
```

Add this immediately before the `return { ...user, ... }` line in `applySessionResults`:

```js
  // Recent-form window (dashboard strip). In Supabase mode db.js rebuilds this
  // from the session log on load — this keeps the current device accurate
  // between loads, the same pattern as recentHands/scenarioHistory.
  const recentSessions = appendRecentSession(user.recentSessions, {
    date: toLocalDateString(new Date()),
    correct: sessionCorrect,
    total: hands.length,
    hands: hands.map(h => ({ skill: h.skill, result: h.result })),
  });
```

Then add `recentSessions` to the returned object:

```js
  return { ...user, skills, streak, lastSessionDate, rebuys, sessionsCompleted, schema, pokerScore, coachNote, coachReads, scenarioHistory, recentHands, recentSessions, directionTally, bestSessionCorrect };
```

`sessionCorrect` already exists above in this function — reuse it, do not recompute.

- [ ] **Step 12: Seed the field for new users**

In `src/utils/session.js`, find `createUser` and add `recentSessions: []` alongside the existing `recentHands: []` seed, so a fresh profile has the field rather than `undefined`.

- [ ] **Step 13: Run the gates**

Run: `npm run gates`
Expected: PASS.

- [ ] **Step 14: Commit**

```bash
git add src/utils/recentForm.js src/utils/recentForm.test.js src/utils/db.js src/utils/db.test.js src/utils/session.js src/utils/session.test.js
git commit -m "feat(state): derive recentSessions for the dashboard recent-form strip

A 12-session window (trailing 6 plus previous 6, which is what the strip's
comparison needs), newest first, derived exactly like coachReads: rebuilt from
the append-only session log in db.js, maintained in memory by
applySessionResults for localStorage mode. No schema change.

correct is counted from the hands log rather than the correct_count column -
that column is client-written (CA-001) and the log is the append-only truth."
```

---

### Task 4: `deriveRecentForm` and the ≥5-attempt gate

**Files:**
- Modify: `src/utils/spacedrep.js` — export `remediationQueueDepth`
- Modify: `src/utils/spacedrep.test.js`
- Modify: `src/utils/recentForm.js` — add `deriveRecentForm`
- Modify: `src/utils/recentForm.test.js`

**Interfaces:**
- Consumes: `RECENT_FORM_WINDOW`, `RecentSession[]` (Task 3).
- Produces:

```js
remediationQueueDepth(scenarioHistory) -> number

deriveRecentForm({ recentSessions, skills, scenarioHistory }) -> {
  windowSize: number,               // sessions actually in the trailing window (≤ 6)
  correct: number, total: number,   // trailing window, strict `result === 'correct'`
  prev: { correct, total } | null,  // previous window, null when history is too short
  moved: { skill, dir } | null,     // dir: 'up' | 'down'
  queueDepth: number,
}
```

Two deliberate metric choices, both matching an existing neighbour rather than inventing a third:
- `correct`/`total` count **strict** `result === 'correct'`, matching the session summary's "N correct" score line.
- `moved` compares accuracies computed with `RESULT_CREDIT` (partial = 0.5), matching `deriveRating` and the skill ledger.

- [ ] **Step 1: Write the failing test for the queue depth**

Append to `src/utils/spacedrep.test.js`:

```js
test('remediationQueueDepth counts hands still working through the ladder', () => {
  const history = {
    sc_001: { seen: 2, lastResult: 'incorrect', remediating: true, rung: 0 },
    sc_002: { seen: 1, lastResult: 'correct', remediating: false, rung: 0 },
    sc_003: { seen: 3, lastResult: 'incorrect', remediating: true, rung: 1 },
    // legacy entry with no `remediating` field falls back to lastResult
    sc_004: { seen: 1, lastResult: 'incorrect' },
  };
  expect(remediationQueueDepth(history)).toBe(3);
});

test('remediationQueueDepth handles an empty or missing history', () => {
  expect(remediationQueueDepth({})).toBe(0);
  expect(remediationQueueDepth(undefined)).toBe(0);
});
```

Add `remediationQueueDepth` to the existing import from `./spacedrep`.

- [ ] **Step 2: Run to verify it fails**

Run: `CI=true npx jest src/utils/spacedrep.test.js -t "remediationQueueDepth"`
Expected: FAIL — not exported.

- [ ] **Step 3: Export it from spacedrep**

In `src/utils/spacedrep.js`, immediately after the private `isRemediating` helper (around line 132), add:

```js
// How many scenarios are currently working through the graduation ladder.
// Lives here because this file owns ladder semantics — the dashboard strip
// reports the number but must never re-derive what "remediating" means.
export function remediationQueueDepth(history) {
  return Object.values(history ?? {}).filter(isRemediating).length;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `CI=true npx jest src/utils/spacedrep.test.js -t "remediationQueueDepth"`
Expected: PASS.

- [ ] **Step 5: Write the failing tests for deriveRecentForm**

Append to `src/utils/recentForm.test.js`:

```js
import { deriveRecentForm, RECENT_FORM_WINDOW } from './recentForm';

// Build a session whose hands are all one skill, so attempt counts are exact.
const skillSession = (date, skill, correct, total) => ({
  date, correct, total,
  hands: Array.from({ length: total }, (_, i) => ({
    skill, result: i < correct ? 'correct' : 'incorrect',
  })),
});

const SKILLS = { potodds: { attempts: 40, correct: 20, rating: 'yellow' } }; // lifetime 50%

test('the trailing window totals this window and the one before it', () => {
  const sessions = [
    ...Array.from({ length: 6 }, (_, i) => skillSession(`2026-07-1${i}`, 'potodds', 4, 5)),
    ...Array.from({ length: 6 }, (_, i) => skillSession(`2026-07-0${i}`, 'potodds', 2, 5)),
  ];
  const out = deriveRecentForm({ recentSessions: sessions, skills: SKILLS, scenarioHistory: {} });
  expect(out.windowSize).toBe(RECENT_FORM_WINDOW);
  expect(out).toMatchObject({ correct: 24, total: 30 });
  expect(out.prev).toEqual({ correct: 12, total: 30 });
});

test('with no previous window there is no comparison, not a fake zero', () => {
  const sessions = Array.from({ length: 3 }, (_, i) => skillSession(`2026-07-0${i}`, 'potodds', 3, 5));
  const out = deriveRecentForm({ recentSessions: sessions, skills: SKILLS, scenarioHistory: {} });
  expect(out.windowSize).toBe(3);
  expect(out.prev).toBeNull();
});

// ── The gate, both directions ──────────────────────────────────────────────
// Six sessions is ~30 hands across 8 skills — under 4 attempts each, against a
// product-wide MIN_RATED_ATTEMPTS of 5 that the skill ledger already enforces.
// Naming a skill below that bar would break the evidence discipline the rest of
// the product holds, so the strip stays SILENT rather than hedging.
test('a skill is named when it clears MIN_RATED_ATTEMPTS inside the window', () => {
  const sessions = [skillSession('2026-07-10', 'potodds', 5, 5), skillSession('2026-07-09', 'potodds', 5, 5)];
  const out = deriveRecentForm({ recentSessions: sessions, skills: SKILLS, scenarioHistory: {} });
  expect(out.moved).toEqual({ skill: 'potodds', dir: 'up' });  // 100% window vs 50% lifetime
});

test('a skill BELOW the bar is not named — the line is absent, not hedged', () => {
  const sessions = [skillSession('2026-07-10', 'potodds', 4, 4)]; // 4 attempts < 5
  const out = deriveRecentForm({ recentSessions: sessions, skills: SKILLS, scenarioHistory: {} });
  expect(out.moved).toBeNull();
});

test('movement is reported in both directions, not just slips', () => {
  const sessions = [skillSession('2026-07-10', 'potodds', 0, 5), skillSession('2026-07-09', 'potodds', 0, 5)];
  const out = deriveRecentForm({ recentSessions: sessions, skills: SKILLS, scenarioHistory: {} });
  expect(out.moved).toEqual({ skill: 'potodds', dir: 'down' });
});

test('the biggest mover wins, tie-broken by attempts then alphabetically', () => {
  const mixed = {
    date: '2026-07-10', correct: 5, total: 10,
    hands: [
      ...Array.from({ length: 5 }, () => ({ skill: 'potodds', result: 'correct' })),
      ...Array.from({ length: 5 }, () => ({ skill: 'bluffing', result: 'correct' })),
    ],
  };
  const skills = {
    potodds:  { attempts: 40, correct: 36, rating: 'green' },  // lifetime 90% → moves +10
    bluffing: { attempts: 40, correct: 8,  rating: 'red' },    // lifetime 20% → moves +80
  };
  const out = deriveRecentForm({ recentSessions: [mixed], skills, scenarioHistory: {} });
  expect(out.moved.skill).toBe('bluffing');
});

test('queue depth is reported straight from the ladder', () => {
  const out = deriveRecentForm({
    recentSessions: [skillSession('2026-07-10', 'potodds', 3, 5)],
    skills: SKILLS,
    scenarioHistory: { sc_001: { remediating: true }, sc_002: { remediating: false } },
  });
  expect(out.queueDepth).toBe(1);
});

test('an empty history derives a zeroed, non-crashing shape', () => {
  const out = deriveRecentForm({ recentSessions: [], skills: {}, scenarioHistory: {} });
  expect(out).toMatchObject({ windowSize: 0, correct: 0, total: 0, prev: null, moved: null, queueDepth: 0 });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `CI=true npx jest src/utils/recentForm.test.js`
Expected: FAIL — `deriveRecentForm is not a function`.

- [ ] **Step 7: Implement deriveRecentForm**

Append to `src/utils/recentForm.js`:

```js
import { MIN_RATED_ATTEMPTS, RESULT_CREDIT } from '../data/constants';
import { remediationQueueDepth } from './spacedrep';

const strictCorrect = (hands) => hands.filter(h => h.result === 'correct').length;

// Credit-weighted accuracy (partial = 0.5), matching deriveRating and the skill
// ledger — so the strip and the ledger can never disagree about the same skill.
const creditAccuracy = (hands) =>
  hands.reduce((s, h) => s + (RESULT_CREDIT[h.result] ?? 0), 0) / hands.length;

/**
 * The dashboard's deterministic recent-form read.
 *
 * `moved` is the heart of it: of the skills that cleared MIN_RATED_ATTEMPTS
 * INSIDE the window, the one whose window accuracy differs most from its
 * lifetime accuracy — the thing that actually moved. Below that bar the strip
 * says NOTHING: six sessions is ~30 hands across 8 skills, and naming a skill
 * off ~4 attempts would break the same evidence bar the skill ledger enforces.
 *
 * Movement is reported in BOTH directions. A strip that only ever reports slips
 * reads as nagging rather than informational, which is the failure mode M4
 * warns about.
 */
export function deriveRecentForm({ recentSessions, skills, scenarioHistory }) {
  const all = Array.isArray(recentSessions) ? recentSessions : [];
  const window = all.slice(0, RECENT_FORM_WINDOW);
  const previous = all.slice(RECENT_FORM_WINDOW, RECENT_FORM_WINDOW * 2);
  const windowHands = window.flatMap(s => s.hands ?? []);
  const prevHands = previous.flatMap(s => s.hands ?? []);

  // Per-skill attempts inside the window, so the gate is measured on the window
  // and never on the lifetime ledger.
  const bySkill = {};
  for (const h of windowHands) (bySkill[h.skill] ??= []).push(h);

  let moved = null;
  let bestGap = 0;
  for (const key of Object.keys(bySkill).sort()) {   // alphabetical = deterministic tie-break
    const hands = bySkill[key];
    if (hands.length < MIN_RATED_ATTEMPTS) continue;
    const lifetime = skills?.[key];
    if (!lifetime || !lifetime.attempts) continue;
    const windowPct = creditAccuracy(hands);
    const lifetimePct = lifetime.correct / lifetime.attempts;
    const gap = Math.abs(windowPct - lifetimePct);
    // Strictly greater keeps the first winner on a tie; because we iterate
    // alphabetically, attempts then break remaining ties below.
    if (gap > bestGap || (gap === bestGap && moved && hands.length > bySkill[moved.skill].length)) {
      bestGap = gap;
      moved = { skill: key, dir: windowPct >= lifetimePct ? 'up' : 'down' };
    }
  }

  return {
    windowSize: window.length,
    correct: strictCorrect(windowHands),
    total: windowHands.length,
    prev: previous.length > 0
      ? { correct: strictCorrect(prevHands), total: prevHands.length }
      : null,
    moved,
    queueDepth: remediationQueueDepth(scenarioHistory),
  };
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `CI=true npx jest src/utils/recentForm.test.js`
Expected: PASS (all tests).

- [ ] **Step 9: Run the gates**

Run: `npm run gates`
Expected: PASS. `simulate:schemas` and `playtest:personas` must still pass — this task adds a read-only derivation and must not have touched the rating engine.

- [ ] **Step 10: Commit**

```bash
git add src/utils/recentForm.js src/utils/recentForm.test.js src/utils/spacedrep.js src/utils/spacedrep.test.js
git commit -m "feat(state): deriveRecentForm with the MIN_RATED_ATTEMPTS gate

Six sessions is ~30 hands across 8 skills - under 4 attempts each, against a
product-wide MIN_RATED_ATTEMPTS of 5 the skill ledger already enforces. So the
strip names a skill ONLY when it clears that bar inside the window, and stays
silent otherwise rather than hedging. Borrowing the ledger's bar rather than
inventing a second one means the two surfaces can never disagree.

Movement is reported in both directions: a strip that only reports slips reads
as nagging rather than informational, the failure mode M4 warns about.

remediationQueueDepth is exported from spacedrep.js because that file owns
ladder semantics - the strip reports the number, never re-derives it."
```

---

### Task 5: The RecentForm strip on the dashboard

**Files:**
- Create: `src/components/dashboard/RecentForm.jsx` (≤160 lines, invariant 21)
- Create: `src/components/dashboard/RecentForm.test.js` (required by invariant 22)
- Modify: `src/components/Dashboard.jsx` (219 → ~226 lines, ceiling 250)
- Modify: `src/App.css` — `db-form-*` styles

**Interfaces:**
- Consumes: `deriveRecentForm(...)` and its return shape (Task 4); `user.recentSessions` (Task 3).
- Produces: nothing later tasks depend on. This is the last task.

- [ ] **Step 1: Write the failing component tests**

Create `src/components/dashboard/RecentForm.test.js`:

```jsx
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import RecentForm from './RecentForm';

const form = (over = {}) => ({
  windowSize: 6, correct: 19, total: 30,
  prev: { correct: 16, total: 30 }, moved: null, queueDepth: 0, ...over,
});

test('renders nothing at all before any session is played', () => {
  const { container } = render(<RecentForm form={form({ windowSize: 0, total: 0, prev: null })} />);
  expect(container).toBeEmptyDOMElement();
});

test('reports the window score and the direction against the previous window', () => {
  render(<RecentForm form={form()} />);
  expect(screen.getByText(/19 of 30/)).toBeInTheDocument();
  expect(screen.getByText(/up from 16/)).toBeInTheDocument();
});

test('labels a short window by its REAL size, never padded to six', () => {
  render(<RecentForm form={form({ windowSize: 3, correct: 8, total: 15, prev: null })} />);
  expect(screen.getByText(/Last 3 sessions/)).toBeInTheDocument();
  expect(screen.queryByText(/up from|down from/)).not.toBeInTheDocument();
});

// The gate's whole point: silence, not a hedge.
test('omits the skill line entirely when nothing cleared the attempts bar', () => {
  render(<RecentForm form={form({ moved: null })} />);
  expect(document.querySelector('.db-form-moved')).toBeNull();
});

test('names the mover when one cleared the bar', () => {
  render(<RecentForm form={form({ moved: { skill: 'bluffing', dir: 'down' } })} />);
  expect(document.querySelector('.db-form-moved')).toBeInTheDocument();
  expect(screen.getByText(/Bluffing/)).toBeInTheDocument();
});

test('shows the resurface queue only when something is waiting', () => {
  const { rerender } = render(<RecentForm form={form({ queueDepth: 0 })} />);
  expect(document.querySelector('.db-form-queue')).toBeNull();
  rerender(<RecentForm form={form({ queueDepth: 4 })} />);
  expect(screen.getByText(/4 hands waiting to resurface/)).toBeInTheDocument();
});

test('one waiting hand is singular', () => {
  render(<RecentForm form={form({ queueDepth: 1 })} />);
  expect(screen.getByText(/1 hand waiting to resurface/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `CI=true npx jest src/components/dashboard/RecentForm.test.js`
Expected: FAIL — `Cannot find module './RecentForm'`.

- [ ] **Step 3: Create the component**

Create `src/components/dashboard/RecentForm.jsx`:

```jsx
import { SKILL_NAMES } from '../../data/constants';

// ─── Recent form ───────────────────────────────────────────────────────────
// The deterministic half of the dashboard's feedback (Phase A, July 2026):
// updates after EVERY session, costs nothing, and can never be slow or wrong.
// The AI read below it speaks over a longer window and refreshes rarely.
//
// Line 2 is conditional by design. Six sessions is ~30 hands across 8 skills,
// so most of the time no skill has earned the right to be named — and this
// strip stays silent rather than hedging (see deriveRecentForm).
//
// Line 3 is a count of real work outstanding, not a points balance: rewards
// that read as informational support intrinsic motivation, rewards that read as
// currency undermine it (M4).

export default function RecentForm({ form }) {
  if (!form || form.total === 0) return null;
  const { windowSize, correct, total, prev, moved, queueDepth } = form;

  const direction = prev && prev.total > 0
    ? (correct > prev.correct ? 'up' : correct < prev.correct ? 'down' : 'flat')
    : null;

  return (
    <div className="db-form">
      <div className="db-form-label">Last {windowSize} session{windowSize === 1 ? '' : 's'}</div>

      <div className="db-form-score">
        <span className="db-form-count">{correct} of {total}</span>
        {direction && (
          <span className="db-form-dir" data-dir={direction}>
            {direction === 'flat'
              ? `level with ${prev.correct}`
              : `${direction === 'up' ? 'up' : 'down'} from ${prev.correct}`}
          </span>
        )}
      </div>

      {moved && (
        <div className="db-form-moved" data-dir={moved.dir}>
          <span className="db-form-moved-skill">{SKILL_NAMES[moved.skill] ?? moved.skill}</span>
          <span className="db-form-moved-word">
            {moved.dir === 'up' ? 'is sharper lately' : 'is slipping lately'}
          </span>
        </div>
      )}

      {queueDepth > 0 && (
        <div className="db-form-queue">
          {queueDepth} hand{queueDepth === 1 ? '' : 's'} waiting to resurface
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `CI=true npx jest src/components/dashboard/RecentForm.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Add the styles**

In `src/App.css`, add near the other `db-*` dashboard rules:

```css
/* Recent form — the deterministic strip that updates every session. Quiet
   register: this reports, it never celebrates (M4 — informational, not
   controlling). */
.db-form { padding: 12px 0 4px; }
.db-form-label {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 0.55rem; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--cream-faint); margin-bottom: 6px;
}
.db-form-score { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.db-form-count { font-family: Georgia, serif; font-size: 1.15rem; color: var(--cream); }
.db-form-dir {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 0.62rem; letter-spacing: 0.08em;
}
.db-form-dir[data-dir="up"]   { color: #56c878; }
.db-form-dir[data-dir="down"] { color: #e25555; }
.db-form-dir[data-dir="flat"] { color: var(--cream-faint); }
.db-form-moved {
  margin-top: 6px;
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 0.62rem; letter-spacing: 0.06em;
}
.db-form-moved-skill { color: var(--gold-light); margin-right: 6px; }
.db-form-moved-word { color: var(--cream-faint); }
.db-form-queue {
  margin-top: 6px;
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 0.6rem; letter-spacing: 0.06em; color: rgba(232,144,40,0.85);
}
```

- [ ] **Step 6: Render it on the dashboard**

In `src/components/Dashboard.jsx`, add the imports:

```jsx
import RecentForm from './dashboard/RecentForm';
import { deriveRecentForm } from '../utils/recentForm';
```

Inside the component body, before the `return`:

```jsx
  // Deterministic recent form — computed at render from derived state, so it
  // costs nothing and is never stale.
  const recentForm = guest ? null : deriveRecentForm({
    recentSessions: user.recentSessions,
    skills,
    scenarioHistory: user.scenarioHistory,
  });
```

Then render it immediately **above** `<LastSessionRead ... />` (around line 186), so the numbers sit above the prose:

```jsx
          {recentForm && <RecentForm form={recentForm} />}
```

Guests get neither surface, matching the existing `LastSessionRead` gating.

- [ ] **Step 7: Verify the line budget**

Run: `npm run check:invariants`
Expected: PASS. `Dashboard.jsx` must be ≤ 250 lines and `RecentForm.jsx` ≤ 160. If `Dashboard.jsx` has gone over, extract rather than raising the ceiling.

- [ ] **Step 8: Run the gates and e2e**

Run: `npm run gates`
Expected: PASS.

Run: `npm run e2e:build && npm run e2e`
Expected: PASS. **`mobilefold.spec.mjs` asserts the dashboard CTA is above the fold** — the strip adds height to the Player Profile card, so if that check fails, shorten the strip rather than moving the guard.

- [ ] **Step 9: Look at it**

With `npm run e2e:build` freshly run, start a preview server:

```bash
node -e "import('./e2e/server.mjs').then(m => m.startServer('./build', 4173))"
```

Open `http://localhost:4173` at 390px wide and again at 1400px. In localStorage mode you land on **Create your profile** — there is no guest flow without Supabase. Type a name, then play enough sessions for the strip to have a window (or seed `cr_user` with a `recentSessions` array via devtools).

Confirm the strip reads as quiet reporting rather than celebration, and that line 2 is genuinely absent — not blank space — when no skill has cleared the bar.

Remember: a later `npm run gates` overwrites `build/` with a production build and the preview turns into a sign-in wall. Re-run `npm run e2e:build` if that happens.

- [ ] **Step 10: Commit**

```bash
git add src/components/dashboard/RecentForm.jsx src/components/dashboard/RecentForm.test.js src/components/Dashboard.jsx src/App.css
git commit -m "feat(dashboard): recent-form strip — deterministic, every session

The free half of the two-tier split: numbers report movement after every
session, prose interprets a longer window and refreshes rarely. Costs no API
call, has no loading state, and can never be stale.

Line 2 is omitted entirely when no skill cleared MIN_RATED_ATTEMPTS inside the
window - silence rather than a hedge. Line 3 counts real work outstanding
rather than points, keeping the strip informational rather than controlling (M4).

Guests get neither surface, matching LastSessionRead."
```

---

## Definition of Done for Phase A

- [ ] Session summary renders no coach block, no spinner; chain button interactive on arrival
- [ ] `Hands to Review` collapsed by default; chain button above the fold at 390×844, asserted in e2e
- [ ] `smoke.spec.mjs` asserts the read is **absent** from the summary
- [ ] Dashboard shows the recent-form strip after a session; guests see neither surface
- [ ] The ≥5-attempt gate is tested in **both** directions
- [ ] `npm run gates` green; `npm run e2e` green
- [ ] `api/coach-read.js` **untouched** — confirm with `git diff --stat main -- api/` before opening the PR. If it is non-empty, the eval:coach law applies and this is no longer Phase A.

## Not in this plan (Phase B)

Server-side window query, `aggregate()`, the prompt rewrite, the trigger, `COACH_READS_CAP` 30 → 12, `LastSessionRead` re-scope and relabel, and the `eval-coach.mjs` seam. Phase B fires the eval:coach law.
