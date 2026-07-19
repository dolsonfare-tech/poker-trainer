# Synthetic Persona Playtest — Findings (July 18, 2026)

**Harness:** `npm run playtest:personas` (`scripts/playtest-personas.mjs`) — 8 poker personas play 40 sessions each through the REAL product loop: the real session builder (spaced-rep v2 + R4 contrast pairs) dealing from the real pool, answers folded through the real `applySessionResults` (ratings, schema, IQ, streak, graduation ladder), over simulated multi-day timelines with same-day chaining every 5th session. Personas are *directional* (they err by fold/call/raise tendency — the axis that separates the player schemas), not per-skill accuracy dials like `simulate:schemas`. Dealer shuffles are unseeded, so headline numbers below are medians over **10 trials per persona** (`--trials=10`), run on both pools (`--intermediate` for the 91-hand pool). Raw per-session data: `persona-playtest-raw.json` (gitignored, regenerate any time).

**The confidence result first: every mechanical invariant held across all 160 simulated player-runs.** Session shape (always 5 hands, no duplicates), ≤1 replay per session, replays only for genuinely-remediating hands, and the R2 same-day floor (a hand missed today never resurfaced today, even in chained sessions). The machine works. The findings below are about what the machine's *behavior means for a player* at volume — none block anything, all are calibration/design inputs for the post-launch queue.

---

## F1 · HIGH — The graduation ladder can't keep up with a leaky player

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

R4 delivered a pair in a median of **1–3 sessions out of 40** (~5%). Mechanism: pairing only triggers when a *weak-skill slot* happens to seat one of the ~11 beginner pair-member hands. The 1-pair-per-session cap is not the bottleneck — trigger frequency is. Cheap options if the founders want pairs felt: have the weak-slot picker *prefer* pair members among equally-eligible candidates, and/or extend pairing to the replay slot (re-encountering a missed hand next to its contrast partner is arguably the highest-value juxtaposition). Both are small `spacedrep.js` changes, measurable here.

## F5 · MEDIUM — Content runway is ~3 weeks for a daily player

Unseen hands exhaust at median **session 20–21 (beginner, 81 hands)** and **session 23 (intermediate, 91)**. After that every session is re-deals (least-recently-seen first, which behaves well — no invariant issues). Not a bug: a plain-fact input for Phase 1.6 scenario-scale planning and the Expert tier. A daily player finishes the novelty of a difficulty tier in about three weeks; a 2-session/day player in under two.

## F6 · LOW — Cap yields near pool exhaustion

0–3 sessions per 40 exceeded the 2-preflop or 2-per-skill soft caps, always near/after exhaustion. Two code observations: the unseen-fill phase deliberately drops both caps rather than under-fill (fine), but it also prefers *unseen* hands over cap compliance right at the exhaustion boundary (a session can go 3-preflop while plenty of seen postflop hands were available), and the seen-re-deal phase never checks the per-skill cap at all (only preflop). Minor polish, only worth touching alongside F1 work in `spacedrep.js`.

---

**Re-run guidance:** `npm run playtest:personas -- --trials=10` (beginner) and `-- --trials=10 --intermediate`. Single-trial mode prints per-session detail (IQ curve, queue trajectory). The harness is the regression bed for any F1/F4 tuning and the acceptance test for schema v2 (F2) and recency-weighted IQ (F3) — implement a candidate, point the personas at it, and the tables above are the before.
