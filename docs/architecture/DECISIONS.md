# CheckRaise — Do-Not-Reverse Decisions Ledger

**Read this when:** deciding whether a design choice is reversible; onboarding to why the codebase is shaped the way it is; evaluating a proposed change that feels like it contradicts something that already exists.

Every entry: **Decision** · date (where known) · rationale (the WHY) · *Revisit if:* (what has to change first).

---

## Architecture

**React web app (Create React App), iOS via Capacitor later.**
Phase 1–2. The product needed to ship fast; CRA gives a tested pipeline. iOS is Phase 3 — deferred because it requires the $99 Apple dev account and adds nothing until web traction exists.
*Revisit if:* Phase 3 begins or a developer joins who prefers a different bundler and can absorb the migration.

**Supabase for backend (PostgreSQL + auth + row-level security).**
Phase 2 (July 2026). Chosen over Firebase for the relational model (skills, sessions, profiles have foreign keys; SQL queries drive the triage workflow) and for Supabase's built-in RLS — every table gets RLS + explicit policies, enforced by invariant rule 8 (`rls`).
*Revisit if:* a developer joins with a strong Firebase preference AND the schema is still simple enough to migrate before launch.

**All display values are derived live from the append-only `sessions` log — never stored as display values.**
Phase 2 (July 2026). Skills, streak, Poker IQ, schema, coach-read history, direction tally, scenario history: all rebuilt from `sessions.hands` on every `fetchRemoteUser`. Consequences: self-healing across devices, zero-migration engine upgrades, retroactive intelligence when the diagnosis improves.
*Revisit if:* the derivation cost becomes measurable in prod (post-scale); even then, prefer a materialised-view cache, not a stored field.

**Supabase client created only in `src/utils/supabase.js`.**
Phase 2 (July 2026). Single-file ownership prevents scattered client configurations. Enforced by invariant rule 1 (`supabase-client`).
*Revisit if:* never — even new screens must import the client from this file.

**All Supabase reads/writes live only in `src/utils/db.js`. Table names must be string literals.**
Phase 2 (July 2026). All DB access in one file means auth, RLS, and error handling stay consistent. Dynamic table names would allow generic helpers that launder variable names past the rule. Enforced by invariant rule 2 (`db-access`).
*Revisit if:* never.

**PostHog called only from `src/utils/analytics.js`.**
Phase 2 (July 2026). Single-file ownership means the no-op guard (absent `REACT_APP_POSTHOG_KEY`) is in exactly one place; components call `track()`/`identify()` from this file. Enforced by invariant rule 3 (`posthog`).
*Revisit if:* never.

**Sentry called only from `src/utils/sentry.js`, imported first in `index.js`.**
July 2026. Same single-file pattern. Init before any other code so crashes in early startup are captured. Enforced by invariant rule 10 (`sentry`).
*Revisit if:* never.

**Claude API called only from `api/coach-read.js` (server-side Vercel function). Client code goes through `src/utils/claude.js` → `/api/coach-read`.**
Phase 1. The `CLAUDE_API_KEY` must never reach the browser. Enforced by invariant rule 4 (`secrets`).
*Revisit if:* never.

**AdSense touched only by `src/utils/ads.js` and `src/components/AdSlot.jsx`.**
July 2026. Placement is dashboard-bottom and summary-bottom only — never the decision screen. Total no-op without `REACT_APP_ADSENSE_CLIENT`. Enforced by invariant rule 5 (`adsense`).
*Revisit if:* AdSense launches (set the env var); a new placement requires adding it to `AdSlot.jsx`, not scattering ad code.

**No `await` inside `onAuthStateChange` callbacks. Defer with `setTimeout(async () => {…}, 0)`.**
July 2026. Supabase-js holds its auth lock during the callback; async calls that need that lock deadlock intermittently ("stuck on Shuffling up…" bug). Enforced by invariant rule 6 (`auth-deadlock`).
*Revisit if:* Supabase changes this behaviour in a named release.

**`createRemoteProfile` upserts must use `ignoreDuplicates: true`.**
July 2026 (auth-hardening sprint). The create path is reachable by players who already have a profile (any state landing on UsernameEntry). A plain upsert would zero their stats. Enforced by invariant rule 9 (`create-no-clobber`).
*Revisit if:* never.

**`.env` must never be committed. No uppercase in `public/` paths.**
Standing rule. Tracked env files expose keys; uppercase paths cause prod 404s on Vercel (macOS hides case-only renames, July 2026 icon bug). Enforced by invariant rule 7 (`env-tracked`, `case-sensitivity`).
*Revisit if:* never.

**RLS enabled + at least one policy on every Supabase table.**
Phase 2 (July 2026). Without RLS, any authenticated user can read all rows. Enforced by invariant rule 8 (`rls`). New tables must run their schema block in the Supabase SQL editor before the deploy that uses them (gate 5 in Definition of Done).
*Revisit if:* never.

**Google Fonts links must use the async media-print swap pattern.**
July 2026. A blocking stylesheet link adds ~790 ms to mobile first paint. Enforced by invariant rule 11 (`fonts-async`).
*Revisit if:* Google Fonts is dropped entirely for a self-hosted font.

**`vercel.json` is zero-config (framework: create-react-app). The legacy `builds`/`routes` format is deleted.**
July 2026. The legacy format silently broke `/api` routing — the Coach's Read endpoint 404'd in prod for weeks and the graceful fallback hid it. Zero-config auto-mounts `api/` correctly.
*Revisit if:* a custom route is needed that zero-config cannot express.

---

## Product / Gameplay

**Session length = 5 hands.**
Phase 1 design instinct, deliberately unvalidated. Defense: chaining makes it a unit not a cap; the streak habit loop wants a ~2–4 min ask; more sessions = more replay slots. The deciding data is behavioral — `session_started.chained` rate and mid-session abandonment from PostHog. Decision rule already written: chain rate persistently >~50% argues for a bigger unit; abandonment >~15% argues smaller.
*Revisit if:* the 14-day playtest cohort produces post-hoc behavioral data meeting those thresholds.

**Dashboard is the entry point screen (`screen === 'dashboard'`), not DifficultySelector.**
Phase 1.5. The dashboard surfaces the player's full state (streak, skills, schema, coach notebook) before asking them to commit to another session. Reversing this removes the retention-driving state display.
*Revisit if:* A/B data shows players skip the dashboard and funnel engagement drops.

**Guest-first SignIn (deferred-signup pattern). Primary CTA = "Play a Free Session →"; sign-in stack hides behind "Already have an account? Sign in".**
July 25, 2026 (founder decision). Consumer-trainer convention (Duolingo-style): get the visitor into the product, ask for the account after value is demonstrated. Funnel already captures `guest_play_clicked` vs `sign_in_link_sent` for cold-traffic validation.
*Revisit if:* funnel data from the reddit/YouTube push shows guest conversion is not improving sign-in rates.

**One free guest session, then a sign-in gate. Guest progress migrates into the account on first sign-in.**
July 2026. The trial must not be wasted data (guest profile shape is identical to an auth'd profile; `createRemoteProfile` migrates local `scenarioHistory`). The 1-session limit prevents indefinite free use without a Supabase profile.
*Revisit if:* conversion data shows the gate fires too early.

**Sessions are dealt by the spaced-rep v2 session builder (`src/utils/spacedrep.js`), not pure random.**
July 2026. Unseen first, 2 weak-skill slots, graduation ladder (R1), calendar-day floor (R2), surge slot (F1 fix), confident-miss priority (F2), contrast pairs adjacent (R4). The pedagogy is in the dealer.
*Revisit if:* any individual mechanism — see the specific R/F labels in CLAUDE.md — should be touched only after reviewing its research basis and re-running `npm run playtest:personas`.

**Graduation ladder: GRADUATION_TARGET_FIRST = 2 spaced corrects, GRADUATION_TARGET_REPEAT = 3. Ladder intervals [2, 5, 13]. These are spec-fixed inside the evidence range — do not widen.**
July 2026 (R1/F1). From hypercorrection-relapse research; winding the target higher has no evidence support and slows queue drain. The interval spacing is within the 2–3-spaced-retrievals evidence window.
*Revisit if:* real per-user miss-rate data from the playtest cohort shows the ladder is structurally under- or over-tight.

**Per-hand `scenarioId` in `sessions.hands` is load-bearing (history rebuilds from it).**
July 2026. Do not remove this field from any `hands` entry. Pinned by integration test.
*Revisit if:* never.

**Max 2 preflop-street hands per 5-hand session (soft cap — yields when pool leaves no choice).**
July 8, 2026 (founder decision). Without the cap, weak preflop/position skills drove sessions to ~50% boardless preflop spots, collapsing variety.
*Revisit if:* the pool grows large enough that the cap never binds.

**`CONTRAST_PAIRS` cross-difficulty mirrors are INERT (comment-only, never map entries).**
July 2026 (R4). One pool per difficulty; co-dealing is impossible. Documenting them as map entries would mislead future authors.
*Revisit if:* the pool is reorganized to share a unified cross-difficulty dealing path.

**Timer = 60 seconds, hardcoded.**
Phase 1. Move server-side in Phase 2 (prevents client-side tampering with the timer value).
*Revisit if:* Phase 2 server-side enforcement is scoped.

**One live Claude API call per session (Coach's Read). 5 calls/user/day, server-enforced. Free allowance launches at its long-term level.**
July 18, 2026. Cap lowered 20 → 5 to match the long-term free-tier level, so a future Pro tier never takes anything away from existing free users (subscription-research finding).
*Revisit if:* Pro tier ships with a higher limit, in which case free stays at 5 and Pro unlocks more.

**Coach's Read voice = session-scoped field notes, not trait verdicts.**
July 22, 2026 (founder decision). Five hands cannot honestly support "you are too passive." The per-session read is an observation log entry; the Coach's Notebook accumulates longitudinal patterns; a Pro-tier meta-read is the diagnosis-weight feature. Prompt rules: every claim scoped to the session; identity claims banned ("you are a…", "you always…", "your game…").
*Revisit if:* the meta-read (Pro backlog) ships and the prompt is redesigned around a longer window.

**Coach's Read output is structured JSON (headline / evidence[] / watchFor), schema-constrained at the API level. Wire format unchanged (`{ text: string }` carrying a JSON string).**
July 18, 2026. Structured output enables targeted rendering (headline strip in the dashboard notebook, evidence rows in the summary). `parseCoachRead` in `userStorage.js` handles both structured and legacy prose gracefully.
*Revisit if:* the structured schema needs additional fields — extend via the schema object, never bypass `parseCoachRead`.

**Re-run `npm run eval:coach` after ANY prompt or model change. Nine synthetic personas, six-point quality bar + mechanical checks.**
July 2026 (eval-workflow rule). The harness caught invented hand details and solver language in round 1. It is the trust mechanism for a live AI call; skipping it is a process failure.
*Revisit if:* never.

**XP system removed entirely. Streak is the sole engagement metric.**
Phase 1.5 (founders decision). The overjustification literature: extrinsic rewards (points, badges as currency) erode intrinsic motivation. Earned moments (quiet gold 5/5, personal best) are understated on purpose. The Rebuy is the one borrowed mechanic — named into the product's world, earned not purchased (at launch).
*Revisit if:* retention data post-launch shows streak alone is insufficient and a specific mechanic is proposed with an evidence basis.

**Skill ratings and schema diagnosis stay lifetime-based. Only the Poker IQ display is recency-weighted (last 8 hands per rated skill, min 8 samples).**
July 18, 2026 (F3). The ledger and schema deliberately measure the whole record. Only the IQ is a "pulse" — recency window swept at 5/6/8/20 hands; 8 gave honest trend-tracking with the lowest session-to-session volatility (~1.4 mean |ΔIQ|/session vs ~2.1 at 6). `MIN_RECENT_HANDS` and `RECENT_WINDOW` are independent knobs — do not collapse them.
*Revisit if:* the skill-side diagnosis v2 (relative-weakness model) ships and the IQ formula is redesigned alongside it.

**`deriveSchema` is a hybrid engine: direction schemas (Conflict Avoider, Gambler, Overaggressor) scored from direction-of-error tally; skill schemas (Positional Blind Spot, Results Thinker, Exploitable Regular) scored from absolute skill weakness. Highest severity wins.**
July 18, 2026. Engine v1 (accuracy-only) labeled a passive player "The Overaggressor" 2/10 trials. Direction scoring eliminated all opposite-direction labels (verified zero across 15 trials). The calibration uses excess-over-computed-baseline, not a flat threshold.
*Revisit if:* the skill-side v2 (relative-weakness, Results Thinker re-anchor, bet-sizing sub-axis) is scoped — those changes touch the skill schemas only, not the direction scoring.

**`SCHEMA_MIN_SEVERITY = 1.25`. Below this, fallback to Balanced Player or Student of the Game (majority rated skills green → Balanced; otherwise → Student).**
July 2026. A named schema must require a genuinely strong signal. "Student of the Game" was added July 19, 2026 (founder) because "no single leak dominates" at 52 IQ with 7 yellow skills reads as false reassurance.
*Revisit if:* real per-player data shows the threshold is misfiring systematically.

**Table Reads mode uses mode-local scoring only. No writes to the 8-skill ratings.**
July 18, 2026 (founder decision). Keeps a future Pro gate clean; the mode's lifetime tally lives in `cr_table_reads_stats` localStorage.
*Revisit if:* Pro-tier scoping decides to credit Reads/Opponent skill from Table Reads answers.

**Situation ticker derives only provable facts from structured fields. Authored `actionHistory` overrides derivation.**
Phase 1.5. The ticker must never guess unknowable history. Postflop relation line splits preflop (seat-index) and postflop (POSTFLOP_ORDER) — they are different facts.
*Revisit if:* never; extend `actionHistory` authoring instead.

**`scenario.question` is never displayed.**
Phase 1 (founders decision). Considered redundant with the body. Content that isn't displayed at decision time must not be decision-relevant (the C1 comprehension finding: decision-relevant context goes in `tableContext`, which renders at decision time).
*Revisit if:* founder review decides `question` should render somewhere specific.

---

## Content / Copy Voice

**Feedback text must explain WHY (price, position, villain type) — never restate or dress up the action taken.**
Phase 1 / July 2026 (reaffirmed from learning-science research). Elaborated feedback = ES 0.49 vs 0.05 for bare grades — ~10× the learning effect. Explanation quality is the product's highest-leverage feature. Tell the SME this too: a right grade with a weak explanation is still a defect.
*Revisit if:* never weaken; only strengthen.

**Per-hand grading labels use "Recommended" and "Recommended Play", never "Correct".**
July 6, 2026 (founder decision, honest-labeling pass). Exploitative spots are judgment calls; "correct" overclaims certainty. The one-tap Disagree box exists precisely because these are defensible plays, not math proofs.
*Revisit if:* never. The honest-labeling posture is a slow-build trust signal with a professionally skeptical audience.

**Running scores and tallies say "correct" (score line "N / 5 correct", in-session "N correct"). This is not an honest-labeling violation.**
July 8, 2026 (founder decision, counter language). The honest-labeling rule applies to per-hand grading claims, not running accuracy tallies. "Recommended plays" wording was tried and rejected as bureaucratic.
*Revisit if:* never.

**Pre-written per-hand feedback is static (no API call). Only the Coach's Read is live AI. Label it "Hand Analysis", not "AI Analysis".**
July 6, 2026 (founder decision). Per-hand feedback is authored, instant, and deterministic. "AI Analysis" implies a live call that doesn't happen and creates false AI labeling (AdSense reviewers flag this). The Coach's Read keeps its name because it IS a live call.
*Revisit if:* per-hand feedback ever becomes a live call (a major architectural change requiring rethinking the cost model).

**Every resurfaced miss carries a visible "↩ You missed this one before" chip. Replays are never silent.**
July 2026. Honest labeling of the spaced-rep mechanism. Players must know they are being re-tested, not seeing new content. A silent re-test corrupts trust when the player notices.
*Revisit if:* never.

**Option labels (not raw values) display in the Recommended Play row. Raw `val` keys are data, never shown.**
July 6, 2026 (honest-labeling pass). When authoring scenario options, remember the label renders in the recommended-play row — author it to read correctly in that context.
*Revisit if:* never.

**Do not reuse "Deal Me In" on SignIn — it is the dashboard CTA and a jest matcher.**
July 25, 2026 (noted during guest-first SignIn build).
*Revisit if:* the dashboard CTA is renamed.

**SME engagement path changed: founder self-grades via gameplay + the Disagree box triage pipeline.**
July 20, 2026 (founder decision). The planned external SME review stalled. The disagree box + `scenario_feedback` table is the live capture mechanism. sc_098/M10 was the first live cycle.
*Revisit if:* an SME is engaged and `scenario-review.csv` + `SCENARIO_GRADING_FINDINGS.md` are sent together.

---

## Monetization

**Launch free with no ads. Monetize via subscription (Pro tier). Coin/session economy is dead.**
July 18, 2026 (founder decision, revised). AdSense deferred until the product has real users — the banking/LLC/legal overhead is not worth it pre-traction. Ad scaffolding (`ads.js`, `AdSlot`, two dormant placements) stays harmless without `REACT_APP_ADSENSE_CLIENT` — do not set it. Coin economy idea (July 5) is permanently rejected — see REJECTED section.
*Revisit if:* real users exist and the founder decides the AdSense overhead is worth it; even then, set only `REACT_APP_ADSENSE_CLIENT` first (passes review, renders no ads) before adding slot IDs.

**Pro tier = Table Reads mode + Expert difficulty + deeper coaching (meta-read, hand ingestion). Single tier: $9.99/mo · $49.99/yr.**
July 18, 2026 (subscription research finding). Freemium converts ~2.1–2.3% of downloads → size user-base OKRs in thousands. Free tier launches at its long-term limits (5 coach reads/day) so Pro never takes anything away.
*Revisit if:* user-base data changes the conversion math; the single-tier model is research-backed and should not be split without evidence.

**Go Pro button = demand instrument. Shows "Coming soon ✨" and fires `go_pro_clicked`. No dead/grayed UI.**
July 2026. The funnel measures Pro-tier demand before it ships. Wire a real upgrade flow here when Stripe is integrated.
*Revisit if:* Pro tier launches.

---

## Engineering Practice

**`npm run check:invariants` runs after EVERY code change. Exit code 1 on any ERROR = red build.**
Standing rule (gate 1 in Definition of Done). Prose rules drift; exit codes don't. When a new "never do X" or "only file Y does Z" rule is established, encode it in `scripts/check-invariants.mjs` in the same session.
*Revisit if:* never.

**Every bug ever found becomes a permanent mechanical check in the same session it is fixed.**
Standing rule (the ratchet law). A fix that leaves no check behind is a process failure, not a fix.
*Revisit if:* never.

**AI review runs only on diffs, never as scheduled sweeps of the whole codebase.**
July 19, 2026 (proactive bug net, token-efficiency rule). The always-on layer is deterministic (CI, e2e, auditors, simulators). Nightly/scheduled LLM sweeps are deliberately NOT part of the system — see REJECTED section.
*Revisit if:* never; add to the deterministic layer instead.

**`npm run e2e` requires `npm run e2e:build` first (localStorage-mode build). The suite uses geometry guards (element dimensions + overlap assertions), not screenshot diffing.**
July 2026. Screenshot diffing is flaky and rots; geometry assertions catch the class of bug where the table renders as a vertical line while all functional tests stay green (the sc2-table width:100% incident, July 18, 2026).
*Revisit if:* Playwright upgrades break the geometry assertion API; even then, replace with equivalent assertions, not screenshot diffing.

---

## What to Never Do

> These rules are law. They are quoted verbatim from CLAUDE.md. The invariant rule number that mechanically enforces each one is noted; "prose-only" means no mechanical check yet exists — these are ratchet candidates.

- Never hardcode the Claude API key — use the `CLAUDE_API_KEY` env variable (server-side only, set in Vercel) — **invariant rule 4 (`secrets`)**
- Never call the Claude API from any file except `api/coach-read.js` — client code goes through `src/utils/claude.js` — **invariant rule 4 (`secrets`)**
- Never expose the API key to the browser (no `REACT_APP_`-prefixed key variables) — **invariant rule 4 (`secrets`)**
- Never add `tag` or `villain.label` fields back to scenario objects — they're derived at runtime — **prose-only**
- Never use shorthand card notation (KQs, 98d) — always use suit symbols — **prose-only** (audit:scenarios catches shorthand in authored content; not enforced in src/)
- Never add Tailwind to existing Phase 1 CSS — only on new screens if adopted — **prose-only**
- Never modify `scenarios.js` for UI work — it's content, not layout — **prose-only**
- Never commit `.env` to GitHub — **invariant rule 7 (`env-tracked`)**
- Never add answer-until-correct / re-attempt to the SCORED main loop — it corrupts the skill-accuracy ratings the whole rating engine stands on (RESEARCH_LEARNING_SCIENCE.md F4). An unscored "replay this hand" study mode is the acceptable form. — **prose-only**
- When authoring scenario feedback text: the fb must explain WHY (price, position, villain type) — never just restate or dress up the action taken. Explanation quality is the highest-effect-size lever in the product (F1). — **prose-only**
- Never `await` Supabase (or any async) calls inside the `onAuthStateChange` callback — supabase-js holds its auth lock during the callback and authed calls need that lock, so it deadlocks intermittently (the "stuck on Shuffling up…" bug, July 2026). Defer with `setTimeout(async () => {...}, 0)`. — **invariant rule 6 (`auth-deadlock`)**

---

## REJECTED — On the Record

These were considered, debated, and explicitly rejected. Record them so future sessions do not re-propose them without new evidence.

**Coin / session economy** (July 18, 2026). "5 free coins/day, 1 coin/session" — proposed July 5, killed July 18. Reason: fights the habit loop; the overjustification literature validates holding the no-XP/no-coins instinct; payment rails don't exist yet; conflicts with "unlimited daily play" positioning.

**Ads-first monetization** (July 18, 2026). Rejected in favour of subscription. Reason: banking/LLC/legal overhead before traction; code scaffolding stays dormant, not removed.

**B2B scenario licensing ("sell scenario-sourcing to competitors")** (July 19, 2026). Considered as a revenue stream. Reason: tiny buyer set, upside-down IP positioning, directly arms competitors.

**Roulette mode — Variant A (pure spinner)** (July 20, 2026). Proposed as a top-right minigame. Reason: no lesson, cuts against the skill-not-luck identity ("The Gambler" is a diagnosed leak), gambling-classification optics risk with app stores and payment processors. Backlogged, not scheduled.

**Roulette mode — Variant B (variance teacher)** (July 20, 2026). Same interaction but narrates the EV lesson (no selection pattern beats the edge). Reason: better than A but still a distraction from the core loop at this stage. Backlogged pending traction.

**Nightly / scheduled LLM sweeps** (July 19, 2026, proactive bug net). Rejected in favour of deterministic always-on layers. Reason: token cost, false confidence — the ratchet law + CI + auditors are the always-on bug net; model review runs on diffs only.

**FSRS / SM-2 per-item ease factors** (July 2026, R3). Rejected in favour of the fixed graduation ladder. Reason: at a ~170-scenario pool, a fixed ladder performs within noise of adaptive scheduling and is enormously more debuggable. Revisit post-scale with real miss-rate distributions.

**Answer-until-correct / re-attempt in the scored main loop** (standing rule, reinforced July 2026, RESEARCH_LEARNING_SCIENCE.md F4). Reason: corrupts the skill-accuracy ratings the entire rating engine stands on. An unscored study mode is the acceptable form if ever needed.

**Schema diagnosis score-margin knob, rated-only-skills scoring, unlock-at-8-sessions** (July 2026, simulation tuning). All three were tested in `simulate:schemas` and rejected. Reason: score-margin created false ties; rated-only changed unlock timing without diagnostic benefit; 8-session unlock moved the bar without evidence. `SCHEMA_MIN_SEVERITY = 1.25` and the 10-session early-read chip are the calibrated survivors.

**A seventh "Tilt" schema** (standing rule). Reason: tilt is diagnosed by self-report in the literature; the engine only claims what decisions can show. The tilt-signature instrument (behavioral, feeding the coach) is the roadmap-honest version, not a schema label.

**Leaderboard (public / global)** (deferred to post-launch). Not rejected, but explicitly excluded from Phase 2 scope. Friends-only variant + `isUser` row highlight is the intended shape; data structure preserved in `dummyUser.js`.

---

*Maintained by: update this file in the same session any entry changes. If a decision is reversed, move it to a "Reversed" section with the date and the reason — don't delete it.*
