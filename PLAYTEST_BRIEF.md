# CheckRaise Playtest — Brief & Protocol (July 2026)

> Drafted July 20, 2026 (founder request). Purpose: recruit and run the first
> paid playtester cohort. This cohort generates the real human data that three
> parked calibrations are waiting on: **R5** (tune sessions toward ~85%
> correct — needs per-scenario miss rates), **F2b / schema v2 skill side**
> (needs real per-skill accuracy distributions), and **session-length
> calibration** (chain rate + mid-session abandonment). Plus the qualitative
> layer telemetry can't see: first-session confusion, grading trust, and
> whether the coaching voice lands.

---

## Part 1 — The recruiting post (copy-paste ready)

> **Paid playtest: a poker training app that finds the leaks in your game ($40, ~15 min/day for 2 weeks)**
>
> We're CheckRaise (checkraise.ai) — a Texas Hold'em trainer that deals you
> realistic cash-game decisions, grades them, and diagnoses the pattern behind
> your mistakes. We're looking for **10–15 playtesters** before our public
> launch.
>
> **What you'd do:**
> - Play at least one 5-hand session a day (about 3–5 minutes) for 14 days —
>   more is welcome
> - When you disagree with a grading, say so with the in-app "Disagree?"
>   button (one tap, right on the hand)
> - Fill out a 10-minute survey at the end
> - A few testers (optional, extra $15): screen-record your very first session
>   while thinking out loud
>
> **What you need:** a phone or computer with a browser, and an email address
> to sign in with. Any skill level from "just learned the rules" to "regular
> at my local game" — we specifically need a mix.
>
> **Pay:** $40 gift card on completion (14 days played + survey), +$15 for a
> recorded first session. Comped Pro access when our paid tier launches.
>
> To apply, answer the five questions below.

### Screening questions (pick for a spread, not a bar)

1. How often do you play poker, and where? (home games / casino / online / apps)
2. Which best describes you: (a) still learning the rules, (b) know the rules,
   play casually, (c) play regularly and think about strategy, (d) study
   seriously (solvers, courses, books)
3. What does "pot odds" mean to you? (One sentence — fine to say "no idea.")
4. What device would you mostly play on? (phone / tablet / laptop)
5. Have you used a poker training app before? Which?

**Cohort targets (the spread is the point):**
- 3–4 novices (answer b, or a with rules knowledge — they stress comprehension
  and the Beginner pool)
- 5–6 casual regulars (answer c — the core target user)
- 2–3 studying players (answer d — they stress grading correctness and will
  file the sharpest disagreements)
- At least half primarily on **phone** (the mobile layout is the primary
  target and the least-verified surface)
- Screen out: current training-app power users only if the cohort skews that
  way; one or two are useful for comparison quotes.

---

## Part 2 — Tester instructions (send on acceptance)

Keep this light — **do not explain the app's mechanics.** Naive first contact
is data we can never get back.

> Welcome — thanks for testing CheckRaise.
>
> 1. Go to checkraise.ai and **sign in** (Google or email link — don't play as
>    a guest, or we can't see your results). After signing in, reply to this
>    message with the **username you chose** so we can match your data.
> 2. Play **at least one session a day for 14 days**, starting [DATE]. Pick
>    whichever difficulty honestly matches you. Play more if you feel like it —
>    that's useful too. Missing a day isn't a disqualification; just keep going.
> 3. If a grading feels wrong, tap **"Disagree? Let us know if we have this
>    wrong"** on that hand and pick the reason. This is the single most
>    valuable thing you can do for us. If something is broken, confusing, or
>    boring, use the feedback box at the bottom of the dashboard ("Something
>    broken, boring, or brilliant?").
> 4. If you see a "Table Reads" mode on the dashboard, play it whenever you
>    like — it's part of the test too.
> 5. On day 14 we'll send a short survey. That's it — there are no right
>    answers to being a tester; play like a person, not a QA analyst.
>
> [Recording-cohort testers only:] Before your first session, start a screen
> recording and talk through what you're seeing and thinking as you play —
> confusion is exactly what we want on tape. Send us the file after; first
> impressions only, no need to record after day 1.

**Deliberately not told to testers:** streak mechanics, Rebuys, the schema
diagnosis, replay/comeback hands, the coach's daily cap. Whether they notice,
understand, and care about these unprompted IS the test.

---

## Part 3 — What we capture, and which question each stream answers

All passive — the infrastructure already exists. Testers only need to sign in.

| Data | Where it lives | Question it answers |
|---|---|---|
| Per-scenario result + `decision_ms` + `timed_out` + `replay` | PostHog `decision_made` | **R5** (miss-rate per scenario → the ~85% target), **C4** comprehension heatmap (p50 time + timeout outliers = confusing hands) |
| Per-skill accuracy, session rows, direction tally | Supabase `sessions` (rebuilt into skills/tally) | **F2b / schema v2 skill side** — real per-skill accuracy distributions to calibrate relative-weakness scoring |
| `session_started.chained`, `decision_made` count vs `session_completed`, `session_started.guest` | PostHog | **Session length**: chain rate persistently >~50% argues for a bigger unit; abandonment >~15% argues smaller (decision rule already in CLAUDE.md) |
| Grading disputes | Supabase `scenario_feedback` | Content bugs; SME-replacement signal (founder self-grading + testers is the current grading pipeline) |
| Free-text reports | Supabase `feedback` | Everything else |
| `table_reads_started/answered/completed` (observation_id, picked, correct) | PostHog | Table Reads difficulty ordering + which distractors actually confuse |
| Streak survival, Rebuy consumption | Derivable from `sessions.created_at` gaps per profile | Does the daily loop hold for strangers with no founder loyalty? |
| Remediation-queue depth per tester at day 14 | Derivable from `sessions` rows (count `remediating` entries in the rebuilt history), especially for low-accuracy/passive-profile testers | **F1 / Conflict-Avoider deferral (docs/research/RESEARCH_SCHEMA_TAXONOMY.md, July 22)**: the harness's stuck-queue signature may be an artifact of personas that can't learn. If real strugglers ALSO show un-draining queues → build graduation-proximity-aware surge targeting; if their queues drain as they improve → the deferral was right |
| Crashes | Sentry (email alerts now on) | Stability under real devices |
| First-session recordings (2–3 testers) | Sent files | Onboarding friction telemetry can't see |

**Cohorting:** collect each tester's username at signup (step 1 above), map to
profile uid via `select id, display_name from public.profiles` in the SQL
editor, and keep the uid list in the tracking sheet. In PostHog, filter by
those identified uids to separate testers from organic users — **this matters
now that the link is being shared publicly**; the two populations must not be
mixed when calibrating.

**Volume honesty:** 12 testers × ~14–20 sessions × 5 hands ≈ 900–1,200 hands,
spread over 172 scenarios with weak-skill weighting ≈ 5–8 exposures per
scenario. That's enough to flag outliers (the R5/C4 signal) and to shape the
skill-accuracy distributions — it is NOT enough for fine per-scenario
calibration. Treat results as directional; organic users compound the sample.

---

## Part 4 — Exit survey (day 14, ~10 minutes)

Scale questions 1–5 (1 = no / never, 5 = strongly yes), then free text.

1. The app correctly identified something real about my game. (1–5) — *the
   product's core claim; the schema/coach moat lives or dies here*
2. When the app graded a play wrong, I usually understood **why** after
   reading the explanation. (1–5) — *F1: explanation quality is the highest
   effect-size lever*
3. I trusted the gradings. (1–5, plus: "Name a hand you still think we got
   wrong, if any.")
4. What does your streak number mean? What's a Rebuy? (open — *tests whether
   the mechanics communicated themselves; we never explained them*)
5. The sessions felt: too short / right / too long. Did you usually play one
   session or chain several? — *pairs with the behavioral chain-rate data;
   stated vs revealed preference*
6. What's the difference between the "Villain Read" on the table and your
   "Player Profile" on the dashboard? (open — *tests the villain-vs-you
   boundary we just re-drew*)
7. Did you play Table Reads? Was it clear how it relates to the main game? (open)
8. Was anything on screen confusing or unreadable on your device? (open,
   ask device model)
9. Would you pay $9.99/month for a version with more content and deeper
   coaching? What would it need to have? (open — *Pro-tier demand, phrased
   against the real planned price*)
10. What almost made you stop playing during the two weeks? (open — *the
    churn question; more honest than "what did you like"*)

---

## Part 5 — Founder ops

- **Where to recruit:** r/poker + r/homepoker (post the brief; mods often
  allow paid-study posts — message first), poker Discords, and one
  general-population source (e.g. BetaTesting.com or a friends-of-friends
  chain) for the novice stratum — poker forums alone will skew expert.
- **Budget:** 12 testers × $40 + 3 recordings × $15 ≈ **$525** all-in.
- **Tracking sheet columns:** name/contact, screener answers, stratum, device,
  username, profile uid, start date, days played (from `sessions.created_at`),
  disagreements filed, survey done, paid.
- **During the fortnight:** run the intake-triage drill at the start of every
  working session (the CLAUDE.md cadence — now that the link is public this
  is no longer optional): Sentry → PostHog failure events + comprehension
  heatmap → `scenario_feedback` most-flagged → `feedback` latest. Every real
  item becomes a work item; every fix leaves a permanent check (ratchet law).
- **Do not** ship scenario regrades mid-test unless a grading is outright
  wrong — a moving target corrupts the miss-rate data. Queue disputes; batch
  the regrade after day 14.
- **After day 14:** pay promptly, then run the analysis session — R5 outlier
  list (miss rate + p50 time + timeout rate per scenario), skill-accuracy
  distributions for schema v2 skill-side, chain/abandonment numbers against
  the session-length decision rule, survey synthesis. Each calibration change
  goes through the existing harnesses (`playtest:personas`, `simulate:schemas`,
  `eval:coach`) as acceptance gates.
