# Learning-Science Research — input to spacedrep v2 & feedback design

*July 18, 2026. Run lean and in pieces (session-limit strategy): targeted searches + source reads, verification reserved for load-bearing claims. Cognitive-science findings here are stable, replicated literature — unlike the volatile pricing data in `docs/research/RESEARCH_SUBSCRIPTION_MARKET.md`, they don't need 3-vote adversarial verification.*

**Status: Piece 1 (scheduling) DONE · Piece 2 (feedback design) DONE · Piece 3 (motivation mechanics) DONE — all three pieces complete**

---

## Piece 1 — Scheduling (feeds spacedrep v2)

### What the literature says

1. **Spacing dominates everything else.** One correct retrieval in each of three *spaced* sessions beats three correct retrievals in a *single* session by a wide margin (reported 68% vs 26% one-week retention in the successive-relearning line of work — direction rock-solid, exact figures medium confidence). The prescriptive recipe from [Rawson & Dunlosky's successive-relearning research](https://journals.sagepub.com/doi/full/10.1177/09637214221100484) ([practitioner summary](https://www.retrievalpractice.org/strategies/2018/successive-relearning), verified): initial learning to ~3 correct recalls, then ~3 spaced relearning sessions (their gaps: 1, 3, 8+ days) each to 1 correct recall. Exam-grade improvements of a letter grade, replicated in classrooms.

2. **Optimal gap ≈ 10–20% of the desired retention interval** ([Cepeda et al. 2008 "temporal ridgeline"](https://laplab.ucsd.edu/articles/Cepeda%20et%20al%202008_psychsci.pdf); [2006 meta-analysis of 254 studies](https://www.yorku.ca/ncepeda/publications/CPVWR2006.html)). Critically, the penalty is **asymmetric**: accuracy rises sharply up to the optimal gap, then declines only gradually past it — a gap slightly too long costs little; a gap too short forfeits most of the benefit. Retrieval should happen under *slight forgetting*.

3. **Expanding vs equal intervals: mostly a wash.** [Karpicke & Roediger 2007](https://learninglab.psych.purdue.edu/downloads/2007/2007_Karpicke_Roediger_JEPLMC.pdf) found expanding schedules win on immediate tests but *equal* spacing won at a 2-day delay; the [broader review](https://link.springer.com/article/10.3758/s13423-014-0636-z) finds most studies show no significant difference long-term. **Design consequence: an elaborate per-item ease algorithm (SM-2/FSRS style) is over-engineering for this product** — the win is spacing at all, at roughly-right gaps.

4. **Interleaving beats blocking, and the benefit is largest when categories are confusable** ([Brunmair & Richter meta-analysis "Similarity matters"](https://www.researchgate.net/publication/335004545_Similarity_matters_A_meta-analysis_of_interleaved_learning_and_its_moderators); [Rohrer 2012](https://files.eric.ed.gov/fulltext/ED536926.pdf)). Mechanism: discriminative contrast — mixed practice forces the learner to notice what distinguishes near-identical situations. Interleaving *feels* worse (lower practice scores) but tests better delayed — and learners systematically [overestimate blocking](https://link.springer.com/article/10.3758/s13423-022-02225-7).

5. **Errors are assets when corrected**: generating a wrong answer and then receiving corrective feedback produces *better* learning of the correction than error-free study ([Smith & Kimball 2010](https://pubmed.ncbi.nlm.nih.gov/20053046/); [Roediger & Butler 2011](http://psychnet.wustl.edu/memory/wp-content/uploads/2018/04/Roediger-Butler-2011_TCS.pdf)). Re-testing a corrected error after a delay (under slight forgetting) is what cements it.

6. **~85% success is the optimal difficulty** for learning and engagement ([Wilson et al. 2019, Nature Communications "The Eighty Five Percent Rule"](https://www.nature.com/articles/s41467-019-12552-4)) — hard enough that errors carry signal, easy enough that failure doesn't dominate.

### What this means for spacedrep v2 (concrete, ranked)

**R1 — Graduation criterion (the biggest v0 gap).** v0 resurfaces a miss once; one correct answer clears it forever. That's "one and done" — exactly what successive relearning shows is fragile. v2: a missed scenario needs **2–3 spaced correct retrievals** to clear. Track a per-scenario spaced-correct streak (derivable from existing history — no schema change) and resurface on an **expanding session ladder ≈ 2 → 5 → 13 sessions** (the 1/3/8-day rhythm for a daily player). A new miss at any rung resets the ladder.

**R2 — Fix the binge-player massing hole.** Cooldowns are counted in *sessions*, but a player chaining 4 sessions tonight gets tonight's miss back tonight — massed practice wearing a spaced-repetition costume. Make the cooldown **max(2 sessions, 1 calendar day)**. `sessions.created_at` already exists; zero schema change. This matters *more* now that "Deal Next Session →" deliberately encourages chaining.

**R3 — Don't build FSRS/SM-2.** With a ~172-scenario pool, 5-hand sessions, and evidence that expanding-vs-equal barely matters, a fixed 2/5/13 ladder is within noise of optimal and infinitely more debuggable. Revisit only if the pool grows ~10x.

**R4 — Weaponize interleaving via the authored contrast pairs.** The per-skill cap (MAX_PER_SKILL = 2) is already evidence-aligned; keep it, and never add a "drill one skill" mode without a warning — blocked practice tests worse while feeling better. The upgrade: when a weak skill gets its 2 slots, prefer dealing an authored **contrast pair** — same surface, opposite correct action (sc_161/sc_164 monotone attack-vs-release; the sc_122/136/167 price trio; sc_113/sc_088 villain mirrors). Discriminative contrast is the exact mechanism the pool's deliberate pairs were authored for; the scheduler just doesn't know about them yet. (Also independently validates Table Reads' confusable-pairs design.)

**R5 — Aim sessions at ~4/5 expected correct.** No difficulty model exists per scenario yet; once real users generate per-scenario miss rates (Supabase `sessions.hands`), tune the weak-slot count so typical sessions land near 80–85% correct. Immediate cheap version: treat *frequent* 5/5 perfect sessions as an under-challenge signal (bump weak-skill weighting), rare ones as the earned moment they're designed to be.

**Sequencing note:** R1+R2 are a small, self-contained spacedrep.js change (both reuse existing history/timestamps). R4 needs a pairs map authored into data. R5 waits for real data — park it next to the schema-v2 calibration work, same dependency.

---

## Piece 2 — Feedback design (July 18, 2026)

### What the literature says

1. **Elaboration depth is the single biggest feedback lever.** [Van der Kleij et al. 2015 meta-analysis](https://journals.sagepub.com/doi/abs/10.3102/0034654314564881) (40 studies, 70 effect sizes): elaborated feedback (explanation of *why*) ES = **0.49**, versus 0.32 for showing the correct answer and just **0.05** for bare right/wrong marks. The gap is *largest for higher-order outcomes* — transfer and judgment, which is exactly what poker decisions are. Explanations are where the learning lives; grades alone teach almost nothing.

2. **Immediate item-level feedback is the right default for this format.** [Van der Kleij et al.](https://www.researchgate.net/publication/272923307_Effects_of_Feedback_in_a_Computer-Based_Learning_Environment_on_Students'_Learning_Outcomes_A_Meta-Analysis) found immediate beats end-of-test feedback in computer-based practice (and found *no* significant interaction supporting the old "delay helps higher-order" claim); [Kulik & Kulik 1988](https://hal.science/hal-05546645v1/file/Meta_HAL_submission.pdf) found immediate wins in applied settings. Recent work ([Ryan et al. 2024](https://asmepublications.onlinelibrary.wiley.com/doi/full/10.1111/medu.15287)) finds immediate and delayed roughly equal in formative MCQ — nothing supports moving feedback later.

3. **The hypercorrection effect**: high-confidence errors are corrected *better* than low-confidence ones after feedback — surprise recruits attention ([Metcalfe & Finn 2011](https://www.columbia.edu/cu/psychology/metcalfe/PDFs/MetcalfeFinn2011.pdf)). **But corrected high-confidence errors RETURN after ~a week unless re-tested** ([Butler et al.](https://link.springer.com/article/10.3758/s13423-011-0173-y)); [subsequent testing blocks the return](https://www.sciencedirect.com/science/article/abs/pii/S2211368114000242). Confident misses are simultaneously the most correctable and the most relapse-prone.

4. **Answer-until-correct / multiple attempts** improves retention in formative testing ([scaffolded multiple attempts beat all other conditions](https://pmc.ncbi.nlm.nih.gov/articles/PMC7550480/)) — but the benefit skews to high-prior-knowledge learners, and it trades off against assessment integrity.

### What this means for CheckRaise (F1–F5)

**F1 — The existing architecture is exactly right; the lever is explanation quality.** Immediate elaborated per-hand feedback + a delayed pattern-level summary (Coach's Read) is the evidence-optimal structure — don't restructure it. But the 0.49-vs-0.32 gap means the *fb explanation texts* carry more learning value than the gradings themselves: the SME review should weigh explanation quality as heavily as grading correctness, and scenario authoring standards should require the fb text to say *why* (price, position, villain type), never just restate the action.

**F2 — Decision latency is a free confidence signal.** The hypercorrection literature wants confidence ratings, but a confidence tap would pollute the 60-second decision loop. Response time is already on screen and unmeasured: **fast + wrong ≈ high-confidence error** (the most correctable, most relapse-prone kind). Capture `decisionMs` in the session `hands` payload (additive JSON field, zero schema migration) and use it two ways: prioritize confident misses on the R1 resurface ladder, and flag them in the coach-read payload so the Coach's Read can name the player's *confident* leak — the one they don't know they have (this is the diagnosis moat, sharpened).

**F3 — The R1 graduation ladder is relapse prevention, not polish.** Corrected errors—especially confident ones—return within a week without re-testing; spaced re-test is the documented blocker. This upgrades R1 from "nice scheduling improvement" to the mechanism that makes corrections stick.

**F4 — Do NOT add answer-until-correct to the main loop.** It would corrupt skill-accuracy ratings (the rating engine's foundation), soften the timer's realism, and its benefits skew to advanced learners. If wanted later: a "replay this hand" study mode from Hands to Review, unscored.

**F5 — Coach's Read quality bar (input to queue item 4):** as delayed elaborated feedback, its job is pattern-level *why* — name the leak, the direction of error (too passive/too aggressive), and the villain-context mistake; never restate per-hand results the player already saw. The quality pass should test for this explicitly, and the `decisionMs` flag from F2 gives it the "you were sure, and wrong" hook that hypercorrection says is the highest-leverage coaching moment.

## Piece 3 — Motivation mechanics (July 18, 2026)

### What the evidence says

1. **Streak repair is the single most validated retention mechanic in the genre.** Duolingo's Streak Freeze [reduced churn 21% for at-risk users and lifts long-term retention ~10%](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth); cross-app data shows [streaks average ~48% longer where freeze functionality exists](https://trophy.so/blog/streaks-feature-gamification-examples) (17.2 vs 11.6 days past the 7-day mark). Users who reach a 7-day streak are [~3.6x more likely to stay engaged long-term](https://blog.duolingo.com/how-duolingo-streak-builds-habit/) — the first week is the retention cliff that matters. *(Caveat: company-reported figures, not peer-reviewed — direction robust across sources, exact numbers medium confidence.)*

2. **The broken streak is the abandonment event.** Loss aversion powers streaks, but the documented failure mode is that [losing a long streak makes people abandon the habit entirely — more permanently than if the streak had never existed](https://uxmag.com/articles/the-psychology-of-hot-streak-game-design-how-to-keep-players-coming-back-every-day-without-shame), with anxiety and guilt as the mediators. A streak system without a designed *break* experience is half-built.

3. **Goal gradient + endowed progress**: effort measurably accelerates as a goal nears ([Kivetz et al. 2006](https://www.researchgate.net/publication/239776073_The_Goal-Gradient_Hypothesis_Resurrected_Purchase_Acceleration_Illusionary_Goal_Progress_and_Customer_Retention)); a 10-stamp card with 2 pre-filled stamps beats an 8-stamp card for the *same effort* ([34% vs 19% completion](https://learningloop.io/plays/psychology/endowed-progress-effect)). Showing proximity to the next milestone is nearly free motivation.

4. **Rewards that feel informational support intrinsic motivation; rewards that feel controlling undermine it** (overjustification: [tangible expected rewards reliably undermine intrinsic motivation for already-interesting tasks](https://onlinelibrary.wiley.com/doi/10.1002/pits.70056), 128-study meta-analytic base; [gamification meta-analyses](https://link.springer.com/article/10.1007/s11423-023-10337-7) show it moves extrinsic motivation more than intrinsic). Quiet acknowledgment of real achievement = informational; points-as-currency = controlling.

### What this means for CheckRaise (M1–M4)

**M1 — Build a streak-repair mechanic; poker gives it a perfect name: the Rebuy.** The strongest evidence-backed retention feature not yet in the product. Proposed shape honoring the quiet/honest register: earn one Rebuy automatically at each 7-day milestone (max 1–2 held); a missed day silently consumes one, dashboard notes it plainly ("Rebuy used — streak intact"). Earned-not-bought keeps it informational at launch; note Duolingo monetizes freezes heavily, so **purchasable/extra Rebuys are a natural Pro-tier perk later** (ties to `docs/research/RESEARCH_SUBSCRIPTION_MARKET.md`). **Founder call needed on the design; not added to the build roadmap yet.**

**M2 — Design the broken-streak moment (currently an undesigned bare reset).** Never show a naked zero: pair the reset with the consistency record ("You've played 26 of the last 30 days") and an immediate one-tap restart. This is the abandonment cliff — the copy here matters more than the milestone copy.

**M3 — Goal-gradient the milestone line (cheap copy change).** "Day 5 secured" becomes "Day 5 secured · 2 more to a full week ★" when within reach of 7/30/100. Effort accelerates near goals; the current line states progress but never proximity.

**M4 — The existing instincts are validated; hold them.** Quiet-gold earned moments, XP removed, streak as sole metric, honest labeling — all consistent with the informational-not-controlling evidence. If badges ever ship from the backlog: milestone acknowledgments, never currency. The 6pm warning banner should stay factual, never guilt-toned. The 7-day retention cliff also says: the first week of a new user's life is where session quality (spacedrep R1–R4) pays retention dividends, not just learning ones.
