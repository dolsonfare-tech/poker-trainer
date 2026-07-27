# CheckRaise — Product Roadmap

> **Read this when** you need the current-truth picture of what's shipped, what's in flight, and what comes next. For the WHY behind decisions see `docs/architecture/DECISIONS.md`. For the technical end-state of the engines see `docs/architecture/ENGINES.md`.

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

---

## Cohesion Audit Fix Waves (audit §7)

Sequenced in `docs/architecture/TARGET_ARCHITECTURE.md`. High-level order:

- **Wave 1 — ✅ DONE 2026-07-26 (`3dac2c4`):** `shuffle` → `random.js`, M2 copy → `copy.js`, Dashboard date formatters → `dates.js`, `dummyUser.js` delete + CLAUDE.md drift fixes (CA-035).
- **Wave 2 (after Wave 1):** Dashboard.jsx split → `src/components/dashboard/`; ScenarioCard.jsx split → `src/components/scenario/`.
- **Wave 3 (after Wave 2):** App hooks extraction (`useAuthSession`, `useGuest`, `useSessionRun`); `userStorage.js` split into six modules; prop-drilling contexts.
- **Wave 4 (after Wave 3):** `events.js` typed emitters; scenarios batch split + lazy-load; trust-boundary Postgres functions (required before leaderboard or purchasable Rebuys); test expansion (VillainGuide, DisagreeBox, TableReads e2e).

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
