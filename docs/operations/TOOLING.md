# TOOLING — agent routing table, skill catalog, hook catalog

> **Read this when…** you're starting a new task and need to know which agent or
> model to use, you're looking for a project skill to invoke, or you're deciding
> whether to install a hook.

---

## Agent routing table

Use the lightest agent that can do the job. "Model" is the override; omitted =
session default. Sub-agent tasks named here are dispatched via the Agent tool.

| Task type | Agent | Model | Notes |
|-----------|-------|-------|-------|
| Scenario authoring / editing | executor | sonnet | Use `/scenario-authoring` skill first |
| Observation authoring (Table Reads) | executor | sonnet | Use `/observation-authoring` skill when built |
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

Project-scoped skills live in `.claude/skills/` and are committed. Invoke with
`/<name>` in the prompt.

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
            "command": "grep -q 'sc2-stage\\|sc2-table' \"$CLAUDE_TOOL_INPUT_FILE_PATH\" 2>/dev/null && echo 'REMINDER: screenshot the gameplay canvas after .sc2-stage/.sc2-table CSS changes (functional e2e passes while the table is invisible — see the July 18 table-collapse incident)'"
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
