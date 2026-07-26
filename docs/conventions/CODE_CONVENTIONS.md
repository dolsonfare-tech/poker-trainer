# Code Conventions

Read this when writing new components, utilities, tests, or CSS. These rules
were each introduced to fix a specific bug or close a specific gap — the
rationale is preserved so future sessions understand what they're protecting.

---

## Honest labeling

Two distinct contexts, two distinct words:

| Context | Word | Example |
|---------|------|---------|
| Per-hand grading claims | **Recommended** | "Recommended Play:", feedback panel header |
| Running score counts | **correct** | "3 / 5 correct", in-session counter |

"Correct" overclaims on judgment calls — exploitative spots are debatable, and
the disagree box exists for a reason. "Recommended Play" is the honest frame.
`FeedbackPanel.jsx` sets `correct: 'Recommended Play'` in the grade-label map.

The same principle extends to feature labeling:
- Never label per-hand static feedback as "AI Analysis" — it is pre-written.
  `"⚡ Hand Analysis"` is the current copy.
- "Coach's Read" keeps its name — it is the one live Claude call per session.

In feedback text: use `"Clear fold"`, never `"Correct fold"` (sc_038 was the
fix). Do not use the word "correct" to describe the player's action in any
user-facing string.

---

## Copy voice

**Quiet-gold aesthetic, no XP, no currency, no guilt.** The product's
motivation mechanics are validated by the overjustification literature —
acknowledgments work, currency systems undermine intrinsic motivation. Hold
this instinct when adding copy.

Specific precedents:
- Timeout copy: `"The action passed you by"` — not `"Too slow"` or `"Time's
  up"`. Factual, no guilt.
- Broken-streak moment: show `"You've played X of the last 30 days"` and a
  one-tap restart — not a demoralising count-down or a shaming message.
- Milestone proximity: `"· N more to a full week ★"` — factual, goalward,
  never naggy.
- Schema copy uses `"your player profile"` not `"your archetype"` (archetype
  is the villain word).
- Schema locked state: `"unlock your player profile"` not `"unlock your
  archetype"`.

**Avoid prose questions ending a response** when the UI can carry the answer —
write the copy, don't defer it.

---

## Single-file ownership

These files are the **only** permitted entry points for their domain. Any call
site that bypasses them is an invariant violation (`npm run check:invariants`
exits 1).

| Domain | Sole owner |
|--------|-----------|
| Supabase client creation | `src/utils/supabase.js` |
| All Supabase reads and writes | `src/utils/db.js` |
| PostHog (track/identify/reset) | `src/utils/analytics.js` |
| Sentry (init + user set/clear) | `src/utils/sentry.js` |
| Anthropic API calls | `api/coach-read.js` |
| Client → coach endpoint fetch | `src/utils/claude.js` |

`sentry.js` must be imported first in `index.js` so initialisation precedes
any crash. `CLAUDE_API_KEY` is server-only — it must never appear in any
`REACT_APP_`-prefixed variable.

---

## Never `await` inside `onAuthStateChange`

Supabase-js holds its auth lock during the callback. Any `await`ed auth or
database call that needs the same lock will deadlock intermittently — this was
the `"stuck on Shuffling up…"` bug (July 2026).

```js
// WRONG — deadlocks intermittently
supabase.auth.onAuthStateChange(async (event, session) => {
  const user = await fetchRemoteUser(); // needs the auth lock — stalls
});

// CORRECT — defer with setTimeout so the lock is released first
supabase.auth.onAuthStateChange((event, session) => {
  setTimeout(async () => {
    const user = await fetchRemoteUser();
    // …
  }, 0);
});
```

See `src/App.jsx` lines 119–170 for the reference implementation. The comment
there records the Supabase docs citation.

---

## Derived-state pattern

User state is never materialised server-side beyond what the database rows
already store. Fields like `scenarioHistory`, `directionTally`, `recentHands`,
and `coachReads` are **rebuilt from `sessions` rows** on every
`fetchRemoteUser` call in `db.js`.

Benefits: self-healing across devices, no migration when the derived shape
changes, no sync bugs.

Rule: when adding a new user field that can be derived from existing rows,
derive it in `db.js assembleUser` rather than persisting it separately. The
derived field may be cached in `localStorage` as a warm cache — the Supabase
read is always the source of truth.

---

## PostHog events

All PostHog calls go through `track()` from `src/utils/analytics.js`. Never
call `posthog.capture()` directly anywhere else — the single-file rule above
covers this, and `analytics.js` is a silent no-op when `REACT_APP_POSTHOG_KEY`
is absent (keeps jest green and local dev keyless).

**Reason taxonomy for failure events:**

```js
track('coach_read_failed', { reason: 'network' | 'http' | 'empty_response' | 'daily_limit', status });
track('scenario_disagree_failed', { reason: 'error' });
track('profile_create_failed', { reason: 'error' });
track('username_change_failed', { reason: 'rate_limited' | 'error' });
```

Always pass a `reason` field on failure events so PostHog funnels can
distinguish root causes without a code deploy.

---

## CSS namespace conventions

Each screen or component owns a CSS prefix. Work within the matching prefix;
do not reach across namespaces with descendant selectors.

| Prefix | Scope |
|--------|-------|
| `sc2-` | Session canvas (ScenarioCard single-canvas layout) |
| `db-` | Dashboard |
| `tr-` | Table Reads mode (TableReads.jsx) |
| `vg-` | VillainGuide modal |
| `si-` | SignIn screen |
| `ss-` | SessionSummary |
| `ds-` | DifficultySelector |
| `act-btn` | Shared action button base (used by `sc2-btn`) |

Mobile overrides live in `@media (max-width: 700px)` blocks. The breakpoint
is 700px throughout — do not introduce a different value. Desktop-only
additions go in `@media (min-width: 700px)` blocks. Keep the block adjacent to
the desktop rule it overrides.

### The `.sc2-table` explicit-width law

`.sc2-table` **must** keep `width: 100%`. This is not aesthetic — it is
structural. `.sc2-stage` is a single-cell grid (so the feedback overlay can
outgrow the table without layout shift). A grid item with `margin: 0 auto` and
only absolutely-positioned children collapses to 0 px wide without an explicit
width — the table renders as a vertical line while all functional Playwright
tests stay green (the action buttons live outside it). This was shipped broken
to prod in commit `541299e` and caught by founder playthrough.

**After any change to `.sc2-stage` or `.sc2-table` layout rules: open the
real UI, screenshot the gameplay canvas, and confirm the felt is visible before
committing.**

Current rule (App.css):
```css
.sc2-table {
  position: relative;
  height: 400px;
  width: 100%;          /* MUST stay — do not remove */
  max-width: 720px;
  margin: 0 auto;
}
```

---

## Test conventions

### Co-location

Test files live next to the file they test:
- `src/utils/spacedrep.js` → `src/utils/spacedrep.test.js`
- `src/components/Dashboard.jsx` → `src/components/Dashboard.test.js`

Exception: `src/App.jsx` integration tests follow `App.*.test.js` naming
(`App.guest.test.js`, `App.twooption.test.js`).

### Source-pin idiom

When a rule prohibits a specific code pattern, pin it in a jest test that reads
the source file and asserts the pattern is absent. This makes the prohibition
mechanically enforced without adding it to `check-invariants.mjs`.

```js
// From src/utils/db.test.js — CA-020
test('CA-020: db.js source contains no Math.max spread over an array', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require.resolve('./db'), 'utf8');
  expect(src).not.toMatch(/Math\.max\(\s*\.\.\./);
});
```

Name source-pin tests with their CA-NNN code so they can be traced back to the
finding that introduced them.

### e2e harness

End-to-end specs in `e2e/` run against the **static production build** in
localStorage mode. The coach endpoint is stubbed by every spec via
`stubCoach(page)` from `helpers.mjs`. Real Supabase contact is zero — all
specs that exercise the Supabase auth path use Playwright `route` intercepts
against `https://stub.supabase.co`.

Key helpers (`e2e/helpers.mjs`):
- `seedAndOpen(page, baseURL, user, extra)` — writes `cr_user` to localStorage
  and reloads; waits for `.db-cta-btn`.
- `installClock(page)` — installs a `Date` shim that reads `__day_offset` from
  localStorage; advance days with `setDay(page, N)`.
- `playSession(page, { perHand })` — clicks through a full 5-hand session from
  the dashboard; `perHand(i)` runs before each decision (geometry guards live
  there).
- `backToDashboard(page)` — clicks `.ss-dash-link`.
- `loadUser(page)` — reads `cr_user` from localStorage for post-session
  assertions.

Build before running: `npm run e2e:build` (localStorage-mode build). Then:
`npm run e2e`.

**Assertions must be deterministic element-box checks, never screenshot diffs.**
Screenshot diffing is flaky and rots as the UI evolves. Assert element sizes,
bounding boxes, and absence of overlaps instead. The geometry suite
(`e2e/mobilefold.spec.mjs`, `e2e/taptargets.spec.mjs`) is the reference for
this pattern.

### Fake-clock tests

When testing streak/date logic in jest, use `jest.useFakeTimers` +
`jest.setSystemTime`. The e2e `installClock` shim covers the same requirement
in Playwright specs. Do not use `new Date('...')` literals in logic under test
— they create implicit coupling to wall-clock time.

---

## Git hygiene

**Lowercase `public/` paths only.** Vercel is case-sensitive; macOS silently
hides case-only renames. A capitalised path in `public/` will 404 in
production even if it exists locally. After any rename inside `public/`:

```sh
git ls-files public/   # confirm the tracked path is lowercase
```

`check-invariants.mjs` (rule `case-sensitivity`) exits 1 on any tracked file
under `public/` with an uppercase character in its path.

**Stage specific files, not `.`** Use `git add src/utils/spacedrep.js` rather
than `git add .` to avoid accidentally staging `.env`, generated CSVs, or
other unintended files.
