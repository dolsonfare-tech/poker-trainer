# CheckRaise — Founder's Briefing

*Written July 22, 2026. Purpose: everything you should be able to say out loud — without notes — before talking to mentors, advisors, or other entrepreneurs. Each section gives the decision, the reasoning in plain language, what we rejected, and the question a sharp mentor will probe. This is the rehearsal doc; the full record lives in CLAUDE.md, decision-log.md, and the four RESEARCH_*.md docs.*

---

## 1. The one-paragraph pitch

CheckRaise (checkraise.ai) is a Texas Hold'em skill trainer that finds the specific leak in your game and coaches you like a human would. You play short 5-hand sessions of realistic decisions; the app grades your judgment, tracks 8 skills, and — this is the differentiator — diagnoses the *belief* behind your mistakes ("I shouldn't put money in unless I'm sure") rather than just scoring your accuracy. Free to play; monetization is a planned Pro subscription.

**The moat, one sentence:** we diagnose *why* you make mistakes from your actual decisions — no competitor does belief-based diagnosis from decision data (verified against the market July 2026: GTO tools rank your EV loss, mental-game coaching diagnoses via self-report questionnaires; nobody connects the two).

---

## 2. Why there's no EV in the product

You asked for this in plain terms, and it's the question a poker-literate mentor *will* ask, because every serious training tool they've seen (GTO Wizard, DTO) is built on EV. The honest answer has three parts — it's mostly a **deliberate competitive decision**, partly a **real capability constraint**, and a small slice is **deferred by design**.

**The deliberate part (the main reason).** EV — "expected value," the average money a decision wins or loses — is only a hard number when it comes from a solver: software that computes game-theory-optimal play. Our scenarios are deliberately *not* solver spots. They're exploitative judgment calls: "fold here *because this specific opponent doesn't bluff*," "raise bigger *because this player calls too much*." That's how $1/$2 live poker is actually beaten, and it's what beginners can actually learn from. The moment you print an EV number on an exploitative spot, you're claiming solver-grade precision for a judgment call — which is either fake rigor, or it drags us into competing head-on with GTO Wizard on solver accuracy, a lane where a well-funded incumbent already wins. Our whole positioning is the *other* lane: they tell you *what* the optimal play is; we tell you *why you keep not making it*. This is also why the app says "Recommended Play," never "Correct Play," and why the coach is banned from saying "the solve" — one consistent honesty posture, top to bottom.

**The capability part (real, but secondary).** Computing true EV requires either solver infrastructure or an explicit mathematical model of the opponent's range. We have neither, and building either is a serious engineering lift. But be clear with a mentor: this is not "we couldn't, so we rationalized it." The causality runs the other way — we chose the diagnosis lane first (it's the defensible moat), and that choice makes solver infrastructure the wrong investment. If a mentor asks "could you add EV?" the answer is "we could buy or build our way to it, but it would make us a worse GTO Wizard instead of the only CheckRaise."

**The deferred part.** What *is* on the roadmap is the arithmetic a human coach would show you: pot odds laid out, "you need 22% equity to call, against this range you have roughly 35%." That's checkable, teachable math — not a solver claim — and it's a natural Pro-tier depth feature. So if the question is "will numbers ever appear?": yes, the *price math*, framed as coaching. Never an EV-loss leaderboard.

**The sentence to say out loud:** *"We grade judgment like a coach, not equity like a solver. An EV number on an exploitative spot is either false precision or a different product — one that already exists and is better funded."*

---

## 3. The diagnostic engine (the moat, and how it actually works)

- **Six player schemas** — named mental models behind losing play (The Conflict Avoider, The Gambler, The Overaggressor, The Positional Blind Spot, The Results Thinker, The Exploitable Regular). The card the user sees says, in effect, "here is the belief driving your leak."
- **How it's computed:** a hybrid engine. Three schemas are diagnosed from the *direction* of your errors (do you fold when raising was right, or raise when folding was right? — two players with identical 60% accuracy can have opposite diseases). The other three come from *which skill* is weak (position, reads, opponent-adjustment). Highest-severity signal wins; no clear signal → an honest "Balanced / Student of the Game" card instead of a forced label.
- **Why direction matters — a story worth telling:** our v1 engine scored accuracy only, and synthetic playtesting caught it labeling a passive, scared player as "The Overaggressor" — the exact opposite of the truth — because of *which* scenarios his misses landed on. The v2 direction-of-error rebuild fixed it (zero opposite-direction labels across all persona trials since). Lesson we can honestly claim: we adversarially test our own diagnosis engine with simulated players before real users ever see a label.
- **External validation:** the July 2026 research pass found our homegrown design independently mirrors SISM, an academic cognitive-diagnosis model that scores skills and misconceptions jointly — we reinvented the published state of the art without knowing it. Also found: zero external precedent for poker-belief diagnosis, which means the moat is real *and* unvalidated — only real playtest data can prove the six schemas carve players correctly.
- **Known weak point (own it before a mentor finds it):** "The Results Thinker" is the shakiest mapping — it's a belief about the learning process itself, hard to observe from decisions alone. Slated for re-anchoring in the engine's next revision.

---

## 4. The learning science (why the trainer is built the way it is)

Every mechanic below came out of a July 2026 evidence review (RESEARCH_LEARNING_SCIENCE.md), not vibes:

- **Spaced repetition with a graduation ladder.** A missed hand isn't "reviewed once and done" — it must be answered correctly 2–3 times, *spaced out* on an expanding schedule (2, then 5, then 13 sessions), before it graduates. New miss → back to the start. Chained same-day sessions can't cheat the spacing (a calendar-day floor prevents cramming).
- **We deliberately did NOT build the fancy algorithm.** Anki-style adaptive schedulers (SM-2/FSRS) were evaluated and rejected: at our pool size the evidence says a fixed ladder performs within noise of the adaptive ones and is far more debuggable. Mentors like hearing what you *didn't* build.
- **Explanation quality is the product.** The single biggest effect size in the feedback literature: elaborated "why" feedback carries roughly **ten times** the learning effect of a bare right/wrong grade (ES 0.49 vs 0.05). So every hand ships with authored reasoning about price, position, and villain — and a right grade with a weak explanation is treated as a defect.
- **Confident misses are gold.** We time every decision. Answering fast *and* wrong (≤15s) signals a mistake the player doesn't know they're making — those hands jump the review queue and the coach is required to lead with the pattern when it clusters.
- **No answer-until-correct, ever, in the scored loop.** It would corrupt the skill-accuracy data the entire diagnosis engine stands on. (Encoded as a hard "never do" rule in the repo.)
- **Contrast pairs.** Scenarios are authored in look-alike pairs with opposite answers (same price, different opponent → opposite play) and the dealer places them side by side. Discrimination training via juxtaposition — the same method the perceptual-learning literature validates for training doctors to read ECGs (54%→86% accuracy in the canonical study). Our Table Reads mode (watch a hand replay, name the player type) is that literature's method almost exactly, discovered after we designed it.

---

## 5. Honest labeling (the trust posture)

A recurring, deliberate theme — poker players are professionally skeptical, and one overclaim loses them:

- "**Recommended** Play," never "Correct Play" — exploitative spots are judgment calls, and there's a built-in "Disagree?" button on every graded hand that files the dispute straight to us.
- "Hand Analysis," not "AI Analysis" — per-hand feedback is pre-written by us, and we won't label static content as AI. The one real AI call per session (the Coach's Read) keeps its name.
- Re-dealt hands are labeled ("↩ You missed this one before") — the engine never quietly tests you.
- No XP, no coins, no badge economy. Streak only, and understated "earned moments" (a quiet gold 5/5, a personal best). The overjustification literature backs this: pile extrinsic rewards on an intrinsically motivated activity and you erode the motivation. The one retention mechanic we did adopt — a streak-freeze we call the **Rebuy** — is the genre's single most validated one (Duolingo measured −21% churn).
- The Coach's Read speaks in session-scoped observations, not verdicts (reframed July 22, 2026 — five hands is field notes, not a diagnosis; the accumulated Coach's Notebook, and a planned Pro "meta-read" across weeks of notes, is where diagnosis-weight conclusions belong).

---

## 6. Business decisions

- **Model: free + Pro subscription.** Decided July 2026 after market research. Launch free with *no ads* — the ads-first plan was killed (banking/LLC overhead not worth it pre-traction), and a coin/token economy was considered and rejected (fights the habit loop; poker "buy a spin" optics). Research-backed price point: **$9.99/mo or $49.99/yr, single Pro tier.** Pro candidates: Table Reads mode, Expert difficulty, deeper coach/analytics, "train on your own hands."
- **The math to know cold:** freemium tools convert roughly **2.1–2.3%** of signups to paid. That means the user-base goal must be sized in the thousands before Pro revenue is real. Nothing about our plan pretends otherwise.
- **Never take anything away:** the free tier launched already at its long-term limits (e.g. 5 coach reads/day, not 20 lowered later), and free-during-beta features carry a "Free during beta" chip — so the future paywall reads as a promise kept, not a rug-pull.
- **Costs are capped by architecture:** one AI call per session, server-enforced daily cap per user, $50/mo spend ceiling. The unit economics of the free tier are deliberately boring.
- **Distribution plan (early, honest):** nothing tried yet, deliberately — gameplay first. First channels: a Reddit post and a YouTube demo *played as a user, not pitched as the founder*. Positioning lead: the schema diagnosis (verified novel). Explicit don't: never claim tilt/mental-game coverage — tilt is deliberately out of scope (it's diagnosed by self-report, not decision data), and a poker-literate audience will test that claim.
- **Next gate before marketing/legal/banking: paid playtesters.** ~10–13 testers, 14-day daily-play protocol, ~$525 budget (PLAYTEST_BRIEF.md). They produce the real human miss-rate data that several calibration decisions are parked on. SME grading review stalled; founder self-grades through play, with the in-app dispute pipeline as the capture mechanism.

---

## 7. Engineering culture (say this to technical mentors)

- **Solo founder + AI pair, kept honest by machines:** every rule that matters is enforced by a deterministic gate, not discipline — an invariant checker (architecture rules as exit codes), content auditors (poker math re-verified mechanically: pot sizes, out-counts, stack coverage), a jest suite, browser end-to-end tests with geometry guards (they catch "the UI is destroyed but every functional test passes"), and a schema-bias simulator that fails CI if the diagnosis engine develops structural bias. All of it runs on every push.
- **The ratchet law:** every bug ever found becomes a permanent mechanical check in the same session it's fixed. The net only grows. A user-reported bug fixed without leaving a check behind is classified as a process failure.
- **Synthetic playtesting before real users:** 8 simulated player personalities play thousands of sessions through the real engine. This caught the opposite-label diagnosis bug, a review-queue drain problem, and proved our old score formula literally couldn't show a player improving (fixed with a recency-weighted window).
- **The AI coach is evaluated, not trusted:** a harness runs the real prompt against nine synthetic sessions after any prompt change; output judged against a written quality bar. Round one caught the model inventing details and using solver language — both now banned in the prompt.
- **Stack:** React web app (iOS via Capacitor later), Supabase (Postgres + auth, row-level security everywhere), Vercel, one serverless function holding the only AI-API key. Single-file ownership rules for every external service.

---

## 8. Open questions a mentor could help with (bring these, don't hide them)

1. **Zero users, by choice — when does that flip?** Everything above is pre-traction. The queue says: playtesters → calibration → then marketing. Is that right, or is it perfectionism deferring contact with the market?
2. **Validation of the six schemas.** The moat has no external precedent, which cuts both ways. What's the cheapest experiment that proves the labels feel *true* to real players?
3. **Session length (5 hands) is a design instinct, not a validated choice.** We have the telemetry plan to answer it (chain rate vs. abandonment) but no data yet.
4. **Content runway.** 172 scenarios + 22 Table Reads hands; engaged players exhaust the pool in ~3 weeks. Scaling authored, judgment-dense content (or building the "upload your own hand" pipeline) is the manufacturing problem.
5. **Solo-founder risk** with an AI-heavy build process — what does hiring look like, and when?
6. **Pro timing.** Rails (Stripe) don't exist yet. Build them pre- or post-traction?

---

## 9. Numbers card (memorize)

| Thing | Number |
|---|---|
| Scenarios in pool | 172 (81 beginner / 91 intermediate; Expert empty by design) |
| Session length | 5 hands, ~2–4 minutes, one-tap chaining |
| Skills tracked | 8 · Schemas diagnosed | 6 · Villain archetypes | 7 + Unknown |
| Table Reads observation hands | 22 |
| Coach reads (free) | 5/day, server-enforced |
| Planned Pro price | $9.99/mo · $49.99/yr |
| Freemium conversion benchmark | ~2.1–2.3% |
| Playtest plan | ~10–13 testers · 14 days · ~$525 |
| Elaborated-feedback effect | ES 0.49 vs 0.05 for bare grades (~10x) |
| Streak-freeze precedent | −21% churn (Duolingo) |
