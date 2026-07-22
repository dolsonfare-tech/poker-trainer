# Villain-Type Taxonomy Research — Findings & Recommendations (July 22, 2026)

> **Status: DONE — and unlike the schema research, fully verified.** Run as three small
> phases with disk checkpoints between them (the session-limit-resilient structure): P1
> search+extract (13 agents; one sandbox bug — `new URL` unavailable in workflow scripts —
> fixed via cached resume at trivial cost), P2 adversarial verification (36 agents, **all
> 12 selected claims VERIFIED, 11 at 3-0, one at 2-1**), P3 synthesis written inline by
> Claude. No session limits were hit; the checkpoint structure cost nothing and would have
> saved everything. Claims below marked **[VERIFIED]** survived 3-vote adversarial
> verification; **[P1]** = extracted from a fetched source, not put through verification
> (chosen for the supporting tier, none refuted).
>
> Raw data: tasks `w832iiojm` (P1) / `w24g5d696` (P2) in the session tasks dir; durable
> per-agent journals under `subagents/workflows/wf_b99cf640-564` and `wf_6fc188dc-c5d`.

## The question

CheckRaise deals 8 villain archetypes (`VILLAIN_LABELS`): Aggressive Regular, Passive
Player, Tight Recreational, Loose Recreational, Calling Station, Maniac, Tight Nit,
Unknown. The schema research already confirmed the underlying tight/loose ×
passive/aggressive grid is canonical, so soundness wasn't in question. The questions were
granularity (is 8 right?), trainability (does archetype-identification training transfer —
the Table Reads bet), observable basis, per-archetype standardness, and population realism.

## Headline findings

1. **Eight types is defensible — and lands exactly on the empirical answer.** Taught
   taxonomies run 3–6 types: Jonathan Little's beginner tier is THREE motivation-based
   types [VERIFIED 2-1], his canonical grid taxonomy is SIX (TAG, LAG, Maniac, Calling
   Station, Nit, GTO-player) [VERIFIED 3-0], Red Chip's profiling curriculum teaches FOUR
   base quadrants [VERIFIED 3-0], and the PokerTracker HUD community operationalizes FIVE
   named types plus a fallback [VERIFIED 3-0]. But unsupervised clustering of a real NLHE
   hand-history database found **SEVEN distinct player types** [VERIFIED 3-0] — and
   CheckRaise's set is exactly seven named archetypes + Unknown-as-fallback, the same
   shape as the data. The perceptual-learning literature adds that far larger category
   sets (15 diagnoses) are trainable to high proficiency in under 90 minutes [P1], so 8 is
   nowhere near a discriminability ceiling.

2. **The nit-vs-tight distinction — the one I flagged as possibly expert-only — is
   validated as foundational.** Little teaches nit vs TAG as a beginner-level distinction
   (both tight; a nit's rare aggression signals near-nuts) [VERIFIED 3-0], and coaches
   draw the line numerically: <~15 VPIP = nit, a subcategory inside the broader 11–20
   tight band [VERIFIED 3-0]. Keeping Tight Nit and Tight Recreational separate is
   coach-standard, not over-engineering.

3. **Table Reads' pedagogy is independently validated by the perceptual-learning
   literature — down to its authoring principles.** Many short classification trials with
   immediate feedback is THE format that builds expert pattern recognition, and such
   drills produce large gains that transfer to novel unseen cases (ECG training: 54%→86%
   accuracy, fluency roughly doubled, tested on exemplars never seen in training)
   [VERIFIED 3-0]. Discrimination between easily confusable categories is explicitly
   trained by juxtaposing contrasting exemplars (melanoma vs benign mole) [VERIFIED 3-0] —
   the exact confusable-pair principle Table Reads was authored on (nit↔tight,
   passive↔station, maniac↔aggressive, loose↔station). And classification-only practice —
   never practicing the downstream task — dramatically sped the downstream task in the
   equation-structure study [VERIFIED 3-0], which is the strongest available support for
   Table Reads' core bet: naming archetypes should speed live exploit decisions without
   drilling the decisions themselves.

4. **Type reads are frequency reads, formed over many hands — a single replay can't
   honestly carry one.** VPIP/PFR frequency ranges are the primary classifier, applied by
   observing the first orbits before categorizing [VERIFIED 3-0], and coaches state an
   explicit evidence ladder: a decent type read at ~30 hands, confident at ~100, full
   profile with showdowns at ~500 [VERIFIED 3-0]. Product implication below (§Observables).

5. **Where CheckRaise spends its granularity differs from coaches — deliberately, and
   the population data supports it.** Coaches split the *reg* space (TAG vs LAG) and lump
   the recreational space (fish/station); CheckRaise merges regs into one Aggressive
   Regular and splits the recreational/passive space four ways (Passive Player, Calling
   Station, Loose Rec, Tight Rec). For a $1/$2 trainer that's the right side to be rich
   on: recreational players are the majority of small/mid-stakes pools while win-focused
   players are a tiny fraction [VERIFIED 2-1, substance uncontested], and calling stations
   remain common in live low-stakes games [P1]. The money at the product's stakes is in
   discriminating recreational flavors, not in TAG-vs-LAG.

## Per-archetype verdicts

| Archetype | Verdict | Notes |
|---|---|---|
| Tight Nit | **KEEP** | Standard name; the nit-vs-tight boundary is coach-taught and numerically drawn [VERIFIED ×2]. |
| Tight Recreational | **KEEP** | The 11–20 VPIP tight band minus the nit subcategory [VERIFIED]; nonstandard name but transparent. |
| Calling Station | **KEEP** | Standard name; carries the most-taught exploit in the literature (relentless value betting) [P1]. |
| Passive Player | **KEEP, watch discrimination** | The passive↔station fault line is real pedagogy, but these two are the closest neighbors in the set — watch Table Reads confusion telemetry (see actions). |
| Loose Recreational | **KEEP, watch discrimination** | Real-data loose-type boundaries are fuzzier than textbook definitions (859-player sample: observed "whale" centroid 32/12 vs textbook 55/9) [P1, blog-tier] — the loose↔station line needs sharp authoring. |
| Aggressive Regular | **KEEP (deliberate TAG/LAG merge)** | Coaches split TAG/LAG [VERIFIED]; merging is defensible at $1/$2 where regs are scarce [VERIFIED population claim]. If Expert difficulty ever wants a 9th type, TAG-vs-LAG is the literature-backed split. |
| Maniac | **KEEP** | Standard name, standard stat signature (55/38/AF4) [VERIFIED]. |
| Unknown | **KEEP** | Not a type but the correct fallback; sc_155's population-defaults lesson matches the verified majority-recreational population claim. |

No renames, merges, or deletions recommended now.

## Observables — one product implication

Coaches classify from frequency evidence accumulated over 30–100+ hands [VERIFIED ×2]. A
single replayed hand cannot honestly carry a type read — which Table Reads' design already
half-knows: its authored tells lean on frequency/range/sizing language and context lines.
**Make this an explicit authoring rule** (candidate `audit:observations` check): every
observation hand whose answer depends on frequency ("plays almost every hand") must carry
that evidence in the context/setup text, not expect the single hand's actions to prove it.
The main pool already solved the same problem with `tableContext` READ lines — same
principle, same fix. The 30/100/500 ladder is also honest-labeling ammunition: Table Reads
feedback can legitimately say "at a real table this read takes a few orbits to form —
here's what it looks like compressed."

## Actions distilled

1. **No taxonomy change.** 7 named + Unknown matches the empirical cluster count; every
   type is coach-recognized or a defensible merge/split with a verified rationale.
2. **Table Reads content runway (the real gap):** the PL literature's effective
   interventions used ~30–40 varied, non-repeating exemplars PER category [P1];
   the pool has 22 hands across 7 archetypes (~3/type). Transfer comes from exemplar
   variety — repeats risk memorizing hands instead of learning types (seen-hand dealing
   already mitigates, but can't create variety that doesn't exist). Long-term target for a
   Pro-tier Table Reads: grow toward 15–30+ hands per archetype. This is the villain-side
   twin of the F5 content-runway finding.
3. **Fluency criterion (backlog, cheap):** PL mastery = consecutive correct AND fast
   [P1]; decisionMs capture already exists in the main loop. Track response time in Table
   Reads (mode-local, like its scoring) and treat fast+correct as the mastery signal —
   also a natural Pro analytics surface.
4. **Confusion-matrix telemetry:** `table_reads_answered` already logs
   (observation_id, picked, correct) — the post-launch check is whether passive↔station
   and loose↔station actually discriminate (picked-vs-correct matrix per pair). If a pair
   never separates, sharpen its authoring before considering a merge.
5. **Authoring rule (do with next observation batch):** frequency-dependent answers must
   carry frequency evidence in context text (§Observables above); consider encoding as an
   `audit:observations` WARN.
6. **Optional content audit:** main-pool archetype distribution vs the verified
   majority-recreational population reality — are strong-reg villains over-represented
   relative to a real $1/$2 pool? Low priority; scenario villains are chosen for lessons,
   not census realism.

## Limitations

- The skeptic search angle (players as unstable mixtures, leveling, stereotyping errors)
  yielded no fetched source in the top-9 cut; the one contrarian datum that survived is
  the fuzzy-centroid finding [P1, blog-tier]. The synthesis therefore avoids claiming
  types are stable traits — consistent with the chess-study caution already recorded in
  RESEARCH_SCHEMA_TAXONOMY.md (errors/styles are substantially situation-driven).
- The 2-1 verdict on Little's three-type taxonomy: the dissenting verifier confirmed the
  substance (three motivation-based types) but flagged that the type NAMES in the claim
  are paraphrased glosses, not Little's verbatim labels. Treated as verified substance,
  paraphrased labels.
- The 7-cluster paper's count is conditioned on its specific dataset and names no
  archetypes — it anchors the granularity range, not the specific type list.

## Sources

Verified-claim sources: pokercoaching.com (Little's 6-type taxonomy, VPIP article) ·
jonathanlittlepoker.com (3-type beginner taxonomy) · Red Chip Poker profiling-fundamentals
podcast · arXiv 1301.5943 (NLHE player clustering) · PokerTracker forums (HUD typology
thresholds) · Kellman et al., perceptual/adaptive learning in medical education
(ResearchGate 326950662) · Kellman & Massey, TopiCS 2009 (perceptual learning modules).
P1-tier: PokerNews Ed Miller interview · pokercoaching population notes · 859-player
empirical centroid table (PT forums).
