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
| | ~~`userStorage.js` (re-export barrel)~~ ✅ DELETED 2026-07-27 | Served one release, then all 17 import sites were repointed at the owning module and the file was removed |
| `src/utils/dates.js` ✅ DONE | `src/utils/dates.js` | `toLocalDateString`, `localDateFrom`, `formatShortDate` (MOD-015 addition) |
| `src/App.jsx` ✅ DONE | `src/hooks/useAuthSession.js` | **Shipped as** `{ user, setUser, authPhase, setAuthPhase, loadedUidRef, handleCreateUser, handleRename, signOut, handleSwitchAccount }` — the listener + `setTimeout(0)` deadlock workaround, plus the three identity mutations. Takes `{ guestRef }`. `signOut` is deliberately NOT composed with the session reset: this hook is constructed before `useSessionRun`, so the caller chains `handleRestart` |
| | `src/hooks/useGuest.js` | **Shipped as** `{ isGuest, guestGated, handleGuestPlay, handleGuestSignIn, guestOffer }` — takes `guestRef` rather than returning it (see the Wave 3 note on ownership). `guestOffer()` is a function, not a value: it reads localStorage and only the signed-out branch needs it |
| | `src/hooks/useSessionRun.js` | `{ scenario, feedback, decided, timedOut, combo, handleDecision, handleTimeout, handleNext, sessionDelta, showSummary }` |
| | `src/utils/session.js:submitSession` | `submitSession(user, hands, { isGuest, hasSupabase })` — coach-read fetch + persist pipeline |
| | `src/App.jsx` (residual) | Render tree + hook composition; owns screen routing, the guide modal, and `guestRef`. Shipped at 243 lines (from 633) |
| `src/components/Dashboard.jsx` ✅ DONE | `src/components/dashboard/StreakWarning.jsx` | `StreakWarning({ user })` |
| | `src/components/dashboard/StreakStatus.jsx` | `StreakStatus({ user, sessionDelta })` |
| | `src/components/dashboard/SchemaPanel.jsx` | `SchemaPanel({ schema, sessionsCompleted, onSchemaInfo })` — added during Wave 2 (see note below) |
| | `src/components/dashboard/SkillLedger.jsx` | `SkillLedger({ skills, prevSkills })` — co-locates FLIP animation |
| | `src/components/dashboard/LastSessionRead.jsx` | `LastSessionRead({ coachNote, coachReads, guest })` — added during Wave 2; owns `parseCoachRead` + composes `CoachNotebook` |
| | `src/components/dashboard/BetaFeedback.jsx` | `BetaFeedback()` — reads `hasSupabase` directly, as the monolith did |
| | `src/components/dashboard/CoachNotebook.jsx` | `CoachNotebook({ reads, includeLatest })` |
| | `src/components/dashboard/UsernameEditor.jsx` | `UsernameEditor({ user, onRename, onClose })` |
| | `src/hooks/useCountUp.js` | `useCountUp(to, from, duration, delay)` — extracted from Dashboard inline hook |
| | `src/components/Dashboard.jsx` (residual) | Layout skeleton composing the above; ≤250 lines (shipped at 219, pinned by invariants rule 21) |
| `src/components/ScenarioCard.jsx` ✅ DONE | `src/components/scenario/TimerRing.jsx` | `TimerRing({ totalSeconds, paused, onTimeout })` |
| (dead LegacyLayout deleted ✅) | `src/components/scenario/StreetBar.jsx` | `StreetBar({ boardLength })` |
| | `src/components/scenario/SituationTicker.jsx` | `SituationTicker({ scenario })` — moved to own file; default export |
| | `src/components/scenario/TableCanvas.jsx` | `TableCanvas({ scenario, onVillainInfo })` + named `seatPercent` — absorbs `BlankCard`, `seatPercent` (`TableOval` did not exist; `relationLine` went to `ticker.js`, see note below) |
| | `src/components/scenario/SessionProgress.jsx` | `SessionProgress({ currentIndex, total, correctCount })` |
| | `src/components/scenario/ActionButtons.jsx` | `ActionButtons({ options, onDecision, decided })` |
| | `src/components/scenario/CanvasLayout.jsx` | `CanvasLayout(...)` — top-level layout compositor for the gameplay canvas |
| | `src/utils/handName.js` | `getHandName(hand)` — default export; used by `TableCanvas` (`SessionSummary` never derived hand names, so there was no second caller to converge) |
| | `src/utils/ticker.js` (existing) | gains `relationLine(v)` — both `TableCanvas` and `CanvasLayout` render it, and its only input is `villainSummary`'s output, so it belongs beside it rather than inside either component |
| | `src/components/ScenarioCard.jsx` (residual) | Thin wrapper delegating to `CanvasLayout`, plus a one-release `SituationTicker` re-export shim; ≤40 lines (shipped at 14) |
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

### Wave 2 — Component Splits — ✅ DONE 2026-07-26 (commit `fcca8ce`)

**Items:** MOD-003 (`Dashboard.jsx` → `src/components/dashboard/` + `useCountUp`), MOD-004 (`ScenarioCard.jsx` → `src/components/scenario/`, `handName.js`).

**What unblocked it:** Wave 1 complete (date formatters and `shuffle` extracted so no import duplication is created mid-split).

**What it unblocks:** Wave 3 (prop-drilling contexts can't be introduced cleanly while the component graph is still monolithic) — now unblocked, and `src/hooks/` now exists; Wave 4 (`SituationTicker` sits at its final path, enabling the scenarios lazy-load without import chain breakage).

**Prerequisites within wave:**
- Dashboard split first (simpler; no cross-component imports); ScenarioCard second. ✅ done in that order.
- `SituationTicker` already exported — its test moved to `scenario/SituationTicker.test.js`; a re-export shim in `ScenarioCard.jsx` keeps any existing direct importers green for one release.

**Deviations from the sketch above (all deliberate):**
1. **Two extra dashboard modules.** `SchemaPanel` and `LastSessionRead` were not in the original list, but the residual `Dashboard.jsx` landed at 296 lines — over its own ≤250 budget. Those two blocks were the cohesive ones left; extracting them brought it to 219.
2. **`relationLine` went to `utils/ticker.js`, not `TableCanvas.jsx`.** Both `TableCanvas` and `CanvasLayout` render it. Owning it in one component would force the other to import a text helper sideways out of a component file; `villainSummary` (its only input) already lives in `ticker.js`.
3. **Prop signatures preserved verbatim.** The sketch proposed reshaped props (`StreakWarning({ user, today })`, `BetaFeedback({ hasSupabase, user })`). Wave 2 shipped as a pure move — same props, same behaviour — so any regression is provably a move error, not a redesign. Reshaping these for testability is a fine follow-up; it is not a component-split concern.
4. **`SessionSummary` never used `getHandName`.** The sketch listed two callers; there was only ever one. `handName.js` still earns its own file (invariants rule 19 keeps it single-sourced), but it deduplicated nothing.

**Ratchets left behind:**
- Every file in `dashboard/`, `scenario/`, and `hooks/` has a co-located `*.test.js` — and **invariants rule 22** now fails the build for any module in those trees that lacks one, so the convention is mechanical rather than remembered.
- **Invariants rule 21 (`component-budget`)**: `Dashboard.jsx` ≤ 250 lines, `ScenarioCard.jsx` ≤ 40, and no single module under `dashboard/` or `scenario/` over 160. This is the anti-re-monolithization ratchet — 727 lines was reached one "just this once" block at a time.
- **Invariants rule 19/20**: `getHandName` only in `utils/handName.js`, `relationLine` only in `utils/ticker.js`, `useCountUp` only in `hooks/useCountUp.js`.
- `SkillLedger` FLIP logic has a jest test for the RAF measurement path (untested inside the monolith — jsdom reports every rect as 0×0, so the measurement branch silently short-circuited; the test stubs `getBoundingClientRect` to hand back a real before/after pair).
- `CanvasLayout` has a geometry smoke test pinning the `.sc2-stage > .sc2-table` nesting the width law depends on, plus `TableCanvas`'s `seatPercent` checked as arithmetic (all seats inside the felt, hero always at the near rail).
- The existing CA-032 and CA-037 source pins were **widened from `Dashboard.jsx` to the whole dashboard directory** — scanning only the residual would have left both passing while guarding nothing.
- **Invariants rule 23 (`frozen-clock`)**: see the CI note in the DONE ledger below.

### Wave 3 — Hooks + Contexts — ✅ DONE 2026-07-27 (`45e35fa`, `43183e1`, `ea990cc`, + barrel removal)

**Items:** MOD-002 ✅ (App hooks: `useAuthSession`, `useGuest`, `useSessionRun`; `submitSession` in `session.js`), MOD-001 ✅ (`userStorage.js` split into six modules + barrel, barrel since removed), MOD-014 ❌ **DECLINED**.

**MOD-014 (`GuideContext`, `SessionActionsContext`) was declined, not deferred.** It existed to remove three hops of prop-drilling for `onVillainInfo`. With the finished component graph visible, context buys indirection and a re-render surface for one callback. Revisit only if a THIRD consumer appears.

**The `guestRef` ownership decision.** `App` holds it, not either hook. Neither can own it without a cycle — `useGuest` needs `authPhase` from `useAuthSession`, and `useAuthSession`'s listener needs the ref. It also cannot collapse into `authPhase === 'guest'`: the guest handlers write it synchronously, while a state read inside the listener closure lags one render, and that window is where the "guest stomped back to SignIn" bug lives. A composition root holding a channel its children share is the honest shape.

**Lesson banked — `exhaustive-deps` gets STRICTER as code gets better organized.** Moving a `useRef` behind a hook boundary means the lint rule can no longer see the `useRef()` call, so it stops treating the ref as stable and demands it as a dependency. `CI=true` promotes that to a red deploy — which is what happened on `45e35fa` (fixed in `43183e1`). Every dep array closing over a cross-boundary ref must LIST it, never suppress the rule. This also produced gate 2b and `npm run gates`.

**What unblocks it:** Wave 2 complete (component graph stable, prop-drilling targets identified at their final locations).

**What it unblocks:** Wave 4 (trust boundary work needs `session.js:submitSession` as the server-callable seam; scenarios lazy-load needs App to not own the session setup inline); CLAUDE.md "App is routing only" claim becomes TRUE (Task 8 updates CLAUDE.md only after this wave lands — the lean CLAUDE.md must not make that claim until then).

**Prerequisites within wave:**
- `dates.js` and `persistence.js` extracted before `streak.js` (cycle-break; `spacedrep` → `dates` already done ✅, `userStorage` → `spacedrep` cycle resolved by the `session.js` extraction).
- ✅ DONE 2026-07-27. `userStorage.js` re-export barrel kept for one release, then deleted. **Scoping correction:** this line said "there are 4: App, Dashboard, SessionSummary, db" — the real count was **17** (12 source + 5 test). The four named were only the ones importing *persistence* symbols; the barrel also fronted `streak`, `schema`, `iq` and `coachRead` for nine components. Count with `grep -rn "from.*userStorage" src/`, not from memory.
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

## 3b. DONE Ledger (July 26, 2026 — Wave 2)

| MOD id | CA id | What landed | Commit |
|---|---|---|---|
| MOD-003 ✅ | CA-024 | `Dashboard.jsx` 727 → 219 lines. Eight modules under `src/components/dashboard/` (`StreakWarning`, `StreakStatus`, `SchemaPanel`, `SkillLedger`, `LastSessionRead`, `CoachNotebook`, `BetaFeedback`, `UsernameEditor`) plus `src/hooks/useCountUp.js`, each with a co-located test. CA-032/CA-037 source pins widened to sweep the directory. | `fcca8ce` |
| MOD-004 ✅ | CA-026 | `ScenarioCard.jsx` 404 → 14 lines (thin wrapper + one-release `SituationTicker` shim). Seven modules under `src/components/scenario/`, plus `src/utils/handName.js` and `relationLine` into `src/utils/ticker.js`. `SituationTicker.test.js` split: component half → `scenario/`, `villainSummary` half → new `utils/ticker.test.js`. | `fcca8ce` |
| — | — | **Bug caught in-wave:** CI had been red on `main` since run #17 while the suite passed locally. `Dashboard.test.js`'s M3 proximity test hard-coded `lastSessionDate: '2026-07-25'` but let `streakAlive` read the real clock — "yesterday" in the founder's EDT is two days ago in CI's UTC, so the streak read as dead and the line never rendered. Clock frozen; **invariants rule 23 (`frozen-clock`)** now fails any test file that pins a session date without either `jest.setSystemTime` or an injected fixed `now`. | `fcca8ce` |

Jest suite: 206 → 337 tests. Invariants: 18 → 23 rules.

---

## 4. Binding Constraints

**Single-file-ownership law extends to new modules.** Every split module that takes ownership of a responsibility must be encoded in `scripts/check-invariants.mjs` on the same day it ships:

| Module | Invariant rule |
|---|---|
| `src/utils/random.js` ✅ | `function shuffle` only in `src/utils/random.js` (rule 17) |
| `src/utils/handName.js` ✅ | `getHandName` only in `src/utils/handName.js` (rule 19) |
| `src/utils/ticker.js` ✅ | `relationLine` only in `src/utils/ticker.js` (rule 19) |
| `src/hooks/useCountUp.js` ✅ | `useCountUp` only in `src/hooks/useCountUp.js` (rule 20) |
| `src/utils/schema.js` | `deriveSchema` must only be defined in `src/utils/schema.js` — Wave 3 |
| `src/utils/events.js` | Event-name string literals (`session_started`, `decision_made`, etc.) only in `src/utils/events.js` — Wave 4 |
| `src/utils/persistence.js` | `loadUser`/`saveUser`/`clearUser` only in `src/utils/persistence.js` (extends the existing cache pattern) — Wave 3 |

**Test co-location:** every new file under `src/components/dashboard/`, `src/components/scenario/`, and `src/hooks/` gets a co-located `*.test.js`. The split does not reduce coverage — each new file inherits its portion of the parent's test suite. ✅ Mechanically enforced since Wave 2 by **invariants rule 22**; a module added to those trees without a test is a build error, not a review catch.

**Component budgets (rule 21).** `Dashboard.jsx` ≤ 250, `ScenarioCard.jsx` ≤ 40, any single module under `dashboard/`/`scenario/` ≤ 160. Raising a number is a deliberate act visible in review; drifting past one silently is what the rule prevents. When a residual approaches its ceiling, extract — don't raise.

**Clock discipline (rule 23).** Any test pinning `lastSessionDate`/`usernameChangedAt` to a literal date must control its clock: `jest.useFakeTimers()` + `jest.setSystemTime()` for components (which call `new Date()` internally and offer no seam), or a fixed injected `now` for utils that accept one. Without it the test asserts against the machine's timezone.

**"App is routing only":** the CLAUDE.md claim is false today. It becomes true only after Wave 3 (hooks + contexts) lands. Task 8 (lean CLAUDE.md) must not assert it until then.

**`userStorage.js` barrel:** ✅ removed 2026-07-27, one release after the Wave 3 split, with all 17 import sites repointed at their owning module. The `barrel-only` invariant that guarded it retired with it; rule 27 (`dates-owner`) was added FIRST so that deleting the file could not silently drop the CA-028 source pin it hosted.

**Scenarios `index.js`:** the audit scripts (`audit:scenarios`, `audit:observations`, `simulate:schemas`) import the flat `SCENARIOS` export. The split to batch files must preserve that export shape — no audit logic changes required.
