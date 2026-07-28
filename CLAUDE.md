# CheckRaise — Claude Context File

> This file is per-session law. Everything else lives in `docs/` — the pointer block at the bottom is the map.

---

## What this is

CheckRaise is a Texas Hold'em skill trainer that identifies the player's specific weaknesses and coaches them like a human would. Live at **checkraise.ai**. Stack: Create React App on Vercel, Vercel serverless functions (`api/coach-read.js`), Supabase (PostgreSQL + Auth + RLS), PostHog analytics, Sentry error monitoring. When Supabase env vars are absent the app runs in localStorage-only mode — same code path, no conditional trees.

---

## Definition of Done — every gate, every change

Never weaken or skip a gate to get green — if a change can't satisfy one, say so. Detail (rule tables, harness usage, verification recipes) → `docs/operations/GATES.md`.

| # | Command | When | Enforces |
|---|---|---|---|
| 1 | `npm run check:invariants` | after EVERY code change | 23 architecture rules (single-file ownership, secrets, RLS, no-async-onAuthStateChange, asset budgets, dead-layout guard, CI-status watchdog, root-doc allowlist, CLAUDE.md line budget, component line budgets, test co-location, frozen-clock) |
| 2 | `CI=true npm test` | after every code change | jest suite (unit + integration + source pins) |
| 2b | `CI=true npm run build` | after every code change — **`npm run gates` runs 1 + 2 + 2b as one command; prefer it** | the build Vercel runs. `CI=true` promotes ESLint warnings to errors, so a lint-only issue (e.g. `react-hooks/exhaustive-deps` after a ref moves into a hook) is a RED DEPLOY even with every test green. Jest and e2e cannot catch it — they don't lint. Red deploy July 27, 2026 |
| 3 | `npm run audit:scenarios` | `scenarios.js` or `constants.js` touched | scenario content: pots, cards, gradings, contrast pairs, effective stacks |
| 3b | `npm run audit:observations` | `observations.js` touched | Table Reads content (rules O1–O6) |
| 4 | `npm run simulate:schemas` | `deriveSchema` or rating engine touched | exits 1 on structural diagnosis bias |
| 5 | *process* | new Supabase table/column | goes in `supabase/schema.sql` with RLS + explicit policies; **flag the founder to run the SQL block in the Supabase editor BEFORE the deploy that uses it** |
| 6 | `npm run e2e` | gameplay/dashboard components, App.css, session flow | geometry guards, streak transitions, notebook, mobile fold, tap targets. **Requires `npm run e2e:build` first** — plain build bakes in Supabase keys and boots to SignIn where specs can't seed a user |
| 7 | *process* | any bug fixed or load-bearing decision made | **the ratchet law** — encode as a mechanical check the same session: invariants rule, audit rule, jest pin, e2e guard, or harness invariant. Prose rules drift; exit codes don't. A bug fixed without leaving a permanent check behind is a triage failure, not a fix |

**The eval:coach law:** re-run `CLAUDE_API_KEY=... npm run eval:coach` LIVE after ANY prompt or model change to `api/coach-read.js`, and judge the 9 reads against the F5 bar before deploying. Last live run: July 26, 2026 (voice reframe verified — 9/9 pass, zero trait verdicts).

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
- Never add answer-until-correct / re-attempt to the SCORED main loop — it corrupts the skill-accuracy ratings the whole rating engine stands on (RESEARCH_LEARNING_SCIENCE.md F4). An unscored "replay this hand" study mode is the acceptable form.
- When authoring scenario feedback text: the fb must explain WHY (price, position, villain type) — never just restate or dress up the action taken. Explanation quality is the highest-effect-size lever in the product (F1).
- Never `await` Supabase (or any async) calls inside the `onAuthStateChange` callback — supabase-js holds its auth lock during the callback and authed calls need that lock, so it deadlocks intermittently (the "stuck on Shuffling up…" bug, July 2026). Defer with `setTimeout(async () => {...}, 0)`.

---

## Single-file ownership map

Mechanically enforced by `npm run check:invariants` (rules 1–16). Violations are build errors.

| What | Owned by | Rule |
|---|---|---|
| Supabase client creation | `src/utils/supabase.js` | 1 |
| All Supabase reads/writes (string-literal table names only) | `src/utils/db.js` | 2 |
| PostHog (posthog-js) | `src/utils/analytics.js` | 3 |
| Sentry (@sentry/react) — imported FIRST in `index.js` | `src/utils/sentry.js` | 10 |
| AdSense (adsbygoogle) | `src/utils/ads.js` + `src/components/AdSlot.jsx` | 5 |
| Claude API calls | `api/coach-read.js` | 4 |
| Client → coach-read fetch | `src/utils/claude.js` | 4 |
| Local date formatting (`toLocalDateString`, `localDateFrom`, `formatShortDate`) | `src/utils/dates.js` | CA-028 / CA-037 |

`CLAUDE_API_KEY` and `SUPABASE_SECRET_KEY` are Vercel Sensitive vars (server-only). `REACT_APP_*` vars are public by definition — anything prefixed that way ships to the browser.

---

## Repo map

```
poker-trainer/
├── api/
│   └── coach-read.js          ← Vercel serverless function. ONLY code that calls Claude API.
├── src/
│   ├── index.js               ← Entry. Imports sentry.js FIRST (before any crash can occur).
│   ├── App.jsx                ← Screen router + auth/session orchestration (see Key Decisions).
│   ├── App.css                ← All layout including sc2-* canvas classes.
│   ├── copy.js                ← Shared UI strings that must move together across surfaces.
│   ├── components/
│   │   ├── AdSlot.jsx         ← Ad placement (dormant without REACT_APP_ADSENSE_CLIENT).
│   │   ├── Dashboard.jsx      ← Entry screen SKELETON only (≤250 lines, rule 21). Sections live in dashboard/.
│   │   ├── dashboard/         ← StreakWarning, StreakStatus, SchemaPanel, SkillLedger,
│   │   │                        LastSessionRead, CoachNotebook, BetaFeedback, UsernameEditor.
│   │   ├── DifficultySelector.jsx
│   │   ├── FeedbackPanel.jsx  ← Post-decision feedback overlay.
│   │   ├── PlayingCard.jsx
│   │   ├── ScenarioCard.jsx   ← Thin gameplay entry point (≤40 lines) → scenario/CanvasLayout.
│   │   ├── scenario/          ← CanvasLayout, TableCanvas, TimerRing, StreetBar,
│   │   │                        SituationTicker, SessionProgress, ActionButtons.
│   │   ├── SessionSummary.jsx ← End-of-session results + Coach's Read.
│   │   ├── SignIn.jsx         ← Auth screen: guest CTA + magic-link + Google.
│   │   ├── TableReads.jsx     ← Villain-identification mode (mode-local scoring).
│   │   ├── UsernameEntry.jsx  ← First-run profile creation.
│   │   └── VillainGuide.jsx   ← Info modal: villain types, positions, glossary, schemas.
│   ├── hooks/
│   │   └── useCountUp.js      ← Stat count-up animation (CA-024). Wave 3 adds the session/auth hooks.
│   ├── data/
│   │   ├── constants.js       ← Skill names, PLAYER_SCHEMAS, rating engine.
│   │   ├── observations.js    ← Table Reads observation hands.
│   │   └── scenarios.js       ← Scenario content. Never edit for UI work.
│   └── utils/
│       ├── ads.js analytics.js claude.js dates.js db.js sentry.js
│       ├── handName.js        ← getHandName() — single-sourced (rule 19).
│       ├── random.js          ← shuffle() — single-sourced (CA-029).
│       ├── spacedrep.js       ← Session builder v2: dealing, graduation ladder, history rebuild.
│       ├── supabase.js
│       ├── ticker.js          ← buildTicker, villainSummary, relationLine (rule 19).
│       └── userStorage.js     ← localStorage cache + pure logic: schemas, ratings, streaks, IQ, coach reads.
├── e2e/                       ← 5 Playwright specs (smoke, streaks, context, taptargets, mobilefold).
├── scripts/                   ← check-invariants, audit-scenarios, audit-observations, simulate-schemas,
│                                 playtest-personas, eval-coach, export-review.
├── supabase/schema.sql        ← Full DB schema + RLS policies. Run in Supabase SQL editor.
├── public/                    ← Lowercase paths ONLY (Vercel is case-sensitive; macOS hides case renames).
└── vercel.json                ← Zero-config: { "framework": "create-react-app" }. api/ auto-mounted.
```

`src/hooks/` exists as of Wave 2 (`useCountUp`); Wave 3 adds `useAuthSession`, `useGuest`, `useSessionRun`.

**Split-tree laws (Wave 2, enforced by invariants 21–22):** `Dashboard.jsx` ≤ 250 lines, `ScenarioCard.jsx` ≤ 40, any module under `dashboard/`/`scenario/` ≤ 160 — when a residual nears its ceiling, extract rather than raise the number. Every module in `dashboard/`, `scenario/`, and `hooks/` needs a co-located `*.test.js` or the build fails.

**Clock law (invariants rule 23):** a test that pins `lastSessionDate`/`usernameChangedAt` to a literal date MUST freeze the clock (`jest.useFakeTimers()` + `jest.setSystemTime()`) or inject a fixed `now`. `streakAlive` reads the real `Date`, so an unfrozen test asserts against the machine's timezone — that is what kept CI red on `main` while the suite passed locally (run #17, July 2026).

**The `.sc2-table` width law:** `.sc2-table` needs its explicit `width:100%`. `.sc2-stage` is a single-cell grid, and a grid item with `margin:0 auto` and only absolutely-positioned children collapses to 0px wide without an explicit width — the table renders as a vertical line while functional tests stay green. **Screenshot the gameplay canvas after any `.sc2-stage` or `.sc2-table` CSS change.**

---

## Session rituals

- **Start of every session — intake triage.** Sentry issues, PostHog failure events (`coach_read_failed` should be zero, plus `profile_load_failed`, `scenario_disagree_failed`, `stale_session_cleared`, `decision_made.decision_ms` heatmap), `scenario_feedback` SQL, `feedback` SQL. **The link is being shared publicly — this runs at session START, no longer weekly.** Full drill + PostHog event catalog → `docs/operations/TRIAGE.md`.
- **After any `.sc2-stage`/`.sc2-table` CSS change:** screenshot the gameplay canvas (see law above).
- **After any prompt/model change to `api/coach-read.js`:** re-run `eval:coach` LIVE (see the eval law under Definition of Done).
- **New Supabase table/column:** the SQL block runs in the Supabase SQL editor BEFORE the deploy that uses it (gate 5). Deploy detail → `docs/operations/DEPLOY.md`.
- **Watch invariants rule 12 (`ci-status` WARN):** a red main on the local gate is the watchdog that catches a silently dead bug net (as it did July 19–26, 2026 — CI failed on every push for a week).
- **Founders' standing queue + working priorities live in `docs/product/ROADMAP.md`** — check it before starting new feature work.

---

## Key decisions (load-bearing; do not reverse without reading DECISIONS.md)

- **Derived-state pattern.** Skills, streak, Poker IQ, schema, coach-read history, direction tally, scenario history, `recentHands` — all rebuilt fresh on every `fetchRemoteUser` from the append-only `sessions.hands` log. Self-healing across devices; engine upgrades need zero migrations. `sessions.hands[].scenarioId` is load-bearing (history rebuilds from it).
- **Honest labeling.** Per-hand grading says "Recommended Play", never "Correct". Coach's Read is session-scoped field notes (July 22, 2026 reframe), never diagnosis-weight verdicts — 5 hands can't support "you are a X". The disagree box, replay chip ("↩ You missed this one before"), and "Free during beta" chip all reflect the same discipline.
- **No per-item SM-2/FSRS ease.** Spaced-rep v2 uses a fixed graduation ladder (`LADDER_SESSIONS = [2, 5, 13]`); at this pool size that's within noise of adaptive schemes and far more debuggable. Full engine detail → `docs/architecture/ENGINES.md`.
- **One live Claude call per session** (the Coach's Read); everything else is pre-written static feedback. Structured JSON output; `parseCoachRead` resolves structured vs legacy prose at render time.
- **`App.jsx` is routing + hook composition** (Wave 3 landed, July 27 2026 — 633 → 243 lines). Identity lives in `hooks/useAuthSession`, the guest gate in `hooks/useGuest`, the hand loop in `hooks/useSessionRun`, the persist pipeline in `utils/session.js:submitSession`. App still owns screen routing, the guide modal, and **`guestRef`** — the one shared channel, held by the composition root because neither hook can own it without a cycle (useGuest needs `authPhase` from useAuthSession; useAuthSession's listener needs the ref). MOD-014 contexts were deliberately skipped. Target end-state → `docs/architecture/TARGET_ARCHITECTURE.md`.
- **Single-file ownership** for every external SDK (see the ownership map above). Enforced by invariants; new integrations follow the same pattern.
- **`sessions` is append-only; archetype is never stored** (derived from skills + direction tally). RLS enabled on every table.

Full ledger of every decision + when to revisit → `docs/architecture/DECISIONS.md`.

---

## Where everything lives

`docs/INDEX.md` is the authoritative map — one line per document, read the doc whose description matches the task. Summary:

| Path | Contents |
|---|---|
| `docs/architecture/` | ARCHITECTURE (system + data flow), DECISIONS (do-not-reverse ledger), ENGINES (algorithm depth), TARGET_ARCHITECTURE (modularity end-state + wave plan) |
| `docs/conventions/` | AUTHORING_SCENARIOS, AUTHORING_OBSERVATIONS, CODE_CONVENTIONS |
| `docs/operations/` | GATES (Definition of Done detail), DEPLOY (Vercel + schema migrations), TRIAGE (intake drill + PostHog event catalog), TOOLING (local dev + eval harness usage) |
| `docs/research/` | Learning science, schema taxonomy, subscription market, villain types — the evidence base for engine choices |
| `docs/findings/` | Persona playtest findings, gameplay comprehension audit, scenario grading, scenario audit rules, Table Reads design |
| `docs/product/` | ROADMAP (current phase, working queue, backlog — the current-truth product picture) |
| `docs/audit/` | 2026-07-25 cohesion audit + lane reports (CA-001…CA-058) |
| `docs/superpowers/` | Plans + specs (immutable historical record of completed sessions) |

Root allowlist: `CLAUDE.md`, `README.md`, `FOUNDER_BRIEFING.md`, `PLAYTEST_BRIEF.md`. Any other tracked `*.md` at the repo root is a drift violation (enforced by invariants rule 15).
