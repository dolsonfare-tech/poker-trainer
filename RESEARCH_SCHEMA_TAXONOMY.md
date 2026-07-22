# Schema Taxonomy Research — Findings & Recommendations (July 22, 2026)

> **Status: DONE.** Deep-research workflow ran July 21–22 (5 search angles → 22 sources →
> 100+ extracted claims → top 25 adversarially verified, 3 votes each). Two session-limit
> interruptions killed the automated synthesis step both times — as with
> RESEARCH_SUBSCRIPTION_MARKET.md, **this synthesis is Claude-written from the vote-verified
> claims**, with verification status marked throughout: **[VERIFIED]** = survived 3-vote
> adversarial verification (vote count shown), **[PLAUSIBLE]** = extracted from a fetched
> source, verification votes errored on session limits (none of these were refuted),
> **[KILLED]** = refuted by ≥2 of 3 verifiers.
>
> Raw claim data: `tasks/wdymztuk9.output` + `wztnwq813.output` (scratchpad, may not survive
> reboot); durable per-agent journal:
> `~/.claude/projects/-Users-primaryaccount-Desktop-poker-trainer/8f1ce4cd-b645-4b65-b2c4-bd9927697eca/subagents/workflows/wf_fec2b6d1-e68/journal.jsonl`

## The question

Does CheckRaise's six-schema, root-belief diagnostic taxonomy align with how poker coaches,
training products, and the academic misconception-diagnosis literature taxonomize player
errors — and what should change? Hard constraint honored throughout: diagnosis must work
from per-decision data alone (chosen vs recommended action, fold<call<raise direction,
8-skill accuracy, decisionMs). No self-report channel.

## Headline findings

1. **Nobody else occupies CheckRaise's ground.** The two dominant taxonomy families are
   (a) quantitative solver-deviation ranking and (b) emotional/mental-game classification —
   neither does belief-based diagnosis from decision patterns. GTO Wizard, the
   category-defining data product, organizes mistakes purely by **EV-loss × frequency**
   [VERIFIED 3-0], grades per action against the solver in blunder/inaccuracy/correct tiers
   [VERIFIED 3-0], and presents no player-type or belief taxonomy. Tendler, the
   category-defining psychology product, taxonomizes **seven tilt types** [VERIFIED 3-0]
   diagnosed via **self-report** (tilt-profile questionnaires) [VERIFIED 3-0]. The moat
   claim in CLAUDE.md ("schema diagnosis — no major competitor does it") survives
   adversarial verification. The flip side: there is **no external precedent to copy** —
   the six schemas can only be validated empirically (playtest data), not by citation.

2. **The root-belief framing itself is well-supported — by both camps.** Tendler frames
   entitlement tilt as a *belief* ("belief you deserve to win") and mistake tilt as "rooted
   in flawed learning beliefs" [VERIFIED 3-0]; his Mental Hand History is a 5-step protocol
   tracing mistakes to flawed logic, CBT-style [PLAUSIBLE]; he explicitly holds that
   emotions are *symptoms* of flawed logic, not root causes [PLAUSIBLE]. GTO Wizard's own
   leak-fixing method piece frames leaks as "faulty logic" fixed by "understanding why the
   logic is faulty" plus reps [VERIFIED 3-0]. Academically, the ITS lineage (BUGGY, Brown &
   Burton 1975: errors are systematic — "correct execution of an incorrect procedure" —
   and diagnosable purely from observed behavior [PLAUSIBLE]) and psychometric **cognitive
   diagnosis models** are direct precedent. Strongest single anchor: the **SISM model**
   (Kuo, Chen & de la Torre, *Applied Psychological Measurement*) was built specifically to
   diagnose skills AND misconceptions *simultaneously* from item-response data alone,
   because most CDMs handle only one [VERIFIED 2-0] — and joint modeling beat skill-only
   and bug-only models on real data [PLAUSIBLE]. **The v2 hybrid engine (skill schemas +
   direction schemas) independently reinvented the SISM architecture.** No structural
   change needed; this is the strongest validation in the research.

3. **Keep the taxonomy small and fixed.** The ITS literature's known failure mode: bug/error
   libraries balloon into unusable catalogs even in domains as simple as fraction
   arithmetic [PLAUSIBLE]. Six named schemas + Balanced/Student fallbacks is the right
   shape; resist adding schemas per newly-observed error.

4. **Require repeated evidence before labeling — verified, and already built.** "One
   mistake does not mean you have a structural leak" [VERIFIED 3-0]. The existing
   `MIN_DIRECTION_EVIDENCE=10` / evidence-confidence ramp / materiality gate stack is
   exactly what this demands. Reinforced by the strongest caution in the research: the
   large-scale chess study (Anderson/Kleinberg/Mullainathan, "Assessing Human Error Against
   a Benchmark of Perfection") found blunders are predicted far better by the *difficulty
   of the specific position* than by the player's skill — errors are dominantly
   **situation-driven, not trait-driven** [PLAUSIBLE, and consistent with the published
   paper]. Implication: a schema label built on too little evidence mostly measures which
   scenarios the dealer happened to serve. The July-18 anti-transient guards were the right
   call; do not weaken them, and treat scenario-difficulty normalization (once real
   miss-rate data exists) as the schema engine's next real upgrade.

## Per-schema verdicts

| Schema | Verdict | Basis |
|---|---|---|
| The Conflict Avoider | **KEEP — validated** | Tight-passive quadrant of the canonical tight/loose × passive/aggressive grid every practicing coach uses [PLAUSIBLE]; GTO Wizard's GTO Reports independently treat below-baseline (over-fold/under-bluff) as one of two primary deviation directions [PLAUSIBLE]. |
| The Gambler | **KEEP — validated** | Loose axis of the grid; maps to Tendler's "illusion of control" root flaw [PLAUSIBLE]. |
| The Overaggressor | **KEEP — validated** | Aggressive axis; GTO Reports' above-baseline direction [PLAUSIBLE]. Together the three direction schemas are the canonical 2-axis grid re-expressed on the fold<call<raise axis — strong convention alignment, and GTO Wizard's data tooling converged on the same over/under directional framing. |
| The Positional Blind Spot | **KEEP, reclassify mentally as knowledge-gap** | Coaches treat position as a skill-ladder knowledge gap (Ed Miller's *The Course*: leaks = the missing skill for your stakes [PLAUSIBLE]), not a belief type. Fine to keep — it's cleanly decision-observable — but it's a knowledge-gap leak wearing belief copy, which is consistent with the harness finding that it under-fires (~1–2/15). Its fix lives in the planned skill-side relative-weakness v2, not in renaming. |
| The Results Thinker | **WEAKEST MAPPING — flag for skill-side v2** | The *belief* is real in the literature (Tendler's flawed-learning-beliefs / results-orientation [PLAUSIBLE]) — but it is a belief about the learning process, and per-decision data cannot observe how a player judges outcomes. Diagnosing it off the `reads` skill is a proxy mismatch (the harness shows RT absorbing adjacent personas, e.g. Overaggressor→RT 7/15). Options when the skill-side v2 lands: re-anchor it on a behavioral signature that IS observable (e.g. repeating a just-graded-incorrect line — remediation-resistance — or confident-miss density), or accept it as the loosest schema and say so in its copy. |
| The Exploitable Regular | **KEEP — validated** | Ed Miller's *Playing the Player*: opponent assessment, not your cards, is the core of profitable play [PLAUSIBLE]; Slotboom's coaching profile of technically-sound-but-opponent-blind players is this exact leak, named as separable from knowledge gaps [PLAUSIBLE]. |

No merges or deletions recommended. No renames forced by the literature (the names are
product voice, and nothing collides with established terms-of-art).

## Coverage gaps — what the six schemas miss, and whether it matters

- **Tilt / emotional regulation — the glaring omission, and the defensible one.** It is the
  flagship leak of the entire poker-psychology literature [PLAUSIBLE; Tendler's taxonomy
  VERIFIED 3-0], so its absence will be the first thing any poker-literate reviewer
  notices. But the omission is principled: Tendler's own diagnostic channel is self-report
  [VERIFIED 3-0], which CheckRaise doesn't have — and GTO Wizard's leak-fixing piece
  likewise defers the mental game to a separate treatment while handling strategic leaks
  as logic problems [VERIFIED 3-0]. **Recommendation:** don't add a tilt schema; DO
  consider (post-launch, data-first) a session-level *tilt signature* instrument —
  accuracy collapse + decisionMs shortening in the hands following a miss streak is
  decision-observable, would feed the Coach's Read rather than the schema card, and
  decisionMs capture (F2) already exists. Cheap, honest, and turns the omission into a
  roadmap item.
- **Bet-sizing direction-blindness — the real diagnostic gap.** Jonathan Little names
  betting-too-small-with-strong-hands as a chronic, self-invisible small-stakes leak
  [PLAUSIBLE]; the fold<call<raise axis literally cannot see it (too-small and too-big are
  both "raise"). Today sizing errors only surface as `betsize` skill inaccuracy — accuracy
  without direction, the exact blindness the direction tally fixed for fold/call/raise.
  **Recommendation:** when touching the skill-side v2, extend `classifyDirection` with a
  sizing sub-axis (option `cls`/amounts already distinguish bet_small/bet_medium/bet_large
  in the data) — under-sizer vs over-sizer within the raise direction. Zero new data
  needed; it's the one place the literature exposes a concrete hole in the engine's
  observables.
- **Game selection / bankroll / variance handling** — coach-recognized (Tendler, Angelo)
  but structurally outside a per-decision trainer's scope. Defensible omission; no action.

## What was killed (and why it matters)

Three claims were refuted [KILLED], all absolutist overclaims about GTO Wizard's docs
("operates *purely* on decision data" 0-3; "no taxonomy of leak categories *anywhere*"
1-2 ×2). The verifiers' pushback: GTO Wizard's ecosystem does carry qualitative leak
content (blog taxonomies like "the 3 biggest leaks", directional report colorings), even
though its *diagnostic tooling* is EV-loss-based. Substantively this doesn't change the
headline — the weaker, precise versions of these claims were VERIFIED 3-0 — but it's a
good calibration: the differentiation claim is "no belief-based *diagnosis*," not "no
qualitative content anywhere."

## Action list distilled

1. **No engine change now.** The v2 hybrid is independently validated (SISM); the
   evidence gates are validated; the taxonomy size is right.
2. **Skill-side v2 (already queued, post-playtest):** fold in (a) Results Thinker
   re-anchoring, (b) the sizing sub-direction, (c) scenario-difficulty normalization per
   the chess-study caution. This doc + PERSONA_PLAYTEST_FINDINGS.md F2b are its spec inputs.
3. **Post-launch instrument idea (backlog):** session-level tilt-signature detector feeding
   the Coach's Read (not the schema card).
4. **Marketing/copy note:** the schema system is genuinely novel — safe to lead with it;
   avoid claiming it covers the mental game.
5. **Villain-types research (queued next, founder July 21):** lighter pass — the 8
   archetypes sit close to the canonical 2-axis grid the coaching literature confirmed;
   the open question is granularity/trainability, not soundness.

## Session decisions preserved (July 21–22, not research)

- **Conflict Avoider queue-drain issue: DEFERRED** — likely a harness artifact
  (fixed-accuracy personas can't learn; real players convert misses after feedback); the
  2-replay cap protects session UX; both candidate fixes would make sessions more remedial
  on zero human evidence. Revisit trigger: the 14-day playtest shows real passive players
  with the stuck-queue signature → build graduation-proximity-aware surge targeting then.
  **Playtest analysis checklist: check end-of-window remediation queue depth per tester,
  especially passive/low-accuracy testers.**

## Sources (fetched + claim-extracted)

Primary: GTO Wizard help docs (Analyze Mode, Hand History Analyzer) + blog (Fixing a Poker
Leak 1–2, GTO Reports, 3 Biggest Leaks, Science of Poker Performance) · Tendler
(jaredtendler.com, Hendon Mob TMGP excerpt, 888poker Mental Hand History update) ·
PMC5985701 (SISM cognitive-diagnosis model) · arXiv 1606.04956 (chess human-error study) ·
arXiv 2606.05602 (misconception inference from interaction behavior) · Jeuring et al.
systematic review of 40 ITSs (DiagnosingBehaviour.pdf) · BUGGY summary (tecfaetu.unige.ch).
Secondary/blog: Red Chip Poker (Ed Miller's *The Course*), pokernews (Miller *Playing the
Player*), PokerCoaching/Jonathan Little (leak lists, bet-sizing leak), smartpokerstudy +
pokerology (2-axis player-type grids), CardPlayer (Slotboom opponent-reading profile,
Little sizing column), thinkingpoker.net (Angelo *Elements of Poker*).
