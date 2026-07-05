# CheckRaise

AI-powered Texas Hold'em skill trainer. Presents poker scenarios, grades your decisions, and coaches you based on villain type and skill area.

Live at: https://checkraise.ai

> **Working on this repo with Claude?** Read `Claude.md` first — it's the authoritative context file (current phase, decisions, what never to do). `SCENARIO_AUDIT.md` documents the content-quality rules and the automated auditor.

---

## Tech Stack

- **React** (Create React App) — single-page app
- **Supabase** — Postgres, auth (email magic link + Google), Row Level Security on every table
- **Anthropic Claude API** — one call per session (Coach's Read), server-side only via `api/coach-read.js`
- **Vercel** — hosting, serverless functions, auto-deploy from GitHub `main`
- Capacitor — planned for iOS App Store (post-launch)

---

## Setup

1. Clone, then `npm install`
2. Create `.env` in the root (browser-safe values — see `Claude.md` for details):
   ```
   REACT_APP_SUPABASE_URL=https://<project-ref>.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=sb_publishable_...
   ```
   **No `.env`? The app still runs** in localStorage-only mode (no sign-in) — handy for UI work.
3. `npm start`

Database: run `supabase/schema.sql` in the Supabase SQL editor (tables + RLS policies).
Server-side env (Vercel dashboard only, never in `.env`): `CLAUDE_API_KEY`, `SUPABASE_SECRET_KEY`.

---

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Dev server |
| `npm test` | Integration test — plays a full session end-to-end |
| `npm run build` | Production build |
| `npm run audit:scenarios` | Content consistency gate — run after ANY `scenarios.js` change; exits non-zero on errors |
| `npm run export:review` | Generates `scenario-review.csv` for expert review of all 83 scenarios |

---

## Project Structure

```
api/coach-read.js      Serverless Coach's Read — the only code that calls Claude (auth + daily cap)
supabase/schema.sql    Database schema + RLS
scripts/               Scenario auditor + review exporter
src/
├── components/        App (state), ScenarioCard (single-canvas table), Dashboard,
│                      SessionSummary, SignIn, UsernameEntry, FeedbackPanel, …
├── data/
│   ├── scenarios.js   All 83 scenarios (content — never edit for UI reasons)
│   └── constants.js   Skill metadata + the accuracy rating engine
└── utils/
    ├── supabase.js    The only Supabase client
    ├── db.js          The only Supabase reads/writes
    ├── userStorage.js localStorage cache + pure game logic (sessions, streaks, schema)
    ├── ticker.js      "The hand so far" street-by-street derivation
    └── claude.js      Client → /api/coach-read
```

## Scenario Format

Scenarios are built with the `mkScenario` helper in `scenarios.js` — never add raw objects. Key fields: `id`, `skill`, `difficulty`, `villain {type, notes}`, `positions` (6 seats), `hand`, `board` (null preflop), `pot`, `toCall`, optional `actionHistory` (street-by-street story shown in the ticker), `body`, `correct`, and `choices` (label/grade/title/feedback per option). `tag` and `villain.label` are derived at runtime — do not add them. Full authoring rules: `SCENARIO_AUDIT.md`.

---

## Roadmap

| Phase | What | Status |
|-------|------|--------|
| 1 | Prototype — scenarios, grading, Coach's Read | ✅ Done |
| 1.5 | UX validation, single-canvas table, accuracy engine, content audit | ✅ Done |
| 2 | Accounts (Supabase), analytics, ads — **launching early August 2026** | 🔨 In progress |
| 3 | iOS App Store via Capacitor (Bundle ID TBD: `com.[name].checkraise`) | Later |
