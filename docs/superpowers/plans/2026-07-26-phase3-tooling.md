# Phase 3 — Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the TOOLING.md catalog and three project-scoped skills that encode CheckRaise's most-repeated workflows as reflex-level automation.

**Architecture:** Four documents, zero src changes. TOOLING.md replaces a 5-line stub in docs/operations/. Three skills land in `.claude/skills/` (committed, project-scoped, immediately available to every session). Verification = dry-run each skill against a real example + all gates green.

**Tech Stack:** Markdown, YAML frontmatter (Claude Code skill format), bash gate checks.

## Global Constraints

- All 7 gates must remain green throughout.
- No src/ changes — this phase is docs + skill files only.
- Skills go in `.claude/skills/<name>.md` (project-scoped, committed — NOT in `.omc/` or `~/.claude/`).
- Every skill must be dryrun-verifiable against a real CheckRaise example before the phase is declared complete.
- TOOLING.md replaces `docs/operations/TOOLING.md` entirely (current content is a 5-line stub).
- Spec: `docs/superpowers/specs/2026-07-25-cohesion-audit-and-docs-design.md` §Phase 3.

---

### Task 1: TOOLING.md — agent routing table + catalog

**Files:**
- Modify: `docs/operations/TOOLING.md` (replace stub with full content)

**Interfaces:**
- Consumes: docs/operations/GATES.md (gate commands), docs/operations/TRIAGE.md (channels), docs/operations/DEPLOY.md (deploy flow), the three skills built in Tasks 2–4
- Produces: the canonical agent/skill/hook routing reference for future sessions

- [ ] **Step 1: Write full TOOLING.md**

Content must cover:
  1. **Agent routing table** — rows: task type → agent → model → notes. Cover at minimum: scenario authoring, bug investigation, architecture decisions, code review, research/exploration, UI changes, deploy, triage, eval:coach, planning/brainstorming.
  2. **Skill catalog** — every skill with status (built / spec-only) + trigger + rationale + priority.
  3. **Hook catalog** — spec'd hooks with install instructions and founder decision note.

- [ ] **Step 2: Verify TOOLING.md does not exceed 150 lines** (depth in the skills themselves, not the index).

- [ ] **Step 3: Run `npm run check:invariants`** — must exit 0.

- [ ] **Step 4: Commit**

```bash
git add docs/operations/TOOLING.md
git commit -m "docs(phase3): TOOLING.md — agent routing table + skill/hook catalog"
```

---

### Task 2: scenario-authoring skill

**Files:**
- Create: `.claude/skills/scenario-authoring.md`

**Interfaces:**
- Consumes: `docs/conventions/AUTHORING_SCENARIOS.md` (all rules), `docs/conventions/AUTHORING_OBSERVATIONS.md` (O-rules for observations)
- Produces: a skill that, when invoked, guides the full scenario-authoring workflow end-to-end

- [ ] **Step 1: Write `.claude/skills/scenario-authoring.md`**

Frontmatter:
```yaml
---
name: scenario-authoring
description: Use when adding or editing scenarios in src/data/scenarios.js or observations in src/data/observations.js. Walks the full authoring workflow, enforces all conventions, and runs the content gates.
---
```

Body must cover (in workflow order):
  1. Pre-flight: read AUTHORING_SCENARIOS.md before the first change.
  2. Use helpers — `mkScenario` / `mkHand` / `mkPositions` only; never raw objects.
  3. The three non-negotiable rules: suit symbols (♠♥♦♣ always), effectiveStacks required (house default 200), tableContext vs body (decision-time law).
  4. Pot convention (preflop includes raise, postflop excludes live bet, multiway includes both).
  5. Feedback discipline: WHY not restatement; ES 0.49 elaborated > 0.05 bare marks.
  6. Gates to run in order: `npm run audit:scenarios` → `CI=true npm test` → `npm run check:invariants` → `npm run simulate:schemas` (if deriveSchema touched) → smoke-test ticker in real UI.
  7. After every batch: `npm run export:review` to update scenario-review.csv.

- [ ] **Step 2: Dry-run** — invoke the skill mentally against sc_172 (existing all-in scenario) and verify the skill's steps would have caught the $1/$3→$1/$2 scaling requirement and the all-in convention.

- [ ] **Step 3: Run `npm run check:invariants`** — must exit 0.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/scenario-authoring.md
git commit -m "feat(phase3): scenario-authoring skill — full authoring workflow + content gates"
```

---

### Task 3: intake-triage skill

**Files:**
- Create: `.claude/skills/intake-triage.md`

**Interfaces:**
- Consumes: `docs/operations/TRIAGE.md` (channels, SQL queries, event catalog), `docs/operations/GATES.md` (ratchet law / gate 7)
- Produces: a skill that runs the full session-start triage drill in order

- [ ] **Step 1: Write `.claude/skills/intake-triage.md`**

Frontmatter:
```yaml
---
name: intake-triage
description: Run at the START of every working session. Checks all four user-signal channels (Sentry, PostHog, scenario_feedback SQL, feedback SQL), converts every real item to a work item, and applies the ratchet law.
---
```

Body must cover (in drill order):
  1. Channel 1: Sentry — check for new issue types since last look; note the open founder action (enable email alerts).
  2. Channel 2: PostHog — `coach_read_failed` (zero = healthy), `profile_load_failed`, `profile_create_failed`, `scenario_disagree_failed`, `username_change_failed`, `stale_session_cleared` (spike = sessions revoked). Plus the comprehension heatmap: `decision_made.decision_ms` p50 + `timed_out` rate per scenario_id.
  3. Channel 3: scenario_feedback SQL (exact query from TRIAGE.md).
  4. Channel 4: feedback SQL (exact query from TRIAGE.md).
  5. Routing law: every real item → work item → the session that fixes it must leave a permanent mechanical check (ratchet law, GATES.md gate 7) AND stamp the relevant findings doc.
  6. If no items: confirm healthy state, proceed with session goal.

- [ ] **Step 2: Dry-run** — invoke the skill mentally, verify the four steps fire in order and the ratchet-law reminder is prominent.

- [ ] **Step 3: Run `npm run check:invariants`** — must exit 0.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/intake-triage.md
git commit -m "feat(phase3): intake-triage skill — session-start drill (4 channels → ratchet law)"
```

---

### Task 4: deploy-checklist skill

**Files:**
- Create: `.claude/skills/deploy-checklist.md`

**Interfaces:**
- Consumes: `docs/operations/DEPLOY.md` (full deploy flow), `docs/operations/GATES.md` (eval:coach law)
- Produces: a skill that runs every pre/post-deploy check in the right order

- [ ] **Step 1: Write `.claude/skills/deploy-checklist.md`**

Frontmatter:
```yaml
---
name: deploy-checklist
description: Run before and after every deploy. Enforces SQL-before-deploy law, env-var audit, eval:coach requirement on prompt changes, e2e:build gotcha, and post-deploy verification steps.
---
```

Body must cover:
  1. **Pre-deploy — SQL law (gate 5):** if the change adds a Supabase table or column, the block must be in schema.sql with RLS + policies, run in Supabase SQL editor, and confirmed by founder BEFORE the push. Reference both incidents: rebuys (400'd all profile writes) and scenario_feedback (silent graceful failure).
  2. **Pre-deploy — prompt/model change law:** if `api/coach-read.js` prompt or model changed → `CLAUDE_API_KEY=... npm run eval:coach` live and all 9 reads must pass the F5 bar before pushing. Use a short-lived founder console key (Vercel Sensitive keys are write-only).
  3. **Pre-deploy — gates:** `npm run check:invariants` + `CI=true npm test` + `npm run e2e` (requires `npm run e2e:build` first — the plain build bakes in .env's Supabase keys and boots to SignIn; the e2e build blanks them for localStorage mode).
  4. **Pre-deploy — env-var audit:** no secret in a `REACT_APP_` var (invariants rule 4); Sentry DSN on Production env only; AdSense vars are dormant (do not set until founder lifts the hold).
  5. **Post-deploy checks:** CI green on the push; prod-bundle string grep (fetch served JS, grep for a feature string unique to the change); hard-refresh icon/asset check when `public/` changed.
  6. **Case-sensitivity law:** after any rename under `public/`, verify with `git ls-files` — Vercel is case-sensitive, macOS hides case-only renames.

- [ ] **Step 2: Dry-run** — invoke the skill against the July 18 rebuys deploy scenario and verify step 1 (SQL law) would have been the first gate hit.

- [ ] **Step 3: Run `npm run check:invariants`** — must exit 0.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/deploy-checklist.md
git commit -m "feat(phase3): deploy-checklist skill — SQL law, eval:coach gate, pre/post-deploy checks"
```

---

### Task 5: Verification + Phase 3 close

**Files:**
- No new files — verification only.

- [ ] **Step 1: Run full gate set**

```bash
npm run check:invariants && CI=true npm test && npm run audit:scenarios && npm run audit:observations
```

All must exit 0.

- [ ] **Step 2: Verify TOOLING.md is reachable from INDEX.md**

Read `docs/INDEX.md` and confirm `TOOLING.md` has an entry (it was added in Phase 2).

- [ ] **Step 3: Confirm `.claude/skills/` is tracked by git**

```bash
git ls-files .claude/skills/
```

Should list all three skill files.

- [ ] **Step 4: Final commit if any fixes needed, otherwise tag phase complete**

```bash
git log --oneline -6
```
