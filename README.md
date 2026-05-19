# CheckRaise

AI-powered Texas Hold'em skill trainer. Presents poker scenarios, grades your decisions, and coaches you based on villain type and skill area.

Live at: https://checkraise.ai

---

## Tech Stack

- React (Create React App)
- Anthropic Claude API — scenario grading and Coach's Read
- Vercel — hosting and auto-deploy from GitHub
- Capacitor — planned for iOS App Store (Phase 3)

---

## Setup

1. Clone the repo
2. Run `npm install`
3. Create a `.env` file in the root with your API key:
REACT_APP_CLAUDE_API_KEY=your-key-here
4. Run `npm start`

For production, the API key is set as an environment variable in the Vercel dashboard.

---

## Project Structure
src/
├── components/       UI components (in progress — currently in App.js)
├── data/
│   └── scenarios.js  All scenario content lives here
├── utils/            API calls, spaced repetition, skill rating logic (planned)
├── hooks/            Custom React hooks (Phase 2)
├── App.js            Main app — routing between difficulty selector, session, summary
└── index.js          Entry point
---

## Scenario Format

Every scenario in `scenarios.js` requires these fields:

- `id` — unique number
- `tag` — display label (e.g. "Preflop Hand Selection")
- `skill` — internal key (preflop, position, aggression, betsize, bluffing, potodds, reads, opponent)
- `difficulty` — beginner / intermediate / advanced
- `weight` — spaced repetition weight, default 1.0
- `villain` — object with type, label, notes
- `positions` — array of 6 table positions
- `hand` — hero's hole cards
- `board` — community cards or null
- `pot` — pot size string
- `toCall` — amount to call or null
- `body` — scenario description
- `question` — the decision prompt
- `options` — array of 3 choices (fold/call/raise)
- `correct` — correct answer value
- `grading` — grade and title for each option

---

## Bundle ID

Pending — to be set before App Store submission. Format: `com.[name].checkraise`

---

## Phase Roadmap

| Phase | What | Who | When |
|-------|------|-----|-------|
| 1 | Prototype — scenarios, AI grading, Coach's Read | Founders + Claude | Done |
| 2 | User accounts, history, spaced repetition, personalization | Developer needed | Next |
| 3 | App Store submission via Capacitor | Developer + designer | Later |

---

## Decision Log

See `decision-log.md` for a full record of all product and technical decisions.

---

## Adding Scenarios

All scenarios live in `src/data/scenarios.js`. Add new objects to the array following the format above. The app auto-picks them up on next deploy — no other files need to change.