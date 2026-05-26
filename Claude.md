# CheckRaise — Claude Context File

> Read this before touching any code. It explains what's been built, why decisions were made, and what to do next.

---

## What This Is

CheckRaise is a Texas Hold'em skill trainer that identifies your specific weaknesses and coaches you like a human would — not a textbook. Live at **checkraise.ai** (Vercel, React).

The core moat: personalization + spaced repetition + opponent modeling + schema diagnosis. No major competitor does all four.

---

## Current Phase: 1.5 — UX & Design Validation

**The philosophy:** Build the full logged-in experience with dummy data before touching a database. Validate the UX, then engineer it.

All Phase 1.5 screens read from `src/data/dummyUser.js`. No backend exists yet. In Phase 2, `dummyUser.js` is replaced entirely by Supabase.

**Phase 1.5 is complete when:**
- All screens designed and tested with dummy data
- Developer friend has reviewed architecture
- 5+ testers have experienced the full logged-in flow
- Phase 2 scope is locked based on feedback

---

## Repo Structure

```
checkraise/
├── public/
│   └── index.html          ← Google Fonts link tags live here
├── src/
│   ├── components/
│   │   ├── App.jsx             ← Screen routing only. Screens: 'dashboard' | 'difficulty' | 'session'
│   │   ├── Dashboard.jsx       ← Entry point screen — Phase 1.5 BUILT
│   │   ├── ScenarioCard.jsx    ← Gameplay card with table, board, decision panel
│   │   ├── FeedbackPanel.jsx   ← Post-decision feedback
│   │   ├── SessionSummary.jsx  ← End of session results + Coach's Read
│   │   ├── DifficultySelector.jsx
│   │   ├── VillainGuide.jsx    ← Info modal (villain types, positions, glossary)
│   │   ├── SkillTracker.jsx    ← Exists but removed from gameplay screen
│   │   └── PlayingCard.jsx
│   ├── data/
│   │   ├── scenarios.js        ← 83 scenarios. DO NOT edit for UI work.
│   │   └── dummyUser.js        ← Phase 1.5 fake user data. Shape informs Phase 2 schema.
│   ├── utils/
│   │   ├── claude.js           ← All Claude API calls. Only file that calls the API.
│   │   ├── spacedrep.js        ← Placeholder → Phase 2
│   │   ├── gamification.js     ← Placeholder → Phase 2
│   │   └── skillrating.js      ← Placeholder → Phase 2
│   └── index.js
├── .env                    ← REACT_APP_CLAUDE_API_KEY (never commit)
└── package.json
```

---

## Key Decisions — Do Not Reverse

**Architecture:**
- React web app first, iOS via Capacitor in Phase 3
- Supabase chosen for Phase 2 backend (PostgreSQL, not Firebase)
- No backend in Phase 1.5 — all data hardcoded in `dummyUser.js`
- `dummyUser.js` data shape informs the Phase 2 database schema
- API logic isolated in `src/utils/claude.js` — no other file calls the API directly
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
- One live Claude API call per session — `fetchCoachRead` in `claude.js` — session summary only
- Model: `claude-sonnet-4-5`
- XP system removed entirely — streak is the sole engagement metric
- SkillTracker removed from gameplay screen — results shown on session summary only

**Dashboard:**
- Dashboard is the entry point (`screen === 'dashboard'`), not DifficultySelector
- Section order: Stats row → Archetype → Skill Profile → Leaderboard → CTA
- Leaderboard is friends-only (not global) — `isUser` flag highlights your row
- Skill dots are tappable — expand to show description + color meaning
- New-user state (gray dots, locked schema) deferred to Phase 2
- Streak warning shows after 6pm if user hasn't played today
- Coach greeting and streak warning removed from current build — dashboard is cleaner without them

**Fonts:**
- Playfair Display — logo, hero numbers, schema name, schema quote, CTA button
- JetBrains Mono — all labels, section headers, monospace elements
- Both loaded via Google Fonts in `public/index.html`
- Georgia and Courier New are fallbacks only

**Monetization:** Decision deferred until Phase 1.5 UX validation complete. Architecture keeps all doors open.

**Bundle ID:** Deferred — cannot change after App Store submission. Decide before Phase 3.

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
    [skillKey]: { rating: 'green'|'yellow'|'red'|'gray', attempts: N }
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

## What's Still To Build (Phase 1.5)

- Session summary refinements (schema insight, streak celebration)
- Skill Profile screen (full breakdown over time)
- Developer friend architecture review
- 5+ external testers through the full flow
- Phase 2 scope locked from tester feedback

## Phase 1 Still Outstanding

- SME review of all 83 scenario gradings
- Both founders play through 10+ times each
- Bundle ID locked in

---

## What to Never Do

- Never hardcode the Claude API key — use `REACT_APP_CLAUDE_API_KEY` env variable
- Never call the Claude API from any file except `src/utils/claude.js`
- Never add `tag` or `villain.label` fields back to scenario objects — they're derived at runtime
- Never use shorthand card notation (KQs, 98d) — always use suit symbols
- Never add Tailwind to existing Phase 1 CSS — only on new screens if adopted
- Never modify `scenarios.js` for UI work — it's content, not layout
- Never commit `.env` to GitHub