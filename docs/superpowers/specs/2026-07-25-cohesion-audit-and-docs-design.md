# CheckRaise Cohesion Audit, Docs Restructure & Tooling — Design Spec

**Date:** 2026-07-25
**Status:** Approved design (brainstorming complete); implementation plan to follow
**Origin:** Founder request — "audit app for cohesion, be hypercritical and vigilant about security, performance, code quality, usability, and any kind of lack of code reuse. Let's go for modularity. At the end: a full updated documentation set that lets us build faster, plus a complete list of Claude agent/CLAUDE.md/skill updates."

---

## Decisions made during brainstorming

| Question | Decision |
|---|---|
| What happens to audit findings | Audit → triaged queue. Findings docs with severity + effort; founder triages (July 20 UX-audit ritual); fixes become their own planned sessions. NO fixing during the audit. |
| Docs deliverable shape | Full `docs/` tree restructure, including a lean CLAUDE.md. |
| Agents/skills depth | Full catalog spec + actually build the top 3 skills in this effort. |
| Audit scope | Everything: app source, infra & config (schema.sql/RLS, vercel.json, CI, deps), live browser usability pass, content-pool structure (NOT grading correctness), and the test/gate net itself. |
| Execution order | Approach A — sequenced: Audit → Docs → Tooling. Each phase feeds the next; no rework. |

**Context facts that shaped the design:**
- No project-level `.claude/agents` or `.claude/skills` exist — the tooling deliverable is creation, not update. Plugin agents (OMC etc.) aren't ours to edit; "agent updates" becomes a routing table.
- CLAUDE.md is ~19k words of session-log prose — the largest per-session context tax, and already drifted (claims `App.jsx` is in `src/components/`; it's in `src/`).
- Size hotspots: `App.css` 3,797 · `Dashboard.jsx` 717 · `ScenarioCard.jsx` 684 · `userStorage.js` 672 (cache + streaks + schema engine + coach-read parsing) · `App.jsx` 652 (despite the "routing only" decision) · `scenarios.js` 7,690 (172 scenarios, one file).
- The deterministic gate net (7 gates + CI + e2e + persona harness) is strong; the audit builds on it rather than duplicating it.

---

## Phase 1 — The Audit

Five parallel **read-only** specialist lanes (subagents), each with the same output contract. Zero code changes during this phase. The live usability pass uses the existing `e2e:build` localStorage-mode harness (coach endpoint stubbed, no real backend contact).

### Lanes

1. **Security & infra** — `api/coach-read.js` (auth, rate limit, input clamps, clamp-before-prompt-assembly order), `supabase/schema.sql` RLS + policies + `username_change_limit` trigger, client-trust boundaries (client-computed `streak`/`rebuys`/`poker_score` own-row writes — document the trust model's edges and future-leaderboard poisoning risk), env-var handling, `.github/workflows/ci.yml`, `vercel.json`, `npm audit` + `npm outdated`.
2. **Performance** — bundle composition (does `scenarios.js` ship in the main chunk; code-split opportunities), re-render patterns in App/Dashboard/ScenarioCard, `assembleUser` rebuilding scenarioHistory + directionTally + recentHands + coachReads from ALL sessions rows on every fetch (unbounded O(n) with account age — needs a growth-ceiling analysis), `App.css` size/dead selectors, Lighthouse on the prod build.
3. **Code quality & modularity** — the four monoliths (`userStorage.js`, `Dashboard.jsx`, `ScenarioCard.jsx`, `App.jsx`), duplication across components, dead code (`gamification.js`, `skillrating.js`, `dummyUser.js`, `SkillTracker.jsx`, unused CSS), single-file-ownership adherence beyond what invariants mechanically check, content-pool structure (172 inline scenario objects — authoring ergonomics, whether pools should become per-batch data files). **This lane's output feeds TARGET_ARCHITECTURE.md directly.**
4. **Usability (live)** — drive the real app in a browser as a user: guest flow, onboarding, full session, feedback/disagree/peek, summary moments, dashboard (ledger FLIP, notebook, profile card), Table Reads, VillainGuide. Desktop + mobile viewport. A11y basics: keyboard navigation, focus management, contrast, reduced-motion paths.
5. **Test & gate quality** — do the 7 gates enforce what CLAUDE.md claims (spot-check rule by rule); jest/e2e coverage gaps vs shipped behavior; e2e brittleness risk; gate blind spots (e.g., invariants can't see schema-engine logic bugs); doc drift detection (inventory of CLAUDE.md claims vs reality).

### Output contract (every finding)

```
id · axis · severity (P0–P3) · evidence (file:line) · why it matters · proposed fix · effort (S/M/L)
```

- P0 = exploitable/data-loss/launch-blocking · P1 = will bite soon or blocks modularity · P2 = quality debt · P3 = polish.
- Consolidator (main session) **spot-checks a sample of each lane's evidence** before accepting (subagents over-report), dedupes cross-lane overlaps, produces:
  - `docs/audit/2026-07-25-cohesion-audit.md` — consolidated findings (first resident of the new tree)
  - a triage table (finding → severity → effort → recommendation)

### Triage

Founder triages via batched AskUserQuestion rounds: **fix-now / queue / reject** per finding. P0 security findings are flagged for immediate scheduling regardless of batch order. Accepted findings enter the work queue as future planned sessions; per gate-7 law, each eventual fix must leave a permanent mechanical check behind.

---

## Phase 2 — Docs Restructure

### Target tree

```
docs/
├── INDEX.md                    ← the map: one line per doc, when to read it
├── architecture/
│   ├── ARCHITECTURE.md         ← current system: screens, data flow, derived-state pattern,
│   │                             single-file ownership map
│   ├── TARGET_ARCHITECTURE.md  ← modularity end-state, written FROM audit lane-3 findings;
│   │                             the destination every triaged fix steers toward
│   ├── ENGINES.md              ← durable specs extracted from CLAUDE.md session logs:
│   │                             session builder v2 (R1–R4, F1 surge), rating/IQ (recency
│   │                             window), schema hybrid engine, coach pipeline, streak math
│   └── DECISIONS.md            ← "Key Decisions — Do Not Reverse" ledger, dated, with
│                                 rationale; includes rejected-on-the-record ideas
├── conventions/
│   ├── AUTHORING_SCENARIOS.md  ← pot conventions, tableContext vs body, actionHistory rules,
│   │                             contrast pairs, effectiveStacks, feedback-text rules,
│   │                             option-label display, suit symbols
│   ├── AUTHORING_OBSERVATIONS.md ← Table Reads authoring (from TABLE_READS_DESIGN.md + O-rules)
│   └── CODE_CONVENTIONS.md     ← honest labeling, copy voice, CSS patterns, test patterns
├── operations/
│   ├── GATES.md                ← full gate details, when each runs, verification recipes
│   ├── DEPLOY.md               ← SQL-before-deploy ordering, env vars, Vercel specifics,
│   │                             eval:coach-before-deploy law
│   ├── TRIAGE.md               ← the intake-triage drill (4 channels → work items → ratchet)
│   └── TOOLING.md              ← agent routing table + skill/hook catalog (Phase 3 output)
├── research/                   ← RESEARCH_LEARNING_SCIENCE / SCHEMA_TAXONOMY /
│                                 SUBSCRIPTION_MARKET / VILLAIN_TYPES move here
├── findings/                   ← PERSONA_PLAYTEST / GAMEPLAY_COMPREHENSION /
│                                 SCENARIO_GRADING findings, SCENARIO_AUDIT, future audits
├── audit/                      ← this effort's consolidated audit
├── product/
│   └── ROADMAP.md              ← phases, backlog, Pro backlog, founder queue
└── superpowers/specs/          ← design specs (this file's home)
```

`FOUNDER_BRIEFING.md` and `PLAYTEST_BRIEF.md` **stay at repo root** (founder-facing; the playtest brief is being shared publicly — don't move it mid-recruiting). Both go on the root-doc allowlist.

### Lean CLAUDE.md (~2–3k words) — keeps ONLY per-session law

1. What the product is (≤5 lines) + live-at/stack facts
2. Definition-of-Done gate list — commands + trigger conditions inline; details link to `operations/GATES.md`
3. What-to-Never-Do list (verbatim — these are law)
4. Single-file ownership map
5. Repo map (corrected — e.g., `App.jsx` in `src/`)
6. Session rituals: intake triage at session start; screenshot after `.sc2-stage`/`.sc2-table` CSS changes; live `eval:coach` after prompt changes
7. Pointer block into `docs/INDEX.md`

Everything else is **extracted into the tree, not deleted** — durable specs to ENGINES/DECISIONS/conventions, session history preserved via git history (plus the findings/ docs that already capture it).

### Migration safety (two-pass)

1. **Extract pass:** build the tree, move/rewrite content, write lean CLAUDE.md.
2. **Verification pass (separate):** diff old CLAUDE.md rule-by-rule against the new tree — every never-do, every gate, every durable spec must have a new home. Checklist artifact committed with the migration. Only then does the old content leave CLAUDE.md.

### Drift control (gate-7 style, same session as the migration)

New `check:invariants` rules:
- No new root-level CAPS docs (they belong in `docs/`) — allowlist: FOUNDER_BRIEFING.md, PLAYTEST_BRIEF.md, README.md, CLAUDE.md.
- CLAUDE.md line budget: 400 lines, so it can't silently re-bloat.

Auto-memory `MEMORY.md` updated to the new paths in the same session.

---

## Phase 3 — Tooling

### Deliverable: `docs/operations/TOOLING.md`

- **Agent routing table** — which existing agent (OMC executor/architect, Explore, code-reviewer, etc.) to use for which CheckRaise task type. No plugin agents are edited.
- **Skill catalog** — every recommended skill with rationale + priority.
- **Hook catalog** — spec'd for founder decision, not auto-installed.

### Skills built NOW (`.claude/skills/`, project-scoped, committed)

1. **`scenario-authoring`** — the rule-densest repeated workflow: all conventions from AUTHORING_SCENARIOS.md, then runs `audit:scenarios` + gates. References docs/ paths (built after Phase 2 so paths are stable).
2. **`intake-triage`** — the session-start drill: Sentry → PostHog failure events → `scenario_feedback`/`feedback` SQL → work items → ratchet law (every fix leaves a permanent check).
3. **`deploy-checklist`** — SQL-before-deploy ordering, env flips, prompt-change → live `eval:coach` law, `e2e:build` gotcha.

### Spec-only (build on demand)

`observation-authoring` · `eval-coach-workflow` · `audit-fix` (pick a triaged finding, fix it, encode the permanent check).

### Hooks (spec'd, founder decides)

- PostToolUse: auto-run `check:invariants` after src edits (gate 1 becomes reflex).
- Reminder hook: screenshot prompt after `.sc2-stage`/`.sc2-table` CSS changes.

---

## Cross-cutting rules

- Audit phase is read-only (docs excepted). All 7 gates stay green at every commit in every phase.
- Docs phase touches zero src files EXCEPT `scripts/check-invariants.mjs` (the drift-control rules).
- Tooling phase builds against settled `docs/` paths.
- Each phase ends with its own verification pass: audit → evidence spot-check; docs → two-pass rule diff; tooling → dry-run each skill on a real example.
- Separate commits per phase; any phase independently revertable.
- Launch context: early-August go-live target. Nothing in this effort may destabilize the launch push; fixes from triage get scheduled around it by the founder.

## Success criteria

1. Consolidated audit doc exists with founder-triaged verdicts on every finding; zero un-triaged P0/P1.
2. `docs/` tree live; CLAUDE.md ≤ line budget; two-pass migration checklist shows zero orphaned rules; invariants drift rules green.
3. TARGET_ARCHITECTURE.md names the decomposition for the four monoliths + content pools.
4. Three skills committed and dry-run against real examples; TOOLING.md catalog complete.
5. All existing gates green at the end of every phase.

## Implementation sequencing

Three separate implementation plans (one per phase), written via the writing-plans skill, executed in order. Phase 2's plan is written only after Phase 1's triage completes (audit findings are an input to TARGET_ARCHITECTURE.md and doc content).
