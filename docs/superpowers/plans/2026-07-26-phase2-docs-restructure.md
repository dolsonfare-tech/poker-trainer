# Phase 2 — Docs Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `docs/` tree, extract every durable rule/spec from the 19k-word CLAUDE.md into focused docs, write TARGET_ARCHITECTURE.md from the audit's decomposition proposals, shrink CLAUDE.md to ≤400 lines of per-session law, and install drift-control rules — without losing a single load-bearing rule (two-pass migration).

**Architecture:** Content tasks build the tree doc-by-doc (each verified against CODE, not just prose — CA-035 taught us CLAUDE.md lies). CLAUDE.md is rewritten only after every destination doc exists. An INDEPENDENT verification task diffs old CLAUDE.md rule-by-rule against the new tree before the old content is deleted. The founder personally approves the lean CLAUDE.md before it lands (it's the constitution).

**Tech Stack:** Markdown, `git mv` for doc moves, one `scripts/check-invariants.mjs` addition.

**Spec:** `docs/superpowers/specs/2026-07-25-cohesion-audit-and-docs-design.md` (Phase 2 section governs; tree shape is spec-fixed).
**Audit inputs:** `docs/audit/2026-07-25-cohesion-audit.md` (§7 queue clusters, CA-035), `docs/audit/lanes/modularity.md` (MOD-001…016 decomposition proposals).

## Global Constraints

- **Zero src changes** except `scripts/check-invariants.mjs` (drift rules, Task 8). Gates green at every commit: `npm run check:invariants && CI=true npm test` minimum.
- **Extraction, not deletion:** durable content moves; session-log history is preserved by git (plus the findings docs that already capture it). Nothing is paraphrased-and-weakened: "never do X" rules move VERBATIM.
- **Verify against code:** every factual claim written into a new doc (file paths, counts, constants, gate behavior) is checked against the current tree before writing — CLAUDE.md's known drift (CA-035) must not be copied forward. The July 26 bundles changed facts (LegacyLayout deleted, dates.js exists, jest 206+, invariants rules 1–14, CI Node 24 + green).
- **Spec-fixed tree** (do not invent new locations): `docs/INDEX.md`, `docs/architecture/{ARCHITECTURE,TARGET_ARCHITECTURE,ENGINES,DECISIONS}.md`, `docs/conventions/{AUTHORING_SCENARIOS,AUTHORING_OBSERVATIONS,CODE_CONVENTIONS}.md`, `docs/operations/{GATES,DEPLOY,TRIAGE,TOOLING}.md` (TOOLING is Phase 3's — create as a stub pointing at Phase 3), `docs/research/`, `docs/findings/`, `docs/product/ROADMAP.md`. Root allowlist: `CLAUDE.md`, `README.md`, `FOUNDER_BRIEFING.md`, `PLAYTEST_BRIEF.md`.
- Every doc starts with a 1-2 line "read this when…" header (feeds INDEX.md).
- COMMIT DISCIPLINE: exact paths only; never `git add -A`. Commit per task.

---

### Task 1: `docs/architecture/ARCHITECTURE.md` — the current system, verified

**Files:** Create `docs/architecture/ARCHITECTURE.md`

**Content contract:** the CURRENT system as built (not history, not aspiration): screens + routing (App.jsx real state today), the data flow (localStorage-mode vs Supabase mode; warm cache; derived-state pattern — scenarioHistory/directionTally/recentHands/coachReads rebuilt from bounded newest-1000 sessions rows, bestSessionCorrect via aggregation), the single-file ownership map (supabase.js/db.js/analytics.js/sentry.js/ads.js/claude.js/api/coach-read.js + what each owns), the auth flow incl. guest mode and the stale-session/error phases, the repo map (CORRECTED: App.jsx in src/, no gamification.js/skillrating.js/SkillTracker.jsx, dates.js exists, e2e/ has 5 specs). Source material: CLAUDE.md "Repo Structure" + "Key Decisions/Architecture" sections + the code itself. Every path and file claim verified by `ls`/grep before writing (record the verification in the task report).

- [ ] Step 1: Verify the repo facts (script the checks: every file path mentioned exists; every "only file X does Y" claim matches the invariants rules).
- [ ] Step 2: Write the doc (≤ ~300 lines; link to ENGINES.md for algorithm depth, GATES.md for enforcement).
- [ ] Step 3: `npm run check:invariants` (root-docs rule not yet installed — plain green) + commit `docs(phase2): architecture.md — current system, code-verified`.

### Task 2: `docs/architecture/ENGINES.md` — durable algorithm specs extracted

**Files:** Create `docs/architecture/ENGINES.md`

**Content contract:** the durable spec (not the build history) for each engine, extracted from CLAUDE.md's session logs and verified against code constants: (1) session builder v2 — unseen-first, weak-skill slots, graduation ladder `LADDER_SESSIONS=[2,5,13]`, graded targets FIRST=2/REPEAT=3, surge threshold 8, calendar-day floor, confident-miss `CONFIDENT_MISS_MS=15000`, R4 contrast pairs + F4 trigger boost, preflop cap, ids-not-normalized; (2) rating/IQ — true-accuracy buckets, RESULT_CREDIT, recency window `RECENT_WINDOW=8`/`MIN_RECENT_HANDS=8`/cap 200, lifetime-vs-display split; (3) schema hybrid v2 — direction tally axes, baseline correction, severity knobs (MIN_DIRECTION_EVIDENCE=10, DOMINANCE=0.4, SEV_SCALE=2.5, FULL_EVIDENCE=20, MISS_MATERIALITY=0.15), skill-side v1 residuals + the v2-skill-side TODO pointers; (4) coach pipeline — structured JSON schema, parseCoachRead, voice rules (session-scoped field notes), eval:coach law; (5) streak/rebuys — calcStreak, milestones, REBUY_CAP, streakAlive display honesty; (6) Table Reads mode-local model. EVERY constant read from the source file at write time (cite `file:constant` per value).

- [ ] Step 1: Extract + verify constants against src (list any CLAUDE.md-vs-code mismatch found — those are drift catches, report them).
- [ ] Step 2: Write the doc (organized per engine; each section ends with "enforced/tested by:" pointing at the pinning tests/gates).
- [ ] Step 3: Gates + commit `docs(phase2): engines.md — durable algorithm specs, constants code-verified`.

### Task 3: `docs/architecture/TARGET_ARCHITECTURE.md` — the modularity destination

**Files:** Create `docs/architecture/TARGET_ARCHITECTURE.md`

**Content contract:** the founder-approved end-state that queued refactors steer toward, synthesized from `docs/audit/lanes/modularity.md` (MOD-001 userStorage split into persistence/streak/schema/iq/coachRead/session + dates [dates.js ALREADY DONE July 26 — mark it], MOD-002 App hooks useAuthSession/useGuest/useSessionRun, MOD-003 dashboard/ components, MOD-004 scenario/ components [deletion half DONE — mark it], MOD-011 events registry, MOD-013 scenarios/ batch files, MOD-014 contexts) + audit §7 queue clusters (trust-boundary design pre-Pro; bundle work CA-014/022/034; test expansion CA-049/050). Structure: target module map (one table: today's file → target modules → public interface), sequencing waves with prerequisites (wave 1 = zero-risk extractions; wave 2 = component splits; wave 3 = hooks/contexts; wave 4 = trust boundary + bundle), and a DONE ledger (what already landed: dates.js, dead-layout deletion, bounded fetch). Rule: every wave leaves gates green and is independently shippable.

- [ ] Step 1: Read the modularity lane + §7 fully; reconcile with what bundles 1–5 already landed.
- [ ] Step 2: Write the doc.
- [ ] Step 3: Gates + commit `docs(phase2): target architecture — modularity end-state + waves`.

### Task 4: `docs/architecture/DECISIONS.md` — the do-not-reverse ledger

**Files:** Create `docs/architecture/DECISIONS.md`

**Content contract:** every "Key Decisions — Do Not Reverse" entry + every dated founder decision + the rejected-on-the-record list (coin economy, B2B scenario-sourcing, roulette variants, nightly LLM sweeps, FSRS/SM-2, answer-until-correct), one entry each: decision · date · rationale · what would have to change to revisit. VERBATIM for the never-do rules. Source: CLAUDE.md Key Decisions + What to Never Do + Monetization + scattered "founder decision" bullets, FOUNDER_BRIEFING.md's rejected list.

- [ ] Steps: extract → write → gates + commit `docs(phase2): decisions ledger`.

### Task 5: `docs/conventions/` — the three authoring/code convention docs

**Files:** Create `docs/conventions/AUTHORING_SCENARIOS.md`, `AUTHORING_OBSERVATIONS.md`, `CODE_CONVENTIONS.md`

**Content contract:**
- AUTHORING_SCENARIOS.md: mkScenario/mkHand/mkPositions only; suit symbols; pot-field convention (preflop includes live raise, postflop excludes live bet; multiway sc_168 precedent); $6 standard open; effectiveStacks required + house default 200; tableContext vs body (decision-time read vs review narrative, sc_004/sc_167 examples); authored actionHistory rules (hero-first-postflop rows, PRE multi-action, no "out of position" phrasing about villain); grade-level last-write-wins feedback; option labels display in the recommended row; contrast-pair authoring; honest-labeling in fb text; WHY-not-restatement rule; the audit gate rule list (R1–R10 + context WARN) with "run `npm run audit:scenarios` after every edit".
- AUTHORING_OBSERVATIONS.md: from TABLE_READS_DESIGN.md's checklist + O1–O6 rules + the batch-2 lessons (confusable fault lines, tell-type coverage, showdown dial, frequency-evidence rule O6).
- CODE_CONVENTIONS.md: honest labeling (Recommended vs Correct; scores say "correct"); copy voice rules; CSS patterns (sc2-*/db-* namespaces, mobile media blocks, the .sc2-table width law); test patterns (co-location, source-pin idiom, e2e harness usage, fake-clock shim); no-comments-unless-why; single-file ownership discipline beyond the mechanical rules; never await in onAuthStateChange.
- Each rule verified still true against the current gates/scripts before inclusion.

- [ ] Steps: extract per doc → write all three → gates + commit `docs(phase2): authoring + code conventions`.

### Task 6: `docs/operations/` — gates, deploy, triage (+ tooling stub)

**Files:** Create `docs/operations/GATES.md`, `DEPLOY.md`, `TRIAGE.md`, `TOOLING.md` (stub)

**Content contract:**
- GATES.md: all Definition-of-Done gates with commands, trigger conditions, what each mechanically enforces (invariants rules 1–14 enumerated from the script — read it), the harnesses (simulate:schemas, playtest:personas, eval:coach + its founder-key workflow + re-run-after-prompt-change law), e2e suite map (5 specs and what each guards), CI (Node 24, all-gates order, ci-status local watchdog), the ratchet law (gate 7), verification recipes (stub-Supabase Playwright pattern, localStorage-mode dev server).
- DEPLOY.md: push-to-deploy flow; SQL-before-deploy law (gate 5) with the historical examples; env-var map (which are public/Sensitive, REACT_APP_SITE_URL incl.); post-deploy checks (CI green, prod bundle string verification recipe); Vercel specifics (zero-config vercel.json, case-sensitivity law).
- TRIAGE.md: the 4-channel intake drill verbatim from CLAUDE.md (Sentry, PostHog failure events + comprehension heatmap, scenario_feedback SQL, feedback SQL), cadence (start of every session now), the ratchet law restated, PostHog event catalog (every event name + props — grep the codebase for track( calls to enumerate truthfully).
- TOOLING.md: 5-line stub — "Phase 3 deliverable; agent routing + skill catalog land here."

- [ ] Steps: extract/verify (enumerate invariants rules + PostHog events from source) → write → gates + commit `docs(phase2): operations — gates, deploy, triage`.

### Task 7: Moves + ROADMAP.md + INDEX.md

**Files:** `git mv` the four `RESEARCH_*.md` → `docs/research/`; `PERSONA_PLAYTEST_FINDINGS.md`, `GAMEPLAY_COMPREHENSION_FINDINGS.md`, `SCENARIO_GRADING_FINDINGS.md`, `SCENARIO_AUDIT.md`, `TABLE_READS_DESIGN.md` → `docs/findings/`; create `docs/product/ROADMAP.md`; create `docs/INDEX.md`.

**Content contract:**
- ROADMAP.md: phases (1.0/1.5/2 done-state, 1.6, Phase 3 iOS), the working queue (strategy/OKRs session, playtest analysis after day 14, SME-status), backlog + PRO backlog + research-derived backlog, queue clusters from audit §7. Current-truth only — completed work references the findings docs instead of restating them.
- INDEX.md: one line per doc in the tree ("read this when…"), grouped by directory; plus the root allowlist docs.
- Grep the repo for references to moved paths (`grep -rn "RESEARCH_LEARNING\|PERSONA_PLAYTEST\|TABLE_READS_DESIGN" --include="*.md" --include="*.js" --include="*.mjs" .`) and update every reference (scripts comments, FOUNDER_BRIEFING links, memory files are NOT repo — skip).

- [ ] Steps: moves → reference sweep → write ROADMAP + INDEX → gates + commit `docs(phase2): tree moves, roadmap, index`.

### Task 8: Lean CLAUDE.md rewrite + drift rules — FOUNDER GATE

**Files:** Rewrite `CLAUDE.md` (≤400 lines); modify `scripts/check-invariants.mjs` (rule 15 `root-docs`: ERROR on any tracked root-level `*.md` outside the allowlist {CLAUDE.md, README.md, FOUNDER_BRIEFING.md, PLAYTEST_BRIEF.md}; rule 16 `claude-md-budget`: ERROR if CLAUDE.md exceeds 400 lines).

**Content contract for lean CLAUDE.md** (per spec): product one-liner + live facts (≤5 lines); Definition-of-Done gate list (commands + triggers inline, details → GATES.md); What-to-Never-Do VERBATIM; single-file ownership map; corrected repo map (compact); session rituals (intake triage at start → TRIAGE.md, screenshot-after-sc2-CSS, eval:coach-after-prompt-change, SQL-before-deploy); pointer block → docs/INDEX.md; the ratchet law. NOTHING else — history, engine details, research summaries all live in the tree now.

- [ ] Step 1: Draft the lean CLAUDE.md to a scratch path (`.superpowers` workspace), NOT over the real file.
- [ ] Step 2: **FOUNDER GATE — STOP and present the draft to the founder for approval** (this file is the constitution; the controller shows it and asks). Only on approval:
- [ ] Step 3: Replace CLAUDE.md, add invariants rules 15+16, prove both (temp root doc → FAIL; 401-line CLAUDE.md → FAIL; restore → PASS).
- [ ] Step 4: Gates + commit `docs(phase2): lean CLAUDE.md + root-docs/budget drift rules (CA-035 resolved)`.

### Task 9: Independent migration verification (two-pass rule diff)

**Files:** Create `docs/audit/2026-07-26-migration-verification.md`

**Contract:** a FRESH agent (no prior Phase 2 involvement) takes the pre-Phase-2 CLAUDE.md (`git show <pre-phase2-sha>:CLAUDE.md`) and walks it rule-by-rule/claim-by-claim: for each never-do rule, gate, durable spec, convention, decision — name the new-tree location (file + section) or flag ORPHANED. Every ORPHANED item is a blocker: fix (add to the right doc) before this task completes. Ephemeral session-log narration may be marked HISTORY (preserved in git, intentionally not migrated). Output: the checklist doc with per-item dispositions, committed.

- [ ] Steps: dispatch fresh verifier → fix any orphans → commit `docs(phase2): migration verification checklist — zero orphaned rules`.

### Task 10: Close-out

- [ ] Full gate sweep (all gates + e2e). MEMORY.md + memory files updated to new paths (controller does memory — it's outside the repo). Audit doc §7: CA-035 stamped DONE. Republish note for the founder: FOUNDER_BRIEFING.md links unchanged (it stayed root). Update the Phase-2-complete status in the spec's tracker if present. Commit any doc touch-ups.
- [ ] Report: line counts (CLAUDE.md before/after), tree inventory, verification-checklist stats.
