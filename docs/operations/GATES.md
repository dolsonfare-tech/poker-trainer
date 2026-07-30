# GATES — the Definition of Done, mechanically

> **Read this when…** you're about to declare any change complete, you're wondering
> which gate a change triggers, a gate failed and you need to know what it enforces,
> or you're adding a new invariant (see the ratchet law at the bottom).

Every gate is deterministic and costs zero LLM tokens. If a change can't satisfy a
gate, say so explicitly — never weaken or skip a check to get green.

## Gate summary

| # | Command | When | Enforces |
|---|---------|------|----------|
| 1 | `npm run check:invariants` | after EVERY code change | architecture rules 1–16 (below) |
| 2 | `CI=true npm test` | after every code change | jest unit + integration suite |
| 3 | `npm run audit:scenarios` | `scenarios.js` or `constants.js` touched | scenario content consistency |
| 3b | `npm run audit:observations` | `observations.js` touched | Table Reads content (O1–O6) |
| 4 | `npm run simulate:schemas` | `deriveSchema` or rating engine touched | exits 1 on structural diagnosis bias |
| 5 | (process) | new Supabase table/column | schema.sql + RLS + run SQL BEFORE deploy — see [DEPLOY.md](DEPLOY.md) |
| 6 | `npm run e2e` | gameplay/dashboard components, App.css, session flow | browser geometry + behavior guards |
| 7 | (process) | any bug fixed / load-bearing decision made | the ratchet law (below) |

## Gate 1 — invariants (`scripts/check-invariants.mjs`)

Exit 1 on any ERROR. The rules, read from the script:

| Rule | Id | Sev | Catches |
|------|----|-----|---------|
| 1 | `supabase-client` | ERROR | `createClient(` anywhere in src except `src/utils/supabase.js` |
| 2 | `db-access` | ERROR | `.from('` outside `src/utils/db.js`; plus any *dynamic* `.from(` inside db.js (table names must be string literals — no generic query helpers) |
| 3 | `posthog` | ERROR | posthog-js import/require or `posthog.capture/identify/init/reset` outside `src/utils/analytics.js` |
| 4 | `secrets` | ERROR | `CLAUDE_API_KEY`, `SUPABASE_SECRET_KEY`, `api.anthropic.com`, `sk-ant-` in src/ or public/; any `REACT_APP_*SECRET/PRIVATE/SERVICE*` var (REACT_APP_ = public by definition) |
| 5 | `adsense` | ERROR | `adsbygoogle`/`googlesyndication` outside `src/utils/ads.js` + `src/components/AdSlot.jsx` |
| 6 | `auth-deadlock` | ERROR | `onAuthStateChange(async …)` — supabase-js holds its auth lock during the callback (the "stuck on Shuffling up…" bug); defer with `setTimeout(async () => {…}, 0)` |
| 7 | `env-tracked` / `case-sensitivity` | ERROR | any `.env*` tracked by git (except `.example`, incl. `.env_backup`-style names); any uppercase path under `public/` (Vercel is case-sensitive; macOS hides case-only renames — the icon-404 bug) |
| 8 | `rls` | ERROR/WARN | a table in `supabase/schema.sql` without `ENABLE ROW LEVEL SECURITY` (ERROR); RLS but zero policies (WARN — service-role-only, confirm intended) |
| 9 | `create-no-clobber` | ERROR | an upsert in `createRemoteProfile` without `ignoreDuplicates: true` — the create path must never overwrite an existing profile/skills row (July 2026 data-loss chain) |
| 10 | `sentry` | ERROR | `@sentry/` import/require or `Sentry.*()` call outside `src/utils/sentry.js` |
| 11 | `fonts-async` | ERROR | a render-blocking `fonts.googleapis.com/css2` stylesheet link in `public/index.html` — must use the `media="print"` async-swap pattern or sit inside `<noscript>` (~790ms mobile first-paint cost) |
| 12 | `ci-status` | WARN | latest completed CI run on main isn't `success` (best-effort GitHub API fetch, 2.5s timeout, skipped inside CI and when offline) — the local watchdog for a silently dead bug net |
| 13 | `dead-layout` | ERROR | `USE_SINGLE_CANVAS` / `LegacyLayout` / `DecisionPanel` / `TableVisual` reappearing in src/ — the legacy two-column layout was DELETED July 2026; CanvasLayout is the only render path (git history has the code) |
| 14 | `asset-budget` | ERROR | `public/favicon.ico` > 60,000 B or `public/icons/icon-512.png` > 150,000 B (favicon was 279 KB pre-fix; fetched every page load) |
| 15 | `root-docs` | ERROR | any tracked `*.md` at the repo root outside the allowlist {CLAUDE.md, README.md, FOUNDER_BRIEFING.md, PLAYTEST_BRIEF.md, decision-log.md} — new docs live in `docs/` |
| 16 | `claude-md-budget` | ERROR | `CLAUDE.md` exceeds 400 lines — depth lives in `docs/`; the per-session law file must stay skimmable |

Adding a rule: state WHICH CLAUDE.md rule it enforces, prefer patterns that can't
false-positive (the script's own header documents this).

## Gates 3/3b — content audits

- `audit:scenarios` — ~20 mechanical rules over every scenario: structural integrity
  (`struct`), pot fields incl. recomputed preflop pots (`pot`/`potpre`), card/suit
  discipline (`cards`), stated odds vs computed (`odds`/`math`), street language
  (`street`/`R2`), position claims (`position`/`hero`), actionHistory shape (`hist`),
  toCall vs call button (`R1`/`call`), contrast pairs (`CONTRAST`/`pairs`), session-read
  phrases needing `tableContext` (`context`), effective stacks (`stacks`, R10), grade
  labels (`label`). Authoring detail: [../conventions/AUTHORING_SCENARIOS.md](../conventions/AUTHORING_SCENARIOS.md).
- `audit:observations` — rules O1–O6: structural integrity (O1), answer/distractor
  discipline — exactly 3 distractors, each with `whyNot`, never `unknown` (O2), replay
  integrity — street order, boards on postflop rows only (O3), showdown as the
  difficulty dial — beginner hands must keep it (O4), suit symbols only, no
  shorthand notation anywhere text lives (O5), and O6 (July 22): observed-this-session
  repetition claims in a tell WARN unless context/showdown carries the evidence. Detail: [../conventions/AUTHORING_OBSERVATIONS.md](../conventions/AUTHORING_OBSERVATIONS.md).

## Gate 2 — jest, and the source-pin idiom

`CI=true npm test`. Beyond behavior tests, the suite uses **source pins**: a test
reads a source file's text and asserts a load-bearing pattern exists (e.g.
`SignIn.test.js` pins that both auth redirect options reference the `SITE_URL`
constant, not `window.location.origin`). Use a source pin when the invariant is
about *how the code is written*, not what it outputs — it's the jest-level twin of
an invariants rule.

## The harnesses

- **`npm run simulate:schemas`** — runs the REAL `deriveSchema` against synthetic
  archetype profiles; **exits 1 on structural diagnosis bias**. The regression gate
  for any schema-engine work.
- **`npm run playtest:personas [-- --trials=N]`** — 8 directional personas × 40
  sessions through the REAL loop (real dealer, real `applySessionResults`, simulated
  multi-day clock). Mechanical invariants (session shape, ≤2 replays, replay
  integrity, R2 same-day floor) are the emergent-bug hunter — it caught the R4
  duplicate-deal and the schema-v2 transient mislabels within hours. Also the
  calibration bed for ladder/IQ/schema tuning. CI runs 1 trial; use `--trials=10`
  for distribution-level acceptance.
- **`npm run eval:coach`** — 9 synthetic sessions through the REAL coach prompt
  (`buildPrompt`/`callClaude` from `api/coach-read.js`). Live mode needs a key:
  `CLAUDE_API_KEY=sk-... npm run eval:coach` — Vercel-Sensitive keys are write-only,
  so the founder uses a short-lived console key. `npm run eval:coach -- --dry` prints
  prompts without calling. Output → gitignored `coach-eval-output.md`.
  **THE LAW: re-run LIVE after ANY prompt or model change**, and judge the 9 reads
  against the F5 bar before deploying. Last live run: July 26, 2026 — the July 22
  voice reframe verified (9/9 pass, zero trait verdicts; residuals logged in
  `docs/architecture/ENGINES.md` §coach pipeline).

## Gate 6 — e2e suite (two lanes, ~35s)

Plain-Playwright specs (no framework — `e2e/runner.mjs` orchestrates, each lane's
entry point supplies its spec directory and required build) against a static
production build, coach endpoint stubbed. Deterministic element-box assertions,
deliberately NOT screenshot diffs (flaky, and diffs rot).

### Two builds, because auth mode is a build-time fact

CRA inlines `process.env.REACT_APP_*` as string literals at webpack time, so
`supabase.js`'s `url && key ? createClient(...) : null` is decided by the build.
One bundle is in exactly one auth mode, and the suite needs both:

| Lane | Build first | What it can reach |
|------|-------------|-------------------|
| `npm run e2e` (9 specs, 146 checks) | `npm run e2e:build` — blanks `REACT_APP_SUPABASE_URL`/`ANON_KEY` | localStorage mode: `hasSupabase` false, App boots to UsernameEntry, specs seed a profile and drive the product. **SignIn is unreachable.** |
| `npm run e2e:auth` (1 spec, 30 checks) | `npm run e2e:build:auth` — DUMMY Supabase env (`https://stub.supabase.e2e`) | auth-stub mode: `hasSupabase` true, no session in localStorage, App renders **SignIn**. Every request to the (unresolvable) stub host is intercepted in-spec. |

The plain `npm run build` bakes in `.env`'s real Supabase keys — a third flavor,
and **neither lane may run against it**.

**Both lanes refuse the wrong build.** `e2e/buildmode.mjs` classifies `build/` as
`production` / `authstub` / `localstorage` and each lane declares which one it
needs. Production is tested first and wins ties, so a stray stub literal can never
disarm the "never drive e2e against the live project" half. Its `selfTest()`
negative control runs on every lane invocation *and* inside `check:invariants`
(rule 37) — `npm run gates` never runs e2e, so without that second call site a
gutted classifier would ship. Rule 37 also pins the two lanes to different build
modes, keeps `e2e:build:auth` blanking `REACT_APP_POSTHOG_KEY` (rule 25's leak,
second build), and requires CI to run the lane.

The loud failure is the auth lane against the localStorage build: SignIn never
renders and every check fails. The **silent** one — a spec added to the auth lane
that actually needed localStorage mode — is what rule 37 exists for.

### Lane 1 — `npm run e2e`

| Spec | Guards |
|------|--------|
| `smoke.spec.mjs` | Core session flow + GEOMETRY GUARDS at 1200px: table/felt real dimensions (the July 18 0px-wide table-collapse class — functional tests stayed green while the UI was destroyed), bubble-vs-board/hero overlap, stakes row shows `$N EFFECTIVE`, real IQ line, structured read + watch-for, chaining CTA |
| `streaks.spec.mjs` | Streak transitions under a fake clock (Date shim reads a day-offset from localStorage): day-7 milestone + Rebuy earn, missed day consuming the Rebuy with streak intact, broken-streak moment (never a bare "Day 1 secured") |
| `context.spec.mjs` | The READ/FILE line renders at decision time (comprehension audit C1, sc_167 class) + Coach's Notebook: history lists, newest excluded, legacy prose never duplicated |
| `taptargets.spec.mjs` | CA-040: ≥44px hit areas at 390×844 for the feedback-capture surfaces (disagree toggle + chips, guide close/tabs, Table Reads links) |
| `mobilefold.spec.mjs` | CA-038: at 390×844 from scrollTop 0, every action button + ticker top inside the fold (both difficulties), table-collapse guard at phone width, hero-cluster containment, dashboard CTA above the fold |

### Lane 2 — `npm run e2e:auth`

| Spec | Guards |
|------|--------|
| `auth/signin.spec.mjs` | ROADMAP item 8's gap, closed July 30 2026 — the screen where cold traffic decides whether to stay, previously pinned in jest only. Boot fires ZERO Supabase network (the claim the whole lane rests on, asserted not assumed); guest-first hierarchy for a fresh visitor (filled CTA above a bare-text reveal, measured from computed background + stacking, email form absent from the DOM, both subtitle strings); **the reveal REMOVES the guest CTA** — the July 27 founder fix, negative-controlled by reverting `!showSignIn` and confirming exactly this check fails; guest CTA lands on the level picker; magic-link success (submit gated on `@`, one request, address unpadded on the wire, sent state echoes it + the close-tab line); error path (GoTrue `msg` surfaces, `ue-input-error` set, typing clears both); a used-up guest sees the ♠ carry-over note and no CTA |

**Out of scope, stated in the spec header so partial coverage is never mistaken for
full:** magic-link *completion* (email delivery + redirect-with-session needs a live
project), OAuth (`REACT_APP_GOOGLE_AUTH` unset — a check pins the button's absence
rather than letting silence look like coverage), and any real Supabase traffic. The
lane proves the client's behavior around the API, never the API's.

## CI (`.github/workflows/ci.yml`)

Every push to main + every PR. Node **24**, `permissions: contents: read`. Order:
`npm ci` → invariants → audit:scenarios → audit:observations → `CI=true npm test` →
simulate:schemas → playtest:personas (1 trial) → production build (localStorage mode
— no env in CI) → Playwright install → e2e → **auth-stub build → e2e:auth**.

The second build is why the auth lane is last: it overwrites `build/`, so nothing
that needs the localStorage bundle may run after it.

**History note:** CI was never green until July 26, 2026 — it failed silently on
every push July 19–26 (lockfile out of sync under npm 10) and nobody noticed; the
bug-net layer was dead for a week. **Run #11 was the first green.** Invariants rule
12 (`ci-status`) is the local watchdog that shouts a red main on every gate run.

## The ratchet law (gate 7)

Every bug class ever hit gets encoded as a mechanical check **in the same session**
it's fixed: an invariants rule, an audit rule, a jest pin, an e2e guard, or a
harness invariant. Prose rules drift; exit codes don't. A bug fixed without leaving
a permanent check behind is a triage failure, not a fix (see [TRIAGE.md](TRIAGE.md)).
Same for load-bearing decisions: if it's a "never do X" or "only file Y does Z",
it goes in `scripts/check-invariants.mjs` the session it's documented.

## Verification recipes

- **Stub-Supabase Playwright** (auth-path changes): dev server in Supabase mode
  pointed at `https://stub.supabase.co`, EVERY request intercepted by Playwright
  routes — drives the real auth listener with zero prod contact.
- **localStorage-mode dev server**: start with the `REACT_APP_SUPABASE_*` vars
  blank — the app runs keyless (same mode as `e2e:build`), jest-safe.
- **Prod-bundle string verification**: after a deploy, grep the served JS bundle for
  a feature string (e.g. "Recommended Play") to prove the deploy actually carries
  the change — see [DEPLOY.md](DEPLOY.md).
- **Forged-JWT stale-session check**: forge an unexpired-but-invalid Supabase JWT →
  the app must recover to SignIn with the token cleared (`stale_session_cleared`).
  Manual unblock for a stuck device: delete `sb-*` localStorage keys and reload.
