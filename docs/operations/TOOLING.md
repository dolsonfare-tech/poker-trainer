# TOOLING — running locally, agent routing table, skill catalog, hook catalog

> **Read this when…** you want to see a change in a real browser before pushing,
> you're starting a new task and need to know which agent or model to use, you're
> looking for a project skill to invoke, or you're deciding whether to install a
> hook.

---

## Running the app locally

**Plain `npm start` is not the right command.** It reads `.env`, so it boots
against real Supabase and lands on the sign-in screen — you cannot reach gameplay
without completing a magic-link round trip, and anything you do there writes to
the production database. Blank the three public env vars instead and the app runs
in localStorage mode: same code path, no conditional trees, no account required.

### Option 1 — dev server with hot reload (use this while iterating)

```bash
REACT_APP_SUPABASE_URL= REACT_APP_SUPABASE_ANON_KEY= REACT_APP_POSTHOG_KEY= npm start
```

Serves on `http://localhost:3000` and rebuilds on save. Blanking those three vars
is the same trick `npm run e2e:build` uses (see `package.json`) — `hasSupabase` in
`src/utils/supabase.js` goes false and the whole auth path is skipped.

### Option 2 — static preview of the exact production bits (use this before pushing)

```bash
npm run e2e:build                                              # localStorage-mode production build
node -e "import('./e2e/server.mjs').then(m => m.startServer('./build', 4173))"
```

Serves `http://localhost:4173`. This is the same static server and the same build
the e2e suite runs against, so what you see is what the guards measured. Prefer it
over Option 1 for a final look: only a production build exercises minification and
the lazy-loaded chunks (`scenarios`, `tablereads`, `villainguide`).

### Getting to the screen you want

In localStorage mode you land on **"Create your profile"**, not the sign-in
screen. `hasSupabase` is false, so the auth phase resolves straight to
`noprofile` — there is no guest flow here at all, because the guest CTA only
exists as an alternative to signing in. Type any name and you are on the
dashboard with a fresh profile; **Deal Me In** starts a session. `localStorage.clear()`
in the devtools console resets you to that first screen.

To land on a *populated* dashboard (streak, skills, past reads) rather than an
empty one, seed the profile the way the e2e suite does — `baseUser()` and
`seedAndOpen()` in `e2e/helpers.mjs` are the canonical shape. Paste a
`localStorage.setItem('cr_user', …)` and reload.

### ⚠ Any full build CLOBBERS the localStorage-mode build

`npm run gates` ends with `CI=true npm run build`, and that plain build **bakes
your real Supabase keys into `build/`**. If a preview server is running against
`build/`, it silently starts serving the production-mode bundle and every reload
lands on the sign-in wall with no way to reach gameplay — the app looks broken or
unchanged when nothing is wrong with it.

This bit us on July 28: `e2e:build` → preview → `gates` → the preview turned into
a sign-in wall, and the change under review looked like it had not shipped.

**Rule: re-run `npm run e2e:build` after any `npm run gates` or `npm run build`
if a preview server is still up.** The same applies to `npm run e2e` — gate 6
requires `e2e:build` first for exactly this reason. When a local preview shows an
unexpected screen, check which build is on disk before debugging the code.

### Two things that will fool you

1. **The Coach's Read never renders locally.** It needs `/api/coach-read`, a Vercel
   function that neither local server has, so the read block fails and the rest of
   the summary renders around it (`utils/session.js` treats the read as
   fire-and-forget by design). This is expected, not a regression. Per-hand feedback
   is pre-written static content and works fine. To exercise the read path, stub it
   the way `stubCoach()` does in `e2e/helpers.mjs`.
2. **Viewport-gated layouts silently do nothing at the wrong window size.** The
   desktop side-by-side Hand Analysis only engages at **≥1280 CSS pixels**, and
   browser zoom shrinks the CSS viewport — a zoomed-in window on a 1440px display
   can report under 1280. Check `innerWidth` in the console before concluding a
   layout change didn't land. The mobile guards are the mirror image: `⌘0` to reset
   zoom, and use devtools device emulation rather than a narrow desktop window.

---

## Agent routing table

Use the lightest agent that can do the job. "Model" is the override; omitted =
session default. Sub-agent tasks named here are dispatched via the Agent tool.

| Task type | Agent | Model | Notes |
|-----------|-------|-------|-------|
| Scenario authoring / editing | executor | sonnet | Use `/scenario-authoring` skill first |
| Observation authoring (Table Reads) | executor | sonnet | Use `/scenario-authoring` skill — it covers observations too |
| Bug investigation / root-cause | debugger or systematic-debugging skill | opus | Find root cause before proposing any fix (ratchet law: fix must leave a permanent check) |
| Broad codebase search | Explore | — | Quick / medium / very-thorough breadth parameter |
| Architecture & design decisions | architect | opus | Read-only; produces a proposal for founder approval |
| Code review (diff) | code-reviewer | sonnet | Scoped to the diff — never a codebase sweep |
| UX / UI changes | designer | sonnet | Screenshot `.sc2-stage`/`.sc2-table` after any CSS change |
| Refactor / implementation | executor | sonnet (opus for multi-file) | One task at a time via SDD when multi-step |
| Research (learning science, etc.) | general-purpose | opus | Parallel lanes, 3-vote adversarial verification |
| Deploy | — | — | Use `/deploy-checklist` skill — no agent needed |
| Session-start triage | — | — | Use `/intake-triage` skill — no agent needed |
| Eval:coach (prompt/model change) | — | — | Founder runs `CLAUDE_API_KEY=... npm run eval:coach` — not a subagent |
| Planning / brainstorm | brainstorming skill → writing-plans skill | opus | Always brainstorm before plan; plan before SDD |
| Content audit fix (from triaged finding) | executor | sonnet | Use `audit-fix` skill when built |
| Persona playtest analysis | general-purpose | sonnet | `npm run playtest:personas -- --trials=10` then interpret |
| Schema-engine change | executor + verifier | opus | Must pass `npm run simulate:schemas` (exits 1 on structural bias) |

### Model selection rules (aligned with SDD)

- `haiku` — quick lookups, single-file mechanical transcription, cheap re-reviews
- `sonnet` — standard implementation, reviews, most executor tasks
- `opus` — architecture, deep analysis, root-cause debugging, research, multi-file integration

---

## Skill catalog

Project-scoped skills live in `.claude/skills/<name>/SKILL.md` and are
committed. Invoke with `/<name>` in the prompt.

### Built now — invoke these

| Skill | Trigger | Rationale | Priority |
|-------|---------|-----------|----------|
| `/scenario-authoring` | Any time `src/data/scenarios.js` or `src/data/observations.js` is touched | Densest repeated workflow — 18 audit rules + pot conventions + tableContext law + gate sequence. One wrong field wastes the whole audit run. | ★★★ |
| `/intake-triage` | START of every working session | Routes user-signal channels (Sentry/PostHog/SQL) into the ratchet. Without the drill, bugs accumulate and checks don't get encoded. | ★★★ |
| `/deploy-checklist` | Before AND after every push to main | SQL-before-deploy law, eval:coach gate on prompt changes, e2e:build gotcha. Both incidents (rebuys, scenario_feedback) were SQL-law violations. | ★★★ |

### Spec-only — build on demand

| Skill | Trigger | When to build |
|-------|---------|---------------|
| `observation-authoring` | Editing `src/data/observations.js` | When Table Reads pool grows significantly or O-rule violations recur |
| `eval-coach-workflow` | `api/coach-read.js` prompt or model change | When the eval:coach law gets violated or the founder wants the workflow automated |
| `audit-fix` | Starting a triaged finding fix | When fixing audit findings becomes a regular cadence (Phase 4+) |

---

## Hook catalog

Hooks run shell commands on Claude Code events. They inject context via
`<system-reminder>` tags. **These are spec'd — the founder decides whether to
install them.**

To install: add to `.claude/settings.json` under `"hooks"`.

### Hook 1 — auto invariants after src edits

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "cd /path/to/poker-trainer && npm run check:invariants 2>&1 | tail -5"
          }
        ]
      }
    ]
  }
}
```

**Rationale:** Gate 1 becomes a reflex, not a discipline. Single-file ownership
violations surface the moment the bad import is written, not at commit time.

**Trade-off:** Adds ~0.5s to every file edit. Disable by removing the matcher.
Only fires on `Edit`/`Write` tool calls, not on Bash edits.

### Hook 2 — screenshot reminder after layout CSS changes

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "FILE=$(cat | jq -r '.tool_input.file_path // empty'); grep -q 'sc2-stage\\|sc2-table' \"$FILE\" 2>/dev/null && echo 'REMINDER: screenshot the gameplay canvas after .sc2-stage/.sc2-table CSS changes (functional e2e passes while the table is invisible — see the July 18 table-collapse incident)'"
          }
        ]
      }
    ]
  }
}
```

**Rationale:** The July 18 table-collapse bug shipped to prod — Playwright
functional tests passed while `.sc2-table` was 0px wide. The screenshot is the
only defense. This hook makes the reminder automatic.

**Trade-off:** Fires on any file edit touching those class names, even in
comments. Low cost, no false negatives.

---

## CLI tools (not agents — these are deterministic)

| Command | Gate | When |
|---------|------|------|
| `npm run check:invariants` | 1 | After EVERY code change |
| `CI=true npm test` | 2 | After every code change |
| `npm run audit:scenarios` | 3 | `scenarios.js` or `constants.js` touched |
| `npm run audit:observations` | 3b | `observations.js` touched |
| `npm run simulate:schemas` | 4 | `deriveSchema` or rating engine touched |
| `npm run e2e` (after `e2e:build`) | 6 | Gameplay/dashboard/App.css/session flow |
| `npm run playtest:personas` | harness | Ladder/schema/IQ tuning |
| `npm run eval:coach` | eval | ANY prompt or model change in `api/coach-read.js` |
| `npm run export:review` | — | After every scenario batch |

Full gate details and verification recipes: [GATES.md](GATES.md).
