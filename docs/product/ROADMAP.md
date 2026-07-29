# CheckRaise — Product Roadmap

> **Read this when** you need the current-truth picture of what's shipped, what's in flight, and what comes next. For the WHY behind decisions see `docs/architecture/DECISIONS.md`. For the technical end-state of the engines see `docs/architecture/ENGINES.md`.

---

## Phase B status — Coach's Read re-scope (as of 2026-07-29)

**Where it is:** branch `phase-b-coach-read`, **12 commits, not merged, not pushed.**
`main` is 1 commit ahead of `origin/main` (the Phase B plan doc). Phase A is
already live on `origin/main`.

**What Phase B does.** The Coach's Read moved from a per-session note over 5 hands
to a trend read over a trailing 10 sessions, fired at session 6 then every 5. The
**server builds the window itself** from the append-only log — the client posts an
empty body, so it can no longer influence what the read is about. The prompt
receives aggregated patterns (per-skill tallies gated at `MIN_RATED_ATTEMPTS`, the
direction tally, confident errors and repeat spots pre-grouped by villain with
counts, the previous stretch to compare against, a timeout count) and speaks
temporally, never in identity. Spec: `docs/superpowers/specs/2026-07-28-coach-read-scope-design.md`.
Plan: `docs/superpowers/plans/2026-07-28-coach-read-phase-b.md`.

**Verification state.** `npm run gates` green (525 tests), `npm run e2e` green,
invariants clean including three new rules added during the work:
- **29 `server-esm-resolvable`** — no extensionless relative import in the subtree
  `api/coach-read.js` loads. This existed as a real defect: `eval:coach` had been
  BROKEN on `main` since `8846d18` and nothing ran it, so it failed silently.
- **30 `coach-tenant-scope`** — pins `.eq('user_id', uid)` on the sessions query,
  the one line stopping another player's hands entering somebody's read.
- **32** — a `--dry` eval run can never overwrite the live artifact.

### THE ONE OPEN DECISION — word caps

The July 29 live eval passed on substance (see CLAUDE.md's eval line) but flagged
**7 word-cap breaches across 4 of 9 personas**: headline 13w ×2 (cap 12), evidence
21w and 22w (cap 20), watchFor 19w/20w/21w (cap 18).

The caps (12/20/18) were inherited from the OLD per-session prompt, which described
five hands. The trend read describes ten sessions, a previous-stretch comparison and
a villain distribution. The flagged evidence item is
*"Five confident errors span four opponent types: two vs a Tight Nit, one each vs a
Calling Station, Maniac, and Tight Recreational"* — 22 words, and exactly the
aggregate citation Phase B exists to produce. Cutting it to 20 costs a villain name.

Two paths, founder's call:
1. **Ship now, tune later.** The reads are correct, honest and in voice; the caps are
   a style constraint. Merge, push, and re-tune caps when the prompt is next touched
   so one live run validates both. (Recommended — two paid runs were spent on 2026-07-29.)
2. **Tune first.** Suggested: keep headline at 12 (7 of 9 hit it; a 13-word headline
   is a sentence), evidence 20 → 24, watchFor 18 → 20. Costs another live run and will
   not come back all-green — a model told "24 words" writes longer, so it needs real
   validation, not arithmetic against the current artifact.

**Do not raise a cap to make a run green.** A bound moved to fit the output it bounds
is not a bound.

### Left undone, deliberately

- **Task 7 follow-through:** whichever path above is chosen, then merge + push. The
  push IS the deploy, and the eval law binds the deploy.
- **`repeats` is unexercised by the eval** — no persona misses a scenario twice, so
  repeat-spot citations ship unjudged by a live run. Pinned in jest instead. Fixing it
  properly needs a tenth persona, which changes the paid-run cost and the baseline.
- **The withheld-tag citation path has no live coverage** — no persona combines a
  sub-bar skill with a confident miss.
- Three ratchet-hardening minors from the last review (rule 31's re-hardcoding regex
  misses `words >= N`; rule 32 misdiagnoses one of its two failure modes in its
  message; an all-errored live run still overwrites the prior live artifact). None can
  produce a false green today.
- **First production read must be verified after deploy.** This is the first time
  `api/` reaches into `src/` (dynamic import). `@vercel/nft` should trace it, but
  nothing local proves the lambda bundles it — if it misses, every read 500s and the
  only signal is PostHog `coach_read_failed`.

---

## Triage — Tester Feedback (batch of July 26, 2026)

Nine items from the tester batch, each triaged against the code on July 28. The
tester's original numbering is preserved so this list stays matchable to the
source message. Verdicts are recorded with the evidence that drove them — two of
the nine did not survive contact with the code, and the reasons matter more than
the calls.

1. **✅ DONE 2026-07-28 — desktop: the Hand Analysis sits BESIDE the felt, not over it.**
   The analysis and the table shared one grid cell (`.sc2-stage` is a single-cell
   grid; the overlay sat at `grid-area: 1/1` with `z-index: 10`), so the board you
   had just played was hidden exactly when you were being told what to do with it.
   The `👁 Show table` / `← Back to analysis` pair existed only to work around this.
   **Fix:** a `.sc2-analysis` state modifier on the gameplay card (set only while
   feedback is up) that App.css acts on at `min-width: 1280px`, moving the panel
   into a second grid column — 720px table + 410px panel. The card reclaims 120px
   per side of already-empty gutter to reach 1200px; everything is border-box, so
   it lands flush with `.app`'s 1200px box and never overflows. Peek is hidden at
   that breakpoint, including the peeked *state* (a narrow→wide resize while peeked
   would otherwise strand a transparent panel whose restore chip had been hidden).
   Below 1280 nothing changes. The felt shifts left when the panel opens — it cannot
   stay page-centred and have 410px appear beside it; holding the table at its full
   720px was the deliberate half of that trade, since a table that changed SIZE
   between playing and reviewing would break the comparison the panel is asking for.
   **Ratchets:** `CanvasLayout.test.js` pins the modifier (jsdom has no layout, so it
   pins the *switch* the whole CSS rule hangs off), and `e2e/desktopanalysis.spec.mjs`
   measures both directions — at 1440 the panel must not intersect the table and must
   sit to its right with zero horizontal overflow; at 1200 it must STILL cover, so a
   breakpoint that leaked down to phones fails instead of passing quietly. The
   collapse guard (`.sc2-table` ≥ 400×300) is re-run at the new breakpoint because
   changing `grid-template-columns` on `.sc2-stage` is precisely the change class the
   `.sc2-table` width law was written for. Canvas screenshotted at both widths.

2. **⏳ LOW — cap the Coach's Notebook below 30 reads.** True but nearly free of
   benefit. `COACH_READS_CAP = 30` (`utils/coachRead.js:13`) is enforced in exactly
   two places, both via the imported symbol, so changing it is a one-character edit
   with no migration risk (derived state, self-heals). But the reads arrive inside
   the sessions query already — the cap trims an array, not a payload — and the
   notebook is double-collapsed: the list hides behind a toggle that defaults closed,
   and each row is CSS-clamped to one line until tapped. The 30 is invisible unless
   deliberately expanded. **Action:** drop to ~12 whenever that file is next open;
   do not schedule a session for it. Watch `db.test.js:188` — its literal 40-row
   fixture stops testing truncation if the cap is ever raised above 40.

3. **❌ DECLINED as asked — reference guide beside the table — ⏳ but a real bug sits under it.**
   Declined because items 1 and 3 compete for the same pixels: there is no room for
   both a 410px analysis panel and a guide rail beside a 720px table, and item 1 is
   the better use. (The tester hedged on this one themselves.)
   **The real find:** opening the VillainGuide mid-hand does NOT pause the timer.
   `TimerRing` pauses only on its `paused` prop and the only value ever passed is
   `decided` (`CanvasLayout.jsx:44`); `guide` state lives in `App.jsx:31` and is never
   threaded into `ScenarioCard`. So on Intermediate, a player who taps the villain
   bubble to learn what an archetype means can be timed out behind the modal —
   consulting the help costs you the hand. Beginner is safe only by accident
   (`showTimer={difficulty !== 'beginner'}`). **Fix:** pass `guide !== null` as an
   additional pause input; ratchet with a `CanvasLayout` test asserting the ring is
   paused while the guide is open.

4. **◐ SPLIT — reduce friction / fewer coach reads.** The coach read is NOT the
   friction and should not be touched: it is one API call per completed session,
   fired after `setShowSummary(true)`, so the summary renders immediately with only
   the read block in a loading state and both exits live. Seamless replay is also
   already built — `Deal Next Session →` chains at the same difficulty with no
   dashboard round trip, carrying the just-played hands forward so they cannot
   re-deal. Session N → N+1 is **one tap**. The real ceremony is the 10 taps per
   session (5 actions + 5 Next). Do **not** auto-advance past feedback: F1 says
   explanation quality is the highest-effect-size lever, so skipping people past the
   explanation trades the thing that works for the thing that feels fast.
   **Cheap:** keyboard advance (space/enter) on desktop. **Deferred:** session-length
   option — see working-queue item 6, which already holds the decision rule;
   `SESSION_LENGTH` is module-private (`deal.js:13`) but the literal 5 is hardcoded in
   `e2e/helpers.mjs:80`, `App.integration.test.js`, and both simulation harnesses.
   **Unflagged by anyone, and worse than click count:** `api/coach-read.js:11` caps
   reads at 5/day, so the most engaged players — the ones chaining — silently stop
   getting reads after the fifth session of the day.

5. **❌ DECLINED — tokens/credits instead of a subscription.** The premise (AI cost
   scales with use, so price should too) is generally true and specifically weak
   here: at most **five model calls per user per day**, hard-capped server-side. That
   cap is already the mechanism that makes flat-rate safe. Against it, metering
   charges per use in a product whose entire value is habit formation, and rationing
   is the opposite of what a daily loop needs. `RESEARCH_SUBSCRIPTION_MARKET.md`
   landed on single-tier $9.99/mo, and the coin economy was permanently rejected on
   July 5 — a token model is the same idea in a different hat. **If cost ever becomes
   real the lever is the daily cap** (tighter free tier, higher Pro cap), not a
   currency.

6. **💡 ACCEPTED as the defining Expert mechanic — blocked on content, not code.**
   Hiding the villain archetype is mechanically small: the label is derived at runtime
   in `mkScenario` and surfaces through one function (`ticker.js:73` `villainSummary`)
   feeding two render sites. The situation ticker is already type-blind — it says "CO
   bets $15", never "the Calling Station bets $15". The cost is content: **zero expert
   scenarios exist** (81 beginner / 91 intermediate) and Expert is a `disabled: true`
   stub. Note the overlap with Table Reads, which already owns identify-the-archetype
   with distractors and `whyNot` text — but the ideas are distinct: Table Reads is
   identification with no decision, Expert is *deciding without being told*, which is
   the harder and more realistic skill. The interesting version asks both on one hand.
   **Decide explicitly:** whether the hidden label is still sent to the coach
   (`claude.js:17` sends it today — it should stay, so the coach can name a misread).
   **Action:** record the mechanic here and in DECISIONS so it constrains authoring;
   build when the pool exists.

7. **⏳ ACCEPTED in spirit, DIRECTION REVERSED — recency weighting.** Taken literally
   ("weigh the recent 5 hands less and less") this would worsen the engine's worst
   documented defect. Current state: skill ratings are a lifetime `correct/attempts`
   counter with no time term (`constants.js:116-134`); the direction tally is an
   unbounded lifetime sum (`schema.js:92-110`); the only recency mechanism anywhere is
   the IQ display's hard 8-hand window. There is no decay or half-life in the repo.
   And `schema.js:204-211` already documents the failure: **early random skew freezes
   into the lifetime tally** — one steady-strong trial wore "The Conflict Avoider" from
   session 19 to session 40. The problem is not that recent hands count too much; it is
   that old hands never stop counting. What the tester likely felt is a player who
   improved and watched the diagnosis refuse to move.
   **Scope:** decay on the **direction tally only**. Leave the skill ledger lifetime —
   it is the honest "here is your record" surface, and `simulate-schemas.mjs` needs a
   0.40-accuracy skill to read red reliably over ~25 lifetime attempts; an 8-hand
   window makes that a coin flip and the gate starts failing.
   **The real cost is the harness, not the engine:** `simulate-schemas.mjs` synthesizes
   the tally linearly from session count (`synthTally`, `:98-102`) with **no time axis
   whatsoever**, so it cannot verify a decay change at all. Sequence: give the harness a
   time axis, confirm it reproduces today's behaviour, *then* introduce decay. Watch the
   `Positional + mild under-skew` profile — at 2.0 vs ~1.9 it is the tightest margin in
   the suite and the first thing any rescaling breaks. **This is a spec, not an edit,
   and it is the most valuable engine work on the list.**

8. **✅ FIXED 2026-07-27 (`7cc8c84`) — sign-in redundancy + missing sign-up door.**
   Reported independently by the founder and fixed same-day; removed from this triage.
   There was only ever one `SignIn` component with an internal `showSignIn` state — the
   "two screens" are two states. The guest CTA is now gated on `!showSignIn`, and the
   reveal link reads "Sign in or create an account →". Magic link *is* sign-up
   (`signInWithOtp` never passes `shouldCreateUser`, which defaults true).
   **⏳ Gap left behind:** `e2e/` has **zero** SignIn coverage — every spec seeds a
   signed-in profile straight into localStorage. This fix is pinned in jest only, on
   the one screen where users actually leave. Thinnest net in the repo.

9. **◐ SPLIT — better logo/icon on mobile.** The in-app logo is not an image: it is the
   text `Check<em>Raise</em>` in four places, platform-safe and fine. The
   emoji-rendering bug being remembered was the difficulty-card suit glyphs, already
   fixed by font-pinning (`App.css:2242`). The mobile complaint is most likely the app
   **icon**, and there is a concrete defect: neither manifest icon declares
   `"purpose": "maskable"`, so Android circle-crops the full square, and
   `apple-touch-icon` points at the 192px PNG when iOS wants 180×180 and ignores
   transparency. **Do the plumbing first** (maskable variant with safe-area padding,
   180×180, and extend the asset-budget invariant to cover `icon-192.png` at 72 KB and
   `og.png` at 247 KB, both currently unbudgeted; `icon-512.png` is at 116 KB against a
   150 KB hard limit — 34 KB of headroom). New files must be lowercase or the
   case-sensitivity invariant errors. Actual logo *design* is a separate, non-engineering
   task — see whether the complaint survives the plumbing fix.
   **⏳ Also:** two bare `♠` glyphs escaped the July 27 font-pinning fix —
   `SignIn.jsx:80` and the `Dashboard.jsx:69` avatar. Same bug class, one of them on the
   landing screen. That fix should have left a check behind and did not.

**💡 Founder thought (July 28) — is the Coach's Read too frequent, and too behavioural?**
Not yet triaged; raised for discussion. The concern: saying "you play this way" off 5
hands feels wrong when 500 sessions of data exist, and the read may be both too often
and too myopic. Sketch offered: the per-session read explains the **errors** without
behavioural verdicts, and a separate **holistic** read lives on the dashboard over the
full record. Note this rhymes with an existing decision rather than contradicting it —
the July 22 reframe already scoped the read to session field notes precisely because 5
hands cannot support "you are a X" (`api/coach-read.js:133`: "The trend across sessions
is the notebook's job; yours is one session's field notes"). So the question is whether
that reframe went far enough, and whether the cross-session surface it points at should
actually exist. Related: the **periodic meta-read** already sitting in the feature
backlog is arguably this exact idea. Also interacts with item 7 — a holistic surface
wants a diagnosis that can move as the player improves. **Discuss before scoping; the
load-bearing decision is where behavioural claims are allowed to live, not the UI.**

### Tester feedback — later batch (logged 2026-07-28, not yet triaged)

Captured verbatim at the founder's request; **no analysis done yet, deliberately.**

10. **Streak badges.** Tester request. Note when this is picked up: M4 in
    `RESEARCH_LEARNING_SCIENCE.md` is directly on point — badges are acceptable
    as *milestone acknowledgements*, never as currency, and the existing
    quiet-gold register is the constraint. Do not scope without reading it.
11. **Global leaderboard.** Tester request. Note when this is picked up: the
    trust boundary (CA-001/006/012) is a **hard prerequisite** — `db.js:228`
    writes `streak`, `rebuys` and `poker_score` from the client, which is
    harmless while private and trivially forgeable the moment it is ranked. The
    existing backlog entry scopes a *friends-only* board; "global" is a
    different product decision, not a bigger version of the same one.

---

## Phase Status

### Phase 1.0 — COMPLETE
83 scenarios built and structured. Core gameplay loop working (scenario → feedback → summary). Two carry-forwards: SME review of gradings (self-grading via disagree box + triage pipeline is the current substitute), and both founders playing 10+ sessions each.

### Phase 1.5 — COMPLETE (July 2026)
Strategic questions answered: monetization (subscription, not ads-first — Pro tier TBD), Poker IQ mechanics (continuous true accuracy + recency-weighted), session builder design, coach pipeline, streak/engagement mechanics. Full findings in `docs/research/RESEARCH_LEARNING_SCIENCE.md`, `docs/research/RESEARCH_SUBSCRIPTION_MARKET.md`.

### Phase 2 — Launch Build (July 2026, targeting early-August go-live)

**LIVE in production:**
- Supabase auth: email magic link + Google OAuth (brand-verified ✅)
- profiles / skills / sessions / coach_usage tables with RLS
- localStorage migration on first sign-in; stale-session recovery
- Coach endpoint: 5 calls/user/day cap, structured JSON reads (`headline / evidence[] / watchFor`), `claude-sonnet-5`
- Spaced-rep v2 session builder (graduation ladder, calendar-day floor, confident-miss boost, contrast pairs, surge slot — see `docs/architecture/ENGINES.md` §1)
- Streak + Rebuys (M1–M3): earn at 7-day milestones, broken-streak moment, milestone proximity copy
- Schema hybrid v2: direction-of-error diagnosis for 3 direction schemas + absolute-weakness for 3 skill schemas
- Recency-weighted Poker IQ (F3, 8-hand window per skill)
- Table Reads mode: 22-hand pool, mode-local scoring, street-by-street replay
- Guest-first sign-in flow (Duolingo-style deferred signup)
- Coach's Notebook (full read history in dashboard, zero schema change)
- Full UX/consistency sweep (July 20): villain relation line fix, VillainGuide corrections, glossary expansion, Table Reads dealing memory, effective stacks in every scenario, comprehension fix C1 (tableContext rendered as READ line)
- PostHog, Sentry, Resend SMTP live
- Disagree box (`scenario_feedback` table), beta feedback form
- Editable usernames with server-side rate-limit trigger
- Real favicon + PWA icons; OG/SEO tags; sitemap
- Privacy + Terms pages (ads section removed until ads ship)
- AdSense scaffolding dormant (ON HOLD — no account until real users exist)

**Cohesion audit baseline (July 25, commit `6c80cbe`):** 150/150 tests, invariants clean, e2e green, Lighthouse desktop 89 / mobile 63. 58 findings catalogued in `docs/audit/2026-07-25-cohesion-audit.md`; fix waves sequenced in `docs/architecture/TARGET_ARCHITECTURE.md`.

### Phase 1.6 — Scenario Scale & Expert Level (post-launch)
- Expert difficulty scenarios (stack-dependent spots now expressible — `effectiveStacks` field live)
- Scenario pool scale-up; generation tooling for main pool (backlog)
- Lock in iOS Bundle ID before Phase 3

### Phase 3 — iOS via Capacitor (post-web traction)
- $99 Apple dev account required; deferred until web traction established
- **Pre-decided tech-stack defaults (lock these in before scoping begins):**
  - State management: **Zustand or React Context** (already the pre-approved choice)
  - Animations: **Framer Motion** (establish in Phase 1.5 — already the pre-approved choice)
  - Developer estimate: **6–8 weeks** with a dedicated developer

---

## Working Queue (do these in order)

1. **Strategy + OKRs session** — key result: establish a user base. Planned first channels: a reddit post + YouTube demo video played as a user, not as the founder. Positioning inputs: lead with schema diagnosis (belief-based diagnosis from decision data — verified novel; see `docs/research/RESEARCH_SCHEMA_TAXONOMY.md`); Table Reads gets a perceptual-learning evidence claim (`docs/research/RESEARCH_VILLAIN_TYPES.md`). Do NOT claim mental-game/tilt coverage (poker-literate audience will test it).

2. **Online playtester recruiting** — `PLAYTEST_BRIEF.md` has the copy-paste recruiting post, screener (3–4 novices / 5–6 casual / 2–3 studying; half on phone), and budget (~$525). 14-day daily-play protocol. Testers tagged by uid so their data stays separable from organic users. No mid-test regrades.

3. **Day-14 playtest analysis** — after the 14-day window closes, run `npm run playtest:personas -- --trials=10` (acceptance gate for any engine changes) and the PostHog/Supabase triage drill against tester cohort. Key questions: does the remediation queue drain for real players (F1 / Conflict-Avoider deferral), does session chaining signal the session-length is right, which scenarios get the most disagree flags.

4. **Intake triage — start of every session** (upgraded July 20 when the playtest link went public): Sentry dashboard → PostHog failure events → `scenario_feedback` SQL → `feedback` SQL. See `docs/operations/TRIAGE.md` for the full drill.

5. **SME self-grading status** — SME engagement stalled; founder self-grades via gameplay + disagree box. `docs/findings/SCENARIO_GRADING_FINDINGS.md` has 5 open judgment calls (sc_025/043/057/009/023). Don't send `scenario-review.csv` until the SME channel reopens.

6. **Session-length data-driven revisit** — SESSION_LENGTH=5 is a validated instinct, not a data-driven number. Decision rule: if PostHog chain rate (`session_started.chained`) stays persistently >~50%, argue for a bigger unit; if mid-session abandonment (`decision_made` count vs `session_completed`) >~15%, argue smaller. Revisit after day-14 playtest analysis.

7. **Coach eval:coach live re-run** — the voice-reframe prompt landed with dry-mode only. Before any deploy touching `api/coach-read.js`, run `CLAUDE_API_KEY=... npm run eval:coach` and judge 9 reads against the F5 bar (see `docs/architecture/ENGINES.md` §4).

8. **AdSense** — ON HOLD until real users exist. Code scaffolding dormant (no-op without `REACT_APP_ADSENSE_CLIENT`). When ready: create account, set env in Vercel, author `public/ads.txt`.

9. **Tester feedback — July 27 2026** (first live tester report; both items fixed same-day, follow-ups below).
   - ✅ **Mobile hand name printed through the felt rim.** At every width 320–414 the name rendered across the 3px gold border; the tester read "SIX-FIVE SUITED" as "Sive-five suited". Fixed by raising the felt's bottom inset 10% → 14% and giving 5px back between cards and name. Pinned by three guards in `e2e/mobilefold.spec.mjs` (clears rim / no ellipsis / within felt span) alongside the existing founder-approved hero-cluster contract.
   - ✅ **Odds notation was undecodable.** A tester hit "3.7:1" and read the decimal point as a second colon ("3:7:1"). The `Pot Odds` glossary entry defined the concept but never decoded the notation or the break-even conversion; both added in `VillainGuide.jsx`.
   - ⏳ **Follow-up — the glossary is a click away from the moment of confusion.** The number appears in a feedback panel mid-session; the decode lives behind the ⓘ. Options: link the first odds mention in `FeedbackPanel` to the guide's Pot Odds entry, or inline the break-even percentage next to the ratio in feedback text. The second is the higher-effect-size fix (F1: explanation quality is the top lever) but touches 100+ scenario `fb` strings — scope it deliberately rather than piecemeal.
   - ⏳ **Follow-up — audit rule for odds notation.** No `audit:scenarios` rule checks that a ratio in `fb` text is accompanied by its plain-language meaning. Worth adding once the format above is decided, so new scenarios can't reintroduce a bare ratio.
   - 💡 **Suggestion (for consideration) — a quiz mode for concepts like pot odds.** Tester proposal: a short drill format that teaches a concept directly, rather than relying on the player to infer it from per-hand feedback. Same root cause as the notation report above — the concept explanation currently lives behind the ⓘ, away from the moment of need.
     **Why it may be worth real weight:** the main loop scores decisions, so it cannot teach a concept cold without corrupting the skill ratings the whole rating engine stands on (the answer-until-correct ban, RESEARCH_LEARNING_SCIENCE.md F4). An UNSCORED drill mode is the explicitly sanctioned form of exactly this — the same carve-out already granted to a "replay this hand" study mode. It also lines up with F1: explanation quality is the highest-effect-size lever in the product.
     **Open questions before committing:** does it stay unscored and outside the rating engine entirely, or feed a separate concept-mastery signal? Is it a new mode alongside Table Reads, or a drill offered at the point of confusion (a "learn this" affordance on a feedback panel that cites pot odds)? Does concept coverage come from a new content file or derive from the existing `SKILL_NAMES` taxonomy? Decide with `/brainstorming` before any build — the scoring boundary is the load-bearing decision, not the UI.

10. **✅ FIXED 2026-07-27 — guest progress could be stranded by a surviving owner tag.** Surfaced by the `useGuest` extraction, then fixed once Wave 3 was committed (a refactor commit was the wrong place to change behaviour). `handleGuestPlay` called `saveUser` but never cleared `cr_user_owner`, so a guest session played over a still-tagged cache was invisible to the sign-in migration path — `cacheOwner()` truthy → `local = null` → progress dropped. Reachable via a no-session `INITIAL_SESSION` over a surviving tagged cache (`SIGNED_OUT` clears both keys).
    **Fix:** minting a fresh guest now clears the cache and its tag together. The owner tag is metadata ABOUT the cached profile; replacing the profile without dropping the tag leaves it describing a record that no longer exists.
    **Ratchets:** the assertion in `useGuest.test.js` flipped from pinning the gap to pinning the fix, and `useAuthSession.test.js` gained the receiving end — a pair asserting `handleCreateUser` migrates an untagged cache and refuses a tagged one. Both directions fail in opposite ways: dropping an untagged cache loses a real player's history, migrating a tagged one is the two-accounts-one-phone stats leak.

---

## Cohesion Audit Fix Waves (audit §7)

Sequenced in `docs/architecture/TARGET_ARCHITECTURE.md`. High-level order:

- **Wave 1 — ✅ DONE 2026-07-26 (`3dac2c4`):** `shuffle` → `random.js`, M2 copy → `copy.js`, Dashboard date formatters → `dates.js`, `dummyUser.js` delete + CLAUDE.md drift fixes (CA-035).
- **Wave 2 (after Wave 1):** Dashboard.jsx split → `src/components/dashboard/`; ScenarioCard.jsx split → `src/components/scenario/`.
- **Wave 3 — ✅ DONE 2026-07-27 (MOD-014 contexts deliberately skipped).** `App.jsx` 633 → 243 lines. Landed in order: MOD-001 (`userStorage.js` → six modules + re-export barrel, all 18 import sites untouched), `submitSession` (utils/session.js — the choke point Wave 4's trust boundary needs), `useSessionRun`, pure extractions `utils/deal.js` + `buildSessionDelta`, `useGuest`, `useAuthSession`.
  **The one shared piece:** `guestRef` is owned by `App` (the composition root), not by either hook — useGuest needs `authPhase` from useAuthSession, and useAuthSession's listener needs the ref, so either ownership creates a cycle. It also can't collapse into `authPhase === 'guest'`: the guest handlers write it synchronously, and a state read inside the listener closure lags by a render — which is the exact window the "guest stomped back to SignIn" bug lives in.
  **Ratchets left:** `useGuest.test.js` (12 cases) and `useAuthSession.test.js` (10 cases — the deferred-`setTimeout` deadlock workaround, `invalid_session` recovery, and the error-vs-noprofile split now have behavioural tests, not just the invariants pattern-match).
  **SKIPPED — MOD-014 contexts.** They existed to remove three hops of prop-drilling for `onVillainInfo`. With the real component graph in front of us, React context adds indirection and a re-render surface for no meaningful gain. Not deferred — declined.
- **Wave 4 — IN PROGRESS.** Re-sequenced by what each item actually blocks rather than shipped as one wave:
  - ✅ **Test expansion (CA-049 + CA-050) — DONE 2026-07-27.** The only pre-LAUNCH item. jest 398 → 433 (FeedbackPanel 33% → 96%, VillainGuide 62% → 96%, SignIn 75% → 100%); e2e 64 → 126 checks across 3 new specs (tablereads, villainguide, disagree).
  - ✅ **`events.js` registry (MOD-011 / CA-033) — DONE 2026-07-27.** Ahead of the paid playtest: 32 events were composed inline at 38 call sites, and a typo in a name is a silently empty funnel whose data cannot be re-collected.
  - ✅ **Scenario lazy-load (CA-014) — DONE 2026-07-28.** main.js **353.9 → 261.7 KB gzip (−26%)**; the 172-scenario library is now a 92.6 KB chunk fetched on the first deal instead of before the sign-in screen.
    Two extractions made it possible: `data/villains.js` (VILLAIN_LABELS — eight strings that pinned the whole pool, because VillainGuide renders eagerly) and the GENERATED `data/scenario-index.js` (23.9 KB — `schema.js` runs on the LOGIN path via db.js and needs only `correct` + each option's `val`/`cls`, not the prose where the weight is).
    Guarded by `npm run check:bundle` on two independent signals: main.js under a 280 KB ceiling, AND a `scenarios.*.chunk.js` still existing. Reverting to a static import trips both.
  - ✅ **Route-level code splitting (CA-022) — DONE 2026-07-28.** main.js **261.7 → 244.9 KB gzip**. TableReads (12.4 KB chunk — the component is 9 KB but owns the 39 KB observation pool, and it is an opt-in mode) and VillainGuide (4.9 KB — a modal behind a deliberate tap).
    **SessionSummary deliberately NOT split.** Every player who finishes a session needs it, and it renders at the results reveal; trading a stutter at that moment for ~4 KB gzip is a bad deal. Splitting by file size alone would have said otherwise.
    **Wave 4 bundle total: 353.9 → 244.9 KB gzip (−31%).**
  - ⏳ **Scenarios batch split (CA-034)** — authoring-conflict fix; do it with the next scenario batch.
  - 🅿️ **Trust boundary (CA-001 / CA-006 / CA-012) — PARKED until Pro is real.** P1, but abuse is self-only while the numbers are private; it blocks the leaderboard and purchasable Rebuys, neither of which exists.

P1 security items before Pro/leaderboard: CA-001 (client-writable integrity fields), CA-002 (CI permissions stanza), CA-006 (hostile localStorage seed), CA-012 (migrateUser shape validation). See full findings in `docs/audit/2026-07-25-cohesion-audit.md`.

---

## Backlog

### Feature backlog
- **Roulette mode** — two variants considered (pure spinner / variance teacher); both backlogged July 20.
- **"Train on your own hands"** — hand-ingestion pipeline; internal authoring tool first, then Pro differentiator.
- **Periodic meta-read** — synthesized "recurring patterns" read across last N Coach's Reads; one extra model call, Pro-tier post-launch.
- **Leaderboard** — friends-only; data shape preserved in `docs/architecture/DECISIONS.md`'s leaderboard entry (the reference file, `src/data/dummyUser.js`, was deleted as unused legacy content — recover via `git show 3dac2c4^:src/data/dummyUser.js` if needed).
- **Scenario generation tooling** — for Phase 1.6 pool scale-up; generation automates the cheap part, judgment-dense authoring stays manual.
- **Stripe / payment rails** — needed before Pro tier ships; no rails exist yet.
- **iOS Capacitor** — Phase 3; requires Apple dev account + web traction first.

### PRO backlog
- Table Reads mode (currently free during beta)
- Expert difficulty
- Deeper coach analytics + meta-read synthesis
- Purchasable Rebuys (natural extension of the earned-Rebuy mechanic)
- Table Reads fluency tracking (fast + correct = mastery signal, per `docs/research/RESEARCH_VILLAIN_TYPES.md`)

### Research-derived backlog
- **Tilt-signature instrument** (`docs/research/RESEARCH_SCHEMA_TAXONOMY.md`) — session-level detector: accuracy collapse + decisionMs shortening after a miss streak. Feeds Coach's Read, NOT the schema card. Self-report channel; keep tilt out of the diagnosis engine.
- **Table Reads fluency tracking** (`docs/research/RESEARCH_VILLAIN_TYPES.md`) — perceptual-learning mastery = fast + correct; track response-time mode-local; Pro analytics candidate.
- **Skill-side schema v2** — re-anchor Results Thinker on observable signature (remediation-resistance or confident-miss density); extend `classifyDirection` with bet-sizing sub-axis; score skills relative to player's own mean. Spec inputs: `docs/research/RESEARCH_SCHEMA_TAXONOMY.md` + `docs/findings/PERSONA_PLAYTEST_FINDINGS.md` F2b. Requires real per-skill distributions (post-launch Supabase data).

---

## Standing artifacts

Long-lived Claude artifact URLs. These are not auto-updated — when the underlying document changes, the artifact must be manually republished.

| Artifact | URL | Republish trigger |
|---|---|---|
| 30-day launch playbook (checklist, owner tags, revenue math) | https://claude.ai/code/artifact/95b9614a-3b88-4dcc-882f-b6d7da35615a | If the launch timeline or revenue model changes significantly |
| Gameplay layout design-review history (iterations 1–4) | https://claude.ai/code/artifact/fb6322e6-ca47-4eee-b1f4-85a6a453962c | Historical reference; republish not required |
| Founder's briefing (depth dossier — mirrors `FOUNDER_BRIEFING.md`) | https://claude.ai/code/artifact/e8b83615-4edd-472e-81e7-d238befcf0d5 | **Republish whenever `FOUNDER_BRIEFING.md` changes** — this is a standing maintenance obligation |

The founder's briefing artifact is the one with an active obligation: it is used for Q&A rehearsal and investor/mentor prep, so it must stay current with the repo-root `FOUNDER_BRIEFING.md`.

## Monetization (current decision)

Launch free, no ads. Pro tier via subscription when scope is locked. Headline from `docs/research/RESEARCH_SUBSCRIPTION_MARKET.md`: $9.99/mo · $49.99/yr single tier; free tier keeps the habit loop; Pro = Table Reads + Expert + deeper coach/analytics; freemium converts ~2.1–2.3% of downloads. The coin-economy idea (July 5) is permanently rejected.

---

## Open decisions awaiting the founder (as of 2026-07-27)

Recorded here rather than lost in a chat log. Each one is blocked on a judgement
call, not on work.

1. ~~**Collapse `UsernameEntry`?**~~ **RESOLVED 2026-07-27 — keep the screen.**
   A new signed-in user passes two screens before the dashboard: SignIn, then
   pick-a-display-name. Guests skip the second entirely. Three reasons the
   screen stays:
   - It is not a name field, it is the only exit from `authPhase === 'noprofile'`.
     `onSwitchAccount` (`App.jsx:256`) is the sole route back to SignIn from that
     state, and it exists because the founder was walled in with a dead session
     live on July 6. The screen also hosts the pre-Supabase history migration
     hand-off (`const local = cacheOwner() ? null : loadUser()`, `App.jsx:201`).
     Collapsing forces both to be re-homed, and the escape hatch has nowhere to go.
   - The display name is identity-bearing (dashboard) and is the handle a
     friends-leaderboard would use. An email-derived `dc93olson` is a worse first
     impression than a three-second autofocused field.
   - The cost is one field, once per account lifetime, **after** the user already
     cleared the real funnel gate (magic link / OAuth). Sign-in is where people
     leave; a name prompt behind an authed wall is not the leak.

   **Correction to the original framing:** this entry previously claimed
   collapsing "requires relaxing or waiving the first rename." It does not. The
   DB trigger (`supabase/schema.sql:130–150`) leaves `username_changed_at` null
   after INSERT and only starts the clock on the first *update*, so the first
   correction is already free. The real trap is narrower: a **typo in that
   correction** locks the player out for seven days. Don't re-price this option
   as needing a schema change.

   **Cheap alternative if funnel friction ever needs attacking:** prefill the
   input with a sanitized suggestion from the email local-part, making the screen
   one tap instead of typing. `defaultName` already exists (`App.jsx:305`) for the
   local-cache case. No schema change, no cooldown exposure, migration and escape
   hatch untouched. Not built — deliberately available.

2. **`sc_098`: is `call` graded too harshly?** It is `incorrect`; with position
   and 100bb, calling QJs vs a nit's UTG open is defensible enough that
   `partial` may fit. NOT changed — ROADMAP item 2 forbids mid-test regrades,
   and grading is founder/SME territory. Note this is the **same pattern** as
   the existing L2 finding on `sc_009` in `SCENARIO_GRADING_FINDINGS.md`. Two
   independent instances make it a policy question: *when is a
   defensible-but-inferior line `partial` rather than `incorrect`?*

3. **18 unverified domination claims** across 14 scenarios, listed in
   `SCENARIO_GRADING_FINDINGS.md`. Grandfathered by content hash in
   `audit:scenarios`, so only new or edited claims warn. `sc_098` proved the
   failure mode is real, not theoretical.

4. **Wave 3 finish or stop** — see the wave list above. Not a Pro prerequisite.

5. **Wave 4 scope, when Pro is real.** The trust boundary (CA-001/006/012) is
   MANDATORY before any leaderboard or purchasable Rebuys: `db.js:228` writes
   `streak`, `rebuys` and `poker_score` from the client, which is harmless for
   private stats and trivially forgeable the moment they are competitive or
   paid. Payments/Stripe is in NO wave and is likely the largest unknown.
   Bundle/lazy-load is wanted on UX grounds (354 KB gzip, scenarios eager).
