# Fix Bundle 3 — Gate Widenings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the seven audit-found bypass paths in the safety net: CA-046, CA-047, CA-051, CA-053 (invariants rules), CA-052, CA-057 (scenario-audit rules), CA-002 (CI permissions).

**Architecture:** Three code tasks + close-out. Every rule widening carries a prove-the-ratchet step: construct the violation, capture the gate FAILING, remove it, capture the PASS. The widened rules ARE the permanent checks (ratchet law self-satisfying here).

**Tech Stack:** `scripts/check-invariants.mjs`, `scripts/audit-scenarios.mjs`, `.github/workflows/ci.yml`. No app code, no dependencies.

**Source of truth:** `docs/audit/2026-07-25-cohesion-audit.md` — CA-002 (§3.1), CA-046/047/051/052/053/057 (§3.5).

**DO NOT START until fix bundle 2 (plan `2026-07-26-fix-bundle-2-data-integrity.md`) is closed out — same branch.**

## Global Constraints

- After EVERY change: `npm run check:invariants && npm run audit:scenarios && npm run audit:observations` then `CI=true npm test` green before commit. The CURRENT codebase must pass every widened rule — a widening that fires on existing clean code is a false positive to fix, EXCEPT where it exposes a real pre-existing violation (report those, don't whitelist them silently).
- Prove-the-ratchet evidence (FAIL output + PASS output, verbatim) goes in each task's report for every widened rule.
- Match each script's existing rule structure, naming, and reporting style exactly.
- COMMIT DISCIPLINE: stage only named files by exact path. NEVER `git add -A` or `git add .`.
- Commit format `fix(CA-0XX,…): <summary>`.

---

### Task 1: CA-046 + CA-051 + CA-053 + CA-047 — widen four invariants rules

**Files:**
- Modify: `scripts/check-invariants.mjs` (posthog rule ~:54, sentry rule ~:119, git-hygiene/env rule ~:82, db-access rule ~:50)

**Interfaces:**
- Produces four widened rules:
  1. **posthog (CA-046):** also match CJS `require\s*\(\s*['"]posthog-js['"]\s*\)` outside `src/utils/analytics.js`.
  2. **sentry (CA-051):** per the audit's recommended stronger form, trigger on the IMPORT — any `from\s+['"]@sentry\/` or `require\s*\(\s*['"]@sentry\/` outside `src/utils/sentry.js` — replacing the fragile per-method list (`init/captureException/setUser`). Keep the method-pattern too if trivially cheap, but the import trigger is the load-bearing widening (a file can't call Sentry without importing it).
  3. **env hygiene (CA-053):** widen the tracked-file pattern from `/(^|\/)\.env(\.|$)/` to also catch `.env_backup`, `.env-old`, `env.bak`-style names: use `/(^|\/)\.env([^a-z]|$)/i` per the audit's proposal; verify `.gitignore`'s own mention of `.env` (if the rule scans file CONTENTS vs `git ls-files` — read the rule first) doesn't false-positive.
  4. **db-access (CA-047):** two parts per the audit: (a) a comment in the rule + a check that `src/utils/db.js` itself contains no dynamic `.from(` (i.e., every `.from(` in db.js is followed by a string literal — regex the db.js source for `\.from\(\s*[^'"\`]` and flag); (b) outside db.js the existing literal-pattern check stays, now backed by (a) so a generic helper can't launder dynamic table names through db.js.

- [ ] **Step 1: Read `scripts/check-invariants.mjs` fully** — rule structure, flag() reporting, how rules enumerate files.

- [ ] **Step 2: Widen the four rules** per the contracts above.

- [ ] **Step 3: Prove each ratchet (4×):** for each rule create a minimal temporary violation — e.g. `src/utils/_tmp_violation.js` containing `const ph = require('posthog-js');` — run `npm run check:invariants`, capture the FAIL naming the right rule, delete the temp file, re-run, capture PASS. For CA-053, the violation is a tracked-file simulation: if the rule uses `git ls-files`, `git add`ing a scratch `.env_backup` (with dummy content, then `git rm --cached` + delete) is acceptable — NEVER write real secrets. For CA-047(a), temporarily add `.from(tableName)` inside db.js. All four FAIL/PASS pairs verbatim in the report.

- [ ] **Step 4: Full gates** — `npm run check:invariants && CI=true npm test` → green on the clean tree.

- [ ] **Step 5: Commit** — `git add scripts/check-invariants.mjs && git commit -m "fix(CA-046,CA-047,CA-051,CA-053): widen posthog/db-access/sentry/env invariants against bypass paths"`

---

### Task 2: CA-052 + CA-057 — scenario-audit READ_MARKERS + id normalization

**Files:**
- Modify: `scripts/audit-scenarios.mjs` (READ_MARKERS ~:241; stacks-loop flag ids ~:218-232)

**Interfaces:**
- Produces:
  - READ_MARKERS additionally matches: `all evening`, `recently`, `in recent hands`, `he(?:'s| has) been`, `past (few|several|couple)` (case-insensitive, consistent with existing markers).
  - The stacks loop reports ids through the SAME normalization the structural loop uses (`sc_001`, never raw `1`).

- [ ] **Step 1: Read the script** — READ_MARKERS usage (the `context` WARN rule), the structural loop's id normalization helper, the stacks loop.

- [ ] **Step 2: Implement both changes.**

- [ ] **Step 3: Run `npm run audit:scenarios` against the real pool.** Expected: same error count (0) — but the widened READ_MARKERS may fire NEW `context` warns on existing scenarios. For each new warn: read that scenario; if its body genuinely carries a session-history read without `tableContext`, that is a REAL content finding the old pattern missed — list it in the report for founder content triage (do NOT edit scenarios.js in this task; content edits are a separate lane). If the phrase is a false positive (e.g. "recently" in a this-hand narrative), tighten the pattern instead — the report must show the judgment per warn.

- [ ] **Step 4: Prove the ratchet** — `node -e` regex checks for each new marker phrase (TRUE) and a couple of innocent phrases (FALSE), captured in the report; plus one demonstration that a synthetic body string "he's been raising all evening" without tableContext would flag (mirror how the O6 rule was proven, if a harness exists — otherwise the regex proof suffices).

- [ ] **Step 5: Full gates** — both audits + invariants + jest → green (or green-with-reported-new-warns per Step 3, since `context` is WARN-severity and doesn't exit 1 — confirm that from the script and state it in the report).

- [ ] **Step 6: Commit** — `git add scripts/audit-scenarios.mjs && git commit -m "fix(CA-052,CA-057): widen READ_MARKERS session-history phrases; normalize stacks-loop ids"`

---

### Task 3: CA-002 — CI token permissions

**Files:**
- Modify: `.github/workflows/ci.yml` (top level, no `permissions:` key exists)

- [ ] **Step 1: Add at workflow top level** (after `name:`/`on:`, before `jobs:`):

```yaml
permissions:
  contents: read
```

- [ ] **Step 2: Validate** — YAML parses (`node -e "require('js-yaml')"` if available, else `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"`); confirm no job in the file needs write perms (read every job: they run installs/gates/build only — no releases, no comments, no pushes).

- [ ] **Step 3: Commit** — `git add .github/workflows/ci.yml && git commit -m "fix(CA-002): restrict CI token to contents:read"`. Note in the report: the real proof is the next push's green CI run — flag it for the close-out summary.

---

### Task 4: Bundle close-out

**Files:**
- Modify: `docs/audit/2026-07-25-cohesion-audit.md` (§7 — mark bundle 3 done)

- [ ] **Step 1: Full gate sweep** — `npm run check:invariants && CI=true npm test && npm run audit:scenarios && npm run audit:observations && npm run simulate:schemas` → green (no App/CSS changes in this bundle → e2e optional; run it anyway if bundles are being pushed together).

- [ ] **Step 2: Ratchet completeness** — the widened rules are themselves the checks; confirm all four FAIL/PASS proofs + the READ_MARKERS proof exist in the task reports.

- [ ] **Step 3: Update §7** — bundle 3 `— DONE <date> (commits <range>)`. Include any REAL content findings from Task 2 Step 3 as a founder to-do line. Commit `docs: bundle 3 complete in triage outcomes`.

- [ ] **Step 4: Founder note** — after the next push, confirm CI still green (CA-002's proof) and watch for the new `context` warns list if Task 2 surfaced content findings.
