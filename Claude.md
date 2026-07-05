# CheckRaise — Claude Context File

> Read this before touching any code. It explains what's been built, why decisions were made, and what to do next.

---

## What This Is

CheckRaise is a Texas Hold'em skill trainer that identifies your specific weaknesses and coaches you like a human would — not a textbook. Live at **checkraise.ai** (Vercel, React).

The core moat: personalization + spaced repetition + opponent modeling + schema diagnosis. No major competitor does all four.

---

## Phase 1.0 — COMPLETE

- 83 scenarios built and structured
- Core gameplay loop (scenario → feedback → summary) working
- SME review of scenario gradings still needed (carry forward)
- Both founders to play through 10+ times each (carry forward)

---

## Current Phase: 2 — Launch Build (July 2026, targeting early-August go-live)

Phase 1.5 closed July 2026. Strategic-question status: **monetization answered** (free + ads at launch, ~$500/mo ≈ 200 DAU milestone; Pro tier later — Table Reads mode + Expert difficulty are candidates). **Poker IQ mechanics answered** (true-accuracy rating engine in `constants.js`; the display formula in `derivePokerScore` still bucket-based — refine post-launch). Schemas/skills questions: deferred to founders review, not launch-blocking.

**Live in production now (week 1 done in one day):**
- Supabase auth (email magic link + Google UI; Google provider NOT yet configured — button shows friendly fallback)
- profiles/skills/sessions/coach_usage tables, RLS everywhere, localStorage migration on first sign-in
- Coach endpoint locked: requires signed-in user, 20 calls/user/day (`coach_usage`), $50/mo Anthropic cap set
- Streak warning banner (dashboard, after 6pm local, unplayed day)
- Privacy (`/privacy.html`) + Terms (`/terms.html`), linked from sign-in; contact = support@checkraise.ai via Cloudflare Email Routing

**In flight / next (30-day playbook is a Claude artifact; owner tags YOU/CLAUDE):**
- ⏳ AdSense application (user submitting)
- ⏳ PostHog analytics — blocked on user creating account + providing project key
- ⏳ Google OAuth provider config — user errand, walkthrough on request
- ⏳ Resend SMTP for magic links (Supabase built-in sender is ~2-4 emails/hour — must fix before tester wave)
- ⏳ **UNRESOLVED BUG:** production Coach's Read returning empty ("No pattern identified yet") for the founder despite valid sign-in; Anthropic spend $40 of $50 cap (not capped). Awaiting network-tab status code for `/api/coach-read` (502 = upstream/billing, 401 = token, 429 = daily cap)
- Week 3: pot/bet-size consistency pass (~8 scenarios, founder blesses sizes; auditor then recomputes pots) + SME grading review (`npm run export:review` → scenario-review.csv)
- Week 4: landing/OG/SEO, soft launch (r/poker etc.), ads flag on

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
│   │   ├── constants.js        ← Skill names/descriptions, COLOR_LABELS, accuracy rating engine (deriveRating, applyHandToSkill)
│   │   └── dummyUser.js        ← Legacy schema reference (no longer imported by app code)
│   ├── utils/
│   │   ├── claude.js           ← Client fetch to /api/coach-read (sends Supabase auth token). Never calls Anthropic directly.
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
│   └── icons/              ← PWA icons (lowercase paths — Vercel is case-sensitive!)
├── vercel.json             ← Static build + api/ serverless functions
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
- Section order: Stats row → Archetype → Skill Profile → CTA
- Skill dots are tappable — expand to show description + color meaning
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

---

## Backlog (no defined phase)

Features excluded from current build. May return based on tester feedback or strategic direction.

- **"Table Reads" mode — villain-identification minigame** (tester suggestion, July 2026; founders endorse concept, timing TBD — candidate Phase 1.6 or paid tier). Player watches a hand's action replay (reuses ticker/actionHistory infrastructure), then picks which of the 8 villain archetypes it is; feedback explains the tells. Trains *forming* reads rather than receiving them — directly serves the Reads/Opponent skills and the opponent-modeling moat. Authoring unit: observation hand + correct archetype + tell explanation (lighter than a decision scenario).
- **Leaderboard** — friends-only, `isUser` row highlight. Data shape preserved in `dummyUser.js`.
- **Streak warning** — show after 6pm if user hasn't played today
- **Coach greeting** — personalized dashboard greeting
- **Streak badges / celebrations** — milestone rewards

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