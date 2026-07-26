> **Read this when** you need the durable spec for a scoring, scheduling, or diagnosis engine — before tuning a constant, changing a formula, or writing a new gate around one. For file ownership and data flow see [ARCHITECTURE.md](ARCHITECTURE.md). For enforcement commands see [../operations/GATES.md](../operations/GATES.md).
>
> Every constant in this document is cited to its source file. Regenerable by verification: `grep` any constant name and the value here must match the code. A mismatch is a doc bug — fix the doc, not the code, unless the code is the bug.

---

# CheckRaise — Engine Specs

Six engines drive the product's behavior. This is what each does today, the constants that shape it, and the tests that pin it.

1. Session builder v2 (spaced repetition)
2. Rating and Poker IQ (accuracy scoring + recency-weighted display)
3. Schema hybrid v2 (direction + skill diagnosis)
4. Coach pipeline (structured JSON read + eval harness)
5. Streak and Rebuys (retention mechanic)
6. Table Reads (mode-local villain-identification)

Each section ends with "enforced/tested by" pointers.

---

## 1. Session builder v2

**What it does.** Deals a 5-hand session from the difficulty pool honoring three ordered priorities: resurface up to two hands still on the graduation ladder (with the honest replay chip); fill two "weak slot" seats with unseen scenarios in the player's red/yellow skills; fill the rest with unseen scenarios respecting per-skill and preflop caps. Rebuilds per-scenario history from the append-only `sessions` rows on load — no schema change; the ladder is a derived view of the same data.

### Constants

| Constant | Value | Source |
|---|---|---|
| `LADDER_SESSIONS` | `[2, 5, 13]` | `src/utils/spacedrep.js:40` |
| `GRADUATION_TARGET_FIRST` | `2` | `src/utils/spacedrep.js:51` |
| `GRADUATION_TARGET_REPEAT` | `3` | `src/utils/spacedrep.js:52` |
| `GRADUATION_TARGET` (back-compat alias) | `GRADUATION_TARGET_REPEAT` = `3` | `src/utils/spacedrep.js:55` |
| `RESURFACE_COOLDOWN_SESSIONS` (back-compat alias) | `LADDER_SESSIONS[0]` = `2` | `src/utils/spacedrep.js:64` |
| `CONFIDENT_MISS_MS` | `15000` (15s of a 60s clock) | `src/utils/spacedrep.js:68` |
| `SURGE_QUEUE_THRESHOLD` | `8` | `src/utils/spacedrep.js:77` |
| `WEAK_SLOT_TARGET` (internal) | `2` | `src/utils/spacedrep.js:78` |
| `MAX_PER_SKILL` (internal) | `2` | `src/utils/spacedrep.js:79` |
| `MAX_CONTRAST_PAIRS_PER_SESSION` (internal) | `1` | `src/utils/spacedrep.js:86` |
| Preflop cap per session | `Math.max(1, floor(length * 0.4))` = `2` at length 5 | `src/utils/spacedrep.js:91` |
| `SESSION_LENGTH` (call-site) | `5` | `src/App.jsx:21` |

### Behavioral rules

- **Graduation ladder (R1).** A missed hand enters remediation at rung 0 and resurfaces after `LADDER_SESSIONS[rung]` fully-completed sessions. Each spaced correct advances the rung; a new miss resets to rung 0. The graduation target is **graded** by lifetime miss count: a hand missed only once needs `GRADUATION_TARGET_FIRST` = 2 spaced corrects; a repeat offender (≥2 misses) needs `GRADUATION_TARGET_REPEAT` = 3. A legacy remediating entry with no `misses` field is treated as a repeat (conservative default). `misses` is derived — `historyFromSessions` rebuilds it by replay; no schema change.
- **Calendar-day floor (R2).** Cooldown is `max(N sessions, 1 calendar day)`. A same-day chained session cannot resurface a same-day miss. Wall clock: `sessions.created_at` (Supabase) or `toLocalDateString(new Date())` (local). Missing dates degrade to session-count-only so legacy history still resurfaces.
- **Confident miss (F2).** `decisionMs > 0 && decisionMs <= CONFIDENT_MISS_MS` marks the last miss `lastMissConfident: true`. In the resurface queue, confident misses jump ahead of ordinary misses (by `lastSeenAt` within the confident tier). The flag rides the replay object (`{ ...s, replay: true, confidentMiss: true }`) and flows through to the coach payload.
- **Replay surge (F1).** Normally one replay slot per session; surges to two while the pool-scoped remediation queue depth exceeds `SURGE_QUEUE_THRESHOLD` = 8. Depth counts only remediating hands whose id is in the CURRENT difficulty pool, so a deep beginner queue never surges an intermediate session. Both replays pass the same ladder + calendar-day gate and both carry the replay chip. Two replays still leave 3 slots for weak-skill targeting + R4 pairing.
- **Weak-slot targeting.** Two slots aim at unseen scenarios in the player's weakest rated skills — red tier first, then yellow — capped at `MAX_PER_SKILL` = 2 hands per skill per session.
- **Preflop cap.** Soft cap of 2 preflop hands per 5-hand session (`floor(length * 0.4)`, minimum 1). Yields when the pool leaves no other choice. Postflop streets are uncapped.
- **Contrast pairs (R4/F4).** `CONTRAST_PAIRS` in `src/data/scenarios.js` are authored 2-item groups sharing a difficulty. Whenever a weak-slot or replay seat lands a paired scenario, the builder also seats an eligible same-pool partner (spending a general slot) and `enforceAdjacency` places them next to each other in the dealt order — juxtaposition is the teaching mechanism. **F4 trigger boost:** within red/yellow tiers, `buildSession` PREFERS pair members over non-members in a two-pass scan before the caps apply, lifting pair firing from ~1-3/40 sessions to ~4-14/40. Capped at `MAX_CONTRAST_PAIRS_PER_SESSION` = 1. Never touches the replay slot; respects all skill and preflop caps. Cross-difficulty documented mirrors are inert (one pool per difficulty) and live only as comments in `CONTRAST_PAIRS`.
- **Ids are NOT normalized.** Scenario ids are heterogeneous — legacy scenarios use numeric ids (e.g. `id: 2`), batch scenarios use strings (e.g. `'sc_172'`). Match on the raw `id` everywhere (`SCENARIO_BY_ID`, `history[id]`, `pickedIds`). Normalization would silently break every history lookup.
- **Pool exhaustion.** When the unseen + eligible-miss pools are drained, the builder re-deals seen scenarios least-recently-seen first, first respecting the preflop cap then giving it up. Guarantees a full 5-hand session even from a pool of one (jest-mocked path).
- **History is derived.** In Supabase mode `historyFromSessions(rows, sessionsCompleted)` rebuilds the full history map from the append-only `sessions` rows on every profile load. The `base` offset (`max(0, sessionsCompleted - rows.length)`) keeps `lastSeenAt` on the same scale as the live counter for pre-Supabase migrated sessions with no rows.

### Enforced/tested by

- `src/utils/spacedrep.test.js` — the spacedrep.test.js suite: ladder progression/reset, expanding interval, graded FIRST/REPEAT targets, `misses` rebuild, same-day suppression under fake timers, confident-miss ordering, surge behavior at and above threshold, R4 pairing (adjacency, cap, replay-slot integrity, per-skill cap).
- `src/App.twooption.test.js` — chaining integration; proves `applyHandsToHistory` merges the just-played hands so chained sessions can't repeat.
- `scripts/playtest-personas.mjs` (`npm run playtest:personas`) — 8 personas × 40 sessions × 10 trials; the "all mechanical invariants held" line covers session shape, replay integrity, calendar floor, ≤2 replays, and the surge legality condition.
- `scripts/check-invariants.mjs` (`npm run check:invariants`) — single-file ownership for the session builder.

---

## 2. Rating and Poker IQ

**What it does.** Two orthogonal scoring layers on the same 8-skill accuracy data. **Skill ratings** (green/yellow/red/gray) are lifetime true accuracy — the ledger that anchors the schema card, the weak-slot dealer, and everything else that reads a skill's health. **Poker IQ** is the display headline number and is recency-weighted — it must respond to current form or improvement is invisible.

### Constants

| Constant | Value | Source |
|---|---|---|
| `MIN_RATED_ATTEMPTS` | `5` | `src/data/constants.js:116` |
| `RESULT_CREDIT` | `{ correct: 1, partial: 0.5, incorrect: 0 }` | `src/data/constants.js:118` |
| Green threshold | `≥ 0.75` | `src/data/constants.js:123` |
| Yellow threshold | `≥ 0.50` (else red) | `src/data/constants.js:124` |
| `RECENT_WINDOW` | `8` | `src/utils/userStorage.js:461` |
| `MIN_RECENT_HANDS` (internal) | `8` | `src/utils/userStorage.js:462` |
| `RECENT_HANDS_CAP` | `200` | `src/utils/userStorage.js:465` |
| `RATING_SEED` (one-time migration, internal) | `{ green: 0.8, yellow: 0.6, red: 0.3, gray: 0.5 }` | `src/utils/userStorage.js:27` |

### Behavioral rules

- **`applyHandToSkill(data, result)`** — folds one hand's `result` into a skill's `{rating, attempts, correct}`. `attempts += 1`, `correct += RESULT_CREDIT[result]`, then re-derive the rating. Every hand played counts (duplicates within a session count twice). Unknown results are a no-op.
- **`deriveRating(correct, attempts)`** — gray until `attempts >= MIN_RATED_ATTEMPTS`; then `correct/attempts` compared against 0.75 (green) and 0.50 (yellow). Below yellow is red.
- **Ratings are ENGINE INTERNALS.** Never surface the 0.75/0.50 thresholds in user-facing copy — the guide shows status names only.
- **`derivePokerScore(skills, recentHands = [])`** — the Poker IQ display value. Same gate as the rating engine (rated = 5+ attempts and not gray); null when nothing is rated. Per rated skill: if the recent-hands stream contains at least `MIN_RECENT_HANDS` samples for that skill, score = accuracy over its last `RECENT_WINDOW` hands (with the same `RESULT_CREDIT` weighting); otherwise fall back to lifetime `correct/attempts`. Final score is the arithmetic mean across rated skills, rounded. Called with `recentHands` missing/empty → behaves EXACTLY like the lifetime formula (legacy users degrade gracefully until their window fills).
- **MIN_RECENT_HANDS vs RECENT_WINDOW are independent.** MIN is the anti-oscillation ACTIVATION floor (enough samples to trust the window); WINDOW is the SCORING depth. Slicing before the count check would silently disable windowing whenever WINDOW < MIN.
- **Only the IQ DISPLAY is recency-weighted.** Skill ratings/buckets (`deriveRating`) and schema diagnosis (`deriveSchema`) stay lifetime-based on purpose — the ledger and the schema deliberately measure the whole record. Chasing current form is only the headline's job.
- **`appendRecentHands(buf, hands)`** — appends `{skill, result}` per hand, newest last, trims to `RECENT_HANDS_CAP`.
- **Self-healing.** In Supabase mode `db.js recentHandsFromSessions` rebuilds the buffer fresh from the append-only session log (chronological, newest last). `db.js assembleUser` derives `pokerScore` from live skills and the rebuilt buffer, bypassing the persisted `profiles.poker_score` column (the column is still written; only its read is bypassed) so stale bucket-based scores heal on load. `migrateUser` (localStorage) does the same for cached local users.

### Enforced/tested by

- `src/utils/userStorage.test.js` — `derivePokerScore` lifetime + windowed cases; `applySessionResults` end-to-end; recent-hands cap and slicing.
- `scripts/check-invariants.mjs` — single-file ownership (`constants.js` for `deriveRating`; `userStorage.js` for `derivePokerScore`).
- `scripts/playtest-personas.mjs` — F3 acceptance: Improver (45% → 85% across 40 sessions) reaches median end IQ ~79 with the recency window; a WINDOW=20 test would leave him at 72.

---

## 3. Schema hybrid v2

**What it does.** Diagnoses one of six player schemas from a mix of *direction-of-error* signal (three "direction" schemas: Conflict Avoider / Gambler / Overaggressor) and *absolute skill weakness* (three "skill" schemas: Positional Blind Spot / Results Thinker / Exploitable Regular). Single highest severity across all six wins; below the bar or tied → a level-aware Balanced/Student fallback. Locked until the user has completed enough sessions to have real data.

### Constants

| Constant | Value | Source |
|---|---|---|
| `SCHEMA_MIN_SEVERITY` (internal) | `1.25` | `src/utils/userStorage.js:304` |
| `MIN_DIRECTION_EVIDENCE` (internal) | `10` | `src/utils/userStorage.js:355` |
| `DIRECTION_FULL_EVIDENCE` (internal) | `20` | `src/utils/userStorage.js:356` |
| `DIRECTION_MISS_MATERIALITY` (internal) | `0.15` | `src/utils/userStorage.js:357` |
| `DIRECTION_DOMINANCE` (internal) | `0.4` | `src/utils/userStorage.js:358` |
| `DIRECTION_SEV_SCALE` (internal) | `2.5` | `src/utils/userStorage.js:359` |
| `SCHEMA_UNLOCK_SESSIONS` | `5` | `src/utils/userStorage.js:363` |
| `DIRECTION_WEIGHT` (internal) | `{ incorrect: 1.0, partial: 0.5 }` | `src/utils/userStorage.js:229` |
| Skill-schema evidence floor | `attempts >= 3` per contributing skill | `src/utils/userStorage.js:403` |
| `EMPTY_DIRECTION_TALLY` | `{ under: 0, over: 0, loose: 0, evidence: 0, hands: 0 }` | `src/utils/userStorage.js:223` |
| Direction baseline (computed once from live pool) | `{ under: ~0.53, over: ~0.33, loose: ~0.14 }` | `src/utils/userStorage.js:207-220` |

### Direction axes

The `fold(0) < call(1) < raise(2)` ordinal captures the mistake's direction (`classifyDirection` in `src/utils/userStorage.js:169`):

| Cell | Rule | Schema |
|---|---|---|
| `under` | chose more passive than correct (`c < k`) — fold-when-call, fold-when-raise, call-when-raise | The Conflict Avoider |
| `loose` | `call-when-fold` (carved out of the `+1` delta BEFORE `over`) | The Gambler |
| `over` | `raise-when-call`, `raise-when-fold` | The Overaggressor |
| `null` | `c === k` (same-cls mistake, e.g. wrong bet size) or unknown/missing cls | — |

Correct answers and timeouts (`choiceVal == null`) carry no directional signal.

### Behavioral rules

- **Hybrid gate.** `deriveSchema(skills, sessionsCompleted, directionTally)` returns `null` (locked card) while `sessionsCompleted < SCHEMA_UNLOCK_SESSIONS`. Otherwise scores every schema and picks the single highest above `SCHEMA_MIN_SEVERITY`; ties or no-clear-winner fall to the level-aware fallback.
- **Direction schemas.** Score only when four gates all pass:
  1. `directionTally.evidence >= MIN_DIRECTION_EVIDENCE` (early streaks can't name a schema).
  2. `evidence / hands >= DIRECTION_MISS_MATERIALITY` (direction schemas describe LEAKY players; strong players fall to Balanced honestly).
  3. `share (= directionTally[cell] / evidence) >= DIRECTION_DOMINANCE` (plurality pre-filter).
  4. `excess = max(0, (share - baseline) / (1 - baseline)) > 0` (severity is EXCESS over the neutral baseline, not raw share — a uniform-mistaking player sits at under ≈ 0.53 and would otherwise trip Conflict Avoider).
  Severity = `min(2, DIRECTION_SEV_SCALE * excess * confidence)` where `confidence = min(1, evidence / DIRECTION_FULL_EVIDENCE)` is the linear ramp that prevents transient-mislabel spikes at low evidence.
- **Skill schemas.** UNCHANGED from v1. Score = `raw / measured` where `raw` sums 2 (red) or 1 (yellow) across the schema's `primary` skills that have ≥3 attempts, and `measured` is the count of qualifying skills. Normalization stops multi-skill schemas from mechanically beating single-skill ones.
- **Fallback voice.** `balancedFallback(skills)`: if any rated (≥5 attempts, not gray) skill exists and green outnumbers the rest (`green * 2 > rated.length`), return `BALANCED_SCHEMA` ("The Balanced Player — No single leak dominates your game"). Otherwise return `STUDENT_SCHEMA` ("The Student of the Game — Every part of my game is still sharpening"). The founder call: "no dominant leak" reads as reassurance to a 52-IQ uniformly-weak player; the honest message is that the whole skillset is the opportunity.
- **Direction schemas display no chips.** `affected: []` for a direction winner; only skill winners emit `{skill, level}` chips (currently unused by the card but preserved in the shape).
- **Direction tally is derived and lifetime.** `addHandsToDirectionTally(tally, hands)` folds a session's hands per `DIRECTION_WEIGHT` (partial = 0.5, incorrect = 1.0, correct = 0). `db.js directionTallyFromSessions` rebuilds it fresh from the append-only session log on load — self-healing across devices, order-independent (it's a sum). Rows lacking `choiceVal` (pre-v2) skip gracefully.
- **Baseline is computed once from live scenarios** (`computeDirectionBaseline`). Because `under` absorbs 3 of the 6 mispairs and `loose` captures only 1, the baseline is inherently skewed — using it as the excess denominator is what lets one threshold separate a true Gambler (loose 0.62, baseline 0.14 → excess 0.56) from a strong uniform player (under 0.63, baseline 0.53 → excess 0.22).

### Skill-side v2 — pending

The three SKILL schemas (Positional Blind Spot, Results Thinker, Exploitable Regular) still score fixed red/yellow buckets (absolute weakness). Known residuals from the persona harness: skill schemas under-fire for true skill personas (Positional ~1/10, Exploitable Regular/Results Thinker combined ~5–7/10) because partial credit lifts scoring skills into yellow at realistic accuracy, and villain-blind personas fail `opponent` AND `reads` equally (red-red ties → Balanced).

Spec inputs for the eventual rewrite (from `docs/research/RESEARCH_SCHEMA_TAXONOMY.md`):
- Re-anchor **Results Thinker** on an observable signature (remediation-resistance or confident-miss density). The reads-skill proxy is the weakest mapping in the taxonomy — RT is a belief about the learning process, not a decision-observable skill leak.
- Extend `classifyDirection` with a **bet-sizing sub-axis.** Too-small and too-big both read as "raise" in the ordinal today; option `cls` already distinguishes sizes so the data exists.
- Consider scenario-difficulty normalization. Chess human-error research shows errors are dominantly situation-driven, not trait-driven.
- Score skills relative to a player's OWN mean, not absolute buckets — so an improving player's real leak is distinguished from a beginner's uniform weakness.

Calibrate against real per-skill distributions once PostHog/Supabase sessions accumulate. Derived-only; no DB migration.

### Enforced/tested by

- `src/utils/userStorage.test.js` — `classifyDirection` axes, `directionOfHand`, `addHandsToDirectionTally`, `deriveSchema` hybrid cases (direction winners, skill winners, Balanced/Student split).
- `scripts/simulate-schemas.mjs` (`npm run simulate:schemas`) — structural-bias gate; runs the REAL `deriveSchema` against synthetic archetypes with direction-tally-aware v2 profiles and exits 1 on regression. Includes a "Positional + under-skew" guard proving a direction schema cannot hijack a genuinely red skill leak.
- `scripts/playtest-personas.mjs` — schema-side acceptance (zero opposite-direction labels across 30 trials; the confidence ramp + materiality gate pass).
- `scripts/check-invariants.mjs` — single-file ownership: schemas live in `src/data/constants.js`, scored in `src/utils/userStorage.js`.

---

## 4. Coach pipeline

**What it does.** One live Claude call per completed session, from the ONLY file that talks to Anthropic. Session decisions are shaped by the client, sent to a Vercel serverless function that requires a signed-in Supabase user, enforces a per-user daily cap, calls `claude-sonnet-5` with a structured-output schema, and returns `{ text: <JSON string> }`. The client parses at render time and gracefully renders legacy prose reads (pre-restructure) or the model's raw text if JSON validation fails.

### Cost rails

Two independent limits bound spend:

- **`DAILY_LIMIT` = 5 calls/user/day** — enforced server-side in `api/coach-read.js` via the `coach_usage` table. A per-user counter that 429s on the 6th call each UTC day.
- **$50/mo Anthropic console spending cap** — set in the Anthropic dashboard (not in code). This is the last-line dollar ceiling: even if the per-user counter were bypassed by a bug or prompt-injection, the monthly cap is the hard stop that prevents runaway cost. Do not remove it from the Anthropic dashboard.

### Constants

| Constant | Value | Source |
|---|---|---|
| `DAILY_LIMIT` (server) | `5` calls/user/day | `api/coach-read.js:11` |
| `COACH_DAILY_LIMIT` (client display mirror) | `5` | `src/components/SessionSummary.jsx:9` |
| `MAX_DECISIONS` per request | `10` | `api/coach-read.js:19` |
| String field clamp | `200` chars (`position` 30, `hand` 20, `chose`/`correctAction` 40, `result` 20, `villainNotes` clamp 200 default) | `api/coach-read.js:90, 116-122` |
| `max_tokens` | `500` | `api/coach-read.js:160` |
| Model | `claude-sonnet-5` | `api/coach-read.js:156` |
| `thinking` | `{ type: 'disabled' }` | `api/coach-read.js:164` |
| `output_config` format | `{ type: 'json_schema', schema: COACH_SCHEMA }` | `api/coach-read.js:166` |
| `COACH_SCHEMA` | `{headline: string, evidence: string[], watchFor: string}`, `additionalProperties: false` | `api/coach-read.js:96-105` |
| `COACH_READS_CAP` (notebook depth) | `30` | `src/utils/userStorage.js:506` |

### Behavioral rules

- **Auth + daily cap.** POST-only. When `SUPABASE_URL` + `SUPABASE_SECRET_KEY` are set (always in prod), the handler requires a Bearer token, resolves the uid via `admin.auth.getUser(token)`, reads `coach_usage(user_id, day)`, and 429s if `calls >= DAILY_LIMIT`. On success it upserts `calls + 1` (`onConflict: 'user_id,day'`). No auth env → dev-only bypass.
- **Input validation.** Body must be `{ decisionsPlayed: [...] }`, length 1–10, else 400. Every string field is clamped (default 200 chars; positional/hand/action fields tighter).
- **Structured output.** Response is constrained to `COACH_SCHEMA` via `output_config.format.type = 'json_schema'`. `additionalProperties: false` is required by the feature; length/count limits (`maxLength`, `minItems`, `maxItems`) are UNSUPPORTED in-schema and enforced in the prompt text instead.
- **Wire format is unchanged.** The response is always `{ text: string }` (both DB columns `sessions.coach_read` and `profiles.coach_note_body` are unchanged). `normalizeCoachRead` re-serializes valid structured output to canonical JSON; parse/validation failure passes the raw text through so the client falls back to prose. The client's `parseCoachRead` runs at render time.
- **Voice — session-scoped field notes (July 22, 2026 reframe).** The prompt frames the coach as jotting field notes after a small 5-hand sample, NOT diagnosing. Every claim scopes to this session ("today", "these hands"); no "you are a...", "you always...", "your game...". The trend across sessions is the notebook's job — one session is field notes.
- **Prompt shape.** Three required fields:
  - **headline** — one sentence, ≤12 words, THIS-session observation. Confident-miss cluster (misses tagged `answered fast (looked sure)`) MUST lead the headline.
  - **evidence** — 2–3 items, each ≤20 words, each tied to a specific hand + villain from the payload.
  - **watchFor** — one sentence, ≤18 words, concrete and actionable for the next session.
- **Prompt rules (also enforced in text).** Direction of mistakes matters (folding-when-raise ≠ raising-when-fold); mixed-direction sessions must say so honestly; never invent holdings/spots not in the data; say "the recommended play", never "the solve" or GTO language; no em dashes; no "not only… but also"; no generic praise; reference villain types; a clean session gets a brief acknowledgment plus one thing to keep watching.
- **Confident-miss flag.** `src/utils/claude.js` sets `confidentMiss: true` on payload items where `result === 'incorrect' && decisionMs > 0 && decisionMs <= CONFIDENT_MISS_MS` (imports the constant from `spacedrep.js` — single source). Payload strings for those hands include `answered fast (looked sure)`.
- **Client parsing.** `parseCoachRead(raw)` returns `null` for empty/missing, `{ structured: { headline, evidence, watchFor } }` for valid JSON with a string headline, and `{ legacy: raw }` for prose (every pre-restructure DB read + any graceful-degradation fallback).
- **Client error contracts.** `fetchCoachRead` in `src/utils/claude.js`:
  - Network throw → `track('coach_read_failed', { reason: 'network' })`, rethrow.
  - 429 → `track('coach_read_failed', { reason: 'daily_limit' })`, throw `Error('Daily coach limit reached')` with `err.code = 'daily_limit'`. Summary shows "You've used today's 5 Coach's Reads — they refresh tomorrow." (COACH_DAILY_LIMIT must mirror DAILY_LIMIT).
  - Any other non-ok → `track('coach_read_failed', { reason: 'http', status })`, return `''` (empty → graceful fallback).
  - Missing `data.text` → `track('coach_read_failed', { reason: 'empty_response' })`, return `''`.
  - Success → `track('coach_read_ok')`, return `data.text`.
- **Notebook history.** `applySessionResults` prepends `{ date, body }` to `user.coachReads` (raw string preserved; parsed at render) capped at `COACH_READS_CAP`. `db.js coachReadsFromSessions` rebuilds it from the session log (skip null/empty, date via `toLocalDateString(created_at)`, newest first, capped) — self-healing across devices.

### The eval:coach law

**Re-run `npm run eval:coach` LIVE after ANY prompt or model change.** The harness (`scripts/eval-coach.mjs`) imports `buildPrompt` and `callClaude` from `api/coach-read.js` — the REAL prompt and REAL request params, never a copy that can drift. It runs 9 synthetic sessions (one per schema plus confident-misser / double-timeout / perfect personas) and writes `coach-eval-output.md` for judgment against the F5 bar:

1. Names the pattern-level WHY (mental model), not per-hand recaps
2. Names the DIRECTION of mistakes (too passive vs too aggressive)
3. References villain types involved, not just abstract skills
4. Calls out clustered confident misses ("answered fast") directly
5. Human tone; no generic praise, no restating results the player saw
6. Session-scoped field-notes voice ("what I noticed today"), never a trait verdict — July 22, 2026 reframe

Mechanical checks in the harness flag structural issues (parses, three fields, evidence count 1–3, headline word count, confident-misser headline mentions the fast/confident pattern, soft-flag on verdict phrasing `you are a/an/the/too`, `you always/never`, `your game`, `as a player`). Judgment against the F5 bar is still human.

**Live re-run status: VERIFIED July 26, 2026.** The July 22 voice reframe passed its live run — 9/9 personas pass the F5 bar, zero trait verdicts, the honest-mixed and confident-miss-lead rules both confirmed working live. Accepted residuals from that run: one garbled evidence action-verb (1 of 27 lines) and the Positional persona's thread read as villain-exploitation rather than position (mixed-direction session, same class as the accepted F2b residual). The law stands for FUTURE changes: run `CLAUDE_API_KEY=... npm run eval:coach` live after any prompt/model change; the key is Vercel-Sensitive by design — never commit it, never put it in `.env`; use a short-lived console key and delete it after.

### Enforced/tested by

- `src/utils/claude.test.js` — network / 429 / http / empty response contracts; PostHog event names + payloads.
- `src/utils/userStorage.test.js` — `parseCoachRead` structured / legacy / null / malformed cases.
- `scripts/eval-coach.mjs` (`npm run eval:coach`) — F5 quality gate (human judgment) + mechanical checks.
- `scripts/check-invariants.mjs` — single-file ownership: `api/coach-read.js` is the ONLY Anthropic caller; `src/utils/claude.js` is the ONLY client fetch to `/api/coach-read`.

---

## 5. Streak and Rebuys

**What it does.** A retention mechanic implemented as pure derived logic on a small profile shape. `calcStreak` advances the streak by one on the first session of a new calendar day; a missed day silently consumes a Rebuy (streak survives + advances) or resets the streak if no Rebuys are held. Rebuys are earned at 7-day milestones, capped, and reset when the streak breaks. `streakAlive` and `activeDaysLast30` power the display honesty: a stale streak that would break if played today doesn't get to swagger.

### Constants

| Constant | Value | Source |
|---|---|---|
| `REBUY_CAP` | `2` | `src/utils/userStorage.js:544` |
| `STREAK_MILESTONE_INTERVAL` (internal) | `7` (days) | `src/utils/userStorage.js:545` |
| `STREAK_MILESTONES_LIST` | `[7, 30, 100]` | `src/utils/userStorage.js:550` |
| `MILESTONE_NAMES` | `{7: 'a full week', 30: 'a full month', 100: 'a hundred days'}` | `src/utils/userStorage.js:553` |
| `PROXIMITY_WINDOW` (internal) | `3` (days out) | `src/utils/userStorage.js:554` |
| `RENAME_COOLDOWN_MS` (separate mechanic — username edit) | `7 * 24 * 60 * 60 * 1000` | `src/utils/userStorage.js:11` |
| `THIRTY_DAYS_MS` (internal) | `30 * 86_400_000` | `src/utils/db.js:15` |

### Behavioral rules

- **`calcStreak(user)`** — reads `new Date()` at call time; returns `{ streak, lastSessionDate, rebuys, rebuyUsed }`.
  - `lastSessionDate === today` → unchanged (same-day session doesn't secure or advance).
  - No prior date → fresh streak of 1.
  - `gap === 1` (consecutive day) → `streak + 1`, then `grantMilestoneRebuy(streak, rebuys)`.
  - `gap <= 0` (defensive) → same as "already today".
  - `missedDays (= gap - 1) <= rebuys` → streak advances by 1, `rebuys - missedDays` (then a possible milestone grant), `rebuyUsed: true`.
  - `missedDays > rebuys` → streak resets to 1, `rebuys` resets to 0, `rebuyUsed: false` (broken-streak moment).
- **`grantMilestoneRebuy(streak, rebuys)`** — grants one Rebuy on any streak that is a positive multiple of `STREAK_MILESTONE_INTERVAL` (once — the streak steps by exactly 1 per active day, so each multiple is hit once). Capped at `REBUY_CAP`.
- **`streakAlive(user, now = new Date())`** — returns `true` iff playing today would CONTINUE the stored streak (gap ≤ 1, or the gap is Rebuy-covered). False when the stored streak is already dead (lapsed beyond Rebuy coverage) or zero. Dashboard uses this to suppress the stale "on the line" banner and to show an honest streak count in the stats chip.
- **`milestoneProximity(streak)`** — returns `{ remaining, name }` when the streak is within `PROXIMITY_WINDOW` (3) days of the next `STREAK_MILESTONES_LIST` entry, else `null`. Zero and the milestone itself both return null (approaching, not at/past). Same map used by summary + dashboard so milestone wording cannot drift.
- **`activeDaysLast30(sessionRows)`** — distinct local calendar days with a session in the last 30 days. Rebuilt from the append-only session log; `null` in localStorage mode (falls back to copy-only). Today's just-finished session isn't in the rows yet at the broken-streak moment, which only ever undercounts by one — acceptable for encouragement.
- **`daysBetween(fromStr, toStr)`** — UTC math on the parsed YYYY-MM-DD components so DST doesn't shift a boundary.
- **Rebuys belong to the streak they protect.** A true break resets both `streak` to 1 and `rebuys` to 0. The broken-streak MOMENT lives in the UI (summary + dashboard show `activeDaysLast30` + one-tap restart instead of a bare "Day 1 secured").

### Enforced/tested by

- `src/utils/userStorage.test.js` — `calcStreak` consecutive advance, same-day noop, first session, milestone earn, cap, single/double Rebuy consume, break-clears-Rebuys, consume+earn same recompute; `milestoneProximity` window boundaries; `streakAlive` today/yesterday/Rebuy-covered/dead/zero/missing.
- `src/components/Dashboard.test.js` — broken-streak moment (streakBroken → suppresses bare "Day 1", shows `activeDaysLast30`), Rebuy-used copy, chip alive/dead states.
- `src/components/SessionSummary.test.js` — perfect-session moment, streak-secured line, personal best, `activeDaysLast30` fallback.
- `e2e/streaks.spec.mjs` — faked-clock end-to-end (consecutive advance, day-7 milestone earn, missed-day consume with intact streak, broken-streak reset copy, same-day sessions don't secure).
- `scripts/check-invariants.mjs` — single-file ownership: streak logic lives in `userStorage.js`.

---

## 6. Table Reads

**What it does.** The inverse trainer: watch a hand's street-by-street replay, then pick which villain archetype it is. Mode-local scoring — no writes to the 8-skill ratings — so a future Pro gate stays clean and observation accuracy never contaminates decision accuracy. Beginner-first dealing until a low lifetime-attempt floor, then the whole 22-hand pool shuffles together. Session length 5, chained via "Read Another Table".

### Constants

| Constant | Value | Source |
|---|---|---|
| `TR_SESSION_LENGTH` (internal) | `5` | `src/components/TableReads.jsx:10` |
| `REVEAL_MS` (internal) | `1100` ms per street | `src/components/TableReads.jsx:11` |
| `BEGINNER_FIRST_ATTEMPTS` (internal) | `4` | `src/components/TableReads.jsx:15` |
| `TABLE_READS_KEY` (localStorage) | `'cr_table_reads_stats'` | `src/utils/userStorage.js:131` |
| Pool size | 22 observations (4 beginner + 18 intermediate) | `src/data/observations.js` |

### Behavioral rules

- **Mode-local scoring.** Founder decision July 18, 2026: observation accuracy ≠ decision accuracy, and keeping the mode self-contained keeps a future Pro gate clean. `loadTableReadsStats` / `saveTableReadsStats` in `userStorage.js` own the persisted `{ attempts, correct, seenIds, correctIds, lastDeck }` shape. Backward-compatible: legacy objects with just `attempts`/`correct` load with empty arrays for the dealing-memory fields.
- **Device-local persistence.** `localStorage['cr_table_reads_stats']` — no Supabase writes, no cross-device sync. Acceptable for beta.
- **Dealing policy — `dealObservations(pool, stats)`:**
  1. Difficulty gate: while `attempts < BEGINNER_FIRST_ATTEMPTS`, deal beginner-first (two groups: beginner then intermediate); after that threshold, deal from the whole pool as one group.
  2. Within each group, prefer by memory tier: `never-seen (0) → seen-but-never-correct (1) → seen-and-correct (2)`.
  3. Within each tier, deprioritize hands from the immediately previous deck (`lastDeck`) so chained sessions don't repeat unless forced.
  4. Shuffle randomness is preserved WITHIN each preference tier.
  5. Slice to `TR_SESSION_LENGTH`.
- **`lastDeck` bookkeeping.** The just-dealt deck is written back on mount so the NEXT session (chained or not) sees it in `stats.lastDeck` and deprioritizes those ids.
- **Reveal cadence.** Street-by-street reveal at `REVEAL_MS = 1100`. Tap-anywhere on the replay area jumps to fully revealed. `prefers-reduced-motion: reduce` → instant reveal (chips available from the start).
- **Chip layout.** 4 chips (the correct archetype + 3 authored distractors), shuffled per hand. Answering is one tap; feedback shows verdict, distractor-specific `whyNot` on wrong, `tell` on every answer, and an optional "About the {archetype} →" link that opens the VillainGuide focused on that type.
- **Analytics.** `table_reads_started` (`lifetime_attempts`, `again?`), `table_reads_answered` (`observation_id`, `picked`, `correct`), `table_reads_completed` (`correct`, `total`), `villain_guide_opened` (with `from: 'tablereads'`).
- **Guest gate.** The dashboard Table Reads entry is HIDDEN for guests — protects the 1-free-session gate.
- **Free during beta.** A "Free during beta" chip on the dashboard entry frames Pro as a future promise, not a takeaway.
- **Content gate.** `npm run audit:observations` (rules O1–O6) is the authoring gate: archetype keys, distractor discipline, replay integrity, showdown-difficulty rule, suit symbols, tell-vs-frequency evidence (O6).

### Enforced/tested by

- `src/components/TableReads.test.js` — data contract (every observation playable, 3 covered distractors, per-distractor `whyNot`), beginner-first dealing at 0 attempts, whole-pool at 4+, chained no-repeat, full session flow (chip pick, feedback specificity, lifetime tally persistence).
- `scripts/audit-observations.mjs` (`npm run audit:observations`) — content gate O1–O6.
- `scripts/check-invariants.mjs` — no invariant guards Table Reads specifically today (it's not a single-file-ownership concern), but the audit rule is the enforcement layer.

---

## Do not add

These are documented rejections that bind the engines. Each one has costed evidence behind it — reintroducing any of them is a regression, not a design proposal.

- **Per-item SM-2 / FSRS ease on the graduation ladder** (R3). A fixed `LADDER_SESSIONS` ladder is within noise of adaptive-ease algorithms at this pool size and infinitely more debuggable. See `docs/research/RESEARCH_LEARNING_SCIENCE.md` Piece 1.
- **Answer-until-correct / re-attempt in the SCORED main loop** (F4). Corrupts the skill-accuracy ratings the whole rating engine stands on. An unscored "replay this hand" study mode is the acceptable form.
- **XP system / points as currency.** Streak is the sole engagement metric. Overjustification research (`docs/research/RESEARCH_LEARNING_SCIENCE.md` Piece 3, M4) — validated the founder's quiet-gold / honest-labeling instincts.
- **Coach's Read verdict phrasing.** Never `"you are a..."`, `"you always..."`, `"your game..."`. One 5-hand session cannot honestly diagnose a player — the coach jots field notes; the notebook accumulates trends. The soft mechanical check in `eval-coach.mjs` flags these patterns.
- **Solver / GTO language in the coach's voice.** These are exploitative judgment spots, not solver outputs. Say "the recommended play", never "the solve". Extends the honest-labeling rule (per-hand feedback says "Recommended play", never "Correct play").
- **Skill ratings surfaced with numeric thresholds.** The 0.75 / 0.50 cutoffs are engine internals. Show status names only.
- **Async work inside `onAuthStateChange`.** Supabase-js holds its auth lock during the callback; authed calls need that lock; deadlock. Defer with `setTimeout(async () => {...}, 0)`.
- **Bucket-based (green=100 / yellow=65 / red=30) Poker IQ display.** Replaced July 18, 2026 by continuous true accuracy, then recency-weighted the same day. The old formula's step-function anchors caused the 0/5-session "69 → 69" bug and hid improvement completely.
- **Per-scenario history stored as its own DB column.** History is DERIVED from the append-only `sessions` rows. Same rule for `recentHands`, `directionTally`, `coachReads`, and `bestSessionCorrect` (self-healing across devices).
- **Normalizing scenario ids.** Legacy = numeric, batch = string. `SCENARIO_BY_ID`, `history[id]`, `pickedIds`, and `CONTRAST_PAIRS` all key on the raw `id`. Normalization would silently break every lookup.
