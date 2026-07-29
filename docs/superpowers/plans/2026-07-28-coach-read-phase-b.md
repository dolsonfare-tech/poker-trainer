# Coach's Read Phase B — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-scope the Coach's Read from a per-session note over 5 hands into a meta-read over a trailing 10 sessions, built server-side from the append-only log.

**Architecture:** Phase B of `docs/superpowers/specs/2026-07-28-coach-read-scope-design.md`. The client stops building the payload entirely: `api/coach-read.js` already verifies a Bearer token and holds a service-role Supabase client, so it queries the user's last 20 sessions itself, aggregates them into patterns, and prompts on that. The aggregation is a pure function in `src/utils/` (jest cannot reach `api/`) that takes a scenario lookup as a **parameter** — importing the scenario library there would pull the lazy-loaded 94KB chunk back into the main bundle and fail the bundle gate.

**Tech Stack:** Vercel serverless (CommonJS) + `@supabase/supabase-js` service role, Create React App / React 19, jest, the `scripts/eval-coach.mjs` harness.

## Global Constraints

- **`npm run gates` after every task** — never a subset. Invariants → both content audits → jest → `simulate:schemas` → `playtest:personas` → `CI=true npm run build` → bundle.
- **THE EVAL:COACH LAW FIRES IN THIS PHASE.** Any prompt or model change to `api/coach-read.js` requires `CLAUDE_API_KEY=... npm run eval:coach` run **LIVE** and judged against the F5 bar before deploy. Dry mode does not discharge it. This is a founder-run gate (Task 7).
- **Single-file ownership:** `api/coach-read.js` is the ONLY code that may call the Claude API. `src/utils/claude.js` is the only client→endpoint fetch. `src/utils/db.js` is the only client-side Supabase caller. The server's own Supabase query lives in `api/coach-read.js` and uses the service-role key already constructed there.
- **Append-only law:** `sessions` rows are INSERTed once, never UPDATEd. `submitSession` fetches the read BEFORE `recordSession` inserts, so the server's window is the sessions **already in the database** — the read stored on session N describes the sessions before N. Never add an UPDATE path.
- **Bundle gate:** `scenarios.js` is a lazy-loaded chunk (CA-014). No file reachable from the main bundle may import it.
- **Honest labeling:** the meta-read speaks **temporally, never in identity**. "over the last ten sessions", "lately" — never "you are a…". Identity is the schema card's job.
- **Frozen clock (invariants rule 23):** any test pinning a literal date must use `jest.useFakeTimers()` + `jest.setSystemTime()`.
- `npx jest` does NOT parse JSX here. Run one test file with
  `CI=true npx react-scripts test --watchAll=false --testPathPattern=<path>`.
- Commit after every task. Do not batch.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/utils/db.js` | derive `sessionsSinceRead` in `assembleUser` | 1 |
| `src/utils/session.js` | maintain `sessionsSinceRead`; gate the read on the trigger | 1, 2 |
| `src/utils/coachWindow.js` | **create** — `aggregate(sessions, lookup)`, pure, no scenario import | 3 |
| `src/utils/coachWindow.test.js` | **create** — the aggregation contract | 3 |
| `api/coach-read.js` | window query, scenario lookup, wire `aggregate`, new prompt | 4, 5 |
| `src/utils/claude.js` | stops building the payload; posts an empty body | 4 |
| `src/utils/claude.test.js` | update for the thinner client | 4 |
| `scripts/eval-coach.mjs` | rebuild on the `aggregate` seam | 5 |
| `src/utils/coachRead.js` | `COACH_READS_CAP` 30 → 12 | 6 |
| `src/components/dashboard/LastSessionRead.jsx` | re-scope + relabel | 6 |

---

### Task 1: Derive `sessionsSinceRead`

**Files:**
- Modify: `src/utils/db.js` — add `sessionsSinceRead` to `assembleUser`
- Modify: `src/utils/db.test.js`
- Modify: `src/utils/session.js` — maintain it in `applySessionResults`, seed in `createUser`
- Modify: `src/utils/session.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `user.sessionsSinceRead: number` — how many sessions have been recorded since the last one that stored a coach read. `0` immediately after a read. When no read has ever been stored, it equals the total session count.
- Produces: `sessionsSinceReadFromSessions(sessionRows) -> number` exported from `src/utils/db.js`.

**Why:** the trigger must read the log, not a modulus. A modulus on `sessionsCompleted` silently skips five sessions after any failed call.

- [ ] **Step 1: Write the failing test**

Append to `src/utils/db.test.js`. Add `sessionsSinceReadFromSessions` to the existing `db` import.

```js
test('sessionsSinceReadFromSessions counts rows after the last stored read', () => {
  // rows arrive created_at ASCENDING (oldest first), same as every other derivation
  const rows = [
    { created_at: '2026-07-01T12:00:00Z', coach_read: 'read A', hands: [] },
    { created_at: '2026-07-02T12:00:00Z', coach_read: null, hands: [] },
    { created_at: '2026-07-03T12:00:00Z', coach_read: '', hands: [] },   // empty counts as no read
    { created_at: '2026-07-04T12:00:00Z', coach_read: null, hands: [] },
  ];
  expect(sessionsSinceReadFromSessions(rows)).toBe(3);
});

test('with a read on the newest row, nothing has happened since', () => {
  const rows = [
    { created_at: '2026-07-01T12:00:00Z', coach_read: null, hands: [] },
    { created_at: '2026-07-02T12:00:00Z', coach_read: 'read B', hands: [] },
  ];
  expect(sessionsSinceReadFromSessions(rows)).toBe(0);
});

// A brand-new player has no read, so "sessions since the last read" is
// undefined unless we define it. It must equal the total, or the >=5 half of
// the trigger can never be satisfied and the first read never fires.
test('with no read ever stored, every session counts', () => {
  const rows = [
    { created_at: '2026-07-01T12:00:00Z', coach_read: null, hands: [] },
    { created_at: '2026-07-02T12:00:00Z', coach_read: null, hands: [] },
  ];
  expect(sessionsSinceReadFromSessions(rows)).toBe(2);
  expect(sessionsSinceReadFromSessions([])).toBe(0);
  expect(sessionsSinceReadFromSessions(undefined)).toBe(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=src/utils/db.test.js -t "sessionsSinceRead"`
Expected: FAIL — `sessionsSinceReadFromSessions is not a function`.

- [ ] **Step 3: Implement it**

In `src/utils/db.js`, immediately after `coachReadsFromSessions`:

```js
// How many sessions have been recorded since the last one that stored a coach
// read — the second half of the meta-read trigger. Derived from the
// append-only log rather than counted, so it self-heals after a failed call
// (a row with no read simply keeps the count climbing) and cannot desync
// across devices. With no read ever stored this is the total session count, so
// a new player's first read can fire.
export function sessionsSinceReadFromSessions(sessionRows) {
  const rows = sessionRows ?? [];
  let since = 0;
  for (const r of rows) {
    const body = r.coach_read;
    since = (typeof body === 'string' && body.trim()) ? 0 : since + 1;
  }
  return since;
}
```

Wire it into `assembleUser`, directly beneath the `coachReads:` line:

```js
    // Second half of the meta-read trigger (see submitSession).
    sessionsSinceRead: sessionsSinceReadFromSessions(sessionRows),
```

- [ ] **Step 4: Run to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=src/utils/db.test.js`
Expected: PASS.

- [ ] **Step 5: Write the failing test for the localStorage path**

Append to `src/utils/session.test.js`, using the file's existing `createUser('N')` fixture convention:

```js
test('applySessionResults resets the read counter when a read was stored', () => {
  const user = { ...createUser('N'), sessionsSinceRead: 4 };
  const hands = [{ scenarioId: 'sc_001', skill: 'potodds', result: 'correct', choiceVal: 'call' }];
  expect(applySessionResults(user, hands, 'a real read').sessionsSinceRead).toBe(0);
});

test('applySessionResults advances the read counter when no read was stored', () => {
  const user = { ...createUser('N'), sessionsSinceRead: 4 };
  const hands = [{ scenarioId: 'sc_001', skill: 'potodds', result: 'correct', choiceVal: 'call' }];
  expect(applySessionResults(user, hands, null).sessionsSinceRead).toBe(5);
});

test('a legacy cached profile with no counter starts from its session count', () => {
  const user = { ...createUser('N'), sessionsCompleted: 7 };
  delete user.sessionsSinceRead;
  const hands = [{ scenarioId: 'sc_001', skill: 'potodds', result: 'correct', choiceVal: 'call' }];
  // 7 prior sessions + this one, none of which stored a read
  expect(applySessionResults(user, hands, null).sessionsSinceRead).toBe(8);
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=src/utils/session.test.js -t "read counter"`
Expected: FAIL — `undefined`.

- [ ] **Step 7: Implement the in-memory update**

In `src/utils/session.js`, inside `applySessionResults`, immediately before the `return { ...user, ... }`:

```js
  // Read counter for the meta-read trigger. In Supabase mode db.js rebuilds
  // this from the log on load; this keeps the current device accurate between
  // loads, the same pattern as recentHands/scenarioHistory. A legacy profile
  // with no counter falls back to its session count — every session it has
  // played predates any read.
  const priorSince = typeof user.sessionsSinceRead === 'number'
    ? user.sessionsSinceRead
    : (user.sessionsCompleted ?? 0);
  const sessionsSinceRead = coachRead ? 0 : priorSince + 1;
```

Add `sessionsSinceRead` to the returned object, and add `sessionsSinceRead: 0` to `createUser`'s seed alongside `recentSessions: []`.

- [ ] **Step 8: Run to verify it passes, then run the gates**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=src/utils/session.test.js`
Expected: PASS.

Run: `npm run gates`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/utils/db.js src/utils/db.test.js src/utils/session.js src/utils/session.test.js
git commit -m "feat(state): derive sessionsSinceRead for the meta-read trigger

Counts sessions recorded since the last one that stored a coach read, derived
from the append-only log rather than counted. Self-heals after a failed call —
a row with no read keeps the count climbing — and cannot desync across devices.

With no read ever stored it equals the total session count, so a new player's
first read can fire; leaving it undefined would make the >=5 half of the
trigger unsatisfiable forever."
```

---

### Task 2: The trigger

**Files:**
- Modify: `src/utils/session.js` — `submitSession` calls `fetchCoachRead` only when due
- Modify: `src/utils/session.test.js`

**Interfaces:**
- Consumes: `user.sessionsSinceRead` (Task 1).
- Produces: `shouldFetchRead(user) -> boolean`, exported from `src/utils/session.js`.
  `META_READ_MIN_SESSIONS = 6`, `META_READ_EVERY = 5`, exported from the same file.

**Why client-side:** cadence is a UX decision, not a security boundary. The security boundary is the server's own `DAILY_LIMIT` and the fact that the server builds its own window (Task 4) — a forged trigger buys a read the player would get anyway, capped at 5/day. Calling the endpoint every session just to be told "not due" would spend a round trip four times in five.

- [ ] **Step 1: Write the failing test**

Append to `src/utils/session.test.js`:

```js
import { shouldFetchRead, META_READ_MIN_SESSIONS, META_READ_EVERY } from './session';

const u = (over) => ({ ...createUser('N'), ...over });

test('no read before the minimum session count, however long the gap', () => {
  expect(shouldFetchRead(u({ sessionsCompleted: 5, sessionsSinceRead: 5 }))).toBe(false);
});

test('the first read fires at the minimum session count', () => {
  expect(shouldFetchRead(u({ sessionsCompleted: META_READ_MIN_SESSIONS, sessionsSinceRead: 6 }))).toBe(true);
});

test('no read again until the interval has passed', () => {
  expect(shouldFetchRead(u({ sessionsCompleted: 9, sessionsSinceRead: 4 }))).toBe(false);
  expect(shouldFetchRead(u({ sessionsCompleted: 9, sessionsSinceRead: META_READ_EVERY }))).toBe(true);
});

// The self-healing case: a failed call leaves the row with no read, so the
// counter keeps climbing and the NEXT session retries — rather than the player
// waiting another full interval.
test('after a failed read the counter keeps climbing and the next session retries', () => {
  expect(shouldFetchRead(u({ sessionsCompleted: 12, sessionsSinceRead: 7 }))).toBe(true);
});

test('guests never trigger a read', () => {
  expect(shouldFetchRead(null)).toBe(false);
  expect(shouldFetchRead(undefined)).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=src/utils/session.test.js -t "read fires"`
Expected: FAIL — `shouldFetchRead is not a function`.

- [ ] **Step 3: Implement the trigger**

In `src/utils/session.js`, above `submitSession`:

```js
// ── Meta-read cadence ──────────────────────────────────────────────────────
// The read speaks over a trailing 10 sessions (~50 hands) because a skill needs
// ~5 attempts before it can honestly be named. It first fires at 6 so a new
// player is not staring at an empty slot for ten sessions, then every 5.
export const META_READ_MIN_SESSIONS = 6;
export const META_READ_EVERY = 5;

export function shouldFetchRead(user) {
  if (!user) return false;
  return (user.sessionsCompleted ?? 0) >= META_READ_MIN_SESSIONS
    && (user.sessionsSinceRead ?? 0) >= META_READ_EVERY;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=src/utils/session.test.js -t "read fires"`
Expected: PASS.

- [ ] **Step 5: Write the failing test for the gated pipeline**

Append to `src/utils/session.test.js`. Match the file's existing mocking style for `fetchCoachRead`:

```js
test('submitSession skips the API entirely when no read is due', async () => {
  fetchCoachRead.mockClear();
  const user = { ...createUser('N'), sessionsCompleted: 7, sessionsSinceRead: 2 };
  const hands = [{ scenarioId: 'sc_001', skill: 'potodds', result: 'correct', choiceVal: 'call' }];
  const res = await submitSession({ user, hands, sessionHistory: [], difficulty: 'beginner', isGuest: false, remote: null });
  expect(fetchCoachRead).not.toHaveBeenCalled();
  expect(res.coachText).toBe('');
  expect(res.user.sessionsSinceRead).toBe(3);
});

test('submitSession calls the API when a read IS due', async () => {
  fetchCoachRead.mockClear();
  fetchCoachRead.mockResolvedValueOnce('the meta read');
  const user = { ...createUser('N'), sessionsCompleted: 12, sessionsSinceRead: 5 };
  const hands = [{ scenarioId: 'sc_001', skill: 'potodds', result: 'correct', choiceVal: 'call' }];
  const res = await submitSession({ user, hands, sessionHistory: [], difficulty: 'beginner', isGuest: false, remote: null });
  expect(fetchCoachRead).toHaveBeenCalledTimes(1);
  expect(res.coachText).toBe('the meta read');
  expect(res.user.sessionsSinceRead).toBe(0);
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=src/utils/session.test.js -t "skips the API"`
Expected: FAIL — the API is called every session.

- [ ] **Step 7: Gate the pipeline**

In `src/utils/session.js`, `submitSession`'s signed-in branch currently reads:

```js
  try {
    const coachText = await fetchCoachRead(sessionHistory);
```

Replace that branch's opening so the call is conditional:

```js
  // Four sessions in five now skip the network entirely: the read speaks over a
  // trailing window, so it is fetched on a cadence rather than per session.
  // The session still persists exactly as before either way.
  if (!shouldFetchRead(user)) {
    const updated = user ? persist(applySessionResults(user, hands, null), null) : null;
    return { user: updated, coachText: '', limited: false };
  }

  try {
    const coachText = await fetchCoachRead(sessionHistory);
```

**Keep passing `sessionHistory` here.** Task 4 removes the parameter from `fetchCoachRead`'s definition; dropping it at the call site NOW would leave the still-payload-building client mapping over `undefined` and crash on the first due read. The argument becomes ignored in Task 4 and is deleted there.

- [ ] **Step 8: Run to verify it passes, then run the gates**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=src/utils/session.test.js`
Expected: PASS.

Run: `npm run gates`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/utils/session.js src/utils/session.test.js
git commit -m "feat(coach): fetch the read on a cadence, not every session

First read at 6 sessions, then every 5, gated on log-derived state rather than
a modulus — so a failed call retries next session instead of costing the player
a full interval.

Four sessions in five now skip the network entirely. Cadence is a UX decision,
not a security boundary: the server's DAILY_LIMIT and its own window query are
what actually bound cost, so a forged trigger buys a read the player would have
received anyway."
```

---

### Task 3: `aggregate()` — patterns, not hands

**Files:**
- Create: `src/utils/coachWindow.js`
- Create: `src/utils/coachWindow.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:

```js
COACH_WINDOW = 10          // sessions the read speaks over
aggregate(sessions, lookup) -> {
  sessions: number,                                   // sessions in the window
  hands: number,
  accuracy: { correct: number, total: number },
  previous: { correct: number, total: number } | null,
  skills:    [{ skill: string, attempts: number, correct: number }],   // attempts desc, then skill asc
  direction: { under: number, over: number, loose: number, evidence: number, hands: number },
  confidentMisses: [{ skill: string, villain: string, scenario: string }],  // max 5, newest first
  repeats:   [{ scenario: string, villain: string, misses: number }],       // missed >1 in window, max 5
}
```

`sessions` is **newest first**, each `{ hands: [{ scenarioId, skill, result, choiceVal, decisionMs }] }`.
`lookup(scenarioId) -> { tag, skill, villain } | null` is a **parameter**, never an import: `scenarios.js` is a lazy-loaded chunk (CA-014) and importing it from `src/utils/` would pull 94KB back into the main bundle and fail `check:bundle`.

- [ ] **Step 1: Write the failing test**

Create `src/utils/coachWindow.test.js`:

```js
import { aggregate, COACH_WINDOW } from './coachWindow';

const LOOKUP = {
  sc_bluff: { tag: 'Bluff Frequency', skill: 'bluffing', villain: 'Calling Station' },
  sc_odds:  { tag: 'Pot Odds', skill: 'potodds', villain: 'Tight Nit' },
};
const lookup = (id) => LOOKUP[id] ?? null;

const hand = (id, result, over = {}) => ({
  scenarioId: id, skill: LOOKUP[id].skill, result, choiceVal: 'fold', decisionMs: 30000, ...over,
});
const session = (hands) => ({ hands });

test('an empty window aggregates to a zeroed, non-crashing shape', () => {
  const out = aggregate([], lookup);
  expect(out).toMatchObject({ sessions: 0, hands: 0, previous: null });
  expect(out.skills).toEqual([]);
  expect(out.confidentMisses).toEqual([]);
  expect(out.repeats).toEqual([]);
});

test('the window is the newest COACH_WINDOW sessions, the rest is the comparison', () => {
  const recent = Array.from({ length: COACH_WINDOW }, () => session([hand('sc_odds', 'correct')]));
  const older  = Array.from({ length: COACH_WINDOW }, () => session([hand('sc_odds', 'incorrect')]));
  const out = aggregate([...recent, ...older], lookup);
  expect(out.sessions).toBe(COACH_WINDOW);
  expect(out.accuracy).toEqual({ correct: COACH_WINDOW, total: COACH_WINDOW });
  expect(out.previous).toEqual({ correct: 0, total: COACH_WINDOW });
});

test('per-skill tallies come out attempts-desc, and skills with no attempts are absent', () => {
  const out = aggregate([session([
    hand('sc_bluff', 'incorrect'), hand('sc_bluff', 'correct'), hand('sc_odds', 'correct'),
  ])], lookup);
  expect(out.skills).toEqual([
    { skill: 'bluffing', attempts: 2, correct: 1 },
    { skill: 'potodds', attempts: 1, correct: 1 },
  ]);
  expect(out.skills.find(s => s.skill === 'preflop')).toBeUndefined();
});

// F2: fast AND wrong is the confident miss — the leak the player does not know
// they have. Slow-wrong is an ordinary miss; fast-RIGHT is not a miss at all.
test('only fast AND wrong counts as a confident miss', () => {
  const out = aggregate([session([
    hand('sc_bluff', 'incorrect', { decisionMs: 4000 }),   // fast + wrong  -> yes
    hand('sc_odds', 'incorrect', { decisionMs: 40000 }),   // slow + wrong  -> no
    hand('sc_odds', 'correct', { decisionMs: 3000 }),      // fast + right  -> no
    hand('sc_bluff', 'incorrect', { decisionMs: null }),   // timeout       -> no
  ])], lookup);
  expect(out.confidentMisses).toEqual([
    { skill: 'bluffing', villain: 'Calling Station', scenario: 'Bluff Frequency' },
  ]);
});

test('a scenario missed more than once in the window is a repeat offender', () => {
  const out = aggregate([
    session([hand('sc_bluff', 'incorrect')]),
    session([hand('sc_bluff', 'incorrect')]),
    session([hand('sc_odds', 'incorrect')]),
  ], lookup);
  expect(out.repeats).toEqual([
    { scenario: 'Bluff Frequency', villain: 'Calling Station', misses: 2 },
  ]);
});

// The lookup is a parameter precisely so this module never imports the lazy
// scenario chunk. An unknown id must degrade, not throw.
test('an unknown scenario id degrades instead of throwing', () => {
  const out = aggregate([session([
    { scenarioId: 'sc_gone', skill: 'reads', result: 'incorrect', choiceVal: 'call', decisionMs: 2000 },
  ])], lookup);
  expect(out.hands).toBe(1);
  expect(out.skills).toEqual([{ skill: 'reads', attempts: 1, correct: 0 }]);
  expect(out.confidentMisses[0]).toMatchObject({ skill: 'reads', villain: 'Unknown' });
});

test('partial credit counts as an attempt but not as correct', () => {
  const out = aggregate([session([hand('sc_odds', 'partial')])], lookup);
  expect(out.skills).toEqual([{ skill: 'potodds', attempts: 1, correct: 0 }]);
  expect(out.accuracy).toEqual({ correct: 0, total: 1 });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=src/utils/coachWindow.test.js`
Expected: FAIL — `Cannot find module './coachWindow'`.

- [ ] **Step 3: Implement it**

Create `src/utils/coachWindow.js`:

```js
import { CONFIDENT_MISS_MS } from './spacedrep';
import { addHandsToDirectionTally, EMPTY_DIRECTION_TALLY } from './schema';

// ─── Coach window ──────────────────────────────────────────────────────────
// Turns the trailing session log into the PATTERNS the meta-read interprets.
//
// Two deliberate shapes:
//
// 1. The read is prompted on aggregates, not raw hands. Fifty raw hands is ~10x
//    the prompt tokens and the wrong input for a pattern-level claim — F5 says
//    the read's job is the cross-hand why, never a restatement of results the
//    player already saw per hand.
// 2. `lookup` is a PARAMETER, never an import. `scenarios.js` is a lazy-loaded
//    chunk (CA-014); importing it here would pull 94KB back into the main
//    bundle and fail check:bundle. The server and the eval harness each build
//    their own lookup and pass it in.

export const COACH_WINDOW = 10;

const MAX_CITED = 5;   // confident misses / repeat offenders sent to the model

const isConfidentMiss = (h) =>
  h.result === 'incorrect'
  && typeof h.decisionMs === 'number' && h.decisionMs > 0 && h.decisionMs <= CONFIDENT_MISS_MS;

const tally = (sessions) => {
  const hands = sessions.flatMap(s => s.hands ?? []);
  return {
    hands,
    correct: hands.filter(h => h.result === 'correct').length,
    total: hands.length,
  };
};

/** sessions: NEWEST FIRST. lookup: (scenarioId) => { tag, skill, villain } | null */
export function aggregate(sessions, lookup) {
  const all = Array.isArray(sessions) ? sessions : [];
  const win = all.slice(0, COACH_WINDOW);
  const prevWin = all.slice(COACH_WINDOW, COACH_WINDOW * 2);
  const meta = (id) => (typeof lookup === 'function' ? lookup(id) : null) ?? {};

  const { hands, correct, total } = tally(win);
  const prev = tally(prevWin);

  const bySkill = new Map();
  for (const h of hands) {
    const key = h.skill ?? meta(h.scenarioId).skill;
    if (!key) continue;
    const s = bySkill.get(key) ?? { skill: key, attempts: 0, correct: 0 };
    s.attempts += 1;
    if (h.result === 'correct') s.correct += 1;
    bySkill.set(key, s);
  }

  const missesById = new Map();
  for (const h of hands) {
    if (h.result === 'correct') continue;
    missesById.set(h.scenarioId, (missesById.get(h.scenarioId) ?? 0) + 1);
  }

  return {
    sessions: win.length,
    hands: hands.length,
    accuracy: { correct, total },
    previous: prevWin.length > 0 ? { correct: prev.correct, total: prev.total } : null,
    skills: [...bySkill.values()].sort(
      (a, b) => b.attempts - a.attempts || a.skill.localeCompare(b.skill),
    ),
    direction: addHandsToDirectionTally(EMPTY_DIRECTION_TALLY, hands),
    confidentMisses: hands.filter(isConfidentMiss).slice(0, MAX_CITED).map(h => ({
      skill: h.skill ?? meta(h.scenarioId).skill ?? 'Unknown',
      villain: meta(h.scenarioId).villain ?? 'Unknown',
      scenario: meta(h.scenarioId).tag ?? 'Unknown',
    })),
    repeats: [...missesById.entries()]
      .filter(([, n]) => n > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CITED)
      .map(([id, misses]) => ({
        scenario: meta(id).tag ?? 'Unknown',
        villain: meta(id).villain ?? 'Unknown',
        misses,
      })),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=src/utils/coachWindow.test.js`
Expected: PASS.

- [ ] **Step 5: Prove the bundle did not grow**

Run: `npm run gates`
Expected: PASS, and `check:bundle` must still report the `scenarios` chunk as a **separate** asset with `main.js` under its ceiling. If `main.js` jumped by ~90KB, something imported `scenarios.js` — find it and remove the import; do not raise the ceiling.

- [ ] **Step 6: Commit**

```bash
git add src/utils/coachWindow.js src/utils/coachWindow.test.js
git commit -m "feat(coach): aggregate the trailing window into patterns

The meta-read is prompted on aggregates rather than raw hands: 50 raw hands is
~10x the prompt tokens and the wrong input for a pattern-level claim (F5 — the
read's job is the cross-hand why, never a restatement of per-hand results).

The scenario lookup is a PARAMETER, never an import. scenarios.js is a
lazy-loaded chunk (CA-014) and importing it from src/utils would pull 94KB back
into the main bundle. The server and the eval harness each pass their own."
```

---

### Task 4: The server builds its own window

**Files:**
- Modify: `api/coach-read.js` — query the last `COACH_WINDOW * 2` sessions, build the lookup, call `aggregate`; `decisionsPlayed` leaves the request body
- Modify: `src/utils/claude.js` — stop building the payload
- Modify: `src/utils/claude.test.js`

**Interfaces:**
- Consumes: `aggregate(sessions, lookup)`, `COACH_WINDOW` (Task 3).
- Produces: `POST /api/coach-read` takes an **empty JSON body**; auth is the Bearer token alone. `module.exports.aggregateForUser = aggregateForUser` for the harness.
- Produces: `fetchCoachRead()` — no arguments. Task 2 still passes `sessionHistory`; delete that argument at the call site in `src/utils/session.js` as part of THIS task, in the same commit that removes the parameter.

**Why:** the handler already verifies the token via `admin.auth.getUser(token)` and holds a service-role client for the `coach_usage` cap. Querying `sessions` itself removes the forgery surface entirely — the client can no longer inflate the window or fabricate hands — without waiting on the CA-001 trust-boundary project.

- [ ] **Step 1: Write the failing test for the thinner client**

In `src/utils/claude.test.js`, replace whatever asserts the `decisionsPlayed` payload with:

```js
test('the client sends no payload — the server builds the window itself', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({ text: 'read' }),
  });
  global.fetch = fetchMock;
  await fetchCoachRead();
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/coach-read');
  expect(init.method).toBe('POST');
  // The body carries no hand data at all: anything here would be client-trusted
  // input the server must not depend on (CA-001).
  expect(JSON.parse(init.body || '{}')).toEqual({});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=src/utils/claude.test.js -t "no payload"`
Expected: FAIL — the body still contains `decisionsPlayed`.

- [ ] **Step 3: Thin the client**

In `src/utils/claude.js`, delete the entire `decisionsPlayed` mapping (lines 5–31) and the `CONFIDENT_MISS_MS` import, and change the signature and fetch:

```js
export async function fetchCoachRead() {
```

```js
    res = await fetch('/api/coach-read', {
      method: 'POST',
      headers,
      // No payload by design: the server builds the window from the
      // append-only log itself, so there is nothing here for a client to
      // inflate or fabricate (CA-001).
      body: '{}',
    });
```

Everything below (the 429 branch, the `!res.ok` branch, the empty-text branch, the analytics emits) stays exactly as it is.

- [ ] **Step 4: Run to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=src/utils/claude.test.js`
Expected: PASS.

- [ ] **Step 5: Make the server build the window**

In `api/coach-read.js`, replace the body-validation block (the `const { decisionsPlayed } = req.body;` … `MAX_DECISIONS` guard) with nothing — there is no body to validate. Then, inside the authenticated block where `uid` is known, add:

```js
    // The window is built HERE, from the append-only log, not sent by the
    // client — so it cannot be inflated or fabricated. Two windows' worth:
    // the trailing one the read speaks about, plus the one before it for the
    // accuracy comparison. Ordered newest first, which is what aggregate()
    // expects.
    const { data: rows } = await admin
      .from('sessions')
      .select('hands, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(COACH_WINDOW * 2);
    sessions = rows ?? [];
```

Declare `let sessions = [];` above the auth block so it survives the localStorage-mode branch, and after the block:

```js
  if (sessions.length === 0) {
    return res.status(400).json({ error: 'No sessions to read' });
  }
  const summary = await aggregateForUser(sessions);
```

Add near the top of the file:

```js
// aggregate() and the scenario library are ES modules; this handler is
// CommonJS, so they load through dynamic import (supported on the Node
// runtime). The lookup is built here and PASSED IN — coachWindow.js must never
// import the scenario chunk itself (CA-014 bundle split).
let _mods = null;
async function loadModules() {
  if (!_mods) {
    const [win, scen] = await Promise.all([
      import('../src/utils/coachWindow.js'),
      import('../src/data/scenarios.js'),
    ]);
    const byId = new Map((scen.default ?? []).map(s => [s.id, s]));
    _mods = {
      aggregate: win.aggregate,
      COACH_WINDOW: win.COACH_WINDOW,
      lookup: (id) => {
        const s = byId.get(id);
        return s ? { tag: s.tag, skill: s.skill, villain: s.villain?.label } : null;
      },
    };
  }
  return _mods;
}

async function aggregateForUser(sessions) {
  const { aggregate, lookup } = await loadModules();
  return aggregate(sessions, lookup);
}
module.exports.aggregateForUser = aggregateForUser;
```

`COACH_WINDOW * 2` in the query needs the constant — read it from `loadModules()` before the query, or hardcode `20` with a comment naming `COACH_WINDOW`. Prefer reading it; a second source of truth for the window size is exactly the drift this codebase ratchets against.

- [ ] **Step 6: Run the gates**

Run: `npm run gates`
Expected: PASS. `check:invariants` must still report rule 4 clean — `api/coach-read.js` remains the only Claude caller, and `src/utils/db.js` remains the only *client-side* Supabase caller (the server's service-role query is in `api/`, which rule 4 already exempts; if the invariant flags it, STOP and report rather than weakening the rule).

- [ ] **Step 7: Commit**

```bash
git add api/coach-read.js src/utils/claude.js src/utils/claude.test.js
git commit -m "feat(coach): the server builds its own window; client sends nothing

The handler already verified the Bearer token and held a service-role client
for the daily cap, so it now queries the user's own sessions directly.
decisionsPlayed leaves the request body entirely: the client can no longer
inflate the window or fabricate hands, which closes that forgery surface
without waiting on the CA-001 trust-boundary project.

coachWindow.js and scenarios.js load by dynamic import (ESM from a CommonJS
handler). The scenario lookup is built server-side and passed in, so the
lazy-loaded chunk never re-enters the client bundle."
```

---

### Task 5: The prompt, and the eval seam

**Files:**
- Modify: `api/coach-read.js` — `buildPrompt(summary)` rewritten
- Modify: `scripts/eval-coach.mjs` — build fixtures through `aggregate`

**Interfaces:**
- Consumes: the `summary` shape from Task 3, `aggregateForUser` from Task 4.
- Produces: `buildPrompt(summary)` — takes the aggregate, not `decisionsPlayed`.

**The response schema does not change.** `COACH_SCHEMA` keeps `headline` / `evidence` / `watchFor`, so `parseCoachRead`, the notebook and `LastSessionRead` all keep working. What changes is what those fields are ABOUT.

- [ ] **Step 1: Rewrite the prompt**

Replace `buildPrompt` in `api/coach-read.js`:

```js
function buildPrompt(s) {
  const pct = (c, t) => (t > 0 ? Math.round((c / t) * 100) : 0);
  const skillLines = s.skills
    .map(k => `- ${clamp(k.skill, 20)}: ${k.correct} of ${k.attempts}`)
    .join('\n');
  const confident = s.confidentMisses
    .map(m => `- ${clamp(m.scenario, 40)} vs ${clamp(m.villain, 30)} (${clamp(m.skill, 20)})`)
    .join('\n');
  const repeats = s.repeats
    .map(r => `- ${clamp(r.scenario, 40)} vs ${clamp(r.villain, 30)}: missed ${r.misses} times`)
    .join('\n');

  return `You are a poker coach reviewing a student's last ${s.sessions} sessions — ${s.hands} hands — and writing up what you have been seeing lately. This is a trend review, not a verdict on who they are: name what has been happening over this stretch, and stay in the present tense of "lately".

Overall: ${s.accuracy.correct} of ${s.accuracy.total} correct (${pct(s.accuracy.correct, s.accuracy.total)}%)${
  s.previous ? `, against ${s.previous.correct} of ${s.previous.total} (${pct(s.previous.correct, s.previous.total)}%) over the stretch before this one` : ''
}.

Per skill over this stretch:
${skillLines || '- (no skill has enough attempts to report)'}

Direction of their mistakes — too passive (${s.direction.under}), too aggressive (${s.direction.over}), too loose (${s.direction.loose}), over ${s.direction.evidence} weighted misses.

${confident ? `Confident errors — answered fast and got it wrong, so they do not know these are leaks:\n${confident}` : 'No confident errors this stretch.'}

${repeats ? `Spots they have missed more than once in this stretch:\n${repeats}` : 'No spot was missed more than once.'}

Respond with three fields — "headline", "evidence", "watchFor":
- headline: ONE sentence, 12 words or fewer, naming the clearest pattern across these ${s.sessions} sessions as something they have been DOING lately ("Bluffs keep firing into players who never fold"), never as an identity ("You are a maniac"). Start with the observation, not with "you".
- evidence: 1 to 2 short items, each 20 words or fewer, each citing a NUMBER or a repeated spot from the data above ("Bluffing: 3 of 11 across these sessions, twice into a station"). These must be things the player cannot compute for themselves — never a restatement of a single hand's result.
- watchFor: ONE sentence, 18 words or fewer, concrete and actionable for their next session.

Rules for all three fields:
- Scope every claim to this STRETCH ("lately", "over these sessions", "recently") and to observed behaviour. Never pronounce on their identity or their game as a whole: no "you are a...", no "your game is...". Naming the player's type is a different surface's job, not yours
- The direction of the mistakes is the read: folding or flat-calling when raising was best is a different tendency from raising when caution was best. Name the tendency the numbers actually show
- Confident errors are the highest-leverage thing here — they do not know those are leaks. If there are any, they belong in the headline or the evidence
- Use only the numbers and spots given above. Never invent a hand, a holding, an opponent or a statistic
- If the mistakes point in different directions, say so honestly instead of forcing one story
- These are exploitative judgement spots, not solver outputs: say "the recommended play", never "the solve" or GTO language
- Sound like a human coach, not an AI
- No em dashes, no "not only... but also" constructions
- No generic praise or filler
- If they are genuinely playing well across this stretch, say so in the headline and name one thing to keep watching in watchFor`;
}
```

Update the `messages` line in `callClaude` to take the summary, and its signature:

```js
async function callClaude(summary, apiKey) {
```
```js
      messages: [{ role: 'user', content: buildPrompt(summary) }],
```

and the handler's call site to `await callClaude(summary, apiKey)`.

- [ ] **Step 2: Rebuild the eval harness on the seam**

In `scripts/eval-coach.mjs`: delete the `mk()` helper and its "kept in sync by hand" comment — that duplication is exactly what the seam removes. Build each persona's sessions in the STORED hand shape and aggregate them through the real function:

```js
import { aggregate } from '../src/utils/coachWindow.js';

// The harness now exercises the REAL aggregate() and the REAL prompt, so the
// hand-synced copy of the payload mapping is gone. Personas are expressed as
// stored hands — { scenarioId, skill, result, choiceVal, decisionMs } — which
// is exactly what sessions.hands holds in the database.
const lookup = (id) => {
  const s = SCENARIOS.find(x => x.id === id);
  return s ? { tag: s.tag, skill: s.skill, villain: s.villain?.label } : null;
};

const storedHand = (s, result, fast) => ({
  scenarioId: s.id,
  skill: s.skill,
  result,
  choiceVal: result === 'correct' ? s.correct : pickWrong(s, []).val,
  decisionMs: fast && result !== 'correct' ? 4000 : 30000,
});

// Ten sessions of five hands is the window the read speaks over.
const buildWindow = (plan) => {
  const hands = buildDecisions(plan);
  const sessions = [];
  for (let i = 0; i < hands.length; i += 5) sessions.push({ hands: hands.slice(i, i + 5) });
  return sessions;
};
```

**Two concrete changes to the existing persona machinery:**

1. `buildDecisions(plan)` currently returns objects built by `mk()` (the deleted
   hand-synced mapping). Change its final `.map(...)` to return `storedHand(s, result, fast)`
   instead — same per-step logic choosing the scenario and whether the answer is
   correct/fast, different output shape. It must now return the **stored** shape
   (`scenarioId`, `skill`, `result`, `choiceVal`, `decisionMs`), which is what
   `sessions.hands` actually holds and what `aggregate()` consumes.
2. Each persona's `plan` array must expand to **50 hands** (10 sessions × 5), not 5.
   A trend review fed one session's worth of hands would not exercise the prompt
   it is judging. Do this by repeating the persona's existing step list ten times
   rather than authoring fifty new steps:

```js
const TEN_SESSIONS = (steps) => Array.from({ length: 10 }, () => steps).flat();
```

Apply it to each persona's `plan` at its definition site, so every persona's
leak shape is preserved exactly and only its volume changes.

Then replace the two call sites:

```js
      read = await callClaude(aggregate(buildWindow(p.plan), lookup), apiKey);
```
```js
      console.log(`— ${p.name} (dry)\n${buildPrompt(aggregate(buildWindow(p.plan), lookup))}\n`);
```

- [ ] **Step 3: Run the harness in DRY mode and read every prompt**

Run: `npm run eval:coach`
Expected: nine prompts print. Read them. Each must state a real session count, real per-skill numbers, and real cited spots — no `undefined`, no `NaN`, no empty sections rendering as bare headings.

**Dry mode does NOT discharge the eval:coach law.** It only proves the prompt assembles.

- [ ] **Step 4: Run the gates**

Run: `npm run gates`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/coach-read.js scripts/eval-coach.mjs
git commit -m "feat(coach): prompt the read on ten sessions of patterns

buildPrompt now takes the aggregate rather than five raw hands: per-skill
tallies, the direction tally, confident errors and repeat-offender spots, plus
the accuracy comparison against the previous stretch.

The read speaks TEMPORALLY, never in identity — 'lately' and 'over these
sessions', never 'you are a...'. Naming the player's type stays the schema
card's job, which has severity bars and simulate:schemas behind it. Fifty hands
earns a trend claim; it does not earn a verdict.

eval-coach.mjs loses its hand-synced copy of the payload mapping and exercises
the real aggregate(), so the harness can no longer drift from the endpoint.

DRY RUN ONLY so far — the eval:coach law still needs a LIVE run before deploy."
```

---

### Task 6: Notebook cap and the dashboard relabel

**Files:**
- Modify: `src/utils/coachRead.js` — `COACH_READS_CAP` 30 → 12
- Modify: `src/components/dashboard/LastSessionRead.jsx` — label and focus-chip copy
- Modify: `src/components/dashboard/LastSessionRead.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing later tasks rely on.

- [ ] **Step 1: Lower the cap**

In `src/utils/coachRead.js`:

```js
// One read per five sessions (Phase B), so 12 reads is ~60 sessions of history
// — 30 would have been 150. Both enforcement sites use this symbol, so the
// change is one line. NOTE: db.test.js builds a 40-row fixture to prove
// truncation; lowering is safe, raising above 40 would silently stop testing it.
export const COACH_READS_CAP = 12;
```

- [ ] **Step 2: Run the tests that pin the cap**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="src/utils/(db|session).test.js"`
Expected: PASS — both fixtures are symbolic (`db.test.js` builds 40 rows and asserts `toHaveLength(COACH_READS_CAP)`; `session.test.js` sizes its fixture from the constant).

- [ ] **Step 3: Write the failing test for the relabel**

Append to `src/components/dashboard/LastSessionRead.test.js`:

```js
// The read now spans ten sessions, so "Last Session's Read" is a false label
// and "Focus this session" is a false frame (Phase B).
test('the read is labelled as a recent-form read, not a single session', () => {
  render(<LastSessionRead coachNote={{ body: JSON.stringify(read), focus: 'bluffing' }} coachReads={[]} guest={false} />);
  expect(screen.queryByText(/Last Session's Read/i)).not.toBeInTheDocument();
  expect(screen.getByText(/Coach's Read/i)).toBeInTheDocument();
  expect(screen.getByText(/last 10 sessions/i)).toBeInTheDocument();
});

test('the focus chip is framed as ongoing, not as this session', () => {
  render(<LastSessionRead coachNote={{ body: JSON.stringify(read), focus: 'bluffing' }} coachReads={[]} guest={false} />);
  expect(screen.queryByText(/Focus this session/i)).not.toBeInTheDocument();
  expect(screen.getByText(/Focus/i)).toBeInTheDocument();
});

// A read that refreshes every five sessions can be genuinely old — and if calls
// are failing it can be MUCH older than the player assumes. Date it, so stale
// is visible rather than passing for current.
test('the read is dated so staleness is visible', () => {
  render(
    <LastSessionRead
      coachNote={{ body: JSON.stringify(read), focus: 'bluffing' }}
      coachReads={[{ date: '2026-07-24', body: JSON.stringify(read) }]}
      guest={false}
    />,
  );
  expect(screen.getByText(/Jul 24/)).toBeInTheDocument();
});

test('with no dated history the label carries no date rather than a wrong one', () => {
  render(<LastSessionRead coachNote={{ body: JSON.stringify(read), focus: 'bluffing' }} coachReads={[]} guest={false} />);
  expect(screen.queryByText(/as of/i)).not.toBeInTheDocument();
});
```

Reuse the file's existing structured-read fixture for `read`. These dates are
literals in the fixture, not derived from the clock, so no fake timers are
needed — but if you add any assertion on a *derived* date, freeze the clock
(invariants rule 23).

- [ ] **Step 4: Run to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=src/components/dashboard/LastSessionRead.test.js`
Expected: FAIL — the old labels are still rendered.

- [ ] **Step 5: Relabel**

In `src/components/dashboard/LastSessionRead.jsx`, change the two copy strings and the header comment:

```jsx
          <div className="db-profile-read-label">
            Coach's Read · last 10 sessions
            {coachReads?.[0]?.date && <> · as of {formatShortDate(coachReads[0].date)}</>}
          </div>
```
```jsx
              <span className="db-profile-read-focus-label">Focus</span>
```

Import `formatShortDate` from `../../utils/dates` — that file owns local date
formatting (CA-028/CA-037) and `CoachNotebook.jsx` already uses it for exactly
this. Never format a date inline.

Update the component's header comment: the read is no longer "the latest session's" — it is a trend read refreshed every five sessions, and the notebook below it is the archive of previous ones.

- [ ] **Step 6: Run to verify it passes, then the gates**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=src/components/dashboard/LastSessionRead.test.js`
Expected: PASS.

Run: `npm run gates`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/utils/coachRead.js src/components/dashboard/LastSessionRead.jsx src/components/dashboard/LastSessionRead.test.js
git commit -m "feat(dashboard): relabel the read for its real scope; cap the notebook at 12

'Last Session's Read' and 'Focus this session' both became false the moment the
read started spanning ten sessions. Relabelled to what it actually is.

COACH_READS_CAP 30 -> 12: at one read per five sessions, 30 would mean 150
sessions of history. Closes ROADMAP triage item 2."
```

---

### Task 7: The live eval — FOUNDER-RUN GATE

**Files:** none. This is a process gate, not a code change.

**This is the eval:coach law and it cannot be skipped, delegated to dry mode, or discharged by any other gate.** The prompt changed in Task 5, so a live run is mandatory before this work deploys.

- [ ] **Step 1: Run it live**

```bash
CLAUDE_API_KEY=... npm run eval:coach
```

- [ ] **Step 2: Judge all nine reads against the F5 bar**

For each persona, check:
- The headline names a pattern **across the stretch**, not one hand and not an identity. Any "you are a…", "your game…", or "you always…" is a FAIL.
- The evidence cites a **number or a repeated spot** the player could not compute themselves. A restated single-hand result is a FAIL — that is what the per-hand feedback already did.
- Where the persona has confident errors, they surface in the headline or the evidence.
- The direction named matches the direction in the data (too passive vs too aggressive).
- No invented hands, holdings, opponents or statistics.
- No GTO/solver language, no em dashes, no generic praise.

- [ ] **Step 3: Record the result**

Update the eval line in `CLAUDE.md` ("Last live run: …") with the date and the verdict, and only then deploy. If any read fails the bar, iterate on the prompt in `api/coach-read.js` and run live again — the law applies to every iteration.

---

## Definition of Done for Phase B

- [ ] Reads fire at session 6, then every 5, derived from the log — not a modulus
- [ ] A failed read retries the **next** session, not five later
- [ ] `decisionsPlayed` is gone from the request body; the server builds its own window
- [ ] The prompt receives aggregates, and speaks temporally, never in identity
- [ ] `check:bundle` still shows `scenarios` as a separate chunk — nothing pulled it into `main.js`
- [ ] `eval-coach.mjs` exercises the real `aggregate()`; no hand-synced copy remains
- [ ] `npm run gates` green; `npm run e2e` green
- [ ] **`eval:coach` run LIVE, nine reads judged, `CLAUDE.md` updated**

## Not in this plan

The manual refresh button (backlogged with the founder's constraints: once per day, session countdown to the next auto-refresh, manual refresh restarts it, hardened against exploitation — note Task 4's server-side window already removes its main forgery surface). Paid limits. Session length. Item 7's direction-tally decay, which is gated on giving `simulate-schemas.mjs` a time axis first.
