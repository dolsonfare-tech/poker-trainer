# Subscription Market Research — CheckRaise Pro pricing & packaging

*July 18, 2026. Deep-research run (102 agents: 5 search angles → 15 sources fetched → 3-vote adversarial verification per claim). The automated synthesis step was cut twice by session limits; the synthesis below was written by Claude in the main session from the surviving verified claims. Verification votes shown as confirm–refute.*

---

## Verified claims (survived 3-vote adversarial verification)

### Competitor pricing & gating

| Product | Pricing (verified) | Free tier | Vote |
|---|---|---|---|
| **GTO Wizard** (market leader, serious players) | Starter $49/mo ($39 annual-billed); Premium $99/$79; Elite $169/$139; Ultra $279/$229 (2026 restructure) | — | 3–0 ([PokerNews](https://www.pokernews.com/news/2026/03/gto-wizard-subscription-plans-new-features-pricing-50908.htm)) |
| **Advanced Poker Training** (closest CheckRaise analog: drill/practice vs bots) | $39.97/mo · $300/yr · $599/4yr | Free account limited to beginner-level training games; full trainer paywalled | 3–0 ([PokerNews coaching hub](https://www.pokernews.com/poker-coaching/)) |
| **Run It Once** (video courses) | Essential $24.99/mo · Elite $199.99/mo | 3 sample Elite videos + strategy forum | 3–0 |
| **Pokertrainer.se** (recreational drill trainer) | Lifetime one-time purchase (no recurring-only) | ALL exercises free with a **daily hand cap**; premium removes the cap — the free tier *is* the trial | 3–0 ([pokertrainer.se](https://pokertrainer.se/)) |

- APT explicitly targets "beginners building fundamentals and intermediate players looking to fix leaks" — CheckRaise's exact segment (3–0).
- APT's product is high-volume simulated play with instant feedback — the drill format, not video/solver (3–0). Pokertrainer.se likewise monetizes pure drills/quizzes (3–0). **The drill format demonstrably monetizes for recreational players.**

### Benchmarks (RevenueCat *State of Subscription Apps*; Adapty 16k-app dataset)

- **Freemium converts ~2%**: median download-to-paid (D35) is **2.1% freemium vs 10.7% hard-paywall** (~5x gap) (3–0, two independent runs). Hard-paywall apps earn ~**8x revenue per install** at D60 ($3.09 vs $0.38) (3–0).
- **Education category**: D35 download-to-paid median **2.3%**, top quartile **>5%** (2–1).
- **Price anchors**: overall medians **$8/mo** and **$34.80/yr**; Education is the *highest*-priced category — **$9.99/mo median** (3–0) and **$44.99/yr median** (2–1).
- **Long trials convert better**: 17–32-day trials 42.5% trial-to-paid vs 25.5% for ≤4-day (3–0 in run 2; a differently-worded variant was refuted 1–2 in run 1 — treat direction as solid, exact numbers as medium confidence).
- **Funnel averages** (Adapty, global): install→trial 10.9%, trial→paid 25.6% (3–0).

## Refuted or unverified — do NOT cite these

- ❌ PokerCoaching.com "$49.99/$99.99 three-tier" numbers (0–3) and Upswing "$49/mo + $99 signup" (0–3) — verifiers found current pricing differs; re-check the live sites before quoting either competitor.
- ❌ APT "90,000 members" (0–3); Adapty education-specific price medians (0–3); "annual = 59% of education sales" (1–2); Adapty 12-month retention splits (1–2).
- ⚠️ Unverified (verification killed by session limits, single-source): DTO Poker Trainer ~$9.99–$99.99/mo MTT-focused ladder; "GTO trainer free tiers give preflop away and ration postflop by daily quota" (Lucid GTO, GTO Gecko pattern); two conflicting secondhand GTO Wizard price lists (the PokerNews 3–0 numbers above supersede them).

---

## Synthesis & recommendation (Claude, from verified claims only)

**1. Price anchor: $9.99/mo, $49.99/yr.** Education-app medians ($9.99/mo, $44.99/yr) fit CheckRaise's "training app" mental model, and the poker-specific floor is far above it — the cheapest serious competitors are $25–50/mo. $9.99 positions CheckRaise as *the affordable trainer* (4x under APT, 5x under GTO Wizard Starter) while still being the top of the general-app price band. The annual at ~5x monthly matches market structure (~$45–60 is defensible; test $59.99 if launch demand is strong). Avoid lifetime at launch (caps LTV; Pokertrainer.se offers it but is a hobby-scale product).

**2. Packaging: one Pro tier, monthly + annual.** No tier ladder at this scale — the verified competitor ladders (GTO Wizard's four tiers) serve segmented pro audiences CheckRaise doesn't have. One clean "Pro" with an annual discount is the education-app norm.

**3. Free-tier gating: ration volume, paywall depth & personalization.** The verified market pattern across analogs: keep the core habit loop free (Pokertrainer.se: all exercises, daily cap; APT: beginner games free) and gate the advanced/personalized layer. For CheckRaise that maps to — **free**: core 5-hand sessions, basic skill ledger, streaks (the retention engine that earns the conversion moment); **Pro**: Table Reads mode, Expert difficulty, unlimited/deeper Coach's Reads, full session history + schema analytics. Both existing Pro candidates (Table Reads, Expert) are consistent with how APT and the GTO apps gate; the strongest addition the data suggests is gating *depth of personalization* (coach + analytics), since personalization is CheckRaise's stated moat.

**4. Trial: the free tier is the trial** (Pokertrainer.se model) — plus, when Pro ships, consider a 14+ day Pro trial rather than 3–7 days (long trials convert ~70% better, medium confidence).

**5. The number that should shape the OKRs: freemium converts ~2.1–2.3% of downloads (top quartile >5%).** At $9.99/mo: 1,000 MAU ≈ 20–25 payers ≈ ~$200–250 MRR; 10,000 MAU ≈ ~$2–2.5k MRR. Implications: (a) the founder's instinct — user base first, monetization second — is what the math demands; (b) the user-base key result should be sized in thousands, not hundreds; (c) if early conversion disappoints, the levers in order are price (poker wallets tolerate more than $9.99 — APT charges $40) and gate tightness, not more features.

**Open items for a cheap follow-up pass:** verify DTO's ladder + current PokerCoaching/Upswing pricing from their live sites (their secondhand numbers were refuted); chess.com/Duolingo mechanics angle produced no surviving claims worth citing — re-run that angle if wanted.
