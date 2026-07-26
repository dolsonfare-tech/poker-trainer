---
name: scenario-authoring
description: Use when adding or editing scenarios in src/data/scenarios.js or observations in src/data/observations.js. Walks the full authoring workflow, enforces all conventions, and runs the content gates in the right order.
---

# Scenario Authoring

**Before the first edit:** read `docs/conventions/AUTHORING_SCENARIOS.md` in full.
It is the authoritative rule set; this skill is the workflow wrapper around it.

---

## Step 1 — Use helpers only

Every scenario must be created with the three helper functions. Never add raw
object literals to the array:

```js
mkScenario({ id, difficulty, skill, villain, hand, board, pot, toCall,
             effectiveStacks, positions, options, correct, grading, body,
             question, actionHistory?, tableContext? })
mkHand(rank, suit)      // e.g. mkHand('A', '♠')
mkPositions([...])      // wraps seat objects
```

`VILLAIN_LABELS` and `SKILL_TAGS` derive `tag` and `villain.label` at runtime —
do not add those fields back to the scenario object.

---

## Step 2 — Three non-negotiable rules (check before running the auditor)

### 2a. Suit symbols — always

Use ♠ ♥ ♦ ♣ everywhere: hand arrays, board arrays, body text, feedback text,
option labels. **Never** use shorthand (KQs, 98d, T♠d). The O5 rule enforces
this for observations; the scenario auditor enforces it via card-pattern checks.

### 2b. effectiveStacks — required on every scenario

```js
effectiveStacks: 200,  // house default ($200 = 100bb at $1/$2) — omitting is an ERROR
```

Must be a number **≥ 40**. Override only when the scenario's lesson depends on
a specific depth. The auditor rule R10 (`stacks`) exits 1 if the field is
absent or below the floor, and warns if any option bet or `toCall` exceeds the
stack.

**All-in convention (sc_172 precedent):** use an amount-free seat action
(`'All-In'`) and the committed-pot convention (pot includes both live bets).
Do NOT add a separate `stacks` field carrying the total-in number — it triggers R2.

### 2c. tableContext vs body — the decision-time law

`tableContext` is the **only** field that renders at decision time (as the gold
READ line in the ticker). `body` renders only in post-session review.

**Rule:** any session-history read that influences the correct decision must
live in `tableContext`, not in `body`. The `context` WARN fires on these phrases
in `body` when `tableContext` is absent:

> `tonight` · `this session` · `all session` · `already shown` · `been caught` ·
> `his notes` · `his file` · `playbook` · `on sight` · `lately` · `all evening` ·
> `recently` · `in recent hands` · `he's been` / `he has been` ·
> `past few` / `past several` / `past couple`

```js
// CORRECT — read is visible when the player must decide
tableContext: "He's folded top pair to two check-raises tonight.",
body: "Facing a third check-raise, you can release here.",

// WRONG — grading on information that never renders (C1 failure mode)
body: "He's folded top pair to two check-raises tonight, so fold.",
```

---

## Step 3 — Pot convention

| Street | Pot field includes… |
|--------|---------------------|
| Preflop | the live raise (everything committed before decision) |
| Postflop | excludes the live bet (pot before villain's current bet) |
| Multiway postflop | includes both live bets — sc_168 precedent; do not state pot-odds ratios when multiway |

The `potpre` auditor rule recomputes the preflop pot from seat actions. Every
WARN must be reviewed manually — do not silence it without understanding it.
**It is WARN, not ERROR, because R2-flagged scenarios carry stale action
strings.** It also **silently skips** any scenario whose seat-action string it
doesn't recognize (anything outside Raises/3-Bets/4-Bets/Bets/Calls/Limps/
Folds/Active/???) — no warning fires on those, so hand-check the pot yourself
whenever you introduce a novel action string. No WARN does not mean "verified."

---

## Step 4 — Stakes and standard sizing

- `TICKER_STAKES` is hardcoded to `$1/$2 CASH · 6-MAX`. Always author at $1/$2.
- If a hand was conceived at different stakes, **scale every dollar amount
  preserving all ratios**, then flag the founder. (sc_172 precedent: $1/$3
  spec scaled to $1/$2 as 12/40/70/160.)
- Default open: **$6** (pool-wide standard). Deviate only when the lesson
  depends on a different sizing; justify it in the body.

---

## Step 5 — Feedback discipline

Feedback text must explain **WHY** (price, position, villain type, line
frequency) — never restate or dress up the action. Explanation quality is the
highest-effect-size lever in the product (ES 0.49 elaborated > 0.05 bare marks).

```js
// WRONG — restatement
fb: 'Calling here is the right play. You have good pot odds.'

// CORRECT — explains the mechanism
fb: 'At 3.5:1 you need 22% equity; AKs on a K-high board is well above that
     against this villain\'s 3-betting range, which includes bluffs.'
```

- Never use "correct" in `fb` text ("Clear fold" not "Correct fold" — sc_038 fix).
- Grade key `'correct'` is an internal engine term; it does not appear in
  user-facing copy.
- When two options share the same grade (`g`), give both the **same** `fb` text
  that reads correctly for either pick. Their `title` fields may differ.

---

## Step 6 — actionHistory (when the ticker can't derive the story)

Use `actionHistory` for: multiway pots, limp-reraise sequences, hero-first-to-act
postflop spots. Shape:

```js
actionHistory: [
  { street: 'PRE',  segments: [{ text: 'CO raises to $6' }, { text: 'you call', you: true }] },
  { street: 'FLOP', segments: [{ text: "you're first to act", you: true }] },
]
```

Rules enforced by `hist`:
- Streets in order: PRE → FLOP → TURN → RIVER.
- No row beyond the current board length.
- Every row must have at least one segment with non-empty `text`.
- Final row must be on the current street.
- The live bet amount (`toCall`) should appear in the final row's text (WARN
  if missing and the call label does not say "more").
- Hero-first-to-act postflop: final segment must be `{ text: "you're first to act", you: true }`.
- Never describe villain as "out of position" or "OOP" — the `position` rule
  reads it as a hero claim and exits 1 if seats contradict it.

---

## Step 7 — Contrast pairs

To register a new contrast pair, add it to `CONTRAST_PAIRS` in `scenarios.js`:

```js
export const CONTRAST_PAIRS = [
  [2, 84],  // both must share the same difficulty
];
```

Cross-difficulty mirrors are inert (one pool per difficulty) — document them in
a comment only, never as map entries.

---

## Step 8 — Run the gates (in this order)

```bash
npm run audit:scenarios       # fix every ERROR; review every WARN
CI=true npm test              # jest suite incl. integration tests
npm run check:invariants      # single-file ownership + 16 rules
```

If `deriveSchema` or the rating engine was touched, also run:

```bash
npm run simulate:schemas      # exits 1 on structural diagnosis bias
```

Fix every ERROR before committing. Do not silence WARNs without understanding them.

---

## Step 9 — Smoke-test in the real UI

For every new scenario, start the dev server (localStorage mode — leave
`REACT_APP_SUPABASE_*` vars blank) and play through the scenario:

- Ticker derives the correct "How you got here" text.
- Villain bubble/strip renders the right archetype label.
- Multiway pot rows display correctly.
- tableContext READ line appears (gold, above the ticker) if authored.

---

## Step 10 — Post-batch

```bash
npm run export:review         # regenerates scenario-review.csv for the SME queue
```

Run after every batch, regardless of size.

---

## Quick authoring checklist

- [ ] Used `mkScenario` / `mkHand` / `mkPositions` — no raw objects
- [ ] Suit symbols (♠♥♦♣) in hand, board, body, feedback, labels — no shorthand
- [ ] `effectiveStacks` set (200 default, override only if lesson-dependent)
- [ ] Session-history reads in `tableContext` not `body`
- [ ] Pot field matches convention for street
- [ ] Stakes at $1/$2; open $6 unless lesson-dependent
- [ ] Feedback explains WHY; no "correct" in user-facing copy
- [ ] `actionHistory` authored for multiway / limp-reraise / hero-first-to-act
- [ ] `npm run audit:scenarios` clean (ERRORs fixed, WARNs understood)
- [ ] `CI=true npm test` passes
- [ ] `npm run check:invariants` passes
- [ ] UI smoke-tested (ticker, villain, tableContext)
- [ ] `npm run export:review` run

For observations (`src/data/observations.js`): apply the same suit-symbol rule
(O5) and use `mkObservation`. Run `npm run audit:observations` (rules O1–O6)
instead of audit:scenarios.
