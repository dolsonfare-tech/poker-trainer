# CheckRaise — Target Architecture (Modularity End-State)

**Read this when:** planning any refactor, picking up a queued modularity item (CA-023…CA-037, CA-058), or deciding where new code lives.

**Why it exists:** the audit identified four monoliths and a set of small duplications. This document is the founder-approved destination every queued refactor steers toward. No single session must build it all — each wave ships independently with gates green.

---

## 1. Target Module Map

| Today's file | Target module(s) | Public interface (exports) |
|---|---|---|
| `src/utils/userStorage.js` | `src/utils/persistence.js` | `loadUser`, `saveUser`, `clearUser`, `setCacheOwner`, `cacheOwner`, `loadLastDifficulty`, `saveLastDifficulty`, `loadTableReadsStats`, `saveTableReadsStats`, `migrateUser` |
| | `src/utils/streak.js` | `calcStreak`, `MILESTONE_NAMES`, `STREAK_MILESTONES_LIST`, `REBUY_CAP`, `milestoneProximity`, `grantMilestoneRebuy` |
| | `src/utils/schema.js` | `classifyDirection`, `directionOfHand`, `addHandsToDirectionTally`, `EMPTY_DIRECTION_TALLY`, `deriveSchema`, `BALANCED_SCHEMA`, `STUDENT_SCHEMA`, `SCHEMA_UNLOCK_SESSIONS`, `computeDirectionBaseline` |
| | `src/utils/iq.js` | `derivePokerScore`, `appendRecentHands`, `RECENT_WINDOW`, `RECENT_HANDS_CAP` |
| | `src/utils/coachRead.js` | `parseCoachRead`, `COACH_READS_CAP` |
| | `src/utils/session.js` | `applySessionResults`, `submitSession`, `createUser`, `DEFAULT_SKILLS`, `RENAME_COOLDOWN_MS` |
| | `userStorage.js` (kept as re-export barrel) | Re-exports all of the above for one release cycle; deleted after import sites update |
| `src/utils/dates.js` ✅ DONE | `src/utils/dates.js` | `toLocalDateString`, `localDateFrom`, `formatShortDate` (MOD-015 addition) |
| `src/App.jsx` | `src/hooks/useAuthSession.js` | `{ authPhase, user, setUser, loadedUidRef }` — encapsulates `onAuthStateChange` + `setTimeout(0)` deadlock workaround |
| | `src/hooks/useGuest.js` | `{ isGuest, handleGuestPlay, handleGuestSignIn, guestRef }` — guest gate calc + guest flow state |
| | `src/hooks/useSessionRun.js` | `{ scenario, feedback, decided, timedOut, combo, handleDecision, handleTimeout, handleNext, sessionDelta, showSummary }` |
| | `src/utils/session.js:submitSession` | `submitSession(user, hands, { isGuest, hasSupabase })` — coach-read fetch + persist pipeline |
| | `src/App.jsx` (residual) | `<Screen>` render tree only; delegates props to hooks |
| `src/components/Dashboard.jsx` | `src/components/dashboard/StreakWarning.jsx` | `StreakWarning({ user, today })` |
| | `src/components/dashboard/StreakStatus.jsx` | `StreakStatus({ user })` |
| | `src/components/dashboard/SkillLedger.jsx` | `SkillLedger({ skills, prevSkills })` — co-locates FLIP animation |
| | `src/components/dashboard/BetaFeedback.jsx` | `BetaFeedback({ hasSupabase, user })` |
| | `src/components/dashboard/CoachNotebook.jsx` | `CoachNotebook({ coachReads })` |
| | `src/components/dashboard/UsernameEditor.jsx` | `UsernameEditor({ user, hasSupabase, onRename })` |
| | `src/hooks/useCountUp.js` | `useCountUp(target, duration)` — extracted from Dashboard inline hook |
| | `src/components/Dashboard.jsx` (residual) | Layout skeleton composing the above; ≤250 lines |
| `src/components/ScenarioCard.jsx` | `src/components/scenario/TimerRing.jsx` | `TimerRing({ secondsLeft, total })` |
| (dead LegacyLayout deleted ✅) | `src/components/scenario/StreetBar.jsx` | `StreetBar({ streets })` |
| | `src/components/scenario/SituationTicker.jsx` | `SituationTicker({ scenario, villain })` — already exported; move to own file |
| | `src/components/scenario/TableCanvas.jsx` | `TableCanvas(...)` — absorbs `TableOval`, `BlankCard`, `seatPercent`, `relationLine` helpers |
| | `src/components/scenario/SessionProgress.jsx` | `SessionProgress({ handNum, total })` |
| | `src/components/scenario/ActionButtons.jsx` | `ActionButtons({ options, onDecide })` |
| | `src/components/scenario/CanvasLayout.jsx` | `CanvasLayout(...)` — top-level layout compositor for the gameplay canvas |
| | `src/utils/handName.js` | `getHandName(hand)` — used by ScenarioCard + SessionSummary |
| | `src/components/ScenarioCard.jsx` (residual) | Thin wrapper / entry point; delegates to `CanvasLayout` |
| `src/utils/events.js` (new) | `src/utils/events.js` | `emitDecisionMade({scenarioId, skill, result, timedOut, replay, decisionMs})`, `emitSessionStarted({difficulty, chained, guest})`, `emitGuestGateSignIn(from)`, `emitVillainGuideOpened({from, scenarioId})`, `emitCoachReadOk()`, `emitCoachReadFailed(reason)`, plus one emitter per named PostHog event; callers import emitters, never construct prop bags inline |
| `src/data/scenarios.js` | `src/data/scenarios/_helpers.js` | `mkHand`, `mkPositions`, `mkScenario` |
| | `src/data/scenarios/batch1.js` | sc_001–sc_083 |
| | `src/data/scenarios/batch2.js` | sc_084–sc_107 |
| | `src/data/scenarios/batch3.js` | sc_108–sc_123 |
| | `src/data/scenarios/batch4.js` | sc_124–sc_139 |
| | `src/data/scenarios/batch5.js` | sc_140–sc_155 |
| | `src/data/scenarios/batch6.js` | sc_156–sc_172 |
| | `src/data/scenarios/index.js` | Re-exports flat `SCENARIOS`, `CONTRAST_PAIRS` (audit gate iterates the concatenated export — unchanged) |
| `src/context/` (new) | `src/context/GuideContext.jsx` | `openGuide(label)`, `openGuideAtSchema(name)` — eliminates `onVillainInfo` prop-drilling (3 hops) |
| | `src/context/SessionActionsContext.jsx` | `handleGuestSignIn`, coach-read pipeline handle — eliminates `onGuestSignIn` forking |
| `src/data/constants.js` | `src/data/constants.js` (unchanged) | Continues to own `PLAYER_SCHEMAS`, `SKILL_NAMES`, `VILLAIN_LABELS`, `deriveRating`, `applyHandToSkill`, `RESULT_CREDIT`, `DIFFICULTY_LABELS` ✅, `GUEST_GATE_CTA` ✅ |

---

## 2. Sequencing Waves

Each wave ships independently with all Definition-of-Done gates green before the next wave begins.

### Wave 1 — Zero-Risk Extractions — ✅ DONE 2026-07-26 (commit `3dac2c4`)

**Items:** MOD-007 (`shuffle` → `random.js`), MOD-010 (M2 copy → `copy.js`), MOD-015 (Dashboard date formatters → `dates.js`), MOD-016 / CA-058 cycle-break completion, MOD-012 (`dummyUser.js` delete + CLAUDE.md cleanup).

**What unblocks it:** nothing — these are mechanical moves with no structural dependencies.

**What it unblocks:** Wave 2 (component splits that will import from `random.js` and `dates.js`) — now unblocked.

**Ratchet each item leaves:**
- `random.js`: invariant rule 17 asserting `function shuffle` appears only in `src/utils/random.js` (mirrors the posthog/sentry pattern).
- `copy.js`: `activeDaysLine` source-pin test in `src/copy.test.js` (co-located with the module, not `Dashboard.test.js`/`SessionSummary.test.js` as originally sketched here) — asserts neither component hard-codes the consistency-record line.
- `dates.js` formatter addition (`formatShortDate`): unit + source-pin tests in `dates.test.js`; neither `fmtReadDate` nor inline `fmtDate` remain in `Dashboard.jsx`.
- `dummyUser.js` delete: invariant rule 18 asserting `src/data/dummyUser.js` does not exist.

### Wave 2 — Component Splits (unblocked after Wave 1)

**Items:** MOD-003 (`Dashboard.jsx` → `src/components/dashboard/` + `useCountUp`), MOD-004 (`ScenarioCard.jsx` → `src/components/scenario/`, `handName.js`).

**What unblocks it:** Wave 1 complete (date formatters and `shuffle` extracted so no import duplication is created mid-split).

**What it unblocks:** Wave 3 (prop-drilling contexts can't be introduced cleanly while the component graph is still monolithic); Wave 4 (`SituationTicker` moves to its final path, enabling the scenarios lazy-load without import chain breakage).

**Prerequisites within wave:**
- Dashboard split first (simpler; no cross-component imports); ScenarioCard second.
- `SituationTicker` already exported — its test (`SituationTicker.test.js`) updates its import path; a re-export shim in `ScenarioCard.jsx` keeps any existing direct importers green for one release.

**Ratchet each item leaves:**
- Each new file in `dashboard/` and `scenario/` has a co-located `*.test.js` covering its primary behavior (jest co-location rule — inherited, not new).
- Dashboard: `SkillLedger` FLIP logic has a jest test for the RAF measurement path (currently untested inside the monolith).
- ScenarioCard: `CanvasLayout` has a geometry smoke test (at minimum: renders without crashing; extends to the geometry guards already in `e2e/` for the table dimensions).

### Wave 3 — Hooks + Contexts (unblocked after Wave 2)

**Items:** MOD-002 (App hooks: `useAuthSession`, `useGuest`, `useSessionRun`; `submitSession` in `session.js`), MOD-014 (`GuideContext`, `SessionActionsContext`), MOD-001 (`userStorage.js` split into six modules).

**What unblocks it:** Wave 2 complete (component graph stable, prop-drilling targets identified at their final locations).

**What it unblocks:** Wave 4 (trust boundary work needs `session.js:submitSession` as the server-callable seam; scenarios lazy-load needs App to not own the session setup inline); CLAUDE.md "App is routing only" claim becomes TRUE (Task 8 updates CLAUDE.md only after this wave lands — the lean CLAUDE.md must not make that claim until then).

**Prerequisites within wave:**
- `dates.js` and `persistence.js` extracted before `streak.js` (cycle-break; `spacedrep` → `dates` already done ✅, `userStorage` → `spacedrep` cycle resolved by the `session.js` extraction).
- `userStorage.js` re-export barrel kept for one release; removed in a follow-up commit once all import sites update (grep `from.*userStorage` to find them; there are 4: App, Dashboard, SessionSummary, db).
- Invariant rule added: `deriveSchema` must live only in `src/utils/schema.js` (mirrors the `db-access` and `posthog` ownership rules).

**Ratchet each item leaves:**
- `useAuthSession.js`: jest test for the `invalid_session` → sign-out path and the deferred-setTimeout mock (the deadlock rule, currently tested only by invariant pattern-match, gets a behavioral test).
- `useGuest.js`: guest flow test extracted from `App.guest.test.js` to test the hook directly.
- `userStorage.js` split: `deriveSchema` rule added to `check-invariants.mjs`; each new module's test file inherits coverage from `userStorage.test.js` (split test file alongside split source).

### Wave 4 — Platform (unblocked after Wave 3)

**Items (ordered):**
1. MOD-011 `events.js` registry (CA-033) — typed emitters; invariant rule that event-name string literals appear only in `events.js`.
2. MOD-013 `scenarios/` batch split (CA-034) paired with CA-014 lazy-load — `import('./data/scenarios')` behind "Start Session"; `SCENARIO_BY_ID` for the login path extracted into a companion `scenario-ids.js` in the main bundle.
3. CA-022 route-level code splitting — `React.lazy()` + `<Suspense>` for `TableReads`, `VillainGuide`; optionally `SessionSummary`.
4. Trust-boundary design (CA-001 + CA-006 + CA-012) — `fn_record_session` Postgres function; drop client-writable `streak`/`rebuys`/`poker_score`; validate `migrateUser` shape — required before leaderboard or purchasable Rebuys ship.
5. Test expansion (CA-049 + CA-050) — VillainGuide + DisagreeBox jest coverage; TableReads + VillainGuide + DisagreeBox + feedback form e2e — pre-launch gate.

**What unblocks it:** Wave 3 complete (`submitSession` seam exists for the server-side trust work; component graph stable for lazy-load boundaries).

**What it unblocks:** Pro tier (leaderboard, purchasable Rebuys, meta-read), iOS Capacitor port, hand-ingestion pipeline.

**Ratchet each item leaves:**
- `events.js`: invariant rule requiring event-name string literals only in `events.js` (extends the posthog single-file-ownership rule to the shape layer).
- Scenarios split: audit gate (`audit:scenarios`) updated to import from `scenarios/index.js`; no audit logic changes (it iterates the flat export).
- Lazy-load: bundle-size invariant (Lighthouse CI budget or a `build-size` check asserting `main.*.js` < threshold).
- Trust boundary: Postgres migration in `supabase/schema.sql`; new invariant rule asserting `saveRemoteUser` does not write `streak`/`rebuys`/`poker_score` directly (those fields move to server-computed columns).
- Test expansion: e2e specs in `e2e/tablereads.spec.mjs`, `e2e/villainguide.spec.mjs`, `e2e/disagree.spec.mjs`.

---

## 3. DONE Ledger (July 26, 2026 fix bundles)

| MOD id | CA id | What landed | Commit |
|---|---|---|---|
| MOD-006 ✅ | CA-028 | `src/utils/dates.js` extracted; `toLocalDateString` + `localDateFrom` imported by both `userStorage.js` and `spacedrep.js`; neither defines its own copy. Source-pin tests in `dates.test.js`. | `7d68183` |
| MOD-005 ✅ | CA-027 | `LegacyLayout`, `DecisionPanel`, `TableVisual`, `USE_SINGLE_CANVAS` export, and `!USE_SINGLE_CANVAS` App branch deleted. Dead CSS rules removed. Invariant rule 13 (`dead-layout`) added — any reference to these names is an ERROR. | `836dd65` |
| MOD-004 (partial) ✅ | CA-026 | Dead layout path deleted alongside MOD-005. `ScenarioCard.jsx` now 404 lines (from 684). Remaining split into `src/components/scenario/` is Wave 2. | `836dd65` |
| MOD-008 ✅ | CA-030 | `DIFFICULTY_LABELS` single-sourced in `src/data/constants.js`; `SessionSummary.jsx` imports from constants. Source-pin test in `SessionSummary.test.js`. | `7d68183` |
| MOD-009 ✅ | CA-031 | `GUEST_GATE_CTA` exported from `src/data/constants.js`; both `Dashboard.jsx` and `SessionSummary.jsx` import it. Source-pin tests confirm no inline string in either file. | `7d68183` |
| MOD-016 (partial) ✅ | CA-058 | Cycle-break prerequisite done: `spacedrep.js` imports `localDateFrom` from `dates.js` (no longer duplicates). The `userStorage → spacedrep` dependency remains; resolved fully by Wave 3's `session.js` extraction. | `7d68183` |
| MOD-012 ✅ | CA-035 | Three phantom files (`gamification.js`, `skillrating.js`, `SkillTracker.jsx`) confirmed absent on disk (Task 8, Phase 2). `dummyUser.js` deleted; invariant rule 18 pins it can't silently reappear. | `3dac2c4` |
| MOD-007 ✅ | CA-029 | `shuffle()` deduped from `spacedrep.js` + `TableReads.jsx` into `src/utils/random.js`. Invariant rule 17 pins it single-file. | `3dac2c4` |
| MOD-010 ✅ | CA-032 | M2 "consistency record" line deduped from `Dashboard.jsx` + `SessionSummary.jsx` into `src/copy.js:activeDaysLine(n, {surface})`. Source-pin tests in `copy.test.js`. | `3dac2c4` |
| MOD-015 ✅ | CA-037 | Dashboard's two inline date formatters (`fmtReadDate`, `fmtDate`) merged into `src/utils/dates.js:formatShortDate` (accepts either a `Date` or a `'YYYY-MM-DD'` string). Source-pin test in `dates.test.js`. | `3dac2c4` |

---

## 4. Binding Constraints

**Single-file-ownership law extends to new modules.** Every split module that takes ownership of a responsibility must be encoded in `scripts/check-invariants.mjs` on the same day it ships:

| Module | Invariant rule to add |
|---|---|
| `src/utils/schema.js` | `deriveSchema` must only be defined in `src/utils/schema.js` |
| `src/utils/events.js` | Event-name string literals (`session_started`, `decision_made`, etc.) only in `src/utils/events.js` |
| `src/utils/random.js` | `function shuffle` only in `src/utils/random.js` |
| `src/utils/persistence.js` | `loadUser`/`saveUser`/`clearUser` only in `src/utils/persistence.js` (extends the existing cache pattern) |

**Test co-location:** every new file under `src/components/dashboard/`, `src/components/scenario/`, and `src/hooks/` gets a co-located `*.test.js`. The split does not reduce coverage — each new file inherits its portion of the parent's test suite.

**"App is routing only":** the CLAUDE.md claim is false today. It becomes true only after Wave 3 (hooks + contexts) lands. Task 8 (lean CLAUDE.md) must not assert it until then.

**`userStorage.js` barrel:** kept as a re-export shim for one release after the Wave 3 split. Removed in a follow-up commit once all four import sites (App, Dashboard, SessionSummary, db) update their import paths.

**Scenarios `index.js`:** the audit scripts (`audit:scenarios`, `audit:observations`, `simulate:schemas`) import the flat `SCENARIOS` export. The split to batch files must preserve that export shape — no audit logic changes required.
