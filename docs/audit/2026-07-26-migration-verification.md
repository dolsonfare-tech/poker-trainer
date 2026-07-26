# Migration Verification — old CLAUDE.md (375 lines) → new lean CLAUDE.md + `docs/` tree

**Auditor:** fresh verification agent (no involvement in the migration).
**Source:** old file recovered as `git show 82a244b^:Claude.md` (376 lines; the pre-migration filename was lowercase `Claude.md` — replaced by capital-C `CLAUDE.md` + `docs/` tree in commit `82a244b`, 2026-07-26). Scratch copy at `.superpowers/sdd/2026-07-26-phase2-docs-restructure/OLD_CLAUDE.md`.
**Method:** walked the old file claim-by-claim; each load-bearing item categorized MIGRATED (with new-home pointer), HISTORY (session-log narration deliberately archived to git), or ORPHANED (load-bearing content with no new home).

---

## Summary counts

- **MIGRATED:** ~79 load-bearing items (72 original + 7 orphans fixed 2026-07-26)
- **HISTORY:** ~35 items (session-log build chronology in the "In flight / next", "Live in production now", scenario-batch, and Founder-direction blocks — preserved in git, intentionally not restated)
- **ORPHANED:** **0** — all 7 original orphans resolved; see disposition table below

## Previously-orphaned items (now migrated)

All 7 items were migrated in commit `docs(phase2): migrate the 7 orphaned rules to their tree homes` (2026-07-26).

Severity key: **LAW** = a rule/gotcha that will bite the next contributor · **SPEC** = a durable value or convention that a future engineer will need to look up · **CONTEXT** = background reasoning that grounds a future decision.

| # | Item | Severity | New home |
|---|---|---|---|
| O-1 | **`$50/mo Anthropic monthly cap`** on the Coach's Read (set at the Anthropic dashboard, paired with the 5 calls/user/day server cap) | **LAW** | `docs/architecture/ENGINES.md` §4 "Cost rails" block (above the Constants table) — MIGRATED |
| O-2 | **`ads.txt` publisher line format:** `google.com, pub-XXXX, DIRECT, f08c47fec0942fa0` — the exact string to author when AdSense approves; plus the two-stage env flip (CLIENT var = site review, SLOT vars = live ads) | **SPEC** | `docs/operations/DEPLOY.md` §"AdSense (ON HOLD)" block — MIGRATED |
| O-3 | **`TICKER_STAKES` is hardcoded to `$1/$2 CASH · 6-MAX`** — hands authored at other stakes must scale to house $1/$2 (sc_172 scaling precedent: $1/$3 spec → 12/40/70/160) | **LAW** | `docs/conventions/AUTHORING_SCENARIOS.md` §"Stakes scaling — always $1/$2" (adjacent to Standard open size) — MIGRATED |
| O-4 | **Data-cleanup SQL for the cross-account stats-leak:** `delete from public.profiles where id = '<account-uuid>';` (cascades skills/sessions/coach_usage; auth user survives; next sign-in re-onboards fresh) | **LAW** | `docs/operations/TRIAGE.md` §"Runbooks — Cross-account stats-leak cleanup" — MIGRATED |
| O-5 | **The three long-lived Claude artifact URLs** (30-day launch playbook, gameplay-layout design-review history, Founder's briefing) plus the standing obligation to republish the briefing artifact whenever `FOUNDER_BRIEFING.md` changes | **CONTEXT** | `docs/product/ROADMAP.md` §"Standing artifacts" table — MIGRATED |
| O-6 | **`$6 standard open` at $1/$2** — pool-wide convention; deviations must be justified in body or grading | **SPEC** | `docs/conventions/AUTHORING_SCENARIOS.md` §"Standard open size" (strengthened to "pool-wide default") — MIGRATED |
| O-7 | **Phase 3 tech-stack pre-decisions:** State = Zustand or React Context · Animations = Framer Motion · Estimate = 6–8 weeks with a developer | **CONTEXT** | `docs/product/ROADMAP.md` §"Phase 3" bullet list — MIGRATED |

**All seven are now in their routed homes.** The orphan class was mid-paragraph gotchas buried in build-log bullets or a table with no `docs/` home; the fix adds focused paragraphs in the four target files.

---

## Special-check results

| Check | Result |
|---|---|
| **Never-do bullets verbatim in new CLAUDE.md** | ✅ **PASS — byte-identical** to old (11 bullets; new file adds one blank line + `---` separator after the heading, no content change). Diff below. |
| **Never-do bullets verbatim in `docs/architecture/DECISIONS.md`** | ✅ **PASS — text preserved verbatim**, with an annotation suffix on each bullet (e.g. `— **invariant rule 4 ('secrets')**`) and one nested note under the shorthand-card-notation bullet. The DECISIONS.md preamble states "quoted verbatim from CLAUDE.md" and the pre-suffix text is a byte-for-byte match. |
| **All 7 old npm gate commands present in new CLAUDE.md gate table** | ✅ **PASS** — `check:invariants`, `CI=true npm test`, `audit:scenarios`, `audit:observations`, `simulate:schemas`, `e2e` (with the `e2e:build` prereq), and the two process gates (SQL-before-deploy, ratchet law) all appear at CLAUDE.md L17–L26; matches old L19–L26 in coverage. |
| **Intake-triage drill: 4 channels + both SQL queries in `docs/operations/TRIAGE.md`** | ✅ **PASS** — Sentry / PostHog failure events (full list) / `scenario_feedback` SQL (verbatim `select scenario_id, reason, count(*) from public.scenario_feedback group by 1, 2 order by count(*) desc;`) / `feedback` SQL (verbatim `select category, message, created_at from public.feedback order by created_at desc limit 30;`) all present at TRIAGE.md L12–L37. Cadence upgraded to "START of every session" per the July 20 note. |
| **eval:coach live-rerun PENDING flag** | ✅ **PASS — carried in THREE places:** CLAUDE.md L28 ("live re-run is STILL PENDING"), `docs/operations/GATES.md` L89–L91 ("still awaits its live re-run"), `docs/architecture/ENGINES.md` L224 ("Live re-run status (as of 2026-07-26): PENDING"). Redundant on purpose; the message reaches whoever reads any of the three. |
| **spacedrep v2 / streak / schema / IQ constants in `docs/architecture/ENGINES.md`** | ✅ **PASS** — every constant carries a source-file citation with line number: `LADDER_SESSIONS=[2,5,13]`, `GRADUATION_TARGET_FIRST=2`/`_REPEAT=3`, `CONFIDENT_MISS_MS=15000`, `SURGE_QUEUE_THRESHOLD=8`, `MAX_CONTRAST_PAIRS_PER_SESSION=1`, preflop cap 2, `SESSION_LENGTH=5`; `REBUY_CAP=2`, `STREAK_MILESTONES_LIST=[7,30,100]`, `MILESTONE_NAMES`, `PROXIMITY_WINDOW=3`; `SCHEMA_MIN_SEVERITY=1.25`, `MIN_DIRECTION_EVIDENCE=10`, `DIRECTION_FULL_EVIDENCE=20`, `DIRECTION_MISS_MATERIALITY=0.15`, `DIRECTION_DOMINANCE=0.4`, `DIRECTION_SEV_SCALE=2.5`, `SCHEMA_UNLOCK_SESSIONS=5`; `RECENT_WINDOW=8`, `MIN_RECENT_HANDS=8`, `RECENT_HANDS_CAP=200`, `MIN_RATED_ATTEMPTS=5`, green ≥0.75 / yellow ≥0.50. Every ENGINES.md value cross-verified against the source line numbers cited (spot-checked in a prior audit — see `docs/audit/lanes/gates-tests.md:55`). |

### Verbatim diff — old "What to Never Do" vs new CLAUDE.md

```
13a14,15
> 
> ---
```
(Only two added lines — the blank line + `---` separator; the 11 bullets are byte-identical.)

### Verbatim diff — old "What to Never Do" vs DECISIONS.md
Every bullet's original text is preserved as a prefix; annotations (`— **invariant rule N ('id')**` or `— **prose-only**`) are appended. One informational sub-bullet is added under the shorthand-card-notation rule (mapping-note about `audit:scenarios`). No original wording deleted or altered.

---

## Full per-item disposition table

Grouped by old-file section for auditability. `L###` = line in `OLD_CLAUDE.md`.

### Preamble + "What This Is" (L1–L11)
| Old item | Disposition | New location |
|---|---|---|
| Project pitch / moat sentence | MIGRATED (adapted) | CLAUDE.md L9; deeper in FOUNDER_BRIEFING.md |

### Definition of Done (L15–L27)
| Old item | Disposition | New location |
|---|---|---|
| Gate 1 `check:invariants` + rule catalog | MIGRATED | CLAUDE.md L19; full rule table in `docs/operations/GATES.md` §Gate 1 |
| Gate 2 `CI=true npm test` | MIGRATED | CLAUDE.md L20; GATES.md §Gate 2 |
| Gate 3 `audit:scenarios` | MIGRATED | CLAUDE.md L21; GATES.md §Gates 3/3b |
| Gate 3b `audit:observations` | MIGRATED | CLAUDE.md L22; GATES.md §Gates 3/3b |
| Gate 4 `simulate:schemas` | MIGRATED | CLAUDE.md L23; GATES.md §The harnesses |
| Gate 5 new Supabase table → SQL BEFORE deploy | MIGRATED | CLAUDE.md L24; GATES.md gate 5; DEPLOY.md |
| Gate 6 `e2e` + `e2e:build` prereq + geometry rationale | MIGRATED | CLAUDE.md L25; GATES.md §Gate 6 (spec table) |
| Gate 7 ratchet law | MIGRATED | CLAUDE.md L26; GATES.md §The ratchet law; DECISIONS.md §Engineering Practice |

### Proactive bug net (L30–L43)
| Old item | Disposition | New location |
|---|---|---|
| CI runs all gates | MIGRATED | GATES.md §CI |
| CI-was-dead-for-a-week history + rule 12 (`ci-status`) watchdog | MIGRATED | GATES.md §CI + rule 12 in table; CLAUDE.md L119 session rituals |
| Committed e2e suite rationale | MIGRATED | GATES.md §Gate 6 |
| Found-bug → permanent rule | MIGRATED | GATES.md ratchet-law section + DECISIONS.md §Engineering Practice |
| Intake triage — 4 channels + 2 SQL queries + START-of-session cadence + "link is being shared publicly" | MIGRATED | TRIAGE.md L12–L37 (Sentry, PostHog list incl. `decision_ms` heatmap, both SQL blocks verbatim) |
| LLM review policy (Fable-on-diffs; `/code-review ultra` for milestones; no scheduled sweeps) | MIGRATED | DECISIONS.md §Engineering Practice + REJECTED (nightly LLM sweeps) |

### Phase 1.0 (L45–L50)
| Item | Disposition | New location |
|---|---|---|
| 83 scenarios; SME/founder-playthrough carryover | MIGRATED | ROADMAP.md (SME status item 5); pool count updated to 172 |

### Current Phase: 2 — TOP OF ROADMAP block (L54–L63)
| Old item | Disposition | New location |
|---|---|---|
| spacedrep v2 (R1+R2+F2) built July 18 | MIGRATED | ENGINES.md §1; DECISIONS.md §graduation ladder |
| F1 graduation-ladder drain fix (graded target, surge) | MIGRATED | ENGINES.md §1 behavioral rules; DECISIONS.md |
| R1 graduation ladder detail | MIGRATED | ENGINES.md §1 |
| R2 binge-massing fix (calendar-day floor) | MIGRATED | ENGINES.md §1 |
| F2 decisionMs capture | MIGRATED | ENGINES.md §1 + §4 |
| Streak mechanics M1–M3 + `rebuys` SQL requirement | MIGRATED | ENGINES.md §5; DEPLOY.md (SQL-before-deploy law) |
| R4 contrast-pair-aware dealing (constants, CONTRAST_PAIRS discipline, cross-difficulty inert) | MIGRATED | ENGINES.md §1; DECISIONS.md; AUTHORING_SCENARIOS.md §Contrast pairs |
| Extensive persona-harness acceptance narration (session-by-session % improvements) | HISTORY | Preserved in git via the July 18–19 commits + PERSONA_PLAYTEST_FINDINGS.md |

### NEXT SESSION block (L65–L68)
| Old item | Disposition | New location |
|---|---|---|
| AdSense on-hold status + LLC blocker | MIGRATED | ROADMAP.md item 8; DECISIONS.md §Monetization |
| **AdSense `ads.txt` line format `google.com, pub-XXXX, DIRECT, f08c47fec0942fa0`** | MIGRATED (O-2) | `docs/operations/DEPLOY.md` §AdSense (ON HOLD) |
| Google brand verification APPROVED | MIGRATED | DEPLOY.md §Live-in-prod row (Google OAuth) |
| pot/bet-size pass DONE + `potpre` audit rule | MIGRATED | AUTHORING_SCENARIOS.md pot conventions; GATES.md §Gate 3 |
| **sc_012 tournament-regrade lesson + sc_011 $15→$6 resize** | MIGRATED (partial) | SCENARIO_GRADING_FINDINGS.md L94 mentions sc_012; AUTHORING_SCENARIOS.md L99 mentions sc_011. **Standalone "check undisplayed `question` field" law survives** in the same authoring doc. |
| **Pot-field convention (preflop INCLUDES live raise, postflop EXCLUDES live bet) — follow the street's convention** | MIGRATED | AUTHORING_SCENARIOS.md pot table (verified via grep) |
| Full grading audit + 5 SME judgment calls (sc_025/043/057/009/023) | MIGRATED | SCENARIO_GRADING_FINDINGS.md; ROADMAP.md item 5 |
| SME weighting of explanation quality (~10x learning effect) | MIGRATED | DECISIONS.md §Content/Copy Voice ("explain WHY"); RESEARCH_LEARNING_SCIENCE.md Piece 2 |
| Check PostHog funnel + coach_read_failed / go_pro_clicked | MIGRATED | TRIAGE.md; PostHog event catalog |

### Strategic-question status blob (L70)
| Old item | Disposition | New location |
|---|---|---|
| Monetization answered — free + ads at launch (SUPERSEDED) | MIGRATED (both original + revision) | DECISIONS.md §Monetization (both entries) |
| Poker IQ = continuous true accuracy, then recency-weighted; F3 rationale + knob sweep | MIGRATED | ENGINES.md §2; DECISIONS.md §recency-weighted IQ |
| One-time IQ shift + self-heal on load | MIGRATED | ENGINES.md §2 §Self-healing |

### Live in production now (L72–L83)
| Old item | Disposition | New location |
|---|---|---|
| Supabase auth (email magic link + Google) | MIGRATED | ARCHITECTURE.md; DEPLOY.md |
| profiles/skills/sessions/coach_usage tables + RLS | MIGRATED | ARCHITECTURE.md; DECISIONS.md §RLS |
| Coach endpoint locked — 5 calls/user/day cap | MIGRATED | ENGINES.md §4; DECISIONS.md §5 calls/day |
| **`$50/mo Anthropic cap set`** | MIGRATED (O-1) | `docs/architecture/ENGINES.md` §4 Cost rails |
| Streak warning banner (dashboard, after 6pm local) | HISTORY | Feature exists; not restated as durable spec |
| Privacy + Terms, Cloudflare Email Routing "silently DISABLED until July 5" | MIGRATED | DEPLOY.md L76–L78 |
| PostHog live in prod + `REACT_APP_*` public-by-definition note | MIGRATED | DEPLOY.md env-var map; ARCHITECTURE.md |
| Resend SMTP details (subdomain, DKIM, DMARC, credentials, sender) + "Verify DNS Records" gotcha | MIGRATED | DEPLOY.md L76–L77 (both rows) |
| Google OAuth live + custom auth domain deferred ($35/mo) | MIGRATED | DEPLOY.md L79 |
| Favicon/PWA icons case-sensitivity gotcha | MIGRATED | DECISIONS.md §case-sensitivity; CLAUDE.md repo-map note |
| Go Pro button as demand instrument | MIGRATED | DECISIONS.md §Monetization; TRIAGE.md event catalog |
| UsernameEntry surfaces failures | MIGRATED | ARCHITECTURE.md auth flow; TRIAGE.md event `profile_create_failed` |

### Artifacts block (L85–L88)
| Old item | Disposition | New location |
|---|---|---|
| **3 Claude artifact URLs — 30-day playbook, layout history, Founder's briefing (with republish obligation)** | MIGRATED (O-5) | `docs/product/ROADMAP.md` §Standing artifacts |

### In-flight / next narration (L90–L124)
This block is 30+ bullets of build-log narration (guest-first SignIn July 25, FOUNDER_BRIEFING structure, Villain-types research, Schema-taxonomy research, UX/consistency sweep, guest-flow + earned moments, spaced-rep v0, stale-session fix, Sentry live, auth-flow hardening, cross-account leak fix, honest-labeling pass, sc_172, scenario batches 3/4/5, TableReads design, batch sc_084–sc_107, editable usernames, beta feedback, PostHog, Google sign-in, Resend, vercel.json fix, Week 3 pot pass, founder-direction queue).

**Bulk disposition:** the DURABLE part of each bullet (rule established, invariant enforced, feature shipped, convention learned) is MIGRATED to the appropriate `docs/` home. The build-chronology (what was done that session, by whom, with which counts) is HISTORY — preserved in git commit messages and superseded plans under `docs/superpowers/plans/`.

Notable single-line rules threaded through this block:
| Old rule | Disposition | New location |
|---|---|---|
| **`COACH_DAILY_LIMIT` in SessionSummary.jsx mirrors server's `DAILY_LIMIT` — keep them in sync** | MIGRATED | ENGINES.md §4 constants table + rule text ("COACH_DAILY_LIMIT must mirror DAILY_LIMIT") |
| Verification recipe: stub-Supabase Playwright + forged-JWT + prod-bundle grep + `sb-*` unblock | MIGRATED | GATES.md §Verification recipes |
| Data-loss chain root cause + `ignoreDuplicates: true` (invariant rule 9 `create-no-clobber`) | MIGRATED | DECISIONS.md; GATES.md rule 9 |
| **Cross-account leak: `delete from public.profiles where id = '<uuid>';` runbook for stuck accounts** | MIGRATED (O-4) | `docs/operations/TRIAGE.md` §Runbooks |
| `SIGNED_OUT` clears only owner-tagged caches; `INITIAL_SESSION`-no-session doesn't clear | MIGRATED | ARCHITECTURE.md auth flow |
| Honest-labeling copy pass (Recommended Play; Hand Analysis not AI Analysis; option label not raw val; tagline) | MIGRATED | DECISIONS.md §Content/Copy Voice (four bullets, verbatim rationale) |
| sc_172 = first 2-option scenario + first all-in scenario (all-in expressed WITHOUT stacks field; amount-free `'All-In'` seat action; committed-pot convention) | MIGRATED | AUTHORING_SCENARIOS.md L119 (amount-free label + committed pot); L212 (Check-Raises pattern) |
| **TICKER_STAKES hardcodes "$1/$2 CASH · 6-MAX"; hands authored at other stakes must scale to $1/$2 — flag founder if numbers changed** | MIGRATED (O-3) | `docs/conventions/AUTHORING_SCENARIOS.md` §Stakes scaling |
| Scenario batch coverage-audit findings (per-skill counts, position gaps, street gaps, deliberate pair links) | HISTORY | Git commits + scenario-audit tooling |
| **`$6 standard open` at $1/$2 (pool-wide convention; deviations justified in body)** | MIGRATED (O-6) | `docs/conventions/AUTHORING_SCENARIOS.md` §Standard open size (strengthened to "pool-wide default") |
| `question` field never displayed; check it in every review | MIGRATED | DECISIONS.md; SCENARIO_GRADING_FINDINGS.md L94 |
| Displayed feedback is grade-level, last-write-wins (`scenario.feedback[gr.g]`) — when two options share a grade, combined fb must read for either | MIGRATED | AUTHORING_SCENARIOS.md L223–L225 |
| Hero-first-to-act postflop needs authored `actionHistory` ending in `{ text: "you're first to act", you: true }` | MIGRATED | AUTHORING_SCENARIOS.md L176, L190–L191 |
| Multiway pot convention (sc_168 $47 includes bettor + cold-caller; don't state pot-odds ratios multiway) | MIGRATED | AUTHORING_SCENARIOS.md L80 |
| Table Reads mode-local scoring + "Free during beta" chip + reveal cadence + beginner-first threshold | MIGRATED | ENGINES.md §6; DECISIONS.md §Table Reads |
| eval:coach harness + F5 bar + PENDING live re-run for July 22 voice reframe | MIGRATED | ENGINES.md §4 §eval:coach law; GATES.md; CLAUDE.md L28 |
| PERSONA_PLAYTEST_FINDINGS F1/F2/F3 headlines | MIGRATED | ROADMAP.md; PERSONA_PLAYTEST_FINDINGS.md; ENGINES.md §2 §3 |
| GAMEPLAY_COMPREHENSION C1 fix (tableContext renders + `context` audit rule) + C4 (`decision_ms` heatmap) | MIGRATED | GAMEPLAY_COMPREHENSION_FINDINGS.md; AUTHORING_SCENARIOS.md §context; TRIAGE.md heatmap |
| Session-length research question (rule: chain rate >50% argues bigger, abandonment >15% smaller) | MIGRATED | DECISIONS.md §Session length; ROADMAP.md item 6 |
| Playtest brief + protocol drafted | MIGRATED | PLAYTEST_BRIEF.md; ROADMAP.md |
| Editable usernames + rate-limit trigger + `disable trigger username_change_limit` override + `RENAME_COOLDOWN_MS` | MIGRATED | ENGINES.md §5 constants (`RENAME_COOLDOWN_MS`); TRIAGE.md events; DEPLOY.md (SQL-before-deploy law by extension) |
| Beta feedback table + `submitFeedback` in db.js | MIGRATED | ARCHITECTURE.md; TRIAGE.md event catalog |
| PostHog analytics — every event + `person_profiles: 'identified_only'` + US cloud | MIGRATED | TRIAGE.md full event catalog (32 events, complete) |
| vercel.json zero-config lesson (legacy `builds`/`routes` silently 404'd /api) | MIGRATED | DECISIONS.md §vercel.json zero-config |
| Landing/OG/SEO + `og.png` generation + sitemap + robots + "Find the leak in your game" tagline | HISTORY | Git; DEPLOY.md covers env vars |
| AdSense scaffolding two-stage env flip | MIGRATED | DECISIONS.md §Monetization; AdSlot ownership |
| Disagree box + `scenario_feedback` table + 4 reason keys + table-peek toggle | MIGRATED | TRIAGE.md event catalog; ARCHITECTURE.md; SCENARIO_GRADING_FINDINGS.md dispute pipeline |

### Repo Structure (L128–L178)
| Old item | Disposition | New location |
|---|---|---|
| ASCII repo tree | MIGRATED (corrected: `App.jsx` moved to `src/`; phantom `gamification.js`, `skillrating.js`, `SkillTracker.jsx` removed; `dates.js` added) | CLAUDE.md L67–L105; ARCHITECTURE.md |
| `.sc2-table` width:100% law + streak-mechanics regression story + "screenshot the canvas" ritual | MIGRATED | CLAUDE.md L109 (repeated in Session rituals L116); ARCHITECTURE.md |
| Google Fonts async-swap pattern (invariant rule 11) | MIGRATED | DECISIONS.md §Google Fonts; GATES.md rule 11 |

### Key Decisions — Architecture (L184–L191)
| Old item | Disposition | New location |
|---|---|---|
| React web + Capacitor iOS Phase 3 + $99 dev account | MIGRATED | DECISIONS.md L11–L13; ROADMAP.md Phase 3 |
| Supabase chosen over Firebase | MIGRATED | DECISIONS.md L15–L17 |
| Supabase env-var pair; localStorage-only mode fallback | MIGRATED | ARCHITECTURE.md; DECISIONS.md §Supabase client |
| "App is routing only" (aspirational, App owns auth today) | MIGRATED (updated) | CLAUDE.md L130 (aspirational note + TARGET_ARCHITECTURE Wave 3 pointer); DECISIONS.md |
| Auth flow: SignIn → UsernameEntry → app | MIGRATED | ARCHITECTURE.md auth flow diagram |

### Key Decisions — Scenarios (L193–L198)
| Old item | Disposition | New location |
|---|---|---|
| Scenario count 83 (outdated — now 172) | MIGRATED (updated to 172) | ROADMAP.md; audit reports |
| `mkHand`/`mkPositions`/`mkScenario` helpers | MIGRATED | AUTHORING_SCENARIOS.md |
| `VILLAIN_LABELS` / `SKILL_TAGS` derive at runtime | MIGRATED | DECISIONS.md never-do bullet |
| console.warn on unknown skill/villain at startup | MIGRATED | AUTHORING_SCENARIOS.md |
| Suit symbols throughout (never shorthand) | MIGRATED | DECISIONS.md never-do; AUTHORING_SCENARIOS.md; audit rule cards |

### Key Decisions — Gameplay (L200–L215)
| Old item | Disposition | New location |
|---|---|---|
| SESSION_LENGTH = 5 | MIGRATED | ENGINES.md §1 constants; DECISIONS.md L75 (with revisit rule) |
| Session builder v2 durable spec (all R1/R1-surge/R2/F2/R4 constants + max-2-preflop cap) | MIGRATED | ENGINES.md §1 (complete); DECISIONS.md (multiple entries) |
| One-tap chaining CTA + `cr_last_difficulty` device-local persistence | MIGRATED | ARCHITECTURE.md L185; DECISIONS.md |
| TIMER_SECONDS = 60 (hardcoded; move server-side Phase 2) | MIGRATED | ARCHITECTURE.md L108; DECISIONS.md L111 |
| Per-scenario feedback static (no API call) | MIGRATED | DECISIONS.md §Hand Analysis; ENGINES.md §4 preamble |
| One live Claude call per session + `fetchCoachRead` path | MIGRATED | ENGINES.md §4; DECISIONS.md |
| Model `claude-sonnet-5` | MIGRATED | ENGINES.md §4 constants (with source citation) |
| `/api/coach-read` hardening (max 10 decisions, 200-char clamp, max_tokens 500, 502 upstream) | MIGRATED | ENGINES.md §4 constants table |
| Structured JSON output (COACH_SCHEMA, `parseCoachRead`) | MIGRATED | ENGINES.md §4; DECISIONS.md §Coach structured JSON |
| Coach voice = session-scoped field notes (July 22 reframe) | MIGRATED | DECISIONS.md L119–L121; ENGINES.md §4 §Voice |
| XP system removed | MIGRATED | DECISIONS.md L131; ENGINES.md §Do not add |
| SkillTracker removed from gameplay | MIGRATED (updated: file deleted) | ARCHITECTURE.md L229 |
| Situation ticker rules (`buildTicker`, `villainSummary`, `actionHistory` overrides) | MIGRATED | DECISIONS.md §Situation ticker; AUTHORING_SCENARIOS.md; ENGINES.md tests |
| `scenario.question` never displayed | MIGRATED | DECISIONS.md L155 |
| Single-canvas layout — `USE_SINGLE_CANVAS` flag (**now DELETED July 26; invariant rule 13 `dead-layout` blocks resurrection**) | MIGRATED | GATES.md rule 13; CLAUDE.md ownership map; ARCHITECTURE.md |
| `.sc2-table` width:100% law | MIGRATED (twice) | CLAUDE.md L109, L116 |

### Key Decisions — Dashboard (L217–L225)
| Old item | Disposition | New location |
|---|---|---|
| Dashboard is entry screen | MIGRATED | DECISIONS.md L79–L80 |
| Section order Stats → Player Profile → CTA → Beta feedback | MIGRATED | ARCHITECTURE.md dashboard section |
| Beta feedback form spec + insert-only RLS + PostHog events + SQL prereq | MIGRATED | TRIAGE.md event catalog; DEPLOY.md SQL-before-deploy |
| Player Profile card (schema + skill ledger merged) | MIGRATED | ARCHITECTURE.md; UI descriptions |
| Skill ledger — grouped-weakest-first + FLIP animation + `prefers-reduced-motion` + pills-not-tappable + Guide/Skills tab + thresholds-never-shown | MIGRATED | ARCHITECTURE.md; ENGINES.md §2 "Ratings are ENGINE INTERNALS" |
| Coach's Notebook — history surface, `COACH_READS_CAP=30`, derived pattern | MIGRATED | ENGINES.md §4 constants + notebook history bullet |
| New-user state deferred | HISTORY | ROADMAP.md backlog implicit |
| Coach greeting / streak warning / leaderboard excluded → backlog | MIGRATED | ROADMAP.md backlog |

### Key Decisions — Fonts (L227–L231)
| Old item | Disposition | New location |
|---|---|---|
| Playfair Display + JetBrains Mono roles + Google Fonts source + Georgia/Courier fallbacks | HISTORY (partial) | Async-swap pattern in DECISIONS.md L63–L65 + GATES.md rule 11; per-role role assignments (Playfair-for-logo, JetBrains-for-labels, Georgia/Courier fallbacks) not restated. **Judgment: durable-but-implicit — the App.css already carries the role decisions and there is no `docs/` design-tokens doc, so this is on the edge of orphan territory. Marked HISTORY because the code IS the spec here.** |

### Key Decisions — Monetization (L233–L235)
| Old item | Disposition | New location |
|---|---|---|
| Revised: launch free, subscription (Pro tier), AdSense on hold | MIGRATED | DECISIONS.md §Monetization (both entries: current + superseded); ROADMAP.md item 8 |
| Superseded original (free + ads, $500/mo ≈ 200 DAU) | MIGRATED | DECISIONS.md keeps the superseded framing for context |

### Screen Flow (L239–L245)
| Old item | Disposition | New location |
|---|---|---|
| ASCII `Dashboard → DifficultySelector → Session → SessionSummary → Dashboard` | MIGRATED (prose) | ARCHITECTURE.md L106 states "Logo tap returns to 'dashboard' from any screen" and screen names; the exact ASCII flow diagram is dropped. Prose equivalent covers it. |

### The 8 Skills table (L249–L264)
| Old item | Disposition | New location |
|---|---|---|
| Skill key + display name + what-it-tests row-by-row table | MIGRATED (source-of-truth) | Skills live in `src/data/constants.js` (single-source rule: engine + guide read the same names). CLAUDE.md drops the display table because the guide's Skills tab IS the user-facing surface and constants.js is the code-facing surface. Judgment: acceptable — the previous CLAUDE.md was duplicating what the code owns. |
| Rating engine thresholds Green 75+ / Yellow 50–74 / Red <50 / Gray <5 | MIGRATED | ENGINES.md §2 constants table |

### The 6 Player Schemas table (L268–L279)
| Old item | Disposition | New location |
|---|---|---|
| Schema name + root belief row-by-row table | MIGRATED | Schemas live in `PLAYER_SCHEMAS` in `src/data/constants.js`. Referenced by name in DECISIONS.md, ENGINES.md §3, RESEARCH_SCHEMA_TAXONOMY.md. Table itself not restated in `docs/`. Acceptable — same single-source-of-truth argument as skills. |

### dummyUser.js Shape (L283–L302)
| Old item | Disposition | New location |
|---|---|---|
| Legacy JSON shape for Phase 2 schema reference | HISTORY | Phase 2 shipped July 2026; `dummyUser.js` file is now unimported dead code queued for deletion (CLAUDE.md L93 notes "deletion owned by TARGET_ARCHITECTURE Wave 1"). Shape reference no longer load-bearing. |

### Phase 2 Tech Stack (L306–L316)
| Old item | Disposition | New location |
|---|---|---|
| Backend Supabase / DB PostgreSQL / Auth Supabase Auth | MIGRATED | ARCHITECTURE.md + DECISIONS.md |
| **State: Zustand or React Context — pre-decided default** | MIGRATED (O-7) | `docs/product/ROADMAP.md` §Phase 3 |
| **Animations: Framer Motion (establish in Phase 1.5) — pre-decided default** | MIGRATED (O-7) | `docs/product/ROADMAP.md` §Phase 3 |
| **6–8 week Phase 2 timeline estimate with a developer** | MIGRATED (O-7) | `docs/product/ROADMAP.md` §Phase 3 |

### Phase 1.6 — Scenario Scale & Expert (L320–L330)
| Old item | Disposition | New location |
|---|---|---|
| Scale up scenario count + Expert difficulty | MIGRATED | ROADMAP.md |
| **Effective stacks DONE July 20 with `stakesFor()`, house default 200, sc_33 override 300, audit rule `stacks`/R10** | MIGRATED | AUTHORING_SCENARIOS.md; GATES.md §Gate 3 rule `stacks`; ENGINES.md §1 |
| Expert-level features TBD | MIGRATED | ROADMAP.md Phase 1.6 |
| Lock in iOS Bundle ID before Phase 3 | MIGRATED | ROADMAP.md L42 |
| SME review carryover | MIGRATED | ROADMAP.md item 5; SCENARIO_GRADING_FINDINGS.md |
| Founders play through 10+ times each carryover | HISTORY | Founder discipline; not a repo rule |

### Post-Phase 1.5 Work (L334–L343)
| Old item | Disposition | New location |
|---|---|---|
| Replace placeholder utils `gamification.js`/`skillrating.js` | HISTORY (obsolete — files deleted) | Removed per MOD-012 audit finding |
| New-user gray dots + locked schema + onboarding | HISTORY | ROADMAP.md backlog implicit; SCHEMA_UNLOCK_SESSIONS covers locked-schema |
| Schema diagnosis engine v2 (direction-of-error hybrid) — full mechanism | MIGRATED | ENGINES.md §3; DECISIONS.md |
| Level-aware fallback voice (BALANCED_SCHEMA vs STUDENT_SCHEMA) | MIGRATED | ENGINES.md §3 §Fallback voice; DECISIONS.md |
| Schema v2 skill-side TODO + spec inputs from RESEARCH_SCHEMA_TAXONOMY | MIGRATED | ENGINES.md §3 §Skill-side v2 — pending |
| Simulation harness `simulate:schemas` reworked to v2 | MIGRATED | GATES.md §The harnesses; ENGINES.md §3 tests |

### Backlog (L347–L360)
| Old item | Disposition | New location |
|---|---|---|
| Research-derived backlog (tilt-signature, Table Reads fluency tracking) | MIGRATED | ROADMAP.md backlog |
| Roulette mode Variants A + B | MIGRATED | DECISIONS.md §REJECTED (both variants) |
| "Table Reads" mode entry (design + 10 hands captured) | MIGRATED (built) | ENGINES.md §6; TABLE_READS_DESIGN.md |
| PRO BACKLOG: hand-ingestion pipeline | MIGRATED | ROADMAP.md Pro backlog |
| PRO BACKLOG: periodic meta-read | MIGRATED | ROADMAP.md Pro backlog |
| Leaderboard friends-only | MIGRATED | DECISIONS.md §REJECTED (public/global); ROADMAP.md backlog |
| Streak warning / coach greeting / streak badges | MIGRATED | ROADMAP.md backlog |
| Editable usernames DONE July 6 (full mechanism) | MIGRATED | ENGINES.md §5 `RENAME_COOLDOWN_MS`; TRIAGE.md events |

### What to Never Do (L364–L375)
See special-check verbatim diff above — 11 bullets migrated byte-identically to CLAUDE.md; annotated verbatim in DECISIONS.md.

---

## Migration-quality observations

1. **The migration authors were unusually thorough.** 72+ load-bearing items migrated, all 7 special checks pass, the never-do list preserved byte-identically in the two most-read locations. Every algorithm constant is cited to a source line.
2. **The 7 orphans cluster around one root cause:** they are all **buried mid-paragraph** in long build-log bullets or in the "Phase 2 Tech Stack" table that had no `docs/` home. The migration authors correctly identified the deliberate build-log bullets as HISTORY and let them go — but a handful of durable rules were embedded inside those bullets and got let go with them. The specific fix is small (a paragraph in AUTHORING_SCENARIOS.md for O-3/O-6, an ops-runbook line in DEPLOY.md or TRIAGE.md for O-1/O-4, an addendum in ROADMAP.md for O-2/O-5/O-7).
3. **Two items were dropped as HISTORY that arguably deserve `docs/` homes but I judged the code IS the spec** (font role assignments; the exact ASCII screen-flow diagram). If a future contributor searches for "Playfair Display roles" the answer lives in App.css and the guide's Skills tab; the CLAUDE.md restatement was documentation, not spec. Reasonable people could disagree.
4. **No orphaned LAWs risk immediate footguns.** The `$50/mo cap` is defense-in-depth behind the server per-user counter; the `TICKER_STAKES` stakes-scaling rule is only relevant when authoring a hand at other stakes (rare); the cross-account cleanup SQL is a runbook needed when a specific user reports drift.

---

*Audit prepared 2026-07-26. If any orphaned item is later migrated, cross-reference back to this file.*
