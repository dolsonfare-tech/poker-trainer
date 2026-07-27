> **Read this when** you need to understand how the system is structured today — what files own what, how data moves, and how auth works. For algorithm depth (session builder, rating engine, schema diagnosis) see [ENGINES.md](ENGINES.md). For enforcement rules and gate commands see [docs/operations/GATES.md](../operations/GATES.md).

---

# CheckRaise — System Architecture

CheckRaise is a React (CRA) poker trainer live at checkraise.ai. The production deployment is Vercel; the backend is Supabase (PostgreSQL + Auth). When Supabase env vars are absent the app runs in localStorage-only mode — the same code path, no conditional render trees.

---

## Repo map

```
poker-trainer/
├── api/
│   └── coach-read.js          ← Vercel serverless function. Only code that calls Claude API.
├── src/
│   ├── index.js               ← Entry point. Imports sentry.js FIRST (before any crash can occur).
│   ├── App.jsx                ← Screen router only. All business logic lives in utils/.
│   ├── App.css                ← All layout including sc2-* canvas classes.
│   ├── components/
│   │   ├── AdSlot.jsx         ← Ad placement (dormant without REACT_APP_ADSENSE_CLIENT).
│   │   ├── Dashboard.jsx      ← Entry screen: stats, Player Profile, CTA, feedback.
│   │   ├── DifficultySelector.jsx
│   │   ├── FeedbackPanel.jsx  ← Post-decision feedback overlay.
│   │   ├── PlayingCard.jsx
│   │   ├── ScenarioCard.jsx   ← Gameplay: table, board, decision panel, timer.
│   │   ├── SessionSummary.jsx ← End-of-session results + Coach's Read.
│   │   ├── SignIn.jsx         ← Auth screen: guest CTA + magic-link + Google.
│   │   ├── TableReads.jsx     ← Villain-identification mode (mode-local scoring).
│   │   ├── UsernameEntry.jsx  ← First-run profile creation.
│   │   └── VillainGuide.jsx   ← Info modal: villain types, positions, glossary, schemas.
│   ├── copy.js                ← Shared UI strings that must move together across surfaces (CA-032).
│   ├── data/
│   │   ├── constants.js       ← Skill names/descriptions, PLAYER_SCHEMAS, rating engine.
│   │   ├── observations.js    ← Table Reads observation hands (22 hands).
│   │   └── scenarios.js       ← 172 scenarios. Content file — never edit for UI work.
│   └── utils/
│       ├── ads.js             ← Only AdSense file. No-op without REACT_APP_ADSENSE_CLIENT.
│       ├── analytics.js       ← Only PostHog file. No-op without REACT_APP_POSTHOG_KEY.
│       ├── claude.js          ← Client fetch to /api/coach-read. Never calls Anthropic directly.
│       ├── dates.js           ← toLocalDateString / localDateFrom / formatShortDate. Single source (CA-028/CA-037).
│       ├── db.js              ← Only Supabase read/write file.
│       ├── random.js          ← shuffle(). Single source (CA-029).
│       ├── sentry.js          ← Only Sentry file. No-op without REACT_APP_SENTRY_DSN.
│       ├── spacedrep.js       ← Session builder (v2): dealing, graduation ladder, history.
│       ├── supabase.js        ← Only file that creates the Supabase client.
│       ├── ticker.js          ← Situation ticker derivation + villainSummary.
│       └── userStorage.js     ← localStorage cache + pure logic: schemas, ratings, streaks.
├── e2e/                       ← 5 Playwright specs (context, mobilefold, smoke, streaks, taptargets).
│   ├── helpers.mjs
│   ├── run.mjs
│   └── server.mjs
├── scripts/                   ← Dev/CI tooling (check-invariants, audit-scenarios, etc.).
├── supabase/
│   └── schema.sql             ← Full DB schema + RLS policies. Run in Supabase SQL editor.
├── public/
│   └── index.html             ← OG/SEO tags, Google Fonts (async media="print" swap).
└── vercel.json                ← Zero-config: { "framework": "create-react-app" }. api/ auto-mounted.
```

---

## Single-file ownership map

These invariants are mechanically checked by `npm run check:invariants` (rules 1–14). Violations are build errors.

| What | Owned by | Rule |
|---|---|---|
| Supabase client creation | `src/utils/supabase.js` | 1 |
| All Supabase reads/writes | `src/utils/db.js` | 2 |
| PostHog (posthog-js) | `src/utils/analytics.js` | 3 |
| Sentry (@sentry/react) | `src/utils/sentry.js` | 10 |
| AdSense (adsbygoogle) | `src/utils/ads.js` + `src/components/AdSlot.jsx` | 5 |
| Claude API calls | `api/coach-read.js` | 4 (secrets never reach browser) |
| Local date formatting | `src/utils/dates.js` | CA-028 / CA-037 |
| `shuffle()` | `src/utils/random.js` | CA-029 |

`CLAUDE_API_KEY` and `SUPABASE_SECRET_KEY` are Vercel Sensitive vars — server-only. `REACT_APP_*` vars are public by definition (bundled into the client).

---

## Screen states and routing

`App.jsx` is the sole router. It renders exactly one screen based on two orthogonal pieces of state:

**`authPhase`** (Supabase mode only):

| Value | When | What renders |
|---|---|---|
| `'loading'` | Waiting for `onAuthStateChange` first event | "Shuffling up…" spinner |
| `'signedout'` | No session (or explicit sign-out) | `SignIn` |
| `'guest'` | Playing the one free unauthenticated session | App shell (with guest restrictions) |
| `'noprofile'` | Signed in, no profile row yet | `UsernameEntry` |
| `'error'` | Profile fetch failed (network/5xx) | Branded retry screen |
| `'ready'` | Signed in + profile loaded | App shell |
| `'local'` | No Supabase keys | App shell (localStorage mode) |

**`screen`** (inside the app shell):

| Value | Component |
|---|---|
| `'dashboard'` | `Dashboard` |
| `'difficulty'` | `DifficultySelector` |
| `'session'` | `ScenarioCard` → `SessionSummary` (via `showSummary` flag) |
| `'tablereads'` | `TableReads` |

Logo tap returns to `'dashboard'` from any screen. `VillainGuide` is an overlay (modal), not a screen state.

Session constants (hardcoded in `App.jsx`): `SESSION_LENGTH = 5`, `TIMER_SECONDS = 60`, `GUEST_FREE_SESSIONS = 1`.

---

## Auth flow

```
[No session]
    │
    ▼
SignIn (magic-link | Google OAuth | "Try a free session →" guest CTA)
    │
    ├─ Guest path ──────────────────────────────────────────────────────────►
    │   handleGuestPlay() → authPhase='guest', screen='difficulty'
    │   One free session only. No coach read (server-gated). Progress saved
    │   to untagged localStorage cache. At gate: handleGuestSignIn() →
    │   authPhase='signedout' (cache survives for migration).
    │
    └─ Sign-in path ────────────────────────────────────────────────────────►
        onAuthStateChange fires SIGNED_IN
            │
            └─ setTimeout(async, 0) ← NEVER await inside the callback
                   │
                   ├─ fetchRemoteUser() succeeds + profile exists
                   │     → authPhase='ready', user set, cache owner-tagged
                   │
                   ├─ fetchRemoteUser() succeeds + NO profile row
                   │     → authPhase='noprofile' → UsernameEntry
                   │         → createRemoteProfile() (ignoreDuplicates on
                   │           both upserts — never overwrites existing rows)
                   │         → migrates untagged local cache if present
                   │
                   ├─ 401/403 from getUser() (stale/revoked session)
                   │     → tracks stale_session_cleared, signOut({scope:'local'})
                   │     → authPhase='signedout'
                   │
                   └─ Generic error (network, 5xx)
                         → tracks profile_load_failed
                         → authPhase='error' (retry screen — NOT noprofile)
```

**Cache ownership** — the localStorage key `cr_user` doubles as (a) pre-Supabase tester's migration payload or (b) a signed-in account's warm cache. The companion key `cr_user_owner` tags (b) with the auth uid. `SIGNED_OUT` clears only owner-tagged caches; untagged caches survive (migration data). This prevents the two-accounts-one-phone stats leak (one account's warm cache seeding the next account's profile row).

---

## Data flow

### Two modes

**localStorage mode** (`hasSupabase === false`): All user state lives in `cr_user`. `applySessionResults` in `userStorage.js` is the only write path. Coach reads work if `CLAUDE_API_KEY` is set server-side but the daily cap is not enforced (no `coach_usage` table).

**Supabase mode** (`hasSupabase === true`): localStorage is a warm cache. The authoritative state is four DB tables: `profiles`, `skills`, `sessions` (append-only), `coach_usage`.

### Derived state pattern

The user object's computed fields are never trusted from the DB — they are derived fresh on every `fetchRemoteUser()` from the append-only `sessions` log. This makes the in-memory shape self-healing across devices:

| Derived field | Source | Derivation |
|---|---|---|
| `scenarioHistory` | `sessions.hands[].scenarioId` | `historyFromSessions()` in spacedrep.js |
| `recentHands` | `sessions.hands[].{skill,result}` | `recentHandsFromSessions()` in db.js |
| `directionTally` | `sessions.hands[].{scenarioId,choiceVal,result}` | `directionTallyFromSessions()` in db.js |
| `coachReads` | `sessions.coach_read` | `coachReadsFromSessions()` in db.js |
| `schema` | `skills` + `directionTally` | `deriveSchema()` in userStorage.js |
| `pokerScore` | `skills` + `recentHands` | `derivePokerScore()` in userStorage.js |
| `activeDaysLast30` | `sessions.created_at` | `activeDaysLast30()` in db.js |

**Sessions fetch is bounded**: `fetchRemoteUser()` fetches the newest 1000 sessions rows (descending, then reversed to ascending for derivations). `bestSessionCorrect` is a separate `MAX` aggregation query so it stays lifetime-accurate beyond the 1000-row window.

**Between loads**, `applySessionResults()` in `userStorage.js` updates all derived fields in memory so the current device stays accurate without a round-trip. `saveRemoteUser()` persists the profile + skill rows; `recordSession()` appends the session row.

### localStorage keys

| Key | Contents | Clears on |
|---|---|---|
| `cr_user` | Serialized user object (warm cache) | Sign-out (owner-tagged only) |
| `cr_user_owner` | Auth uid of cache owner | Sign-out (owner-tagged only) |
| `cr_last_difficulty` | Last-played difficulty string | Never (device preference) |
| `cr_table_reads_stats` | Table Reads lifetime tally | Never (device-local, mode-local) |

---

## Coach's Read pipeline

`SessionSummary` → `handleFetchCoachRead()` in `App.jsx` → `fetchCoachRead()` in `src/utils/claude.js` → `POST /api/coach-read` → `api/coach-read.js` → Claude API (`claude-sonnet-5`, `max_tokens: 500`, structured JSON output via `output_config`).

- Requires a signed-in user (server checks the Supabase Bearer token).
- Daily cap: 5 calls/user/day enforced in `coach_usage` table; returns HTTP 429 on breach. Client mirrors `COACH_DAILY_LIMIT = 5` in `SessionSummary.jsx` for honest copy.
- Wire format: `{ text: string }` — `text` is canonical JSON (`{headline, evidence[], watchFor}`) on success or raw prose on parse failure (graceful degradation). `parseCoachRead()` in `userStorage.js` resolves to `{ structured }` or `{ legacy }` at render time.
- Guests: `isGuest` check in `App.jsx` skips the fetch entirely; summary states this honestly as the sign-in incentive.

---

## Supabase tables

All tables have RLS enabled with explicit policies (enforced by `check:invariants` rule 8).

| Table | Purpose |
|---|---|
| `profiles` | One row per user: display_name, streak, sessions_completed, poker_score, coach_note_*, rebuys, etc. |
| `skills` | One row per user per skill (8 rows/user): rating, attempts, correct. |
| `sessions` | Append-only log: difficulty, hands (JSON array), correct_count, coach_read. Source of truth for all derived history. |
| `coach_usage` | Per-user per-day call counter for the 5/day cap. |
| `scenario_feedback` | Insert-only "Disagree?" submissions (founders read via service role). |
| `feedback` | Insert-only beta feedback form submissions. |

---

## Dead code (do not resurrect)

The following identifiers were deleted and are guarded by invariant rule 13:

- `USE_SINGLE_CANVAS` — feature flag for the old two-column layout
- `LegacyLayout` — the two-column felt/cream gameplay layout
- `DecisionPanel` — component of LegacyLayout
- `TableVisual` — component of LegacyLayout

Also absent (confirmed by `ls`):

- `src/utils/gamification.js` — placeholder, deleted
- `src/utils/skillrating.js` — placeholder, deleted
- `src/components/SkillTracker.jsx` — removed from gameplay screen, deleted
