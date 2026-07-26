# Authoring Scenarios

Read this when adding or editing anything in `src/data/scenarios.js`.

---

## Helpers — use these, nothing else

All scenarios must be created with the three helper functions. Never add raw
object literals to the array.

```js
mkScenario({ id, difficulty, skill, villain, hand, board, pot, toCall,
             effectiveStacks, positions, options, correct, grading, body,
             question, actionHistory?, tableContext? })
mkHand(rank, suit)          // e.g. mkHand('A', '♠')
mkPositions([...])          // wraps seat objects
```

The `VILLAIN_LABELS` and `SKILL_TAGS` lookup tables derive `tag` and
`villain.label` at runtime from the `skill` and `villain` keys — do not add
those fields back to the scenario object.

---

## Ids

Legacy scenarios (the original 83) have **numeric** ids (`id: 2`). Batch
scenarios use **string** ids (`id: 'sc_172'`). Do not normalise either form;
the session builder and history rebuild key off the raw value. The auditor
pads numeric ids to three digits only for display.

---

## Suit symbols — always

Use ♠ ♥ ♦ ♣ everywhere: hand arrays, board arrays, body text, feedback text,
option labels. Never use shorthand notation (KQs, 98d, T♠d). The audit rule
`O5` in observations enforces this; the scenario auditor enforces it via
card-pattern checks in body text.

---

## Card uniqueness

Every card in `hand` + `board` must be unique. The auditor (`cards` rule)
exits 1 on duplicates. Hand-verify out-counts and draw types against the
printed board — five of the pre-July-5 grading errors hid in stated out-counts
that didn't match.

---

## Seat labels

Every non-folded seat must have a label whose first word is one of:
`UTG HJ CO BTN SB BB`. The auditor (`label` rule) exits 1 on anything else.
The UI derives the you-chip and the villain bubble from this prefix.

---

## Option structure

- `vals` must be unique within a scenario (`struct` rule).
- Exactly one option must be graded `'correct'` (`struct` rule).
- `correct` must equal one of the option `val` values (`struct` rule).
- Option **labels** display in the recommended-play row after a decision.
  Author them as the player would say them ("Call $9", "Raise to $24") — they
  are not internal keys.

---

## Pot-field convention

Street-dependent — follow the convention for each street, consistently:

| Street | Pot field includes… |
|--------|---------------------|
| Preflop | **the live raise** (everything committed before decision) |
| Postflop | **excludes** the live bet (pot before villain's current bet) |
| Multiway postflop | **includes** both live bets — sc_168 precedent ($47 pot includes bettor + cold-caller); do not state pot-odds ratios when multiway |

The auditor rule `potpre` recomputes the preflop pot from seat actions and
exits with a WARN on mismatch. It is WARN not ERROR because R2-flagged
scenarios carry stale action strings — review every hit manually.

The rule `pot` exits 1 if the body text states a dollar pot amount that
disagrees with the `pot` field.

---

## Standard open size

`$6` is the house standard preflop open at $1/$2 6-max. Use it unless the
scenario's lesson explicitly requires a different sizing (the first deviation
must be justified in the body or grading explanation). sc_011 was resized from
$15 to $6 for exactly this reason.

---

## effectiveStacks — required on every scenario

**Rule `stacks` (R10):** every scenario must carry `effectiveStacks` as a
number ≥ 40. The house default is **200** ($200 = 100bb at $1/$2). Override
only when the scenario's lesson depends on a specific depth (sc_033 = 300 for
a $220 3-bet commitment line; sc_172 uses the all-in convention — see below).

```js
effectiveStacks: 200,  // house default — omitting this is an ERROR
```

The auditor also checks that no option bet or `toCall` exceeds the stack, and
warns when the pot exceeds `2 × effectiveStacks + dead money`.

**All-in convention (sc_172 precedent):** express the all-in via the option
label (`'All-In'` as the amount-free seat action) and the committed-pot
convention — the `pot` field includes both live bets. Do not add a `stacks`
field to carry the total-in number; it would trigger R2.

---

## tableContext vs body — the decision-time law

`tableContext` is the **only** field that renders at decision time as the gold
READ line in the situation ticker. `body` renders only in **post-session
review**.

Rule: any session-history read that influences the correct decision must live
in `tableContext`, not in `body`. The auditor rule `context` issues a WARN
when `body` contains session-history phrases (`tonight`, `this session`,
`he's been`, `his file`, `lately`, etc.) and `tableContext` is absent.

```js
// CORRECT — the read is visible when the player must decide
tableContext: "He's folded top pair to two check-raises tonight.",
body: "Facing a third check-raise, you can release here.",

// WRONG — grading on information that never renders (the C1 failure mode)
body: "He's folded top pair to two check-raises tonight, so fold.",
```

Examples:
- **sc_004** — first authored `tableContext`; the archetype read lives there,
  not in `body`.
- **sc_167** — the session-history phrase ("he's checked back the scare card
  before") was in `body` only; C1 audit caught it; the fix moved it to
  `tableContext`.

When `tableContext` is present it also flows into the Coach's Read payload.

---

## Authored actionHistory

Use the `actionHistory` field when the derived ticker can't reconstruct the
full street-by-street story from the seat actions alone — multiway pots,
limp-reraise sequences, and any spot where the hero is first to act postflop.

Shape (mirrors the `SituationTicker` row shape exactly):

```js
actionHistory: [
  { street: 'PRE',  segments: [{ text: 'CO raises to $6' }, { text: 'you call', you: true }] },
  { street: 'FLOP', segments: [{ text: "you're first to act", you: true }] },
]
```

Rules enforced by the auditor (`hist` rule):

1. Streets must be in order: `PRE → FLOP → TURN → RIVER`.
2. No row may reference a street beyond the current board length.
3. Every row must have at least one segment with non-empty `text`.
4. The final row must be on the current street.
5. The live bet amount (`toCall`) should appear in the final row's text (WARN
   if missing and the call label does not say "more").

**Hero-first-to-act postflop:** when the hero acts first on a postflop street,
the final history row must include the exact phrase `"you're first to act"`
(derived from `buildTicker`) as a `{ text: "you're first to act", you: true }`
segment. Without it the ticker shows preflop context the seat actions can't
carry.

**Multi-action preflop sequences** (limp-reraise, limp-call, etc.) that can't
fit in a single seat-action string go in a `PRE` row. The auditor accepts
history ending on `PRE` for preflop scenarios.

**Never describe the villain as "out of position"** in `body`, `question`, or
`actionHistory`. The auditor's `position` rule reads any "out of position" or
"OOP" phrase as a **hero** claim and will exit 1 if the seats contradict it.
Describe position from the hero's perspective ("you have position",
"you're out of position").

---

## Check-raise seat actions

Amount-free action strings for check-raise seats:

```js
{ label: 'BB', action: 'Check-Raises', state: 'active' }
```

Omit the dollar amount. Including it would create a new R2 WARN (stale
preflop action stored on a postflop scenario). The dollar amount lives in
`toCall` and on the call option label.

---

## Grading and feedback

**Grade-level last-write-wins:** `grading` maps option `val` → `{ g, title,
fb }` where `g` is `'correct'|'partial'|'incorrect'`. The app reads
`scenario.feedback[grading[chosen].g]` — the last feedback object keyed to a
grade wins. When two options share the same grade (`g`), give both options the
same `fb` text that reads correctly for either pick. Their `title` fields may
differ.

**Why, not restatement:** feedback text must explain WHY (price, position,
villain type, line frequency) — never restate or dress up the action taken.
Explanation quality is the highest-effect-size lever in the product
(elaborated feedback ES 0.49 vs 0.05 for bare marks). A correct grade with a
weak explanation is a content defect.

```js
// WRONG — restatement
fb: 'Calling here is the right play. You have good pot odds.'

// CORRECT — explains the mechanism
fb: 'At 3.5:1 you need 22% equity; AKs on a K-high board is well above that
     against this villain\'s 3-betting range, which includes bluffs.'
```

**Honest labeling in feedback text:**

- `'Correct fold'` → `'Clear fold'` (sc_038 was the fix — "correct" overclaims
  on judgment calls).
- Never use "correct" to describe the player's action in `fb` text.
- The grade key `'correct'` is an internal engine term; it does not appear in
  user-facing copy.

**`question` field** is never displayed in gameplay. Keep it consistent with
`body` (it was the hiding place for five pre-audit grading errors), but do not
rely on it for player-facing information.

---

## Contrast pairs

Contrast pairs are authored in the `CONTRAST_PAIRS` export in `scenarios.js`:

```js
export const CONTRAST_PAIRS = [
  [2, 84],   // same-difficulty pair — dealer seats them adjacent
  ...
];
```

Rules enforced by the auditor (`pairs` rule, from `CONTRAST_PAIRS` validation):

- Every group must contain exactly **2 distinct ids**.
- Both scenarios must exist in the pool.
- Both must share the same `difficulty` — cross-difficulty pairs cannot
  co-deal (one pool per difficulty). Document cross-difficulty mirrors in a
  comment; never add them as map entries.

The session builder caps contrast pairs at 1 per session and never touches the
replay slot.

---

## Villain types

The eight villain keys (from `VILLAIN_LABELS`):
`nit | tight | passive | calling-station | loose | aggressive | maniac | unknown`

`unknown` is a valid type (sc_155 — population defaults + take notes). The UI
renders all eight safely.

---

## Preflop: live raise must be on a seat

When the hero faces a bet preflop, at least one seat must carry a raise action
(`Raises $X`, `3-Bets $X`, etc.). The auditor `pre` rule exits 1 if `toCall`
is set but no seat records the raise (the "stored as 'Active'" mistake that
caused ticker to say "folds to you" while the player faced a real bet).

---

## Authoring workflow

1. Add the scenario using `mkScenario` / `mkHand` / `mkPositions`.
2. **`npm run audit:scenarios`** — fix every ERROR before committing. Review
   every WARN (do not silence WARNs without understanding them).
3. **`CI=true npm test`** — the jest suite includes integration tests that
   confirm the pool shape and `scenarioId` load-bearing fields.
4. If `scenarios.js` or `constants.js` was touched: **`npm run audit:scenarios`**
   (already done) plus **`npm run simulate:schemas`** if `deriveSchema` was
   touched.
5. **`npm run export:review`** — regenerates `scenario-review.csv` for the SME
   queue. Run it after every batch.
6. Smoke-test the ticker and villain summary in the real UI for every new
   scenario — especially multiway pots and limp-reraise sequences.
