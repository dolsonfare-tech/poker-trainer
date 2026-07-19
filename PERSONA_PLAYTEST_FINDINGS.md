# Synthetic Persona Playtest — Findings (July 18, 2026)

**Harness:** `npm run playtest:personas` (`scripts/playtest-personas.mjs`) — 8 poker personas play 40 sessions each through the REAL product loop: the real session builder (spaced-rep v2 + R4 contrast pairs) dealing from the real pool, answers folded through the real `applySessionResults` (ratings, schema, IQ, streak, graduation ladder), over simulated multi-day timelines with same-day chaining every 5th session. Personas are *directional* (they err by fold/call/raise tendency — the axis that separates the player schemas), not per-skill accuracy dials like `simulate:schemas`. Dealer shuffles are unseeded, so headline numbers below are medians over **10 trials per persona** (`--trials=10`), run on both pools (`--intermediate` for the 91-hand pool). Raw per-session data: `persona-playtest-raw.json` (gitignored, regenerate any time).

**The confidence result first: every mechanical invariant held across all 160 simulated player-runs.** Session shape (always 5 hands, no duplicates), ≤1 replay per session, replays only for genuinely-remediating hands, and the R2 same-day floor (a hand missed today never resurfaced today, even in chained sessions). The machine works. The findings below are about what the machine's *behavior means for a player* at volume — none block anything, all are calibration/design inputs for the post-launch queue.

---

## F1 · HIGH — The graduation ladder can't keep up with a leaky player

> **FIXED July 19, 2026 — graded target + surge slot. See CLAUDE.md (the "F1 (graduation-ladder drain)" roadmap entry + the "Sessions are dealt by the session builder" durable bullet). Two `spacedrep.js` levers, zero schema change: (1) GRADED graduation target — a once-missed hand clears on 2 spaced corrects (`GRADUATION_TARGET_FIRST`), a repeat offender still needs 3 (`GRADUATION_TARGET_REPEAT`), driven by a derived lifetime `misses` count; (2) SURGE slot — replay cap 1→2 while the pool-scoped remediation queue exceeds `SURGE_QUEUE_THRESHOLD`=8. Option (b) from the original recommendation was already true (natural re-deals credit graduation via the `remediating` flag, not the replay flag) — no work needed.**
>
> **Acceptance (`--trials=10`, end-queue median, baseline → after; bar = 70% of baseline):**
>
> | Persona | baseline | bar (≤) | after | verdict |
> |---|---|---|---|---|
> | Conflict Avoider | 34 | 23.8 | ~26 | **MISS — structural (see below)** |
> | Improver | 31 | 21.7 | 17 | ✓ |
> | Confident-misser | 26 | 18.2 | 16 | ✓ |
> | Positional | 23 | 16.1 | 14 | ✓ |
> | Overaggressor | 22 | 15.4 | 14 | ✓ |
> | Exploitable Reg | 20 | 14.0 | 13 | ✓ |
> | Gambler | 19 | 13.3 | 13 | ✓ |
> | Steady strong | — | 10 | 6 | ✓ |
>
> **7 of 8 clear.** The surge does nearly all the work (graded-target-only, surge off: leak personas barely move — they become repeat offenders fast; the FIRST=2 mainly helps recovering/strong players). **Conflict Avoider is a genuine structural miss, not a tuning gap:** at 55% accuracy it perpetually re-misses its raise-correct hands, which reset to rung 0 rather than graduate, so its queue carries an un-graduatable core. Its queue is chronically >> any tested threshold, so the surge is *always on* for it and lower thresholds (tested 6/8/10) don't help; it averages only 1.65 replays/session (also due-availability-bound by the R1 intervals). Draining CA further needs >2 slots or graduation-proximity-aware surge targeting — both outside this task's spec. **Schema-v2 not regressed** (direction personas keep/improve correct diagnosis, zero opposite-direction labels). Threshold chosen at 8 (below the 10–15 starting range) because it clears Exploitable Reg robustly where 10 does not, with the same CA/Gambler outcome. `SURGE_QUEUE_THRESHOLD` is the tuning knob; the harness remains the regression bed.

_Original finding, for the record:_

At realistic accuracy (60–68% — every leak persona), misses join the remediation queue faster than the one-replay-per-session slot can drain them:

| Persona (acc) | Remediating queue at s40, median (min–max) |
|---|---|
| Conflict Avoider (60%) | **34** (28–40) — of an 81-hand pool |
| Improver (61% lifetime, 85% by the end) | **31** (21–33) |
| Confident misser (62%) | 26 (21–29) |
| Positional Blind Spot (65%) | 23 (21–29) |
| Overaggressor (62%) | 22 (17–24) |
| Exploitable Regular (68%) | 20 (18–29) |
| Gambler (66%) | 19 (16–21) |
| Steady strong (86%) | 10 (6–11) — the design case, works fine |

The arithmetic: ~5 hands/session at 62% ≈ 1.9 new misses/session vs. a hard max of 1 replay/session, and each queued hand needs **3** spaced correct retrievals to graduate (R1). With ~25 hands queued, a given miss waits weeks for one retrieval. The R1 ladder's [2, 5, 13]-session intervals describe an *intent* the queue can't deliver — actual revisit latency is queue-depth-bound, not rung-bound. Even the Improver, playing at 85% by session 40, still carries a 31-hand backlog from his early sessions.

**Options (founder decision, post-launch, in rough order of my preference):** (a) scale replay slots with queue depth (2/session when the queue exceeds ~10 — still honest-labeled, still capped); (b) let a *naturally re-dealt* remediating hand answered correctly count as a graduation retrieval at full weight (post-exhaustion re-deals already touch these hands — verify how much credit they currently get before building anything); (c) lower `GRADUATION_TARGET` to 2 for hands missed only once. Measure again with this harness after any change.

## F2 · HIGH — Schema diagnosis is blind to directional players, and can mislabel one badly

> **Verification addendum (Fable, same day):** the session-level adversarial sweep caught transient wrong direction labels the final-session bars missed; fixed with an evidence-confidence ramp + a miss-rate materiality gate (see the calibration comment in `userStorage.js`). Re-verified at 15 trials: zero wrong direction labels in any session of any trial. The skill-schema residual (PBS/ER under-fire, OA→Results-Thinker sideways labels) is deliberately deferred to a skill-side v2 (F2b) per the founder's scope call.

> **FIXED (direction schemas) July 18, 2026 — schema-diagnosis v2, the hybrid direction/skill model. See CLAUDE.md ("Schema diagnosis engine v2" under Post-Phase-1.5). The three DIRECTION schemas (Conflict Avoider / The Gambler / The Overaggressor) are now scored from a direction-of-error TALLY — `choiceVal` × option `cls` on the fold(0)<call(1)<raise(2) axis, weighted incorrect 1.0 / partial 0.5 — measured as each cell's EXCESS over the pool's neutral baseline (because "under" absorbs 3 of 6 mispairs and sits ~0.53 for a balanced player). All in `userStorage.js` (`classifyDirection` / `addHandsToDirectionTally` / `deriveSchema`), rebuilt from the session log in `db.js` (`directionTallyFromSessions`). Zero schema/DB change. `simulate-schemas.mjs` reworked to v2 (direction profiles carry synthesized tallies) and still gates structural bias.**
>
> **Before → after, final schema over 10 trials (beginner pool):**
>
> | Persona | v1 correct | v1 opposite-dir | **v2 correct** | **v2 opposite-dir** |
> |---|---|---|---|---|
> | Conflict Avoider | 0/10 | **2/10 Overaggressor** | **6–9/10** | **0/10 ✓** |
> | Overaggressor | 0/10 | (0) | **8–10/10** | **0/10 ✓** |
> | Gambler | 1/10 | — | **8–9/10** | — |
> | Improver / Steady-strong | Balanced 9–10/10 | — | **Balanced 10/10** | **0/10 ✓** |
>
> The trust-killer — a passive player told *"Pressure wins pots regardless"* — is eliminated: **zero opposite-direction labels across 30 trials**, and a strong/improving player is never mislabeled directional. Direction knobs: `MIN_DIRECTION_EVIDENCE=6`, `DIRECTION_DOMINANCE=0.4`, `DIRECTION_SEV_SCALE=2.5` (excess-over-baseline severity is what separates a true Gambler at loose 0.62 from an 85%-flat player at under 0.63 — a flat share threshold cannot).
>
> **Residual, ACCEPTED by founder (Option 1, July 18):** the SKILL schemas (Positional ~1/10, Exploitable Regular / Results Thinker combined ~5–7/10) still under-fire, blocked by the two causes below (partial-credit yellow-straddle + the opponent/reads red-red tie) — both require touching frozen skill scoring, which this task scoped out. Pre-existing v1 behavior; the direction fix does not regress it. Revisit with the schema-v2 skill-side work (relative-weakness model) when real distributions land.

_Original finding (v1 baseline), for the record:_

Final-schema distribution over 10 trials (beginner pool):

| Persona | Correct diagnosis | Balanced | Wrong schema |
|---|---|---|---|
| Conflict Avoider | **0/10** | 8/10 | **2/10 "The Overaggressor"** ← opposite of his leak |
| Overaggressor | **0/10** | 7/10 | 3/10 "Results Thinker" |
| Gambler | 1/10 | 9/10 | — |
| Positional Blind Spot | 2/10 | 7/10 | 1/10 "Gambler" |
| Exploitable Regular | 2/10 | 4/10 | 4/10 "Results Thinker" (adjacent — reads/opponent both weak) |
| Improver / Steady strong | n/a (correctly Balanced 10/10) | | |

Three compounding causes, all visible in the data: (1) **direction-blindness** — the engine scores accuracy only, so the Conflict Avoider's fold-when-should-raise misses and an Overaggressor's raise-when-should-fold misses look identical; the CLAUDE.md v2 design note predicted exactly this, and the "player who never raises told *'Pressure wins pots regardless'*" case is now demonstrated, ~2/10 trials. (2) **Partial credit lifts leak skills to yellow** — directional wrong answers often land on `partial` options (0.5 credit), so a 35%-choice-accuracy leak reads as ~50–60% skill accuracy, and `SCHEMA_MIN_SEVERITY` (correctly) refuses to name a schema without a red skill. (3) **Directional errors spread across skills**, so no single skill goes clearly red. Note `simulate:schemas` still passes — its personas are per-skill dials with no partial credit, which is why it can't see this. **This is the strongest evidence yet for the schema-v2 direction-of-error model (`choiceVal` × option `cls` — the data is already stored per hand), and argues v2 should rise in the post-launch queue.** The high Balanced rate itself is honest, not harmful; the opposite-diagnosis case is the one that actively damages trust.

## F3 · HIGH — Poker IQ cannot show a player their improvement

> **FIXED July 18, 2026 — recency-weighted Poker IQ. See CLAUDE.md (the `derivePokerScore` note in the Phase-1.5-closed paragraph). The harness's Improver now carries a median end IQ ~79 (was 69; RECENT_WINDOW=8 after a volatility sweep — see the userStorage.js comment) with the s30→s40 trend rising. `RECENT_WINDOW`/`MIN_RECENT_HANDS` in `userStorage.js`; ratings/schema stay lifetime-based, only the IQ display is recency-weighted.**

The Improver goes from 45% to 85% accuracy over 40 sessions. His IQ (median across trials): **s10 = 68 → s20 = 64 → s30 = 65 → s40 = 69** — it *drops* through his fastest-improving stretch and ends where it started, because lifetime-average accuracy is dominated by his early sessions; near s40 his recent-5-session accuracy is 84% while the display says 69. This upgrades this morning's "accepted residual" on the continuous-IQ fix into a measured product problem: the one number on the dashboard is structurally unable to reward the exact player journey the product exists to create. **Recommendation:** recency-weighted accuracy (e.g., last ~30 attempts per skill, derivable from the existing `sessions` rows — zero schema change) as a post-launch task; this harness's Improver curve is the acceptance test.

## F4 · MEDIUM — Contrast pairs fire too rarely to matter yet

> **FIXED July 19, 2026 (Fable) — two trigger changes in `spacedrep.js`:** weak slots now PREFER pair members among equally-eligible candidates, and a resurfaced miss deals its contrast partner adjacent (fresh deal, no replay tag — re-encountering a missed hand next to its contrast is the highest-value juxtaposition). The 1-pair-per-session cap stays. Pair firing rose from median 1–3/40 sessions to ~4–14/40 (most personas 5–12; the Conflict Avoider's deep queue makes replay-pairing especially productive at ~14; the Overaggressor lags at ~2–4 — his weak-skill mix intersects few authored pairs, a content note for future pair authoring, not a scheduler gap). One real bug caught by the harness during this work: when BOTH halves of a pair were due misses under an F1 surge, the partner could be dealt twice (fresh + replay) — the replay loop now skips already-seated hands; regression test pins it. Verified: zero duplicate ids, zero wrong direction labels, schema/queue metrics unregressed, invariants held.

R4 delivered a pair in a median of **1–3 sessions out of 40** (~5%). Mechanism: pairing only triggers when a *weak-skill slot* happens to seat one of the ~11 beginner pair-member hands. The 1-pair-per-session cap is not the bottleneck — trigger frequency is. Cheap options if the founders want pairs felt: have the weak-slot picker *prefer* pair members among equally-eligible candidates, and/or extend pairing to the replay slot (re-encountering a missed hand next to its contrast partner is arguably the highest-value juxtaposition). Both are small `spacedrep.js` changes, measurable here.

## F5 · MEDIUM — Content runway is ~3 weeks for a daily player

Unseen hands exhaust at median **session 20–21 (beginner, 81 hands)** and **session 23 (intermediate, 91)**. After that every session is re-deals (least-recently-seen first, which behaves well — no invariant issues). Not a bug: a plain-fact input for Phase 1.6 scenario-scale planning and the Expert tier. A daily player finishes the novelty of a difficulty tier in about three weeks; a 2-session/day player in under two.

## F6 · LOW — Cap yields near pool exhaustion

0–3 sessions per 40 exceeded the 2-preflop or 2-per-skill soft caps, always near/after exhaustion. Two code observations: the unseen-fill phase deliberately drops both caps rather than under-fill (fine), but it also prefers *unseen* hands over cap compliance right at the exhaustion boundary (a session can go 3-preflop while plenty of seen postflop hands were available), and the seen-re-deal phase never checks the per-skill cap at all (only preflop). Minor polish, only worth touching alongside F1 work in `spacedrep.js`.

---

**Re-run guidance:** `npm run playtest:personas -- --trials=10` (beginner) and `-- --trials=10 --intermediate`. Single-trial mode prints per-session detail (IQ curve, queue trajectory). The harness is the regression bed for any F1/F4 tuning and the acceptance test for schema v2 (F2) and recency-weighted IQ (F3) — implement a candidate, point the personas at it, and the tables above are the before.
