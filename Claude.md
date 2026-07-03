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

## Current Phase: 1.5 — UX & Design Validation

**The philosophy:** Build the full logged-in experience with dummy data before touching a database. Validate the UX, then engineer it.

All Phase 1.5 screens read from `src/data/dummyUser.js`. No backend exists yet. In Phase 2, `dummyUser.js` is replaced entirely by Supabase.

**Status:**
- ✅ Session summary refinements complete
- ✅ Dashboard covers skill profile — dedicated screen not needed
- ✅ Developer friend UX/UI review done
- ✅ Testers reviewing and providing feedback
- ⏳ Strategic questions below not yet answered

**Phase 1.5 is complete when these strategic questions are answered (founders review):**
- What is the Poker IQ algorithm? How should it work?
- Are the 6 player schemas right? Do they cover the real patterns?
- Do we have the right 8 skills? Any missing or redundant?
- What does the paid version include? What's free?

Once these are answered and no tester feedback points to structural UX changes that would reshape the data model, Phase 2 scope can be locked and engineering can begin.

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
│   ├── data/
│   │   ├── scenarios.js        ← 83 scenarios. DO NOT edit for UI work.
│   │   ├── constants.js        ← Shared skill names/descriptions, COLOR_LABELS, rating ladder (nextRating)
│   │   └── dummyUser.js        ← Phase 1.5 fake user data. Shape informs Phase 2 schema.
│   ├── utils/
│   │   ├── claude.js           ← Client fetch to /api/coach-read. Never calls Anthropic directly.
│   │   ├── userStorage.js      ← localStorage user profile: ratings, streak, Poker IQ, schema derivation
│   │   ├── spacedrep.js        ← Placeholder → Phase 2
│   │   ├── gamification.js     ← Placeholder → Phase 2
│   │   └── skillrating.js      ← Placeholder → Phase 2
│   └── index.js
├── vercel.json             ← Static build + api/ serverless functions
├── .env                    ← CLAUDE_API_KEY (server-side; set in Vercel env vars — never commit)
└── package.json
```

---

## Key Decisions — Do Not Reverse

**Architecture:**
- React web app first, iOS via Capacitor in Phase 3
- Supabase chosen for Phase 2 backend (PostgreSQL, not Firebase)
- No backend in Phase 1.5 — all data hardcoded in `dummyUser.js`
- `dummyUser.js` data shape informs the Phase 2 database schema
- Claude API called only from the serverless function `api/coach-read.js` — the key (`CLAUDE_API_KEY`) never reaches the browser. Client code goes through `fetchCoachRead` in `src/utils/claude.js`, which hits `/api/coach-read`.
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

**Monetization:** Decision deferred — one of the strategic questions to answer in Phase 1.5. Architecture keeps all doors open.

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