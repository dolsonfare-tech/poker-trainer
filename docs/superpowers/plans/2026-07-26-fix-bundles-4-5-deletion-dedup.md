# Fix Bundles 4+5 — Dead-Code Deletion & Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the last 8 fix-now audit findings: bundle 4 (CA-027, CA-026-deletion, CA-018, CA-019 — dead code and bloated assets) and bundle 5 (CA-028, CA-030, CA-031, CA-003 — dedup and auth hardening).

**Architecture:** Four code tasks + close-out. Task 1 deletes the dead layout (JS then its CSS in one pass — the CSS is only provably dead after the JS goes). Every fix leaves a mechanical check (two new invariants rules + jest source-pins).

**Tech Stack:** Existing repo tooling; `npx`-available image tooling for Task 2 (no new committed dependencies).

**Source of truth:** `docs/audit/2026-07-25-cohesion-audit.md` — CA-003 (§3.1), CA-018/019 (§3.2), CA-026/027/028/030/031 (§3.3).

**Scope guard:** CA-026's *full* `src/components/scenario/` directory split stays QUEUED with the modularity wave (CA-023/024/025). This plan takes only its deletion half.

## Global Constraints

- After EVERY code change: `npm run check:invariants` + `CI=true npm test`. Tasks touching ScenarioCard/App/App.css/Dashboard/SessionSummary additionally require `npm run e2e:build && npm run e2e` green before commit (gate 6). Screenshot the gameplay canvas after ANY `.sc2-*` CSS change at 1280×800 AND 390×844 (July 18 law).
- Ratchet law: every fix leaves a permanent mechanical check in the same commit.
- Honest labeling; `scenarios.js`/`observations.js`/`api/coach-read.js` untouchable; never `await` in `onAuthStateChange`.
- COMMIT DISCIPLINE: stage only named files by exact path. NEVER `git add -A` or `git add .`.
- Commit format `fix(CA-0XX,…): <summary>`.

---

### Task 1: CA-027 + CA-026(deletion) + CA-018 — delete the dead layout, JS and CSS

**Files:**
- Modify: `src/components/ScenarioCard.jsx` (delete `LegacyLayout` ~:649-685, `DecisionPanel` ~:326-410, `TableVisual` ~:259-309, the `USE_SINGLE_CANVAS` export ~:11, and the flag's remaining conditional so `CanvasLayout` renders unconditionally)
- Modify: `src/App.jsx` (delete the `!USE_SINGLE_CANVAS && feedback && (...)` block ~:629-646 and the `USE_SINGLE_CANVAS` import ~:11)
- Modify: `src/App.css` (delete the legacy selector families — enumerate by grepping each candidate class from the deleted JSX: `scenario-card-body`, `table-wrap`, `dp-*`, `act-icon`, `positions-grid`, `board-label`, `card-meta`, and any others referenced ONLY by the deleted components; update the comment at ~:3181)
- Modify: `scripts/check-invariants.mjs` (new rule `dead-layout`)

**Interfaces:**
- Produces: invariants rule `dead-layout` — ERROR if `USE_SINGLE_CANVAS`, `LegacyLayout`, `DecisionPanel`, or `TableVisual` appears anywhere in `src/**` (identifiers, not comments — match `\b<name>\b` outside the rule file itself). This prevents resurrection-by-stale-revert.

- [ ] **Step 1: Map the dead CSS precisely.** For each candidate class in the three dead components' JSX, `grep -rn "class-name" src/` — a family is deletable ONLY if its sole references were inside the deleted components. Record the kept/deleted decision per family in your report (a class shared with the live canvas stays).

- [ ] **Step 2: Delete the JS** (both files). `CanvasLayout` becomes the unconditional render path. Verify `getHandName`, `SituationTicker`, and every still-live component remain exported/used exactly as before — this is a deletion, not a refactor.

- [ ] **Step 3: Delete the mapped CSS families.** Update the `:3181`-area comment.

- [ ] **Step 4: Add the `dead-layout` invariants rule** (match existing rule style). Prove the ratchet: temp file with `const LegacyLayout = 1;` → FAIL, delete → PASS (verbatim outputs in report).

- [ ] **Step 5: Gates + e2e.** `npm run check:invariants && CI=true npm test && npm run e2e:build && npm run e2e` → ALL green (the geometry/mobilefold/taptargets guards are the functional net proving the live canvas survived). Screenshot gameplay at both viewports; attach to report.

- [ ] **Step 6: Measure the win** — `wc -l src/components/ScenarioCard.jsx src/App.css` before/after + built CSS size delta (`ls -l build/static/css/`). Report the numbers.

- [ ] **Step 7: Commit** — `git add src/components/ScenarioCard.jsx src/App.jsx src/App.css scripts/check-invariants.mjs && git commit -m "fix(CA-027,CA-026,CA-018): delete dead LegacyLayout path (JS+CSS) + dead-layout invariant"`

---

### Task 2: CA-019 — asset recompress + byte budgets

**Files:**
- Modify: `public/favicon.ico` (currently ~279 KB), `public/icons/icon-512.png` (~392 KB) — lowercase paths only (Vercel case law)
- Modify: `scripts/check-invariants.mjs` (new rule `asset-budget`)

**Interfaces:**
- Produces: invariants rule `asset-budget` — ERROR if `public/favicon.ico` > 60,000 bytes or `public/icons/icon-512.png` > 150,000 bytes (post-fix sizes ~≤30 KB / ~≤100 KB leave headroom; a future re-export that regresses gets caught).

- [ ] **Step 1: Regenerate the favicon** as a multi-resolution ICO (16/32/48 only) from the highest-quality existing icon (`public/icons/icon-512.png` is the source of truth). Use npx tooling (e.g. `npx sharp-cli` to resize + `npx png-to-ico`), target ≤30 KB. Do NOT change the visual (same square logo).

- [ ] **Step 2: Recompress icon-512** losslessly or near-lossless (e.g. `npx sharp-cli` re-encode at palette/quality that keeps it visually identical), target ≤100 KB. Compare before/after visually (open both, screenshot side by side for the report).

- [ ] **Step 3: Verify references intact** — `public/index.html` link tags and `manifest.json` entries unchanged (same paths/sizes declared); `git ls-files` shows only lowercase icon paths.

- [ ] **Step 4: Add `asset-budget` rule** + prove it (temporarily point the rule at a 1-byte budget → FAIL; restore → PASS; verbatim outputs).

- [ ] **Step 5: Gates** — invariants + jest green. Build (`npm run e2e:build`) and confirm the new files land in `build/`.

- [ ] **Step 6: Commit** — `git add public/favicon.ico public/icons/icon-512.png scripts/check-invariants.mjs && git commit -m "fix(CA-019): recompress favicon + PWA icon under new asset-budget invariant"`

---

### Task 3: CA-028 + CA-030 + CA-031 — the dedup micro-pass

**Files:**
- Create: `src/utils/dates.js`
- Modify: `src/utils/userStorage.js`, `src/utils/spacedrep.js` (CA-028), `src/data/constants.js`, `src/components/DifficultySelector.jsx`, `src/components/SessionSummary.jsx` (CA-030), `src/components/Dashboard.jsx`, `src/App.jsx` (CA-031)
- Test: extend `src/utils/userStorage.test.js` or a new `src/utils/dates.test.js`; extend existing component tests only where a pin is specified

**Interfaces (exact contracts):**
1. **CA-028:** `src/utils/dates.js` exports `toLocalDateString(date)` (moved verbatim from `userStorage.js:533-538`) and `localDateFrom(value)` (moved verbatim from `spacedrep.js:301-311`). `userStorage.js` RE-EXPORTS `toLocalDateString` (`export { toLocalDateString } from './dates';`) so its many existing importers (db.js, Dashboard.jsx, tests) are untouched; `spacedrep.js` imports `localDateFrom` from dates.js and deletes its private copy + the "mirrors" comment. NO other behavior change; the `userStorage → spacedrep` import cycle question is untouched (that's CA-058, queued).
2. **CA-030:** `src/data/constants.js` gains `export const DIFFICULTY_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' };` (the shared-lookup home, same pattern as SKILL_NAMES). `SessionSummary.jsx` deletes its private map and imports this one. `DifficultySelector.jsx`'s rich `DIFFICULTIES` array derives each entry's `label` from `DIFFICULTY_LABELS[key]` instead of a literal.
3. **CA-031:** `src/data/constants.js` gains `export const GUEST_GATE_CTA = 'Sign In Free to Keep Playing';`. `Dashboard.jsx` (~:694) and `SessionSummary.jsx` (~:278 — note it appends ` →`) consume the constant. `GUEST_FREE_SESSIONS` and the `'Guest'` display name stay where they are (App.jsx) — they're config, not display copy, and moving them is scope creep.

- [ ] **Step 1: Write the pins first (failing where possible):**
  - dates: unit tests for `toLocalDateString` + `localDateFrom` in `src/utils/dates.test.js` (move/adapt any existing coverage), PLUS a source pin (same idiom as the CA-020 pin): read `src/utils/spacedrep.js` and `src/utils/userStorage.js` sources and assert NEITHER contains a `function toLocalDateString`/`const toLocalDateString =` definition (re-export lines don't match).
  - difficulty: pin `DIFFICULTY_LABELS.expert === 'Expert'` and a source pin that `SessionSummary.jsx` contains no inline `beginner:` label map.
  - CTA: source pin that the literal `'Sign In Free to Keep Playing'` appears in exactly one src file (`src/data/constants.js`).

- [ ] **Step 2: Implement all three moves per the contracts.**

- [ ] **Step 3: Full jest + invariants** — green; the July 25 SignIn/guest tests and Dashboard/SessionSummary string pins must pass UNCHANGED (the rendered copy is identical — if a test needed changing, the copy drifted: fix the code, not the test).

- [ ] **Step 4: e2e** (Dashboard/SessionSummary touched) — `npm run e2e:build && npm run e2e` green.

- [ ] **Step 5: Commit** — `git add src/utils/dates.js src/utils/dates.test.js src/utils/userStorage.js src/utils/spacedrep.js src/data/constants.js src/components/DifficultySelector.jsx src/components/SessionSummary.jsx src/components/Dashboard.jsx src/App.jsx <any test files touched> && git commit -m "fix(CA-028,CA-030,CA-031): dates.js extraction, difficulty-label + guest-CTA single source"`
  (Drop unmodified files from the add list.)

---

### Task 4: CA-003 — pin auth redirects to the configured site URL

**Files:**
- Modify: `src/components/SignIn.jsx` (~:29 `emailRedirectTo`, ~:46 `redirectTo`)
- Test: `src/components/SignIn.test.js` (exists — July 25)

**Interfaces:**
- Produces: `const SITE_URL = process.env.REACT_APP_SITE_URL || window.location.origin;` at module scope in SignIn.jsx; both redirect options use `SITE_URL`. Behavior WITHOUT the env var is byte-identical to today (local dev + previews keep working); prod hardens the moment the founder sets `REACT_APP_SITE_URL=https://checkraise.ai` in Vercel.

- [ ] **Step 1: Failing tests** in SignIn.test.js (follow its existing supabase-mock pattern): with `process.env.REACT_APP_SITE_URL = 'https://checkraise.ai'` set (and restored in afterEach), submitting the magic-link form passes `emailRedirectTo: 'https://checkraise.ai'`; without it, `window.location.origin`. Same pair for the Google OAuth call if the existing mocks reach it cheaply (the flag-gated button may need `REACT_APP_GOOGLE_AUTH` mocked — if that becomes a fight, pin the magic-link path only and assert the OAuth call site uses the same `SITE_URL` constant via a source pin).

- [ ] **Step 2: Implement** (env is inlined at build time by CRA — module-scope const is correct).

- [ ] **Step 3: Full jest + invariants** → green.

- [ ] **Step 4: Commit** — `git add src/components/SignIn.jsx src/components/SignIn.test.js && git commit -m "fix(CA-003): auth redirects use REACT_APP_SITE_URL when configured"`

---

### Task 5: Bundles close-out

**Files:**
- Modify: `docs/audit/2026-07-25-cohesion-audit.md` (§7 — bundles 4 and 5 stamped)

- [ ] **Step 1: Full gate sweep** — `npm run check:invariants && CI=true npm test && npm run audit:scenarios && npm run audit:observations && npm run simulate:schemas && npm run e2e:build && npm run e2e` → all green.

- [ ] **Step 2: Ratchet completeness** — CA-027/026/018 (`dead-layout` rule + e2e canvas guards), CA-019 (`asset-budget` rule), CA-028/030/031 (source-pin tests), CA-003 (SignIn env pins).

- [ ] **Step 3: Stamp §7** — bundle 4 and bundle 5 `— DONE <date> (commits <ranges>)` + per-CA checks. Add founder to-dos: (a) set `REACT_APP_SITE_URL=https://checkraise.ai` in Vercel (all envs where the prod domain serves; previews can omit it) and confirm Supabase Auth → URL Configuration lists `https://checkraise.ai` in Site URL / Additional Redirect URLs; (b) after the next deploy, hard-refresh and confirm the favicon/PWA icon still look right on a phone home-screen add. Commit `docs: bundles 4+5 complete in triage outcomes`.

- [ ] **Step 4: Note the milestone** — with this, ALL 28 fix-now findings are done except CA-035 (CLAUDE.md drift), which lands inside Phase 2's docs restructure by design.
