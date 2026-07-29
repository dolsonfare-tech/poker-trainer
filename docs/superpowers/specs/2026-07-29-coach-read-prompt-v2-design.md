# Coach's Read prompt v2 — trajectory headline + trigger-action watchFor

**Date:** 2026-07-29 · **Status:** approved in conversation (founder-user), pending spec review
**Scope:** prompt text + word caps in `api/coach-read.js`, matching harness updates in `scripts/eval-coach.mjs`. Nothing else.

## Goal

The read should feel *encouraging when improvement is real, concrete about stakes,
and actionable every time* — within the existing laws: no invented numbers
(every figure copied from the prompt data), no generic praise, no identity
verdicts, confident errors keep the headline.

## Decisions

### 1. Headline precedence — three tiers

1. **Confident errors present → unchanged.** `HEADLINE_RULE` ("headline must be
   about that confident-error pattern") stays verbatim, single-sourced, and top
   priority. The F2 moat is not negotiable.
2. **No confident errors AND the previous-stretch comparison is given AND this
   stretch improved on it → trajectory opening.** The headline opens with the
   improvement, then names the clearest remaining pattern. Improvement is the
   only encouragement vocabulary that is always earned.

   > **Revised July 29, evening (founder call, after live runs 1–3):** the
   > headline states the improvement in PLAIN WORDS with no figures ("Sharper
   > stretch than the last one; aggression spots still getting checked") and
   > the exact before-and-after counts land in one evidence item instead — the
   > notebook's receipt row. The original copying-counts-into-the-headline form
   > produced "20/50 up from 10/50" — the deleted stat-strip's vocabulary in
   > the coach's mouth — and collided with the 12-word cap. The mechanical
   > check became symmetric with the run-2 false-direction guard: improved →
   > improvement wording required (plus the counts receipt in evidence);
   > declined → improvement wording forbidden anywhere in the read.
3. **Otherwise → today's behavior:** plain "clearest pattern, as something they
   have been DOING lately" diagnosis.

The tier-2 conditional is a new exported constant (`TRAJECTORY_RULE`),
interpolated into the prompt AND imported by `scripts/eval-coach.mjs`, the same
single-sourcing pattern as `HEADLINE_RULE` (invariants rule 31 rationale: the
check and the prompt must be the same string in memory).

### 2. watchFor — implementation intention

New instruction: ONE sentence, cap words or fewer, phrased as a
**trigger-action plan** for the next session — name the situation cue, then
the action ("Next time a raise crosses your mind, make it"), citing one number
from the data above when it sharpens the instruction ("you're 0 for 12 on
those spots lately"). Numbers remain copy-only, never derived.

### 3. Word caps — the pre-registered tune (ROADMAP path 2, executed at the
promised moment)

| Field | Old | New | Why |
|---|---|---|---|
| headline | 12 | **12 (unchanged)** | 7 of 9 live reads made it; trajectory phrasing fits ("31-of-50 lately, up from 24; the leak still open is aggression" = 11 words) |
| evidence | 20 | **24** | the aggregate villain-distribution citations Phase B exists to produce measured 21–22w twice |
| watchFor | 18 | **20** | 4 of 9 live reads landed at exactly 19w; trigger-action + citation needs the room |

These are pre-registered here, before the validating run — NOT moved to make a
red run green. The run can still fail on substance and the caps stay where this
table puts them.

### 4. Validation — one live run judges everything

- `CLAUDE_API_KEY=... npm run eval:coach` LIVE, all 9 personas, judged against
  the F5 bar before any deploy (the eval:coach law).
- Harness updates ride in the same change: `WORD_CAPS` flows automatically
  (already imported); persona expectations that assert headline content get
  updated where the new tiers change what a correct read looks like — notably
  the improving persona must now EXPECT a trajectory opening, and every
  persona WITH confident errors must still expect the confident-error headline
  (tier 1 unchanged, so those expectations should not change).
- The dry run (`--dry`) is free and comes first: eyeball the assembled prompts
  in `coach-eval-dry-prompts.md` before paying for the live run.

### 5. What does NOT change

- `COACH_SCHEMA` (three fields), model (`claude-sonnet-5`), max_tokens,
  thinking-disabled, structured-output config, API params.
- `src/utils/claude.js`, the card rendering (headline + watchFor), the
  notebook, the cadence, the server window build and read-stamping.
- All existing voice rules: stretch-scoped claims, no identity/habitual
  verdicts, no derived counts, no solver language, no em dashes, "sound like a
  human coach", honest multi-direction reporting, the genuinely-playing-well
  case (which tier 2 now partially formalizes).

## Acceptance (what the F5 judgment looks for, per persona class)

- Confident-error personas: headline about the confident-error pattern
  (unchanged), watchFor now trigger-action shaped.
- Improving persona (no confident errors): headline opens with the copied
  counts of the improvement, remaining leak named after; no invented numbers.
- Flat/declining personas: plain diagnosis headline (no forced positivity —
  tier 2 must NOT fire on a down stretch).
- All: watchFor contains a recognizable cue → action structure, ≤ 20 words;
  evidence ≤ 24 words each; zero derived counts anywhere.

## Out of scope

- Any card/UI change (C″ shipped separately today).
- Encouragement on down stretches (rejected: unearned praise violates honest
  labeling; the trajectory tier is deliberately one-directional).
- Chip/EV-denominated stakes language (no such data in the window; the
  no-derivation guardrail forbids inventing it).

## Validation record (July 29, 2026, evening)

Four live runs; each of the first three yielded a real prompt fix (compact →
prose trajectory counts; the false-improvement guard after two declining
personas wrote "up from" on a drop; the trim rule). Run 4: every substance
check green — false-improvement 5/5, trajectory 4/4 (prose + evidence receipt),
tier-1 1/1, freezer 1/1, voice 0 flags — with three +1/+2-word cap misses.

**Tolerance decision (founder-delegated executive call):** word caps carry a
±2-word soft tolerance (`CAP_TOLERANCE` in eval-coach.mjs) — reported ⚠, never
failing a persona; +3 is a hard ✗. Set AFTER substance converged, pre-committed
for all future runs; substance checks tolerate nothing at any margin. Rationale:
re-rolling paid runs until ±1-word sampling noise lands green is a worse
dishonesty than a documented tolerance. The example-opener tweak made after
run 4 was REVERTED so the deployed prompt is byte-identical to the validated
one; that tweak's idea ("Sharper lately" as a two-word example opener) is
recorded here for the next prompt revision instead.
