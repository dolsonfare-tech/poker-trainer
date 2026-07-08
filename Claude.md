# CheckRaise — Claude Context File

> Read this before touching any code. It explains what's been built, why decisions were made, and what to do next.

---

## What This Is

CheckRaise is a Texas Hold'em skill trainer that identifies your specific weaknesses and coaches you like a human would — not a textbook. Live at **checkraise.ai** (Vercel, React).

The core moat: personalization + spaced repetition + opponent modeling + schema diagnosis. No major competitor does all four.

---

## Definition of Done — pass these gates before declaring ANY change complete

These apply to every model working in this repo, every session. If a change can't satisfy a gate, say so explicitly — never weaken or skip a check to get green.

1. **`npm run check:invariants`** — after EVERY code change. Mechanically enforces the "Key Decisions" and "What to Never Do" rules: single-file ownership (Supabase client/reads/writes, PostHog, AdSense, Anthropic, Sentry), no server secrets in client code, RLS + policies on every table in `schema.sql`, no tracked `.env`, no uppercase paths in `public/`, no async `onAuthStateChange` callback.
2. **`CI=true npm test`** — jest suite, after every code change.
3. **`npm run audit:scenarios`** — if `scenarios.js` or `constants.js` was touched (content consistency: pots, cards, gradings).
4. **`npm run simulate:schemas`** — if `deriveSchema` or the rating engine was touched (exits 1 on structural diagnosis bias).
5. **New Supabase table?** It goes in `supabase/schema.sql` with RLS enabled + explicit policies (gate 1 fails otherwise), and flag to the user that the block must be run in the Supabase SQL editor BEFORE the deploy that uses it.
6. **New load-bearing decision?** If it's an invariant (a "never do X" or "only file Y does Z"), encode it as a rule in `scripts/check-invariants.mjs` in the same session you document it — prose rules drift, exit codes don't.

---

## Phase 1.0 — COMPLETE

- 83 scenarios built and structured
- Core gameplay loop (scenario → feedback → summary) working
- SME review of scenario gradings still needed (carry forward)
- Both founders to play through 10+ times each (carry forward)

---

## Current Phase: 2 — Launch Build (July 2026, targeting early-August go-live)

**▶ NEXT SESSION — start here (written July 5, end of the infra sprint — PostHog/Google/Resend all landed in one session):**
1. **Waiting on external clocks, check status first:** AdSense — account NOT yet created (user resolving the LLC question first); code side DONE July 5 (see Week 4 line) — when the account exists: set `REACT_APP_ADSENSE_CLIENT` in Vercel (connects the site for review; nothing visible renders until slot IDs are also set) and author `public/ads.txt` (`google.com, pub-XXXX, DIRECT, f08c47fec0942fa0`) · Google brand verification (submitted July 5, 2–5 business days; approval makes the consent screen say "CheckRaise" + logo instead of the raw supabase.co domain — **cosmetic only; Google sign-in is already LIVE in prod**, `REACT_APP_GOOGLE_AUTH=1` flipped in Vercel July 5).
2. Week 3 queue: pot/bet-size pass **DONE July 5** — auditor now recomputes preflop pots (`potpre` rule); 5 wrong pot fields fixed (sc_006/034/036 → $29, sc_065 → $39, sc_079 → $9). Founder decisions made July 5: **sc_012 regraded** (was a hidden tournament-25BB shove spot — `question` isn't displayed, so players saw a cash game where "shove K9s" graded correct; now a standard $6 BTN steal, pot $3) · **sc_011 open resized** $15 → $6 (pool standard) · **pot-field convention kept as-is**: preflop pot INCLUDES the live raise, postflop pot EXCLUDES the live bet — all X:1 odds text is consistent with this; follow the street's convention when authoring new scenarios. **Full grading audit DONE July 5** (`SCENARIO_GRADING_FINDINGS.md`): all 83 scenarios reviewed — 4 high-severity gradings fixed (sc_024/054/056/064, founder-approved) + 15 text corrections; **5 judgment calls remain for the SME** (sc_025, sc_043, sc_057, sc_009, sc_023 — detailed in the findings doc). Send the SME `scenario-review.csv` (`npm run export:review`) TOGETHER with SCENARIO_GRADING_FINDINGS.md. Audit lesson: check the undisplayed `question` field and re-verify any stated out-counts/draw types against the printed board — that's where 5 of the errors hid. sc_028's wrong feedback (found by founder playthrough July 5) was the proof this review mattered.
3. Check PostHog now that data flows: funnel events, `coach_read_failed` (should be zero), `go_pro_clicked` (Pro-tier demand signal).

Phase 1.5 closed July 2026. Strategic-question status: **monetization answered** (free + ads at launch, ~$500/mo ≈ 200 DAU milestone; Pro tier later — Table Reads mode + Expert difficulty are candidates). **Poker IQ mechanics answered** (true-accuracy rating engine in `constants.js`; the display formula in `derivePokerScore` still bucket-based — refine post-launch). Schemas/skills questions: deferred to founders review, not launch-blocking.

**Live in production now (week 1 done in one day):**
- Supabase auth (email magic link live; **Google sign-in LIVE in prod** — `REACT_APP_GOOGLE_AUTH=1` flipped in Vercel July 5. The flag still gates the button because `signInWithOAuth` navigates before erroring, so an unconfigured provider would show a raw 400 page — keep it set wherever the provider is configured)
- profiles/skills/sessions/coach_usage tables, RLS everywhere, localStorage migration on first sign-in
- Coach endpoint locked: requires signed-in user, 20 calls/user/day (`coach_usage`), $50/mo Anthropic cap set
- Streak warning banner (dashboard, after 6pm local, unplayed day)
- Privacy (`/privacy.html`) + Terms (`/terms.html`), linked from sign-in; contact = support@checkraise.ai via Cloudflare Email Routing (NOTE: routing was silently DISABLED until July 5 — support@ bounced everything before then; re-enabled + verified)
- **PostHog live in prod** (key in Vercel env, plain not Sensitive — all `REACT_APP_*` vars are public by definition; only `CLAUDE_API_KEY` + `SUPABASE_SECRET_KEY` are Sensitive)
- **Resend SMTP live** (July 5): DNS on `send.` subdomain + DKIM + DMARC `p=none`, domain Verified in Resend; Supabase SMTP = smtp.resend.com:465, user literal `resend`, password = Resend API key, sender signin@checkraise.ai. Magic links verified end-to-end. Gotcha hit: Resend domain stays "Not started" until you click **Verify DNS Records** — Supabase 500s ("Error sending magic link email") until then.
- **Google OAuth LIVE in prod** (July 5): Google Cloud project "CheckRaise", web client with redirect to Supabase callback, creds in Supabase; tested end-to-end then `REACT_APP_GOOGLE_AUTH=1` flipped in Vercel — button is live for real users. Brand verification submitted (Search Console TXT on root + logo) — cosmetic only (consent screen still shows raw supabase.co domain until it lands). Full consent-screen fix (custom auth domain, ~$35/mo Supabase Pro+addon) deferred post-launch.
- **Real favicon + PWA icons** (July 5): generated from square logo; old files were mislabeled JPEGs AND git tracked them as `Icons/Icon-*.png` (capitals) so prod 404'd them since day one — macOS swallows case-only renames; verify with `git ls-files` after any rename.
- **Go Pro button = demand instrument**: fires `go_pro_clicked` + shows "Coming soon ✨" (no dead/grayed UI). Wire real upgrade flow here when Pro ships.
- **UsernameEntry surfaces failures** (July 5): profile-create errors were silently swallowed → dead-looking button (founder hit this live). Now busy state + inline error + `profile_create_failed` event.

**Artifacts (persistent links for future sessions):**
- 30-day launch playbook (checklist, owner tags, revenue math): https://claude.ai/code/artifact/95b9614a-3b88-4dcc-882f-b6d7da35615a
- Gameplay layout design-review history (iterations 1–4): https://claude.ai/code/artifact/fb6322e6-ca47-4eee-b1f4-85a6a453962c

**In flight / next (30-day playbook is a Claude artifact; owner tags YOU/CLAUDE):**
- ✅ **Stale-session dead-end FIXED July 6, LIVE in prod (user pushed same day; fix verified present in prod bundle)** — founder hit it live in prod: a locally stored Supabase session the server rejects (403 on `/auth/v1/user` — revoked session or deleted auth user) read as "signed in, no profile," walling him into UsernameEntry with a prepopulated name and a "couldn't save" error, no way back. Root cause: `fetchRemoteUser` ignored the `getUser()` error. Now: 401/403 from getUser → `invalid_session` error → App signs out (`scope: 'local'`) → SignIn screen; tracks `stale_session_cleared` (PostHog — watch it; spikes mean sessions are being revoked somewhere). Plus escape hatch on UsernameEntry: "Not you? Sign in with a different account" (Supabase mode only). Verified July 6 by forging an unexpired-but-invalid JWT against real Supabase — app recovers to SignIn, token cleared. Manual unblock for a stuck device: delete `sb-*` localStorage keys in DevTools and reload.
- ⏳ AdSense application (user submitting)
- ✅ **Sentry error monitoring LIVE in prod July 7** (user set `REACT_APP_SENTRY_DSN` in Vercel — Production env only, deliberately: `environment` comes from NODE_ENV, which CRA hardcodes to 'production' even for preview builds, so preview events would be indistinguishable from real ones — and deployed same day; DSN verified in the prod bundle) — `@sentry/react`, single-file pattern (`src/utils/sentry.js`, **encoded as invariant rule 10 `sentry`**): errors only, no tracing/replay, `sendDefaultPii: false`; user id (uid only, no email/name) set/cleared alongside PostHog identify/reset in App.jsx; imported FIRST in index.js so init precedes any crash. Verified end-to-end July 7 (Playwright + dev server with the real DSN): thrown page error → envelope POST to ingest.us.sentry.io → 200. The test event `sentry-wire-test` (environment: development) sits in the Sentry dashboard — safe to resolve; it proves the pipeline, so an empty dashboard = no crashes, not a dead integration. GitHub repo link + source-map upload deliberately skipped for now (source maps need a Sensitive auth token in the build — revisit if unreadable prod stacks become a problem).
- ✅ **Auth-flow hardening from the July 6 post-deploy bug sweep (commit `6b04b74`, LIVE in prod July 7 — retry-screen string verified in prod bundle)** — sweep of the freshly deployed auth/cache code found a live data-loss chain: transient profile-fetch failure → `authPhase 'noprofile'` → existing player lands on UsernameEntry → submitting ran `createRemoteProfile`'s plain **upserts and zeroed their profile + skills rows in the DB** (the leak fix made this destructive: owner-tagged cache means `local = null`, so the upsert seeded fresh stats instead of re-seeding the player's own). Three fixes, Playwright-verified against a stubbed Supabase (13/13 checks): (1) `createRemoteProfile` upserts are `ignoreDuplicates: true` — the create path can never overwrite existing rows; **encoded as invariant rule 9 `create-no-clobber`**; (2) generic fetch errors render a branded retry screen (new `'error'` authPhase — "Couldn't reach your profile" + Try again; tracks `profile_load_failed`, watch it in PostHog) instead of the create-profile screen; (3) `SIGNED_OUT` clears only **owner-tagged** caches so a pre-Supabase tester's migration payload survives the "Not you?" escape hatch (tagged warm caches still clear — the leak stays fixed), and the owner tag is set from `loadedUidRef` instead of a post-create `getUser()` round-trip that could fail and surface a spurious "couldn't save". Verification recipe worth reusing for auth-path changes: dev server in Supabase mode pointed at `https://stub.supabase.co` with every request intercepted by Playwright routes — drives the real auth listener with zero prod contact.
- ✅ **Cross-account stats leak FIXED July 6, LIVE in prod July 7** — founder repro'd on his phone: sign in as A, sign out, sign in as B → B shows A's stats. Root cause: sign-out never cleared the localStorage warm cache (`cr_user`), so B's first-visit UsernameEntry passed A's cached stats into `createRemoteProfile` as "pre-Supabase migration data" — **B's profile row was created in the DB with A's streak/skills/sessions/IQ** (it's a data bug, not a display bug). Fix (App.jsx + userStorage.js): (1) `SIGNED_OUT` event → `clearUser()` (cache follows the account; INITIAL_SESSION-with-no-session deliberately does NOT clear — that's a pre-Supabase tester whose cache IS the migration payload); (2) belt-and-suspenders `cr_user_owner` uid tag written whenever a signed-in profile is cached — `handleCreateUser` refuses to migrate an owner-tagged cache and UsernameEntry won't prefill from one (covers devices holding a stale cache from before this fix). ⚠️ **Data cleanup**: any account created on a device that had another account's cache (the founder's account B) permanently carries the other account's stats — founders: `delete from public.profiles where id = '<account-B-uuid>';` in the SQL editor (cascades skills/sessions/coach_usage; auth user survives; next sign-in re-onboards fresh). Verify the leak by comparing the two accounts' `profiles` rows.
- ✅ **Honest-labeling copy pass July 6 (founder-requested), LIVE in prod July 7 ("Recommended Play" verified in prod bundle)** — three fixes in the feedback panel + one stray: (1) "Recommended play" row now shows the option LABEL ("Call $9"), never the raw val ("bet_medium") — lookup at both FeedbackPanel call sites (App.jsx legacy + ScenarioCard canvas), vals themselves unchanged (they're data keys); (2) "Correct Play"/"Correct play:" → "Recommended Play"/"Recommended play:" — founder's reasoning: exploitative spots are judgment calls (see the SME findings' open items + the disagree box's existence), "correct" overclaims; (3) "⚡ AI Analysis" → "⚡ Hand Analysis" — per-hand feedback is pre-written static (one live Claude call per session = Coach's Read only, which keeps its name); founder explicitly wants no false AI labeling for AdSense reviewers; (4) in-app header tagline "AI-Powered Skill Training" → "Find the leak in your game" — the one survivor of the July 5 positioning pass. Verified live (Playwright, localStorage mode): tagline, header, and real labels in the recommended row across a full session. **When authoring scenario option labels remember they now display in the recommended-play row too.**
- ✅ **sc_172 authored July 7 (founder-requested hand)** — AKs, 3-bet pot, K94 rainbow, hero leads and faces an all-in raise; correct = call at 3.5:1 vs the aggressive regular (needs 22%; fb notes the same jam from a NIT flips it to a fold). Pool: **172 (81 beginner / 91 intermediate)**. Two firsts, both load-bearing: (1) **first 2-option scenario** (fold/call — no third action exists vs an all-in); `options.map` renders fine and a new permanent regression test `src/App.twooption.test.js` plays it through the real UI (mocks the scenario pool down to sc_172; caught that button labels render split at the parenthesis — "Call $90 more" + sub "all-in"); (2) **first all-in scenario** — expressed WITHOUT a stacks field (amount-free `'All-In'` seat action to dodge R2, all-in fact lives in body/labels/history; committed-pot convention like sc_153: pot $313 includes both live bets). ⚠️ Founder spec was $1/$3 (18/55/100/225) — **scaled to house $1/$2 as 12/40/70/160** because `TICKER_STAKES` hardcodes "$1/$2 CASH · 6-MAX"; every ratio preserved (6bb open, ~3.3x 3-bet, ~0.85-pot lead, ~2.3x jam, same 3.5:1 price). Flag for founder review since the numbers changed. All gates green; CSV regenerated (172 rows).
- ✅ **Scenario batch 5 sc_156–sc_171 authored July 7 (gap-targeting batch)** — +16 (8 beginner / 8 intermediate, 1+1 per skill): pool is now **171 total (81 beginner / 90 intermediate), every skill 21–22**. This batch was built from a measured coverage audit rather than fresh-lesson brainstorming; the gaps it closed (metrics before→after): **hero early seats** UTG 1→2, HJ 4→6, plus the first blind-vs-blind battle (sc_158 — BB has position on SB, the one blind matchup where that's true); **turn street** 21→25 incl. betsize turn 0→2 (sc_162 re-derive-the-fraction-every-street, sc_163 asymmetric-card overbet); **3-bet pots postflop** 1→3 (sc_159 IP small c-bet w/ position framing, sc_171 medium-pair-as-three-street-plan; sc_157 is their preflop feeder — 99 calls the wide button 3-bet, extending the sc_004/117/131 same-spot trio); **paired boards** 1→2 (sc_165 census-of-the-eights cheap c-bet) and **monotone flops** 3→5 (sc_161 attack holding the nut suit card vs sc_164 release holding none — authored as an explicit pair); **multiway postflop** 2→3 (sc_168 'nobody bluffs into a station' — NOTE: its pot field $47 includes BOTH live bets (bettor + cold-caller) because the heads-up exclude-the-live-bet convention has no multiway precedent; no odds text stated, deliberately); **calling-station × potodds** 0→1 (sc_166 implied-odds-have-a-ceiling gutshot fold); **potodds answer skew** 13call/5fold/1raise → 13/6/2 (sc_166 fold, sc_167 check-raise-renegotiates-the-price — same 2:1 turn price as sc_136 with the opposite answer because the villain folds; completes a sc_122/136/167 price trio). Other deliberate links: sc_160 turn check-raise with a set explicitly sequences with sc_154 (flat the flop to milk barrels, raise the turn when the file says no third bullet); sc_169 'the missing barrel is the tell' (he checked the scare card = made hand). Auditor caught 2 real errors mid-batch (sc_159 body said villain was 'out of position' — the position rule reads that phrase as a hero claim, avoid it when describing the villain; sc_162 body mentioned the stale flop pot next to the word 'pot') — both reworded. All gates green (audit 0 errors / same 7 pre-existing R2 warns, invariants, jest, eslint, full build); ticker + villain summaries smoke-tested for all 16 (multiway flop row renders); CSV regenerated (171 rows). **Remaining known gaps, deliberately not addressed**: Expert difficulty (Phase 1.6), stack-dependent spots (needs effective stacks in the data model), hero-hand repeats (J♠T♠ ×4, cosmetic). **⚠️ SME backlog now 88 scenarios (sc_084+) — recommend pausing authoring until scenario-review.csv + SCENARIO_GRADING_FINDINGS.md actually go out.**
- ✅ **Scenario batch 4 sc_140–sc_155 authored July 7 (same session as batch 3)** — +16 (8 beginner / 8 intermediate, 1+1 per skill): pool WAS **155 total (73 beginner / 82 intermediate), every skill 19–20** (superseded by batch 5 above). Fresh lessons: small pairs need position+price (sc_140), the value squeeze vs loose opener + station (sc_141 — sized up because they call, not to make them fold), the free showdown as position's prize (sc_142), SB plays 3-bet-or-fold (sc_143), value-raise the tiny river shrug-bet (sc_144 — explicit mirror of sc_139's call-with-a-bluff-catcher), raise big over limped family pots (sc_145), think in pot fractions not chips (sc_146), underbet the nuts to bait the small-bet attacker (sc_147 — first use of `tableContext` for a session-level read since sc_121), don't bluff with showdown value (sc_148), the A♠-blocker overbet bluff on a 3-flush river (sc_149), the price makes the hand — 5:1 multiway BB defend (sc_150), hidden-outs implied odds on a rainbow board (sc_151 — contrasts sc_122's face-up flush), limp-reraise = monsters (sc_152 — first authored PREFLOP actionHistory: multi-action sequences like limp-then-3-bet can't live in one seat-action string, so a single PRE row carries them; audit accepts history ending on PRE), the river check-raise is the least-bluffed line (sc_153 — line-frequency read, distinct from sc_094's passive-player raise), check-call the barreler with top two because his bluffs fold to raises but barrel at calls (sc_154 — completes a same-monster-different-villain pair with sc_111's raise-the-maniac), and **first 'unknown' villain scenario** (sc_155 — population defaults + take notes; exercises the 8th VILLAIN_LABELS type, watch that the UI renders it sanely). All gates green (audit 0 errors / same 7 pre-existing R2 warns — one new street-language warn caught and fixed mid-batch, invariants, jest, eslint, full build); ticker + villain summaries smoke-tested for all 16 (limp-reraise sequence and Unknown label render correctly); CSV regenerated (155 rows, all of sc_084+ still pending SME).
- ✅ **Scenario batch 3 sc_124–sc_139 authored July 7** — +16 (12 beginner / 4 intermediate), 2 per skill, beginner-weighted at the four skills that were thin at beginner (betsize/bluffing/potodds/reads each got 2 beginner): pool WAS **139 total (65 beginner / 74 intermediate), every skill 17–18** (superseded by batch 4 above). Fresh lessons: no open-limping (sc_124), A5s blocker 4-bet (sc_125 — pays off sc_107's feedback promise), don't donk into the raiser (sc_126), abandoning the c-bet OOP vs a floater on the caller's board (sc_127, inverts sc_118's float lesson), iso-raise the limper (sc_128), attack the skipped c-bet (sc_129), villain-driven wide steal (sc_130), bet-size-as-price-tag on draws (sc_132), never min-raise (sc_133), multiway bluff discipline (sc_134), line-consistency give-up (sc_135), rule-of-2-vs-4 turn math (sc_136, beginner mirror of sc_122), layered equity / count the whole hand (sc_137), sizing-collapse tell (sc_139). Deliberate pairs: sc_131 AQ-fold-to-nit-3-bet completes the sc_004/sc_117 same-spot-different-villain trio; sc_138 draw-completing river lead (fold) mirrors sc_123's brick-river lead (call). Two authoring rules learned/confirmed this batch: (1) **displayed feedback is grade-level, last-write-wins (`App.jsx` reads `scenario.feedback[gr.g]`) — when two options share a grade, give both the SAME combined fb text that reads correctly for either pick** (titles stay per-option); (2) **hero-first-to-act postflop spots need authored `actionHistory` ending in a `{ text: "you're first to act", you: true }` row** (exact `buildTicker` derivation text) — otherwise preflop context the seat actions can't carry (hero's call, villain's flat) is lost from the ticker. All gates green (audit 0 errors / same 7 pre-existing R2 warns, invariants, jest, eslint, full `npm run build`); ticker + villain summaries smoke-tested for all 16; CSV regenerated (139 rows, all of sc_084+ still pending SME).
- ✅ **Scenario batch 2 sc_108–sc_123 authored July 6 (same session)** — +16 more (10 beginner / 6 intermediate): pool WAS **123 total (53 beginner / 70 intermediate), every skill 15–16** (superseded by batch 3 above). Fresh lessons only (domination traps, SB discipline, sizing-jump tells, image/frequency bluffing, float-in-position, station overbets, line-reading donk leads); more deliberate pairs (sc_113 station-wet-board pot-bet mirrors sc_088 nit-dry-board small-bet; sc_117 JJ-vs-maniac-4-bet mirrors sc_004 JJ-vs-nit-call; sc_122 1.7:1 draw fold mirrors sc_092's 3.6:1 call). Auditor caught one real error mid-batch (original sc_113 put a 3-bet in the `cls:'call'` slot with toCall set → R1; scenario redesigned) — the gate works. All gates green after; CSV regenerated (123 rows, all of sc_084+ pending SME).
- ✅ **Table Reads design + content captured July 6** — `TABLE_READS_DESIGN.md` at repo root: full mode design (reuses actionHistory/ticker rendering + VILLAIN_LABELS; `mkObservation` data model with authored distractors + per-distractor `whyNot` feedback; showdown as the difficulty dial; 4 chips not 7) **plus 10 fully authored observation hands** covering all 7 archetypes, built around the four confusable pairs (nit↔tight, passive↔station, maniac↔aggressive, loose↔station) + an authoring checklist. Scoring recommendation inside (credit Opponent skill; alternative mode-local score if Pro-gated) — founders to confirm. Build remains unscheduled (Phase 1.6 or Pro tier); the judgment-heavy authoring is now banked.
- ✅ **Scenario batch sc_084–sc_107 authored July 6** — +24 scenarios (12 beginner / 12 intermediate), deliberately balancing the thin skills: pool WAS 107 after this batch (superseded by batch 2 above), per-skill preflop 14 · position 14 · opponent 15 · betsize/bluffing/potodds/reads 13 each · aggression 12. Auditor-clean (0 errors, no NEW warnings — the 7 pre-existing R2 warns are untouched); ticker derivation + villain summaries smoke-tested for all 24; conventions followed (street-dependent pot fields, $6 standard open, out-counts hand-verified against printed boards, `question` kept consistent with body, check-raise seats use amount-free `'Check-Raises'` action strings to avoid new R2 warns). **⚠️ The 24 new scenarios are NOT yet SME-reviewed** — `scenario-review.csv` regenerated (107 rows); send the UPDATED csv with SCENARIO_GRADING_FINDINGS.md. Design notes: several new hands deliberately pair with existing ones for contrast (sc_084 A7o CO-fold mirrors sc_002's A7o BTN-open; sc_104 "great price, dead hand" inverts sc_083/sc_095's price-based calls). No stack-dependent spots (effective stacks still not in the data model — Phase 1.6). Expert difficulty still empty/disabled by design.
- ✅ **Editable usernames BUILT July 6, LIVE in prod same day** (details in the Backlog entry) — user ran the SQL block + pushed; verified July 6: `username_changed_at` column live (REST probe 200), anon updates blocked by RLS (0 rows matched), all feature strings present in the prod bundle. Gotcha hit during rollout: renaming BEFORE the SQL block runs 400s (PostgREST rejects the unknown column) and surfaces as the generic "couldn't save" inline error — founder hit it on localhost pointed at prod Supabase.
- ✅ **Beta feedback table live in Supabase (July 5)** — `feedback` block run in the SQL editor, test submission verified end-to-end (row landed). Form ships with the next deploy.
- ✅ **PostHog analytics live in prod (July 5)** — `src/utils/analytics.js` is the ONLY PostHog file (no-op without `REACT_APP_POSTHOG_KEY`; autocapture off, `person_profiles: 'identified_only'`, US cloud). Funnel: `sign_in_link_sent` → `signed_in` → `profile_created` → `session_started` → `decision_made` ×5 → `session_completed`; health: `coach_read_ok`/`coach_read_failed` (reason: network | http+status | empty_response), `profile_create_failed`, `go_pro_clicked`, `google_sign_in_clicked`. ✅ Funnel insight built in the PostHog UI by the user July 7.
- ✅ **Google sign-in live in prod (July 5)** — `REACT_APP_GOOGLE_AUTH=1` flipped in Vercel, button live for real users. ⏳ Google brand verification still pending (submitted July 5, 2–5 business days) but cosmetic only — until it lands the consent screen shows the raw supabase.co domain instead of "CheckRaise" + logo.
- ✅ Resend SMTP live — see production list above
- ✅ **RESOLVED (July 5):** production Coach's Read was silently dead — `/api/coach-read` 404'd because the legacy `builds`/`routes` vercel.json wasn't routing to the function. Fixed by modernizing vercel.json to zero-config; verified live (405 on GET, coach read returns, coach_usage increments). Lesson: the graceful "No pattern identified yet" fallback hid a dead endpoint — PostHog should track coach-read failures when it lands.
- Week 3: pot/bet-size consistency pass ✅ **DONE July 5** (auditor `potpre` rule recomputes preflop pots; 5 pot fields corrected; sc_012 regraded + sc_011 resized per founder; pot-field convention decided — see NEXT SESSION block) + SME grading review still open (`npm run export:review` → scenario-review.csv)
**Founder ideas raised July 5:**
1. **Coin economy for sessions** (captured, NO decision yet — not in build scope) — 5 free coins per day, 1 coin per session, $2 to refill the 5 coins; the daily 5 auto-refresh 24 hours after the first coin is used. Would be the first paid mechanic (before the Pro tier) and the first cap on daily play. ⚠️ Tensions to resolve if adopted: the standing monetization decision is "free + ads at launch" with unlimited daily play, and the July 5 copy pass deliberately removed all daily-limit claims ("Sign in and play for free.") — copy and positioning would need a coordinated pass. Also needs: payment rails (none exist yet — Stripe or similar), server-side coin ledger (Supabase table + RLS, enforced in the session-start path, not client-only), and a decision on how it coexists with ads.
2. ✅ **"Disagree?" box — BUILT July 6, LIVE in prod same day** (user ran the `scenario_feedback` SQL block + pushed; verified July 6: table live, RLS rejects anonymous inserts (42501), feature strings present in the prod bundle). Founder green-lit it for beta: streamlines tester feedback with a direct tie to the scenario, no screenshots. Quiet toggle line under the AI Analysis text → four fixed-response chips, one tap = submit, no free text: "The graded answer is wrong" / "My answer deserves credit" / "Explanation doesn't match" / "Something else is off" (DB keys `grading_wrong`/`deserves_credit`/`explanation_off`/`other` — chip copy lives in `FeedbackPanel.jsx`, keys must match the schema check constraint). Inserts into new `scenario_feedback` table: scenario_id + the player's choice (null = timeout) + result + reason; insert-only RLS, same one-way-box model as `feedback`; founders find the most-flagged hands via the sample query in the schema.sql comment. ⚠️ **Run the `scenario_feedback` block (bottom of `supabase/schema.sql`) in the Supabase SQL editor BEFORE the next deploy** — until then submissions fail gracefully (inline "couldn't send" + `scenario_disagree_failed` event). PostHog: `scenario_disagree_opened` / `scenario_disagree_submitted` (scenario_id, reason, result) / `scenario_disagree_failed`. **Companion shipped with it: table peek toggle** — the feedback overlay covered the board, so a disputing tester couldn't see the hand they were disputing; "👁 Show table" chip (top-right of the overlay) fades the overlay out to reveal the untouched table, "← Back to analysis" in the same corner returns; resets every hand; tracks `table_peeked`. Also a study aid on every graded hand, disagreement or not. Verified end-to-end July 6 (Playwright, localStorage mode): peek round-trip, chip submit → thanks state, full reset on the next hand.

- Week 4 pulled forward — ✅ **landing/OG/SEO + ad scaffolding DONE July 5:** OG/Twitter/canonical/JSON-LD tags in `public/index.html`; `public/og.png` (1200×630 brand card, rendered with headless Chrome from a scratch HTML — regenerable on request); `sitemap.xml` + robots `Sitemap:` line; positioning copy replaced the old "AI-powered Texas Hold'em skill trainer" line everywhere it lived (title tag, meta description, manifest, SignIn screen) — pitch is now **"Find the leak in your game"**; founders should sanity-check the SignIn copy. **AdSense scaffolding:** `src/utils/ads.js` (the ONLY file that talks to AdSense; total no-op without `REACT_APP_ADSENSE_CLIENT`) + `src/components/AdSlot.jsx`, mounted dashboard-bottom + summary-bottom ONLY (never the decision screen). Two-stage env flip: client var alone passes AdSense site review with zero visible ads; `REACT_APP_ADSENSE_SLOT_DASHBOARD`/`_SUMMARY` (ad-unit IDs, created post-approval) turn each placement on independently. `ads.txt` deliberately NOT authored yet — it contains the publisher ID and the account is pending the LLC decision. **Deployed + verified July 5:** sitemap submitted in Search Console (Success), link previews confirmed working in iMessage + Twitter. Copy pass same day per founder: sign-in = "Find the leak in your poker game" / "Sign in and play for free." — five-spots-a-day claim removed everywhere (sessions are 5 hands but daily play is unlimited; don't reintroduce). Still open in Week 4: soft launch (r/poker etc.) — link previews are ready for it.

---

## Repo Structure

```
checkraise/
├── api/
│   └── coach-read.js       ← Vercel serverless function — the ONLY code that calls the Claude API
├── public/
│   └── index.html          ← Google Fonts link tags live here
├── src/
│   ├── components/
│   │   ├── App.jsx             ← Screen routing only. Screens: 'dashboard' | 'difficulty' | 'session'
│   │   ├── Dashboard.jsx       ← Entry point screen — Phase 1.5 BUILT
│   │   ├── UsernameEntry.jsx   ← First-run profile creation (shown when no stored user)
│   │   ├── ScenarioCard.jsx    ← Gameplay card with table, board, decision panel; owns the countdown timer
│   │   ├── FeedbackPanel.jsx   ← Post-decision feedback
│   │   ├── SessionSummary.jsx  ← End of session results + Coach's Read
│   │   ├── DifficultySelector.jsx
│   │   ├── VillainGuide.jsx    ← Info modal (villain types, positions, glossary)
│   │   ├── SkillTracker.jsx    ← Exists but removed from gameplay screen
│   │   └── PlayingCard.jsx
│   │   ├── SignIn.jsx          ← Auth screen: magic link + Google (Phase 2)
│   ├── data/
│   │   ├── scenarios.js        ← 83 scenarios incl. authored actionHistory. DO NOT edit for UI work.
│   │   ├── constants.js        ← Skill names/descriptions, COLOR_LABELS, PLAYER_SCHEMAS (single source: engine + guide), accuracy rating engine (deriveRating, applyHandToSkill)
│   │   └── dummyUser.js        ← Legacy schema reference (no longer imported by app code)
│   ├── utils/
│   │   ├── claude.js           ← Client fetch to /api/coach-read (sends Supabase auth token). Never calls Anthropic directly. Tracks coach_read_ok/failed.
│   │   ├── analytics.js        ← The ONLY file that talks to PostHog (track/identify/reset). No-op without REACT_APP_POSTHOG_KEY.
│   │   ├── sentry.js           ← The ONLY file that talks to Sentry (init + setSentryUser/clearSentryUser). No-op without REACT_APP_SENTRY_DSN. Imported first in index.js.
│   │   ├── supabase.js         ← The ONLY file that creates a Supabase client; null → localStorage-only mode
│   │   ├── db.js               ← The ONLY file with Supabase reads/writes (fetch/create/save user, recordSession)
│   │   ├── userStorage.js      ← localStorage cache + pure logic: applySessionResults, deriveSchema, streaks
│   │   ├── ticker.js           ← Situation ticker derivation (street-by-street action) + villainSummary
│   │   ├── spacedrep.js        ← Placeholder → post-launch
│   │   ├── gamification.js     ← Placeholder → post-launch
│   │   └── skillrating.js      ← Placeholder → post-launch
│   └── index.js
├── supabase/
│   └── schema.sql          ← Full DB schema + RLS policies (run in Supabase SQL editor)
├── scripts/
│   ├── audit-scenarios.mjs ← npm run audit:scenarios — content consistency gate (R1–R9)
│   └── export-review.mjs   ← npm run export:review — SME review CSV (one row per scenario)
├── public/
│   ├── privacy.html + terms.html  ← Legal pages (AdSense requirement)
│   └── icons/              ← PWA icons (lowercase paths — Vercel is case-sensitive! Git tracked capitalized paths until July 5 → prod 404s; check `git ls-files` after renames)
├── vercel.json             ← Modern zero-config (framework: create-react-app; api/ auto-mounted). Legacy `builds`/`routes` format removed July 2026 — it silently broke /api routing
├── .env                    ← REACT_APP_SUPABASE_URL + REACT_APP_SUPABASE_ANON_KEY (browser-safe; never commit)
└── package.json            ← Vercel server env: CLAUDE_API_KEY, SUPABASE_SECRET_KEY (both Sensitive)
```

---

## Key Decisions — Do Not Reverse

**Architecture:**
- React web app first, iOS via Capacitor in Phase 3
- Supabase chosen for Phase 2 backend (PostgreSQL, not Firebase)
- No backend in Phase 1.5 — all data hardcoded in `dummyUser.js`
- `dummyUser.js` data shape informs the Phase 2 database schema
- Claude API called only from the serverless function `api/coach-read.js` — the key (`CLAUDE_API_KEY`) never reaches the browser. Client code goes through `fetchCoachRead` in `src/utils/claude.js`, which hits `/api/coach-read`.
- **Supabase (Phase 2, July 2026):** client created ONLY in `src/utils/supabase.js` (env: `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`); all DB reads/writes ONLY in `src/utils/db.js`. Schema lives in `supabase/schema.sql` — RLS on every table, sessions append-only, archetype never stored (derived from skills). The in-memory user object keeps the `userStorage.js` shape regardless of source; localStorage remains a warm cache. **When env vars are absent the app runs in localStorage-only mode** (keeps jest green and local dev keyless). Auth flow: SignIn (magic link + Google) → UsernameEntry on first visit (migrates any local profile) → app. Sign-out via the dashboard avatar.
- App component is routing only — screen state: `'dashboard' | 'difficulty' | 'session'`

**Scenarios:**
- 83 scenarios (sc_001–sc_083) in `src/data/scenarios.js`
- `mkHand`, `mkPositions`, `mkScenario` helpers — never add raw scenario objects
- `VILLAIN_LABELS` and `SKILL_TAGS` lookup objects derive `tag` and `villain.label` at runtime — do not add these fields back to scenario objects
- `console.warn` guard fires on unknown skill or villain type at startup
- Suit symbols (♠♥♦♣) throughout — never shorthand (KQs, 98d, etc.)

**Gameplay:**
- SESSION_LENGTH = 5 scenarios per session
- TIMER_SECONDS = 60 (HARDCODED — move server-side in Phase 2)
- Per-scenario feedback is pre-written static (instant, no API call)
- One live Claude API call per session — `fetchCoachRead` in `claude.js` → `/api/coach-read` — session summary only
- Model: `claude-sonnet-5`
- `/api/coach-read` hardening: max 10 decisions per request, string fields clamped to 200 chars, `max_tokens: 300`, upstream errors surface as 502
- XP system removed entirely — streak is the sole engagement metric
- SkillTracker removed from gameplay screen — results shown on session summary only
- **Situation ticker** (`src/utils/ticker.js` + `SituationTicker` in ScenarioCard) — street-by-street action summary labeled "How you got here". Derives only provable facts from structured fields; never guesses unknowable history; hero actions shown in green. Scenarios may set an authored `actionHistory` field to override derivation — formalize authoring it in Phase 1.6.
- `scenario.question` is never displayed — founders consider it redundant. Never repeat info shown elsewhere on the gameplay screen (hand/board/pot appear once each).
- **Single-canvas gameplay layout** (July 2026, founders-approved) — `USE_SINGLE_CANVAS` flag in ScenarioCard.jsx (`CanvasLayout` vs `LegacyLayout`). One table, one column: pot + board center-felt (POT label gold, unbolded, larger); hero cards at hero seat; villain archetype + position relation in a persistent bubble at his seat (desktop) or a strip below the table (mobile) — no quote/tell text; ticker below table; actions in the thumb zone with semantic chips ✕/=/↑ (colors track aggression, mapped from option `cls`); feedback slides over the table (`sc2-overlay`); timer + hand count top-right, skill tag centered. All `sc2-*` classes in App.css.

**Dashboard:**
- Dashboard is the entry point (`screen === 'dashboard'`), not DifficultySelector
- Section order: Stats row → Player Profile → CTA → Beta feedback
- **Beta feedback form (July 2026)** — quiet collapsed line under the CTA ("Something broken, boring, or brilliant?") expanding to category chips (gameplay/scenarios/technical/idea) + textarea. Inserts into Supabase `feedback` table (insert-only RLS — users can't read back; founders read via SQL editor/service role). `submitFeedback` in db.js. PostHog: `feedback_opened` / `feedback_submitted` / `feedback_submit_failed`. ⚠️ Requires the feedback block at the bottom of `supabase/schema.sql` to be run in the Supabase SQL editor before deploy.
- **Player Profile card (July 2026, founders-approved)** — the old Poker Archetype and Skill Profile sections merged into ONE card: schema (name + quote only — "Schema · N of 6" mini-label and "Affecting" chips removed; founders want the analysis to feel holistic) on the left, skill status ledger on the right, vertical gold divider between; stacked with a horizontal rule on mobile (<700px). Locked-schema state (new user) shows the lock on the left with live skills on the right.
- **Skill ledger** — skills grouped by rating, weakest first (Weak → Work On → Strong → Unrated), one row per status at every width. Group headers double as the legend. After a session, changed skills fly to their new group via a vanilla FLIP hook in `SkillLedger` (Dashboard.jsx), staggered 750ms, landing glow in the new status color; mounts in `sessionDelta.prevSkills` state so the player sees the before→after. `prefers-reduced-motion` → instant regroup. Pills are NOT tappable — skill definitions live in the VillainGuide **Skills tab** (status names only; accuracy thresholds are engine internals, never shown to users).
- New-user state (gray dots, locked schema) deferred — see post-1.5 work
- Coach greeting, streak warning, and leaderboard excluded from dashboard — moved to backlog

**Fonts:**
- Playfair Display — logo, hero numbers, schema name, schema quote, CTA button
- JetBrains Mono — all labels, section headers, monospace elements
- Both loaded via Google Fonts in `public/index.html`
- Georgia and Courier New are fallbacks only

**Monetization (decided July 2026):** Free at launch, ad-supported; premium features incorporated over time (Table Reads mode is a Pro-tier candidate). **Go-live target: early August 2026 (~30 days)** — real accounts via Supabase, minimal scope: **email magic-link + Google sign-in** (Apple deferred to iOS phase — requires the $99 dev account anyway; Facebook skipped) + users/sessions tables ported from the userStorage.js shape. Leaderboard and spaced repetition deferred past launch. **Streak warning pulled INTO launch scope** (in-app banner; retention drives ad revenue); streak badges shortly after launch. Ad placements: session summary + dashboard only — never on the decision screen. Revenue framing: $500/mo ≈ ~200 DAU at realistic ad rates — treat as an audience milestone, not a launch-month expectation.

---

## Screen Flow

```
Dashboard → DifficultySelector → Session → SessionSummary → Dashboard
```

Logo tap returns to Dashboard from any screen.

---

## The 8 Skills

| Key | Display Name | What It Tests |
|-----|-------------|---------------|
| preflop | Preflop | Right starting hands by position |
| position | Position | Adjusting play based on seat |
| aggression | Aggression | Calibrating when to bet and raise |
| betsize | Bet Size | Sizing bets to achieve their purpose |
| bluffing | Bluffing | Bluffing at the right frequency |
| potodds | Pot Odds | Calling profitably vs. over-folding |
| reads | Reads | Reacting to villain betting patterns |
| opponent | Opponent | Adjusting strategy for villain type |

Skill ratings: Green = 75%+ accuracy · Yellow = 50–74% · Red = below 50% · Gray = fewer than 5 attempts

Rating engine (`src/data/constants.js`): ratings are **derived from true accuracy** — `correct / attempts` per skill, thresholds exactly as above. Correct = 1 credit, partial = 0.5, incorrect = 0. Every hand played counts (duplicate skills in a session count twice). Skills stay gray until 5 attempts, which also delays archetype detection for new users — accepted tradeoff, decided July 2026.

---

## The 6 Player Schemas

| # | Schema | Root Belief |
|---|--------|-------------|
| 1 | The Conflict Avoider | "I shouldn't put money in unless I'm sure" |
| 2 | The Gambler | "Any two cards can win" |
| 3 | The Positional Blind Spot | "I don't factor in where I'm sitting" |
| 4 | The Results Thinker | "If it worked, it was right" |
| 5 | The Exploitable Regular | "I play my hand, not my opponent" |
| 6 | The Overaggressor | "Pressure wins pots regardless" |

Phase 1.5: surfaced as text using current session data only. Phase 2: full tracking in database.

---

## dummyUser.js Shape (Phase 2 schema reference)

```javascript
{
  displayName, initials,
  streak, lastSessionDate, sessionsCompleted,
  skills: {
    [skillKey]: { rating: 'green'|'yellow'|'red'|'gray', attempts: N, correct: N }
  },
  schema: {
    name, quote, index, total,
    affected: [{ skill, level: 'red'|'yellow' }]
  },
  sessionsRequiredForSchema: 5,
  leaderboard: {
    yourRank, total,
    top: [{ rank, name, streak, isUser }]
  }
}
```

---

## Phase 2 Tech Stack (when developer is engaged)

| Layer | Tool |
|-------|------|
| Backend | Supabase |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (email + Apple Sign In) |
| State | Zustand or React Context |
| Animations | Framer Motion (establish in Phase 1.5) |

Phase 2 timeline estimate: 6–8 weeks with a developer.

---

## Phase 1.6 — Scenario Scale & Expert Level

*Begins after Phase 1.5 strategic questions are answered.*

- Scale up total scenario count significantly
- Build out Expert difficulty scenarios
- Add effective stack sizes to the scenario data model and gameplay display — players can't evaluate all-in or big-raise decisions without stack depth. Requires authoring a stack value for all existing scenarios.
- Expert-level features TBD based on Phase 1.5 findings
- Lock in Bundle ID (cannot change after App Store submission — decide here, before Phase 3)
- SME review of all scenario gradings (carried from Phase 1.0)
- Both founders play through 10+ times each (carried from Phase 1.0)

---

## Post-Phase 1.5 Work (no phase yet)

*Deferred until strategic questions are answered. Scope depends on those answers.*

- Replace placeholder utils (`spacedrep.js`, `gamification.js`, `skillrating.js`) with full logic
- New user experience — gray dots, locked schema, onboarding flow
- **Schema diagnosis engine v2 (relative-weakness model)** — current `deriveSchema` (`userStorage.js`) scores against fixed red/yellow buckets (absolute weakness). July 2026 fix removed a structural bias (multi-skill schemas + array-order tiebreak made Conflict Avoider fire ~90% of the time under uniform play; now normalized per measured skill + requires a clear winner above a severity bar, else `BALANCED_SCHEMA` = "The Balanced Player"). Post-launch, once real per-skill accuracy distributions exist (PostHog/Supabase sessions), move to *relative* scoring: diagnose skills that lag a player's *own* mean, so an improving player's real leak is distinguished from a beginner's uniform weakness. Calibrate thresholds against real data. Founders to revisit schema→skill mappings here too. Derived-only (no DB migration). **Founders: this is the diagnostic moat — worth a deeper exploration once data lands.**
  - **Simulation harness built July 5** (`npm run simulate:schemas` — runs the REAL `deriveSchema` against 12 synthetic archetypes; exits 1 on structural bias, so it's the regression gate for any v2 work). Findings: ✅ no structural bias remains — every leak archetype converges to the right diagnosis. Simulation-tuned changes shipped July 5 (founder-approved): **`SCHEMA_MIN_SEVERITY` 1.0 → 1.25** (a named schema now requires a genuinely red contributing skill; wrong-schema rate for leaky players 15%→5% and false positives for balanced players 39%→27% at 10 sessions; cost: yellow-only mild leaks read as Balanced by design — still visible in the skill ledger; revisit at v2 calibration if real leaks skew yellow-grade) + **"Early read · sharpens as you play" chip** on the schema card while `sessionsCompleted < 10` (`db-schema-early`) because no scoring knob fixes 5-session noise (~3 attempts/skill). Knobs tested and rejected: score margin (the tie rule already covers it), rated-only skills (no effect), unlock at 8 sessions (delays without improving).
  - **v2 design note — direction of error**: the current engine only uses accuracy, but the schemas differ by *direction* (Conflict Avoider over-folds, Overaggressor over-raises — identical accuracy, opposite mistakes). `sessions.hands` already stores `choiceVal` per hand, and the scenario's option `cls` (fold/call/raise) gives the direction axis — v2 should score it. No schema/DB change needed.

---

## Backlog (no defined phase)

Features excluded from current build. May return based on tester feedback or strategic direction.

- **"Table Reads" mode — villain-identification minigame** (tester suggestion, July 2026; founders endorse concept, timing TBD — candidate Phase 1.6 or paid tier). Player watches a hand's action replay (reuses ticker/actionHistory infrastructure), then picks which villain archetype it is; feedback explains the tells. Trains *forming* reads rather than receiving them — directly serves the Reads/Opponent skills and the opponent-modeling moat. **Design + 10 authored observation hands captured July 6 in `TABLE_READS_DESIGN.md`** (data model, distractor/`whyNot` system, difficulty dial, authoring checklist) — building it later is mostly engineering.
- **Leaderboard** — friends-only, `isUser` row highlight. Data shape preserved in `dummyUser.js`.
- **Streak warning** — show after 6pm if user hasn't played today
- **Coach greeting** — personalized dashboard greeting
- **Streak badges / celebrations** — milestone rewards
- ✅ **Editable usernames — BUILT July 6** (was backlog; pulled forward on founder request). ✎ button next to the dashboard account pill → inline topbar form (same 2–20 char validation as UsernameEntry); initials re-derive from the new name. Rate limit = 1 change per 7 days: enforced **in the DB** by the `username_change_limit` BEFORE UPDATE trigger on `profiles` (new `username_changed_at` column, server-owned — the trigger overwrites client-sent values so the clock can't be reset; raises `username_rate_limited`, surfaced as `err.code = 'rate_limited'` by `updateDisplayName` in db.js). Client mirrors the cooldown as UX (form replaced by a "change again on {date}" note); localStorage-only mode enforces client-side only. `RENAME_COOLDOWN_MS` lives in userStorage.js. PostHog: `username_edit_opened` / `username_changed` / `username_change_failed` (reason: rate_limited | error). Founders forcing a rename: `alter table public.profiles disable trigger username_change_limit`. ✅ SQL block run + deployed July 6 — LIVE in prod (column verified via REST probe, feature strings in the prod bundle) **and founder-tested end-to-end in prod same day (rename worked as expected)**. Uniqueness still not enforced (usernames were never unique — unchanged).

---

## What to Never Do

- Never hardcode the Claude API key — use the `CLAUDE_API_KEY` env variable (server-side only, set in Vercel)
- Never call the Claude API from any file except `api/coach-read.js` — client code goes through `src/utils/claude.js`
- Never expose the API key to the browser (no `REACT_APP_`-prefixed key variables)
- Never add `tag` or `villain.label` fields back to scenario objects — they're derived at runtime
- Never use shorthand card notation (KQs, 98d) — always use suit symbols
- Never add Tailwind to existing Phase 1 CSS — only on new screens if adopted
- Never modify `scenarios.js` for UI work — it's content, not layout
- Never commit `.env` to GitHub
- Never `await` Supabase (or any async) calls inside the `onAuthStateChange` callback — supabase-js holds its auth lock during the callback and authed calls need that lock, so it deadlocks intermittently (the "stuck on Shuffling up…" bug, July 2026). Defer with `setTimeout(async () => {...}, 0)`.