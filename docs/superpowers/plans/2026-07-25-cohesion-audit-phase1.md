# Cohesion Audit — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the five-lane hypercritical audit of CheckRaise (security/infra, performance, code quality/modularity, live usability, test/gate quality), consolidate spot-checked findings into one triaged document.

**Architecture:** Five parallel read-only specialist subagents each write a lane findings file under `docs/audit/lanes/`; the main session spot-checks their evidence, consolidates into `docs/audit/2026-07-25-cohesion-audit.md`, and runs founder triage via batched AskUserQuestion rounds. Zero source-code changes in this phase.

**Tech Stack:** Existing repo tooling only — npm gate scripts, the `e2e/` Playwright harness (localStorage-mode build), `npm audit`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-25-cohesion-audit-and-docs-design.md`

## Global Constraints

- **READ-ONLY phase:** no file outside `docs/` may be created or modified. Verify with `git status` at every commit step.
- **Finding contract (verbatim, every finding):** `id · axis · severity (P0–P3) · evidence (file:line) · why it matters · proposed fix · effort (S/M/L)`.
- **Severity definitions:** P0 = exploitable / data-loss / launch-blocking · P1 = will bite soon or blocks modularity · P2 = quality debt · P3 = polish.
- **Honesty rules for all lane agents:** every finding cites a real `file:line` the agent actually read; no padding to look thorough; areas inspected with NO findings are listed explicitly; deliberate decisions documented in CLAUDE.md may still be challenged but must be labeled `[challenges documented decision]`.
- **No duplicate reporting of the gate net:** things the 7 gates already mechanically enforce are not findings; gaps in what the gates enforce ARE findings.
- Repo root: `/Users/primaryaccount/Desktop/poker-trainer`. Launch target early August 2026 — nothing here may destabilize it.

---

### Task 1: Preflight baseline

**Files:**
- Create: `docs/audit/lanes/` (directory)
- Modify: none

**Interfaces:**
- Produces: a recorded green baseline all later tasks compare against; the `docs/audit/lanes/` directory lane agents write into.

- [ ] **Step 1: Verify clean working tree**

Run: `git status --short`
Expected: empty (nothing staged/modified). If not empty, STOP and ask the user — do not audit on top of uncommitted work.

- [ ] **Step 2: Run the fast gates as baseline (parallel where independent)**

Run: `npm run check:invariants && npm run audit:scenarios && npm run audit:observations && npm run simulate:schemas`
Expected: all exit 0. Record output summary lines.

- [ ] **Step 3: Run jest baseline (background)**

Run: `CI=true npm test`
Expected: all suites pass (was 150/150 as of July 25). Record the count.

- [ ] **Step 4: Build the localStorage-mode bundle + run e2e baseline**

Run: `npm run e2e:build` then `npm run e2e`
Expected: build succeeds, e2e suite green (~30s). This build in `build/` is reused by the usability lane — do not rebuild between now and Task 2.

- [ ] **Step 5: Create the lanes directory**

Run: `mkdir -p docs/audit/lanes`

- [ ] **Step 6: Record baseline in a scratch note (not committed)**

Write the gate results (counts, timings) into the task tracker or session notes — they go into the consolidated doc's "Baseline" section in Task 4.

---

### Task 2: Dispatch the five lane agents (single parallel batch)

**Files:**
- Create (by subagents): `docs/audit/lanes/security-infra.md`, `docs/audit/lanes/performance.md`, `docs/audit/lanes/modularity.md`, `docs/audit/lanes/usability.md`, `docs/audit/lanes/gates-tests.md`

**Interfaces:**
- Consumes: `docs/audit/lanes/` from Task 1; the prebuilt `build/` for the usability lane.
- Produces: five lane files, each a markdown doc with a findings table in the Global-Constraints contract plus a "clean areas" list.

- [ ] **Step 1: Dispatch all five agents in ONE message (five Agent tool calls, `general-purpose` type; security + modularity lanes with `model: opus`, others `sonnet`)**

Every prompt below is self-contained (lane agents see nothing else). Each prompt gets this shared preamble prepended verbatim:

> You are one lane of a hypercritical five-lane audit of CheckRaise, a React (CRA) Texas Hold'em trainer at `/Users/primaryaccount/Desktop/poker-trainer`, live at checkraise.ai. Stack: CRA client, Vercel serverless (`api/coach-read.js`), Supabase (auth+Postgres, RLS), PostHog, Sentry. First read the project `CLAUDE.md` fully — it documents deliberate decisions; you may challenge them but must label such findings `[challenges documented decision]`. You are READ-ONLY except for writing exactly one output file. Report ONLY what you verified by reading actual code/config — every finding must cite `file:line` you personally read. Do not pad. List areas you inspected and found clean. Do not report anything the mechanical gates already enforce (`scripts/check-invariants.mjs`, `scripts/audit-scenarios.mjs`, `scripts/audit-observations.mjs`) — gaps in those gates ARE reportable. Output file format: a markdown doc with (1) a summary paragraph, (2) a findings table with columns `id | severity | evidence (file:line) | finding | why it matters | proposed fix | effort`, (3) a "Clean areas inspected" list. Severity: P0 = exploitable/data-loss/launch-blocking · P1 = will bite soon or blocks modularity · P2 = quality debt · P3 = polish. Effort: S/M/L. Id prefix and output path are given below. Be hypercritical: absence of findings must be earned, not assumed.

**Lane 1 prompt (append to preamble)** — id prefix `SEC-`, output `docs/audit/lanes/security-infra.md`:

> Audit security and infrastructure. Scope: `api/coach-read.js` (auth verification, per-user daily rate limit via `coach_usage`, input clamps — check whether the 200-char clamps and 10-decision cap are applied BEFORE prompt assembly and whether clamped fields can still inject prompt-steering content), `supabase/schema.sql` (every table's RLS + policies + the `username_change_limit` trigger — look for missing WITH CHECK clauses, policies broader than own-row, insert-only tables readable by owners, the `rebuys`/`streak`/`poker_score` client-computed own-row write trust model and how a hostile client could abuse it now or when leaderboards ship), `src/utils/supabase.js` + `src/utils/db.js` (anon key usage, any query shape a hostile client could widen), env-var handling across the repo (any server secret reachable from client code, `.env` hygiene), `vercel.json`, `.github/workflows/ci.yml` (secrets exposure, cache poisoning, missing permissions stanza), and run `npm audit --omit=dev` and `npm audit` plus `npm outdated` and triage ONLY actionable results (not noise). Also check the client for XSS surfaces: any `dangerouslySetInnerHTML`, any user-controlled string rendered unescaped (display names, feedback text), and localStorage trust (what happens if `cr_user` is maliciously crafted). Check `api/coach-read.js` response handling for reflected content. Do NOT test against production — static analysis only, plus local commands listed.

**Lane 2 prompt (append to preamble)** — id prefix `PERF-`, output `docs/audit/lanes/performance.md`:

> Audit performance. Scope: (1) Bundle composition — run `npm run e2e:build` ONLY if `build/` is absent; inspect `build/static/js/*` sizes; determine whether `src/data/scenarios.js` (7,690 lines) and `observations.js` ship in the main chunk and what code-splitting would buy; check source-map/asset sizes. (2) Data-layer growth ceilings — `src/utils/db.js` `assembleUser` rebuilds `scenarioHistory`, `directionTally`, `recentHands`, and `coachReads` from ALL `sessions` rows on every fetch, and the sessions select pulls `hands` JSON for every row ever: quantify growth (rows/day for a daily player, payload size/session), find the point where login fetch becomes user-visible, and identify the cheapest ceiling (limit/pagination/materialization) WITHOUT proposing schema changes as required (the project favors derived state — respect that, propose bounded derivation). (3) React render behavior — read `src/App.jsx`, `src/components/Dashboard.jsx`, `src/components/ScenarioCard.jsx`, `src/components/SessionSummary.jsx` for re-render traps: state held too high, missing memoization where props churn per-second (the countdown timer in ScenarioCard — does its tick re-render the whole card/table?), effect dependencies causing refetch loops. (4) `src/App.css` (3,797 lines, one file): estimate dead-selector share by sampling 30 random class selectors and grepping usage; note paint-heavy patterns (unthrottled animations, large box-shadows on animated elements). (5) Font/asset loading in `public/index.html`. (6) Lighthouse: serve the existing `build/` the way `e2e/server.mjs` does (read it), then run `npx lighthouse http://localhost:<port> --only-categories=performance --preset=desktop --output=json --output-path=/tmp/lh-desktop.json --chrome-flags="--headless"` and once more without `--preset=desktop` for mobile; report the performance score, LCP, TBT, and CLS for both, and turn any failed audit worth acting on into a finding. Cite line numbers for every claim; measure, don't guess — where you can't measure, label the finding `[estimate]`.

**Lane 3 prompt (append to preamble)** — id prefix `MOD-`, output `docs/audit/lanes/modularity.md`:

> Audit code quality, modularity, and reuse. This lane's output seeds a future TARGET_ARCHITECTURE.md, so for each monolith propose a concrete decomposition (named modules, what moves where, what the public interface of each piece is). Scope: (1) `src/utils/userStorage.js` (672 lines — localStorage cache, streak math, schema diagnosis engine, coach-read parsing, milestone logic in one file): map its distinct responsibilities and propose the split. (2) `src/App.jsx` (652 lines) vs the documented decision "App component is routing only": inventory what non-routing logic lives there (auth listener, session orchestration, coach-read wiring) and propose extraction. (3) `src/components/Dashboard.jsx` (717) and `ScenarioCard.jsx` (684): identify embedded sub-components (SkillLedger, StreakStatus, CanvasLayout/LegacyLayout, SituationTicker) that should be files. (4) Duplication: grep for repeated logic/copy across components (date formatting, PostHog event patterns, difficulty labels, gate CTA strings); list each duplication with both sites. (5) Dead code: verify whether `src/utils/gamification.js`, `src/utils/skillrating.js`, `src/data/dummyUser.js`, `src/components/SkillTracker.jsx`, and the `LegacyLayout` path (`USE_SINGLE_CANVAS` flag) are imported/reachable; check `src/hooks/` contents and usage. (6) Content-pool structure: `src/data/scenarios.js` is 172 scenarios in one 7,690-line file — assess authoring ergonomics, merge-conflict risk, and whether per-batch files with an index would preserve the `mkScenario` pattern and the audit gate; same question for `observations.js`. (7) Single-file-ownership adherence beyond the mechanical invariant checks (e.g., does any component build PostHog payload shapes that belong in analytics.js?). Also flag prop-drilling chains ≥3 levels deep. For every proposal, respect documented do-not-reverse decisions.

**Lane 4 prompt (append to preamble)** — id prefix `UX-`, output `docs/audit/lanes/usability.md`:

> Audit usability by DRIVING THE REAL APP — you are a user, not a code reader. Setup: the localStorage-mode production build already exists in `build/` (if missing: `npm run e2e:build`). Read `e2e/server.mjs`, `e2e/run.mjs`, and `e2e/helpers.mjs` to learn the harness (it serves the build with the coach endpoint stubbed and no real backend), then start the server the same way the harness does and drive it with Playwright (`npx playwright` — already available; screenshots allowed, save to `docs/audit/lanes/ux-shots/`). Walk these journeys at BOTH desktop (1280×800) and mobile (390×844) viewports: (1) first-run: UsernameEntry → difficulty → full 5-hand session → feedback each hand (try disagree chips + the 👁 table peek) → summary (IQ row, moments, Coach's Read fallback) → dashboard; (2) chained sessions via "Deal Next Session →"; (3) dashboard surfaces: skill ledger regroup, Player Profile card, Coach's Notebook toggle, feedback form, account menu; (4) Table Reads full session incl. replay skip and the guide link from feedback; (5) VillainGuide all tabs. Critique hypercritically: unclear copy at decision time, information you needed but couldn't find, tap targets <44px, contrast that fails squint-test, focus/keyboard traps (Tab through the decision panel — can you play a hand keyboard-only?), layout shift, dead-feeling waits with no indicator, anything a first-time poker novice would misread. Also test `prefers-reduced-motion` on one session. You CANNOT test signed-in/Supabase surfaces (SignIn, guest gate, magic links) live — for those, read the components (`src/components/SignIn.jsx`, gate points in `App.jsx`/`SessionSummary.jsx`/`Dashboard.jsx`) and critique copy/flow statically, labeled `[static review]`. Every finding: exact screen + steps to reproduce + viewport; screenshots for anything visual.

**Lane 5 prompt (append to preamble)** — id prefix `GATE-`, output `docs/audit/lanes/gates-tests.md`:

> Audit the safety net itself: do the gates enforce what the project believes they enforce? Scope: (1) `scripts/check-invariants.mjs` — read every rule, then hunt for enforcement gaps: files/patterns the rule intends to cover but its grep/glob misses (e.g., does the single-file-ownership rule catch dynamic imports or re-exports? does the no-server-secrets rule scan `src/hooks/`? would a new `.jsx` calling PostHog directly slip through?). Construct at least 3 hypothetical violations per major rule ON PAPER (do not write files) and trace whether the script would catch them. (2) `scripts/audit-scenarios.mjs` + `scripts/audit-observations.mjs` — same treatment for 3 rules each. (3) Jest coverage vs shipped behavior: run `CI=true npx react-scripts test --coverage --watchAll=false`, report per-file coverage for `src/utils/*.js` and `src/components/*.jsx`, and name the 5 least-covered load-bearing files with the specific untested behaviors (read the files to name them — not just percentages). (4) `e2e/` suite: read all specs; list UI surfaces with zero e2e coverage (Table Reads? VillainGuide? feedback form?); assess brittleness (selector fragility, timing assumptions). (5) CI (`.github/workflows/ci.yml`): does it actually run every gate CLAUDE.md claims, in the claimed order, with failure blocking? (6) Doc drift: spot-check 15 concrete factual claims in CLAUDE.md (file paths, counts, line references, script names) against reality and list every mismatch (one known: CLAUDE.md places `App.jsx` in `src/components/`; it's in `src/`). Do NOT audit content grading correctness — that is the founder/SME lane.

- [ ] **Step 2: While agents run, do nothing destructive; when all five return, verify each wrote its lane file**

Run: `ls docs/audit/lanes/`
Expected: all five files present, each non-trivial (`wc -l docs/audit/lanes/*.md` — a lane under ~40 lines is suspicious; if one is missing/thin, re-dispatch that single lane with its same prompt plus the instruction to be exhaustive).

- [ ] **Step 3: Verify read-only compliance**

Run: `git status --short`
Expected: ONLY `docs/audit/` paths (and `build/` which is gitignored). Any src change → revert it and note which lane violated (affects trust in its findings).

- [ ] **Step 4: Commit lane files**

```bash
git add docs/audit/lanes/
git commit -m "audit: five lane findings (raw, pre-verification)"
```

---

### Task 3: Evidence spot-check

**Files:**
- Modify: `docs/audit/lanes/*.md` (annotations only)

**Interfaces:**
- Consumes: the five lane files.
- Produces: each lane file annotated per finding with `VERIFIED` / `STRUCK (reason)` / `ADJUSTED (what changed)` in a new `verification` column or inline tag; consolidation (Task 4) uses only VERIFIED/ADJUSTED findings.

- [ ] **Step 1: Verify every P0 and P1 across all lanes**

For each: open the cited file at the cited lines with Read, confirm the claim is literally true and the severity is earned. Downgrade or strike anything that doesn't hold. P0s additionally get a second look for exploitability-in-practice (is there a real path, not just a theoretical one?).

- [ ] **Step 2: Sample-verify P2/P3 — at least 3 findings or 20% per lane, whichever is larger**

Same method. If ≥30% of a lane's sample fails verification, verify that lane's ENTIRE finding list (its agent over-reported).

- [ ] **Step 3: Annotate lane files with verification outcomes**

Every finding gets a tag. Unsampled P2/P3s are tagged `UNSAMPLED (lane sample passed)`.

- [ ] **Step 4: Commit**

```bash
git add docs/audit/lanes/
git commit -m "audit: evidence spot-check annotations"
```

---

### Task 4: Consolidate into the findings doc

**Files:**
- Create: `docs/audit/2026-07-25-cohesion-audit.md`

**Interfaces:**
- Consumes: annotated lane files (VERIFIED/ADJUSTED findings only; STRUCK findings appear only in a strike log).
- Produces: the consolidated doc with global ids `CA-001…`, the triage table Task 5 fills in, and a Baseline section from Task 1.

- [ ] **Step 1: Write the consolidated doc**

Structure:
1. **Executive summary** — counts by severity and axis, the 5 biggest themes in prose.
2. **Baseline** — Task 1 gate results (proof the audit ran against green).
3. **Findings** — one section per axis; findings renumbered `CA-001…` (keep the lane id in a source column); full contract per finding; cross-lane duplicates merged (note both sources).
4. **Strike log** — findings struck in Task 3 and why (transparency about lane over-reporting).
5. **Triage table** — `id | severity | effort | one-line finding | recommendation | VERDICT (empty)` — verdicts filled in Task 5.
6. **Clean areas** — merged union of lanes' clean-area lists.

- [ ] **Step 2: Self-check the doc**

Every triage-table row maps to a findings-section entry; no finding lacks file:line evidence; no STRUCK finding leaked into the table; severity counts in the summary match the table.

- [ ] **Step 3: Commit**

```bash
git add docs/audit/2026-07-25-cohesion-audit.md
git commit -m "audit: consolidated cohesion audit findings"
```

---

### Task 5: Founder triage

**Files:**
- Modify: `docs/audit/2026-07-25-cohesion-audit.md` (VERDICT column + a Triage Outcomes section)

**Interfaces:**
- Consumes: the consolidated doc's triage table.
- Produces: every finding carrying a founder verdict — `fix-now / queue / reject` — plus an ordered fix-now list. This is the input gate for the Phase 2 plan.

- [ ] **Step 1: Present P0s first, individually**

If any P0 exists, one AskUserQuestion per P0 (options: fix-now / queue / reject, with the evidence summarized in the question). P0s marked fix-now get flagged for immediate scheduling — but are NOT fixed in this phase.

- [ ] **Step 2: Batch-triage P1s, then P2/P3s**

AskUserQuestion rounds, up to 4 findings per round (one question each, options fix-now / queue / reject; recommended verdict listed first per the consolidation's recommendation column). For large P3 clusters, offer one bulk question ("accept recommendation for all remaining P3s?") to spare the founder 20 rounds.

- [ ] **Step 3: Record verdicts + write Triage Outcomes**

Fill the VERDICT column; add a section ordering the fix-now items (founder's priority, asked as a final question if >3 items) and noting queue items enter the roadmap queue. Restate the ratchet law: each future fix must leave a permanent mechanical check.

- [ ] **Step 4: Commit**

```bash
git add docs/audit/2026-07-25-cohesion-audit.md
git commit -m "audit: founder triage verdicts recorded"
```

---

### Task 6: Phase close-out

**Files:**
- Modify: none

**Interfaces:**
- Produces: verified phase-exit state; the go-signal for writing the Phase 2 (docs restructure) plan.

- [ ] **Step 1: Verify read-only compliance for the whole phase**

Run: `git log --stat --oneline -8` and confirm every phase commit touches only `docs/`.

- [ ] **Step 2: Re-run fast gates**

Run: `npm run check:invariants && CI=true npm test`
Expected: green, same counts as baseline (nothing changed, so anything else means contamination — investigate).

- [ ] **Step 3: Confirm Phase 2 gate**

Per the spec: the Phase 2 plan may now be written, using (a) triage verdicts and (b) lane 3's decomposition proposals as inputs to TARGET_ARCHITECTURE.md. Tell the user Phase 1 is complete and offer to brainstorm/plan Phase 2.
