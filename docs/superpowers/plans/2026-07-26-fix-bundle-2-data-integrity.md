# Fix Bundle 2 — Data Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the 5 data-integrity audit fixes (CA-015, CA-048, CA-020, CA-005, CA-055) — bound the sessions fetch, test the data-assembly path, remove the Math.max footgun, guard the rebuys clobber vector, and pin claude.js's error branches.

**Architecture:** Three code tasks + close-out. Tasks 1–2 both touch `src/utils/db.js` and run strictly sequentially. All fixes are client-side; zero schema changes (one founder-run SQL *audit query* is noted at close-out — read-only, not a migration).

**Tech Stack:** Existing repo tooling — jest with the established `db.test.js` supabase-mock pattern, `scripts/check-invariants.mjs`.

**Source of truth for finding details:** `docs/audit/2026-07-25-cohesion-audit.md` — CA-005 (§3.1), CA-015 + CA-020 (§3.2), CA-048 + CA-055 (§3.5).

**DO NOT START until fix bundle 1 (plan `2026-07-26-fix-bundle-1-mobile-trust.md`) is closed out — its tasks commit to the same branch.**

## Global Constraints

- After EVERY code change: `npm run check:invariants` then `CI=true npm test` green before commit. No task here touches gameplay components or App.css, so gate-6 e2e is required only in the close-out sweep.
- Ratchet law: every fix leaves a permanent mechanical check in the same commit.
- All Supabase reads/writes stay in `src/utils/db.js` (invariant law). The in-memory user object keeps the `userStorage.js` shape.
- Derived-state philosophy: `assembleUser` rebuilds derived structures from `sessions` rows — keep that pattern; this bundle BOUNDS the derivation, it does not materialize server-side state.
- COMMIT DISCIPLINE: stage only the task's named files by exact path. NEVER `git add -A` or `git add .` (a bundle-1 task swept untracked artifacts doing that).
- Commit message format `fix(CA-0XX): <summary>`.

---

### Task 1: CA-015 + CA-020 + CA-048 — bounded sessions fetch, no spread footgun, tested assembly path

**Files:**
- Modify: `src/utils/db.js` (the sessions select ~lines 143-147; the `Math.max` spread ~lines 115-117)
- Test: `src/utils/db.test.js` (extend the existing supabase-mock pattern)

**Interfaces:**
- Produces (behavioral contract, consumed by every screen):
  - The sessions query fetches **the newest 1000 rows** — add `.order('created_at', { ascending: false })` + `.range(0, 999)` — then re-sorts ascending in memory before any derivation (`historyFromSessions`/`applyHandsToHistory`, `directionTallyFromSessions`, `recentHandsFromSessions`, `coachReadsFromSessions` all assume chronological order — verify each call site's assumption by reading it before wiring).
  - `bestSessionCorrect` switches to its own tiny aggregation query (`.select('correct_count').order('correct_count', { ascending: false }).limit(1)`) so it stays LIFETIME-true rather than window-true.
  - A comment at the query documents the window: derived history is bounded to the most recent 1000 sessions by design (>1000-session-old ladder state is stale anyway); `directionTally` becomes window-scoped at that extreme — accepted.
  - `Math.max(...sessionRows.map(...))` → `sessionRows.reduce((m, r) => Math.max(m, r.correct_count ?? 0), 0)` (CA-020) — only still needed on whatever path remains after the bestSessionCorrect aggregation change; if the aggregation query fully replaces it, delete it (do not keep dead code).

- [ ] **Step 1: Read the current code paths** — `src/utils/db.js` in full, plus the four derivation helpers' ordering assumptions.

- [ ] **Step 2: Write failing tests in `src/utils/db.test.js`** (extend the existing mock):
  - `fetchRemoteUser` issues the sessions select WITH `order('created_at', {ascending:false})` and `range(0, 999)` (assert on the mock's recorded calls).
  - Given mock rows returned newest-first, `assembleUser`'s derived `scenarioHistory`/`recentHands` match the expected CHRONOLOGICAL derivation (proves the in-memory re-sort).
  - `bestSessionCorrect` comes from the aggregation query result, not from scanning the window.
  - A 15,000-element `correct_count` array derives without throwing (CA-020 pin — this fails today with RangeError only at real spread limits, so pin the mechanism instead: assert the reduce path yields the right max on a large-but-fast array AND grep-pin that `Math.max(...` spread is gone from db.js — a small unit test + a `expect(dbSource).not.toMatch(/Math\.max\(\s*\.\.\./)` source assertion, mirroring how invariants pin patterns).
  - CA-048 core: `assembleUser` field-mapping tests — given a full mock profile row + skills rows + sessions rows, the returned user object carries every field the app renders: `displayName, initials, streak, lastSessionDate, sessionsCompleted, rebuys, skills{rating,attempts,correct}, schema, pokerScore (derived fresh, NOT from profiles.poker_score — pin that), scenarioHistory, directionTally, recentHands, coachReads, bestSessionCorrect`.
  - CA-048: `createRemoteProfile` performs its upserts with `ignoreDuplicates: true` (assert via mock — a REAL call-shape test, not the invariant grep).

- [ ] **Step 3: Run to verify the new tests fail** — `CI=true npx react-scripts test --watchAll=false db.test` → FAIL.

- [ ] **Step 4: Implement** the query bounds + re-sort + aggregation + reduce per the contract above.

- [ ] **Step 5: Full jest + invariants** — `CI=true npm test && npm run check:invariants` → green.

- [ ] **Step 6: Commit** — `git add src/utils/db.js src/utils/db.test.js && git commit -m "fix(CA-015,CA-020,CA-048): bound sessions fetch to newest 1000, lifetime best via aggregation, kill Math.max spread, test assembleUser/createRemoteProfile"`

---

### Task 2: CA-005 — rebuys can never be silently zeroed by a writer

**Files:**
- Modify: `src/utils/db.js` (`createRemoteProfile` ~line 172, `saveRemoteUser` ~line 209 — the unconditional `rebuys` writes)
- Test: `src/utils/db.test.js`

**Interfaces:**
- Produces: both writers OMIT the `rebuys` key from their payload when `user.rebuys` is not a finite number (never coerce undefined/null → 0). Reads keep `profile.rebuys ?? 0` (schema `not null default 0` makes the read-side safe).

- [ ] **Step 1: Write failing tests** — with the established mock, assert:
  - `saveRemoteUser({...validUser, rebuys: undefined})` → the upsert/update payload has NO `rebuys` key.
  - `saveRemoteUser({...validUser, rebuys: 2})` → payload carries `rebuys: 2`.
  - Same pair for `createRemoteProfile`.

- [ ] **Step 2: Verify they fail.**

- [ ] **Step 3: Implement** — build the payload with a conditional spread: `...(Number.isFinite(user.rebuys) ? { rebuys: user.rebuys } : {})` at both writers (match surrounding payload style).

- [ ] **Step 4: Full jest + invariants** → green.

- [ ] **Step 5: Commit** — `git add src/utils/db.js src/utils/db.test.js && git commit -m "fix(CA-005): writers omit rebuys when not a number — no silent zeroing"`

---

### Task 3: CA-055 — pin claude.js's non-happy-path branches

**Files:**
- Test only: create `src/utils/claude.test.js`

**Interfaces:**
- Consumes: `fetchCoachRead` from `src/utils/claude.js` — read it first; the branches to pin are `!res.ok` (~:63-66), missing `data.text` (~:68-70), and the 429 daily-limit path's distinct return shape.

- [ ] **Step 1: Write the tests** (new file; `jest.spyOn(global, 'fetch')`; mock `./analytics` track and `./supabase` per how other tests mock them — read `src/utils/db.test.js` for the mocking idiom):
  - `res.ok === false` (e.g. 502) → resolves to the documented failure shape (whatever claude.js returns — null/'' — READ THE CODE and pin the actual contract, don't invent one), does NOT throw, and `coach_read_failed` is tracked with a `reason` containing the status.
  - JSON body missing `text` → same failure contract, `reason: 'empty_response'`.
  - Network rejection (fetch throws) → failure contract, `reason: 'network'`.
  - 429 → the daily-limit contract (distinct from generic failure — SessionSummary renders the honest cap copy off it).

- [ ] **Step 2: Run them** — they should PASS immediately if claude.js behaves as documented; if any branch actually returns `undefined` or throws where the contract says otherwise, that is a REAL BUG this task was designed to catch: report it and fix the minimal branch in `src/utils/claude.js` (then that file joins the commit).

- [ ] **Step 3: Full jest + invariants** → green.

- [ ] **Step 4: Commit** — `git add src/utils/claude.test.js` (plus `src/utils/claude.js` only if a real bug was fixed) `&& git commit -m "fix(CA-055): pin fetchCoachRead error branches (http, empty, network, 429)"`

---

### Task 4: Bundle close-out

**Files:**
- Modify: `docs/audit/2026-07-25-cohesion-audit.md` (§7 — mark bundle 2 done)

- [ ] **Step 1: Full gate sweep** — `npm run check:invariants && CI=true npm test && npm run audit:scenarios && npm run audit:observations && npm run simulate:schemas && npm run e2e:build && npm run e2e` → all green.

- [ ] **Step 2: Ratchet completeness** — CA-015/048 (db.test.js query-bound + assembly pins), CA-020 (reduce test + no-spread source pin), CA-005 (writer-payload pins), CA-055 (claude.test.js branch pins). All committed.

- [ ] **Step 3: Update §7** — bundle 2 `— DONE <date> (commits <range>)` + per-CA checks. Commit `docs: bundle 2 complete in triage outcomes`.

- [ ] **Step 4: Founder note (SQL editor, read-only, non-blocking):** run `select count(*) from public.profiles where rebuys is null;` — expected 0 (schema has `not null default 0`); if non-zero, tell Claude — those rows predate the alter and need a manual backfill decision.
