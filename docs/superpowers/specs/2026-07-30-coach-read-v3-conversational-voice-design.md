# Coach's Read v3 — a true coach's voice

**Date:** 2026-07-30, revised 2026-08-02 after founder red-pen · **Status:** APPROVED — founder signed off on the revision-2 examples 2026-08-02 ("solid"); implementation is session 4
**Scope:** prompt register + schema + caps in `api/coach-read.js`, harness redesign in `scripts/eval-coach.mjs`, read-panel/notebook render (`LastSessionRead.jsx`, `CoachNotebook.jsx`), invariants rule 31 update. `parseCoachRead`, `claude.js`, cadence, server window build, read-stamping, model + API params: unchanged.

## Goal (founder direction, July 29 2026 evening; sharpened August 2)

The read should feel like a REAL coach talking. The founder's red-pen on
revision 1 moved it further than "conversational": from **audit voice**
("here is what the data shows") to **advice voice** ("here is what to do
about it, and why"). The founder's own rewrites are the register:

> "Be careful snap calling a tight player. Tight nit players rarely bluff and
> don't play with bad hands, so make sure you have a strong hand."

Scope is the Coach's Read panel ONLY: the Player Schema card and skill chips
stay exactly as they are (founder said so twice).

The v2 lesson this project is built on: **the model mimics the prompt's worked
example with near-perfect fidelity.** v3 succeeds or fails on the worked
examples, not on adjectives like "be conversational".

## Founder red-pen decisions (August 2, 2026 — all locked)

1. **Numbers gone everywhere.** No statistics on any surface of the read —
   card or notebook. The window data still decides WHICH pattern gets named
   (the diagnosis is unchanged); the read never shows its arithmetic. The
   Phase B receipt idea ("things you can't compute yourself") is retired from
   this surface — the notebook keeps rendering old reads' evidence rows, but
   new reads carry none.
2. **Two sentences, ≤ 40 words total (±2 soft, +3 hard).** Sentence 1: the
   scoped observation in natural speech. Sentence 2: the WHY (villain type,
   concept) plus a concrete if-then instruction. The founder's rewrites
   measured 25–35 words; the caps pre-register here, before any validating
   run, and do not move to green one.
3. **Trajectory survives as one opening clause.** On an improving stretch
   with no confident errors: "You're playing sharper lately, but…" —
   improvement earns a clause, never a sentence, then straight to the
   coaching. Tier 1 (confident errors own the opening) still always wins.
4. **General poker teaching is now IN the register.** "A Tight Nit rarely
   bluffs" is a claim about the villain type, not about the player — true
   strategy knowledge, the F1 lever (explanation quality) finally speaking in
   the read. The invented-data laws never applied to it; the audit register
   just never had room for it.
5. **Trait phrasing stays banned; scoping goes natural.** The founder's draft
   "you tend to fold too early" collides with the identity/habitual-verdict
   guard (their own July 22 law). Resolution: same warmth, stretch-scoped —
   "**Lately you've been** folding too early…". ~50 hands honestly supports
   "a lot lately"; it still does not support "you tend to".

## Shape: two fields, two sentences

`COACH_SCHEMA` drops `evidence`. The wire keeps the existing field NAMES so
nothing downstream migrates:

| Field | Is | Bound |
|---|---|---|
| `headline` | Sentence 1 — the scoped observation ("You've been snap calling tight players a lot lately.") | ≤ 20 words (render guard, card) |
| `watchFor` | Sentence 2 — the why + if-then instruction ("A Tight Nit rarely bluffs…, so…") | ≤ 26 words (render guard, card) |

- Exactly ONE sentence per field — hard, no tolerance (structure is not
  sampling noise). Both fields end in terminal punctuation (hard): the
  renderers join them into a paragraph.
- Total ≤ 40 words, `CAP_TOLERANCE` (±2 soft, +3 hard) carried over verbatim.
- **No numerals anywhere** — hard check. Thresholds live in words ("less than
  half the pot", "three to one"), which is how a coach says them anyway. This
  is the mechanical form of "numbers gone everywhere", and it makes the old
  copy-only-counts checks vacuous rather than violated.
- `normalizeCoachRead` validates the two-field shape; `parseCoachRead` is
  already forward-compatible (defaults a missing `evidence` to `[]`), so old
  structured reads, legacy prose reads, and new two-field reads all render
  with zero migration.

## The worked examples — revision 2 (founder's register, near-verbatim)

**Tier 1 — confident errors present (the F2 moat, unchanged priority):**

> **headline:** "You've been snap calling tight players a lot lately."
> **watchFor:** "A Tight Nit rarely bluffs and rarely plays a bad hand, so
> make sure yours is strong before the chips go in."

*(9 + 22 = 31 words)*

**Tier 2 — improving stretch, no confident errors (trajectory clause):**

> **headline:** "You're playing sharper lately, but you're still folding too
> early when the price is good."
> **watchFor:** "When the bet is less than half the pot, pause and look at
> your draws before letting the hand go."

*(15 + 20 = 35 words)*

**Tier 3 — plain pattern (freezer variant):**

> **headline:** "The clock has been making too many of your decisions for
> you."
> **watchFor:** "When the timer gets low, pick the safest line you see and
> commit, because any choice beats no choice."

*(12 + 19 = 31 words)*

Register rules the examples embody (stated once, briefly, in the prompt):
natural speech with poker lingo (snap calling, draws, the price), zero
numerals, zero em dashes; sentence 1 scoped with "lately"/"been", never
trait-tensed; sentence 2 explains the WHY in villain-type or concept terms and
lands on an if-then the player can execute next session. Written to be a voice
`claude-sonnet-5` can sustain: simple declarative shapes, no wit budget.

## What survives verbatim (the hard-won constraints)

- **Tier precedence**, single-sourced and exported: `HEADLINE_RULE` (confident
  errors own sentence 1) and `TRAJECTORY_RULE` (rewritten for the clause form:
  improvement in plain words as an opening clause, never fires on a decline).
- **False-improvement guard** (improvement vocabulary forbidden on a declined
  stretch — vocabulary scan, unchanged in kind).
- **Voice guard:** identity AND habitual verdicts banned ("you are a…",
  "you always…", "you tend to…" — the last is new to the regex, per §5 above).
- **Freezer rule** (timeouts named as their own pattern), no solver language,
  the eval law (live run before deploy, F5 bar, dry-run artifact safety).
- **Substance checks tolerate nothing**; the ±2 tolerance is words-only.

## Harness redesign (`scripts/eval-coach.mjs`)

- **Replace** word-cap checks with: per-field sentence count (hard), total
  words ≤ 40 (±2/+3), the two render guards, terminal punctuation (hard),
  **numeral scan (hard)** — any digit in any field fails the persona.
- **Retire:** evidence item-count/word checks, the counts-receipt half of the
  trajectory check (numbers are gone; the prose-vocabulary half remains and
  becomes the whole check).
- **Port unchanged:** confident-error opening check, false-improvement guard,
  freezer scan, voice scan (+ "you tend to" added to the verdict regex),
  coverage accounting, `CAP_TOLERANCE`.
- **New — example-fingerprint scan (soft ⚠):** distinctive example phrases
  ("snap calling tight players", "half the pot", "any choice beats no
  choice") flagged when they appear for a persona whose data doesn't warrant
  them — the tripwire for example-fidelity turning into example-parroting.
  With numbers gone, phrase-leak replaces number-leak as the failure mode.
- **New — em-dash scan (soft ⚠).**
- Persona `expect` strings rewritten for the advice register per tier.

## Render (smallest possible change)

- `LastSessionRead` card: join `headline + ' ' + watchFor` as one paragraph in
  the existing type style.
- `CoachNotebook`: same join for new reads; legacy evidence rows keep
  rendering for old reads (the derived history is append-only in spirit —
  old reads are not rewritten).

## Validation plan

1. ~~Founder red-pen round 1~~ — done August 2 (this revision).
2. Founder sign-off on the revision-2 examples above — the crux gate.
3. Opus implements (session 4): prompt + schema + `V3_CAPS` + harness +
   renders + rule 31 update. Dry run; eyeball assembled prompts.
4. Live eval runs, budget 3–4. Per run: substance green (no tolerance),
   caps within tolerance, founder F5 judgment on VOICE — which no mechanical
   check can carry.
5. Caps and shape above are pre-registered; they do not move to green a run.

## Acceptance

- All 9 personas: 2 sentences, ≤ 40 (+2) words, terminal punctuation, zero
  numerals, zero identity/habitual verdicts, zero example fingerprints, zero
  em dashes.
- Tier behavior: confident-error opening on tier-1 personas; trajectory
  CLAUSE only on genuinely improving stretches; declines never spun; freezer
  named.
- Founder reads all 9 aloud and they sound like one coach talking.

## Out of scope

- Player Schema card, skill chips, any dashboard structure (founder, twice).
- Cadence, window size, server aggregation, model, API params.
- Encouragement on down stretches (still rejected — unearned praise violates
  honest labeling; the trajectory clause is deliberately one-directional).
